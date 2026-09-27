import { z } from "zod";
import { db } from "@/lib/db";
import { callLLM, LLMUnavailableError } from "@/lib/ai/client";
import { groupAbout } from "@/lib/personmd";
import { aiFileLines } from "@/lib/files";

// Hush reads the group chat on its own and notices events being planned, to-dos someone took on,
// and decisions, then posts each as a card in the chat (kind ITEM). Nobody has to talk to Hush.
// Only the group chat is read (every member can see it); private chats with Hush never are.
// Runs after a burst of messages settles (debounced per group), at most every MIN_GAP_MS.

const QUIET_MS = 3_000;
const MIN_GAP_MS = 8_000;
const WINDOW = 40;
const MIN_CONFIDENCE = 0.6;

const timers = new Map<string, NodeJS.Timeout>();
const lastRun = new Map<string, number>();
const running = new Set<string>();

/** True while Hush is about to read, or is reading, this chat (shown as a typing indicator). */
export const replying = new Set<string>(); // Hush writing a reply in this chat (lib/ai/hushchat.ts)
export const hushBusy = (circleId: string) => timers.has(circleId) || running.has(circleId) || replying.has(circleId);

/** Call after every person's message. */
export function scheduleDetect(circleId: string) {
  clearTimeout(timers.get(circleId));
  const since = Date.now() - (lastRun.get(circleId) ?? 0);
  const wait = Math.max(QUIET_MS, MIN_GAP_MS - since);
  timers.set(
    circleId,
    setTimeout(() => {
      timers.delete(circleId);
      detectNow(circleId).catch((e) => console.error("detect failed", e));
    }, wait),
  );
}

const Found = z.object({
  kind: z.enum(["EVENT", "TASK", "DECISION"]),
  title: z.string().describe("Short, e.g. 'Dinner at Mama's' or 'Book the Airbnb'. No names of who wants what."),
  startsAt: z.string().nullable().describe("ISO 8601 with UTC offset if a specific date/time was said, else null"),
  whenText: z.string().nullable().describe("How the chat said it, e.g. 'Sat around 7'"),
  place: z.string().nullable(),
  owner: z.string().nullable().describe("TASK only: the name of who said they'd do it, as written"),
  details: z.string().nullable().describe("One short neutral fact about the plan (never who wants or said what), or null"),
  confidence: z.number().min(0).max(1),
});
const Detection = z.object({
  found: z.array(Found).max(5).describe("NEW things only; nothing already in the known list"),
  updates: z
    .array(
      z.object({
        id: z.string().describe("id from the known list"),
        startsAt: z.string().nullable(),
        whenText: z.string().nullable(),
        place: z.string().nullable(),
        title: z.string().nullable(),
        status: z
          .enum(["OPEN", "DONE", "DISMISSED"])
          .nullable()
          .describe("DONE if the chat says it happened / got done; DISMISSED if the group dropped it"),
      }),
    )
    .max(5)
    .describe("Changes the chat made to known items (moved time, new place, done, dropped)"),
  followUps: z
    .array(
      z.object({
        ref: z.string().describe("'new:<index in found>' or a known id"),
        field: z.enum(["when", "place"]),
        question: z.string().describe("Short, friendly, to the whole group, e.g. 'When works for dinner tomorrow?'"),
        options: z.array(z.string()).min(2).max(3).describe("2-3 concrete, short choices, e.g. '12:30 PM', '7 PM', 'Thai on 5th'"),
      }),
    )
    .max(2)
    .describe("For an EVENT still missing a time or a place: one question to ask the group (answered privately)"),
});

const tz = "America/New_York";
const local = (d: Date) =>
  d.toLocaleString("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Read the recent chat now and post cards for anything new or changed. */
export async function detectNow(circleId: string) {
  if (running.has(circleId)) return { found: 0, updated: 0 };
  running.add(circleId);
  lastRun.set(circleId, Date.now());
  try {
    const rows = await db.groupMessage.findMany({
      where: { circleId, kind: "TEXT" },
      orderBy: { createdAt: "desc" },
      take: WINDOW,
      include: { member: { select: { name: true } } },
    });
    if (!rows.length) return { found: 0, updated: 0 };
    const circle = await db.circle.findUnique({
      where: { id: circleId },
      select: { mode: true, org: { select: { autoDetect: true } } },
    });
    if (circle?.org?.autoDetect === false) return { found: 0, updated: 0 }; // company turned it off
    const work = circle?.mode === "WORK";
    const lines = rows.reverse().map((r) => `[${local(r.createdAt)}] ${r.member?.name ?? "Someone"}: ${r.body}`);
    const known = await db.chatItem.findMany({
      where: { circleId, status: { not: "DISMISSED" } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const knownText = known.length
      ? known
          .map(
            (k) =>
              `- id=${k.id} ${k.kind} "${k.title}"${k.whenText ? ` when: ${k.whenText}` : ""}${k.place ? ` at: ${k.place}` : ""} status: ${k.status}`,
          )
          .join("\n")
      : "(none)";

    let data: z.infer<typeof Detection> | null = null;
    // One retry: the model occasionally answers with prose instead of the JSON we asked for.
    for (let attempt = 0; attempt < 2 && !data; attempt++) {
      try {
        ({ data } = await callLLM({
          task: "detect_chat_items",
          label: "Group chat: notice plans, to-dos and decisions",
          circleId,
          schema: Detection,
          reasoningEffort: attempt ? "minimal" : "low",
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                (work
                  ? "You read a work team's group chat and notice, without being asked:\n" +
                    "- EVENT: a meeting, call, review or deadline event the team is setting up (title it like 'Design review' or 'Call with Acme').\n" +
                    "- TASK: an action item someone took on or was asked to do and accepted; owner = who does it; startsAt = the due date/time if one was said.\n" +
                    "- DECISION: something the team agreed ('we'll ship Friday', 'go with vendor B').\n"
                  : "You read a group chat among friends and notice, without being asked:\n" +
                    "- EVENT: something the group is planning to do together at a time (a dinner, a trip, a game night). Include it once it's concretely proposed, even if not everyone agreed yet.\n" +
                    "- TASK: someone clearly took on a job ('I'll book it', 'can you grab tickets?' 'sure').\n" +
                    "- DECISION: the group settled something ('ok we're doing Italian').\n") +
                "Ignore small talk, jokes, hypotheticals and things only one person mentioned in passing. " +
                "PRIVACY: never write who wants, prefers, agreed to or can't do something; titles and details must be neutral " +
                "(e.g. 'Go out for food', not 'Sam wants food'). For EVENTs missing a time or place, add a followUp question " +
                "with 2-3 concrete options that fit what the chat said. " +
                "Never invent details that weren't said. Don't repeat anything in the known list; if the chat changed a known item " +
                "(new time/place, it happened, it was dropped), put that in updates with its id. " +
                `Times: the group is in ${tz}; the current time is ${local(new Date())}. Resolve 'Saturday', 'tomorrow 7' etc. ` +
                "to a full ISO 8601 date-time with offset when the chat gives enough to do so. confidence is 0 to 1.",
            },
            {
              role: "user",
              content: `${await groupAbout(circleId)}\n\nKnown items:\n${knownText}\n\nChat (oldest first):\n${lines.join("\n")}${(await aiFileLines(circleId)).map((f) => `\n${f}`).join("")}`,
            },
          ],
        }));
      } catch (e) {
        if (!(e instanceof LLMUnavailableError)) console.error("detect llm failed", e);
      }
    }
    if (!data) return { found: 0, updated: 0 };

    const parseDate = (s: string | null) => {
      if (!s) return null;
      const d = new Date(s);
      return isNaN(+d) ? null : d;
    };

    // Safety net: drop any note that names a member (it could reveal who wants what).
    const names = (await db.member.findMany({ where: { circleId }, select: { name: true } }))
      .map((m) => m.name.trim().toLowerCase())
      .filter((n) => n.length >= 2);
    const namesAnyone = (t: string | null) =>
      !!t && names.some((n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t));
    const newIds: string[] = [];

    let found = 0;
    for (const f of data.found) {
      if (f.confidence < MIN_CONFIDENCE || !f.title.trim()) continue;
      // Belt and braces against repeats: same kind + same title (case-insensitive) already open.
      const dup = known.find((k) => k.kind === f.kind && k.title.trim().toLowerCase() === f.title.trim().toLowerCase());
      if (dup) continue;
      const item = await db.chatItem.create({
        data: {
          circleId,
          kind: f.kind,
          title: f.title.trim().slice(0, 80),
          startsAt: parseDate(f.startsAt),
          whenText: f.whenText?.slice(0, 80) ?? null,
          place: f.place?.slice(0, 120) ?? null,
          owner: f.kind === "TASK" ? (f.owner?.slice(0, 40) ?? null) : null,
          details: namesAnyone(f.details) ? null : (f.details?.slice(0, 200) ?? null),
        },
      });
      newIds.push(item.id);
      // A plan: Hush takes it private right away (each person's Hush chat), and the card comes back
      // to the group only once everyone has confirmed. To-dos and decisions are pinned right away.
      const { autoPlan } = await import("@/lib/checkin");
      const started = f.kind === "EVENT" ? await autoPlan(circleId, item.id, "Hush noticed the group making a plan") : null;
      if (!started)
        await db.groupMessage.create({
          data: { circleId, kind: "ITEM", body: "new", itemId: item.id },
        });
      found++;
    }

    let updated = 0;
    for (const u of data.updates) {
      const k = known.find((x) => x.id === u.id);
      if (!k) continue;
      const patch: Record<string, unknown> = {};
      const when = parseDate(u.startsAt);
      if (when && +when !== +(k.startsAt ?? 0)) patch.startsAt = when;
      if (u.whenText && u.whenText !== k.whenText) patch.whenText = u.whenText.slice(0, 80);
      if (u.place && u.place !== k.place) patch.place = u.place.slice(0, 120);
      if (u.title && u.title !== k.title) patch.title = u.title.slice(0, 80);
      if (u.status && u.status !== k.status) patch.status = u.status;
      if (!Object.keys(patch).length) continue;
      await db.chatItem.update({ where: { id: k.id }, data: patch });
      // A fresh card so everyone sees the change, unless it was just dropped.
      if (patch.status !== "DISMISSED")
        await db.groupMessage.create({
          data: { circleId, kind: "ITEM", body: "updated", itemId: k.id },
        });
      updated++;
    }
    // Follow-up questions no longer go to the group: the private planning session asks them.
    void data.followUps;
    return { found, updated };
  } finally {
    running.delete(circleId);
  }
}
