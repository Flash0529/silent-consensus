import type { Member, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { callLLM, LLMUnavailableError, type CallArgs } from "@/lib/ai/client";
import { anonymousMd, groupAbout, personMd, rememberFacts } from "@/lib/personmd";
import { freeSlots, groupZone, myFreeSummary, slotLabel } from "@/lib/calendar";
import { areaName, bookingLinks, geocode, middle, round } from "@/lib/places";
import { findVenues, venueKindOf, type Venue } from "@/lib/findplaces";
import { budgetCents, readRoomStyle, readStyle, roomVoice, voiceFor } from "@/lib/hushstyle";
import { helpersFor, myMoney, setupShares } from "@/lib/chipin";
import { stripeEnabled } from "@/lib/stripe";
import { clip, clipOrNull } from "@/lib/text";

// Planning sessions: the moment Hush starts planning, everything moves to each person's private
// Hush chat, and stays there until the plan is final.
//
//   Group chat: "Looks like you're planning X. I'll sort it out with each of you privately." + a
//   progress card. That's all the group sees until the end.
//
//   Each person's Hush chat:
//     1. Can you make it?                       (asked once, at the start)
//     2. A few details, only what's needed      (times, preferences, where you're coming from, budget)
//     3. "Thanks, I'll show you the plan here"  (you stay in the Hush chat)
//     4. The plan (every part, with real places / events and links). Look right?   (asked once, at the end)
//     5. Everyone confirmed → posted to the group, you're sent back, chip-in and pay if it costs money.
//
//   "Plan event" (organizer describes it first) starts at INTAKE; otherwise Hush starts on its own when
//   it notices a plan in the chat, or when a plan is getting stuck.
//
// Privacy: each prompt sees only its own person's profile; group-level decisions see everyone's
// answers with names hidden (P1, P2, …) and the result is name-checked before anyone sees it.

const MAX_DETAIL_QUESTIONS = 3;
const MAX_REVISIONS = 2;
const topicOf = (id: string) => `ci:${id}`;

export type Part = {
  label: string;
  kind: "food" | "activity" | "event" | "other";
  startsAt: string | null;
  whenText: string | null;
  place: string | null;
  address: string | null;
  why: string | null;
  costCents: number | null;
  links: { resy: string | null; opentable: string | null; tickets: string | null; website: string | null; maps: string } | null;
  venue: Venue | null;
};
export type Proposal = { title: string; summary: string; verdict: "WORKS" | "PARTIAL" | "NO_TIME"; parts: Part[]; costCents: number | null };

export type Card =
  | { card: "intake" }
  | { card: "attend" }
  | { card: "sitout" }
  | { card: "details" }
  | { card: "location" }
  | { card: "budget" }
  | { card: "wait" }
  | { card: "confirm"; proposal: Proposal }
  | { card: "fyi"; proposal: Proposal }
  | { card: "change" }
  | { card: "final"; slug: string; proposal: Proposal }
  | { card: "chipin"; itemId: string; suggestCents: number }
  | { card: "pay"; itemId: string; cents: number };

async function say(memberId: string, topic: string, content: string, options: string[] = [], card?: Card) {
  return db.message.create({
    data: {
      memberId,
      role: "HUSH",
      kind: options.length ? "OPTIONS" : "TEXT",
      content: clip(content, 1500),
      options: options.length ? options.slice(0, 5) : undefined,
      chips: card ? (card as unknown as Prisma.InputJsonValue) : undefined,
      topic,
    },
  });
}
const heard = (memberId: string, topic: string, content: string) => db.message.create({ data: { memberId, role: "MEMBER", kind: "TEXT", content: clip(content, 1500), topic } });

/** Model call with one retry (the model sometimes answers in prose instead of JSON). */
async function llm<S extends z.ZodType>(args: CallArgs<S>): Promise<z.infer<S> | null> {
  for (let i = 0; i < 2; i++) {
    try {
      return (await callLLM({ ...args, reasoningEffort: i ? "minimal" : (args.reasoningEffort ?? "low") })).data;
    } catch (e) {
      if (!(e instanceof LLMUnavailableError)) console.error(`${args.task} failed`, e);
    }
  }
  return null;
}

const first = (n: string) => n.split(" ")[0];
/** Slow work (building the plan, posting it) runs after the reply that triggered it is saved. */
const bg = (fn: () => Promise<unknown>) => setTimeout(() => void fn().catch((e) => console.error("planning step failed", e)), 0);
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const nameRe = (n: string) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

// ---------------------------------------------------------------------------------------------
// Starting
// ---------------------------------------------------------------------------------------------

/** The session that's running in this chat right now, if any. */
export const openSession = (circleId: string) =>
  db.hushCheckIn.findFirst({ where: { circleId, status: "OPEN", createdAt: { gt: new Date(Date.now() - 3 * 864e5) } }, orderBy: { createdAt: "desc" } });

/**
 * Start planning privately with everyone. Returns the session id, or null when one is already running.
 * `organizerId` + `intake` = someone pressed "Plan event": they describe it to Hush first.
 */
export async function startSession(
  circleId: string,
  opts: { itemId?: string | null; reason: string; brief?: string | null; organizerId?: string | null; intake?: boolean },
) {
  if (await openSession(circleId)) return null;
  const members = await db.member.findMany({ where: { circleId, accountId: { not: null } }, orderBy: { createdAt: "asc" } });
  if (!members.length) return null;
  const s = await db.hushCheckIn.create({
    data: {
      circleId,
      itemId: opts.itemId ?? null,
      reason: opts.reason,
      brief: clipOrNull(opts.brief, 400),
      organizerId: opts.organizerId ?? null,
      stage: opts.intake ? "INTAKE" : "ASKING",
      replies: { create: members.map((m) => ({ memberId: m.id })) },
    },
  });
  // Group questions about this plan are replaced by the private session.
  if (opts.itemId) await db.hushAsk.updateMany({ where: { itemId: opts.itemId, status: "OPEN" }, data: { status: "CLOSED" } });
  try {
    await begin(s.id, circleId, opts);
  } catch (e) {
    // Never leave a half-started plan behind (it would block new plans and ask nobody anything).
    console.error("starting a plan failed; rolled back", e);
    await db.hushCheckIn.delete({ where: { id: s.id } }).catch(() => {});
    await db.groupMessage.deleteMany({ where: { circleId, kind: "CHECKIN", body: s.id } }).catch(() => {});
    return null;
  }
  return s.id;
}

async function begin(sessionId: string, circleId: string, opts: { organizerId?: string | null; intake?: boolean }) {
  const s = { id: sessionId };
  if (opts.intake && opts.organizerId) {
    const circle = await db.circle.findUniqueOrThrow({ where: { id: circleId }, select: { title: true, isDirect: true } });
    await say(
      opts.organizerId,
      topicOf(s.id),
      `Let's plan something for ${circle.isDirect ? "you two" : circle.title}. What are you thinking? Tell me like you'd tell a friend: what, roughly when, and anything that matters. I'll handle the rest privately with everyone.`,
      ["Dinner out", "Concert, then food", "Game night", "Weekend trip", "Coffee catch-up"],
      { card: "intake" },
    );
    return;
  }
  await announce(s.id);
}
export const startCheckIn = (circleId: string, itemId: string | null, reason: string) => startSession(circleId, { itemId, reason });
export const findTimesAsk = (circleId: string, itemId: string | null) => startSession(circleId, { itemId, reason: "The group wants to find another day that works" });

async function titleOf(sessionId: string) {
  const s = await db.hushCheckIn.findUniqueOrThrow({ where: { id: sessionId }, include: { item: true } });
  return { s, title: s.item?.title ?? (s.brief ? clip(s.brief.split("\n")[0], 60) : "the plan") };
}

/** Tell the group (one line + progress card) and send everyone their first private question. */
async function announce(sessionId: string) {
  const { s, title } = await titleOf(sessionId);
  const organizer = s.organizerId ? await db.member.findUnique({ where: { id: s.organizerId }, select: { name: true } }) : null;
  const room = readRoomStyle((await db.circle.findUnique({ where: { id: s.circleId }, select: { hushStyle: true } }))?.hushStyle);
  await db.groupMessage.create({
    data: {
      circleId: s.circleId,
      kind: "HUSH",
      body: organizer
        ? `${organizer.name} wants to plan “${title}”. I'll work out the details with each of you privately. Check your ${room.botName} chat.`
        : `Looks like you're planning “${title}”. I'll work out the details with each of you privately, so check your ${room.botName} chat. Only the final plan comes back here.`,
    },
  });
  await db.groupMessage.create({ data: { circleId: s.circleId, kind: "CHECKIN", body: s.id } });
  const members = await db.member.findMany({ where: { id: { in: (await db.hushCheckInReply.findMany({ where: { checkInId: s.id } })).map((r) => r.memberId) } } });
  for (const m of members) {
    if (m.id === s.organizerId) continue; // they already told Hush; they carry on in their chat
    await askAttendance(s.id, m, organizer?.name ?? null, title, s.item ? whenOf(s.item) : null);
  }
}

function whenOf(i: { startsAt: Date | null; whenText: string | null }) {
  return i.startsAt ? slotLabel(i.startsAt, "America/New_York") : i.whenText;
}

async function askAttendance(sessionId: string, m: Member, organizer: string | null, title: string, when: string | null) {
  const who = organizer ? `${organizer} is planning` : "Your group is planning";
  await say(m.id, topicOf(sessionId), `Hey ${first(m.name)}! ${who} “${title}”${when ? ` (${when})` : ""}. Can you make it?`, ["I'm in", "Maybe", "Can't make it"], {
    card: "attend",
  });
}

// ---------------------------------------------------------------------------------------------
// The private Hush chat (one chat, across all your groups)
// ---------------------------------------------------------------------------------------------

/** Everything in your Hush chat, across all your groups, oldest first. */
export async function hushThread(accountId: string) {
  const mems = await db.member.findMany({ where: { accountId }, select: { id: true, circle: { select: { slug: true, title: true, isDirect: true, members: { select: { id: true, name: true } } } } } });
  const byId = new Map(mems.map((m) => [m.id, m]));
  const label = (m: (typeof mems)[number]) => (m.circle.isDirect ? (m.circle.members.find((x) => x.id !== m.id)?.name ?? "DM") : m.circle.title);
  const rows = await db.message.findMany({
    where: { memberId: { in: mems.map((m) => m.id) }, OR: [{ topic: "dm" }, { topic: { startsWith: "ci:" } }] },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const waiting = await db.hushCheckInReply.findMany({
    where: { memberId: { in: mems.map((m) => m.id) }, checkIn: { status: "OPEN" } },
    include: { checkIn: { select: { id: true, stage: true, organizerId: true } } },
  });
  const pending = waiting.filter((w) => needsMe(w, w.checkIn)).map((w) => byId.get(w.memberId)!.circle.slug);
  const acct = await db.account.findUnique({ where: { id: accountId }, select: { hushStyle: true } });
  const style = readStyle(acct?.hushStyle);
  return {
    bot: { name: style.botName || "Hush", color: style.color },
    messages: rows.reverse().map((m) => {
      const mem = byId.get(m.memberId)!;
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        options: (m.options as string[] | null) ?? null,
        card: m.chips && !Array.isArray(m.chips) ? (m.chips as unknown as Card) : null,
        createdAt: m.createdAt,
        slug: mem.circle.slug,
        group: label(mem),
      };
    }),
    groups: mems.map((m) => ({ slug: m.circle.slug, title: label(m) })),
    pending,
  };
}

type ReplyRow = { status: string; attending: string | null; confirm: string | null; memberId: string };
function needsMe(r: ReplyRow, s: { stage: string; organizerId: string | null }) {
  if (s.stage === "INTAKE") return s.organizerId === r.memberId;
  if (s.stage === "ASKING") return r.status === "ASKING";
  if (s.stage === "CONFIRMING") return r.attending !== "OUT" && !r.confirm;
  return false;
}

/** Has Hush got a question waiting for you in this group? (chat list badge / auto-open) */
export async function waitingOnMe(memberId: string) {
  const r = await db.hushCheckInReply.findFirst({ where: { memberId, checkIn: { status: "OPEN" } }, include: { checkIn: true } });
  return !!r && needsMe(r, r.checkIn);
}

/** First visit with nothing going on: a hello (no model call). */
export async function ensureDmHello(member: Member) {
  const any = await db.message.count({ where: { memberId: member.id, OR: [{ topic: "dm" }, { topic: { startsWith: "ci:" } }] } });
  if (any) return;
  const circle = await db.circle.findUnique({ where: { id: member.circleId }, select: { title: true } });
  await say(
    member.id,
    "dm",
    `Hey ${first(member.name)}, this is our private chat about ${circle?.title ?? "this group"}. Nothing you tell me here is shared. When your group plans something, I'll ask you here and show you the plan before it goes to the group.`,
  );
}

export type TurnInput = { text?: string; optionIndex?: number; lat?: number; lng?: number };

/** One message from you in your Hush chat (for one group). Returns what the page should do next. */
export async function hushTurn(member: Member, input: TurnInput): Promise<{ back?: string; error?: string }> {
  const r = await db.hushCheckInReply.findFirst({
    where: { memberId: member.id, checkIn: { status: "OPEN" } },
    include: { checkIn: true },
    orderBy: { at: "desc" },
  });
  const s = r?.checkIn;
  const topic = s ? topicOf(s.id) : "dm";
  const last = await db.message.findFirst({ where: { memberId: member.id, role: "HUSH", topic }, orderBy: { createdAt: "desc" } });
  const card = (last?.chips && !Array.isArray(last.chips) ? (last.chips as unknown as Card) : null)?.card ?? null;
  const opts = (last?.options as string[] | null) ?? [];
  let text = input.text?.trim() ?? "";
  if (input.optionIndex !== undefined) text = opts[input.optionIndex] ?? text;
  if (input.lat !== undefined && input.lng !== undefined) text = text || "📍 Shared my location";
  if (!text) return { error: "Say something to Hush first." };
  await heard(member.id, topic, text);

  if (!s || !r || !needsMe(r, s)) {
    await freeChat(member, text);
    return {};
  }
  if (s.stage === "INTAKE") return intakeTurn(s.id, member, text);
  if (s.stage === "ASKING") return askingTurn(s.id, member, card, text, input);
  if (s.stage === "CONFIRMING") return confirmTurn(s.id, member, card, text);
  return {};
}

// ---------- INTAKE: the organizer describes the plan ----------

const Intake = z.object({
  reply: z.string().describe("Your next message to the organizer. If done: a short 'Got it, I'll check with everyone privately.' Otherwise ONE short question."),
  done: z.boolean().describe("true once you know what the plan is (roughly what + roughly when). Don't over-ask; 1-2 questions max."),
  title: z.string().describe("Short plan title, e.g. 'Concert + dinner' or 'Game night'"),
  parts: z
    .array(z.object({ label: z.string(), kind: z.enum(["food", "activity", "event", "other"]), when: z.string().nullable() }))
    .max(4)
    .describe("The parts of the plan in order, e.g. [concert (event), food after (food)]"),
  when: z.string().nullable().describe("Roughly when, as they said it"),
  notes: z.string().nullable().describe("Anything else they said that matters (budget, vibe, area)"),
});

async function intakeTurn(sessionId: string, member: Member, _text: string) {
  const topic = topicOf(sessionId);
  const history = await db.message.findMany({ where: { memberId: member.id, topic }, orderBy: { createdAt: "asc" } });
  const acct = member.accountId ? await db.account.findUnique({ where: { id: member.accountId }, select: { hushStyle: true } }) : null;
  const tz = await groupZone(member.circleId);
  const asked = history.filter((h) => h.role === "HUSH").length;
  const t = await llm({
    task: "plan_intake",
    label: "Plan event: organizer describes it",
    circleId: member.circleId,
    schema: Intake,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content:
          `You are Hush, privately helping ${member.name} set up a plan for their group. ${voiceFor(readStyle(acct?.hushStyle))} ` +
          `The current time is ${slotLabel(new Date(), tz)} (${tz}). Find out what they want to do (it can have several parts, like a concert then food) and roughly when. ` +
          "Don't ask about budget, places or everyone's availability: you'll check those with everyone privately." +
          (asked >= 3 ? " You've asked enough: set done=true now." : ""),
      },
      ...history.map((h) => ({ role: h.role === "HUSH" ? ("assistant" as const) : ("user" as const), content: h.content })),
    ],
  });
  if (!t) {
    await say(member.id, topic, "Sorry, I'm having trouble thinking right now. Tell me again in a moment?");
    return {};
  }
  if (!t.done && asked < 3) {
    await say(member.id, topic, t.reply, [], { card: "intake" });
    return {};
  }
  // Make (or update) the plan card, then check in with everyone.
  const s = await db.hushCheckIn.findUniqueOrThrow({ where: { id: sessionId } });
  const parts = t.parts.map((p) => ({ label: p.label, kind: p.kind, startsAt: null, whenText: p.when, place: null, address: null, why: null, costCents: null, links: null, venue: null }));
  const itemData = {
    title: clip(t.title, 80),
    whenText: clipOrNull(t.when, 80),
    details: clipOrNull(t.notes, 200),
    parts: parts as unknown as Prisma.InputJsonValue,
  };
  const item = s.itemId
    ? await db.chatItem.update({ where: { id: s.itemId }, data: itemData })
    : await db.chatItem.create({ data: { circleId: member.circleId, kind: "EVENT", ...itemData } });
  const brief = `${t.title}. ${t.parts.map((p) => `${p.label}${p.when ? ` (${p.when})` : ""}`).join(", then ")}.${t.notes ? ` Notes: ${t.notes}` : ""}`;
  await db.hushCheckIn.update({ where: { id: sessionId }, data: { stage: "ASKING", itemId: item.id, brief } });
  await db.hushCheckInReply.update({ where: { checkInId_memberId: { checkInId: sessionId, memberId: member.id } }, data: { attending: "IN" } });
  await say(member.id, topic, t.reply || "Got it! I'll check with everyone privately.");
  await announce(sessionId);
  await nextStep(sessionId, member);
  return {};
}

// ---------- ASKING: can you make it? + details ----------

const YES = /\b(in|yes|yeah|yep|down|sure|i can|count me|definitely|absolutely|works)\b/i;
const NO = /\b(can'?t|cannot|no|nope|busy|out|pass|won'?t|skip)\b/i;
const MAYBE = /\b(maybe|might|not sure|possibly|depends|idk)\b/i;

async function askingTurn(sessionId: string, member: Member, card: string | null, text: string, input: TurnInput) {
  const topic = topicOf(sessionId);
  const key = { checkInId_memberId: { checkInId: sessionId, memberId: member.id } };

  if (card === "attend") {
    const attending = MAYBE.test(text) ? "MAYBE" : NO.test(text) && !YES.test(text.replace(/can'?t make it/i, "")) ? "OUT" : YES.test(text) ? "IN" : "MAYBE";
    await db.hushCheckInReply.update({ where: key, data: { attending } });
    if (attending === "OUT") {
      await say(member.id, topic, "No problem, and nobody needs a reason. Would a different day or time work for you?", ["Yes, another time could work", "No, I'll sit this one out"], {
        card: "sitout",
      });
      return {};
    }
    return nextStep(sessionId, member);
  }
  if (card === "sitout") {
    if (/\bno\b|sit (this|it) out|pass/i.test(text)) {
      await db.hushCheckInReply.update({ where: key, data: { status: "DONE" } });
      await say(member.id, topic, "All good. I'll let you know what the group decides. Nothing about this is shared.");
      bg(() => maybeAnalyze(sessionId));
      return {};
    }
    await db.hushCheckInReply.update({ where: key, data: { attending: "MAYBE" } });
    const r = await db.hushCheckInReply.findUniqueOrThrow({ where: key });
    await db.hushCheckInReply.update({ where: key, data: { summary: { ...((r.summary as object) ?? {}), flexibleTime: true } } });
    return nextStep(sessionId, member);
  }
  if (card === "location") {
    let at: { lat: number; lng: number } | null = null;
    if (input.lat !== undefined && input.lng !== undefined) at = { lat: round(input.lat), lng: round(input.lng) };
    else if (/\b(skip|rather not|no thanks|nah)\b/i.test(text)) {
      const r = await db.hushCheckInReply.findUniqueOrThrow({ where: key });
      await db.hushCheckInReply.update({ where: key, data: { summary: { ...((r.summary as object) ?? {}), locationSkipped: true } } });
      return nextStep(sessionId, member);
    } else {
      const g = await geocode(text).catch(() => null);
      if (g) at = { lat: g.lat, lng: g.lng };
    }
    if (!at) {
      await say(member.id, topic, "I couldn't find that. Try a ZIP code or “City, ST”, or tap Share my location. (Or say skip.)", [], { card: "location" });
      return {};
    }
    await db.hushCheckInReply.update({ where: key, data: { lat: at.lat, lng: at.lng } });
    return nextStep(sessionId, member);
  }
  if (card === "budget") {
    const n = text.match(/\$?\s?(\d{1,4})/g)?.map((x) => Number(x.replace(/\D/g, ""))) ?? [];
    const cents = /no (limit|worries)|not a worry|whatever|any/i.test(text) ? -1 : n.length ? Math.max(...n) * 100 : -1;
    await db.hushCheckInReply.update({ where: key, data: { budgetCents: cents > 0 ? cents : null } });
    const r = await db.hushCheckInReply.findUniqueOrThrow({ where: key });
    await db.hushCheckInReply.update({ where: key, data: { summary: { ...((r.summary as object) ?? {}), budgetAsked: true } } });
    return nextStep(sessionId, member);
  }
  // Details (or anything free-form): the model asks what's still needed.
  return nextStep(sessionId, member, true);
}

const Detail = z.object({
  reply: z.string().describe("If done: short thanks. Otherwise ONE short question (they can tap an option or type)."),
  options: z.array(z.string()).max(4).describe("2-4 short tap answers for your question (concrete days/times/choices). Empty when done."),
  done: z.boolean().describe("true when you know enough from them (or nothing more is needed). Ask at most 3 questions."),
  summary: z.object({
    works: z.string().describe("When/what works for them, concretely ('' if not discussed)"),
    avoid: z.string().nullable(),
    preferences: z.string().nullable().describe("Their preferences for the plan's parts (genre, cuisine, vibe). 'anything works' = flexible"),
    notes: z.string().nullable(),
  }),
  remember: z.array(z.string()).max(3).describe("NEW lasting facts about them worth remembering (not already in their notes). Empty if none."),
});

/** Ask the next thing this person needs to answer, or finish their part. */
async function nextStep(sessionId: string, member: Member, afterAnswer = false) {
  const topic = topicOf(sessionId);
  const key = { checkInId_memberId: { checkInId: sessionId, memberId: member.id } };
  const s = await db.hushCheckIn.findUniqueOrThrow({ where: { id: sessionId }, include: { item: true } });
  const r = await db.hushCheckInReply.findUniqueOrThrow({ where: key });
  const sum = (r.summary as Record<string, unknown> | null) ?? {};
  const acct = member.accountId ? await db.account.findUnique({ where: { id: member.accountId }, select: { hushStyle: true, timeZone: true } }) : null;
  const style = readStyle(acct?.hushStyle);
  const parts = ((s.item?.parts as unknown as Part[] | null) ?? []).map((p) => p.label).join(", ");
  const planText = `${s.item?.title ?? s.brief ?? "a plan"}${parts ? ` (${parts})` : ""}${s.item?.whenText ? `, ${s.item.whenText}` : ""}`;

  // 1) details, by the model (only what's needed)
  if (!sum.detailsDone) {
    const history = await db.message.findMany({ where: { memberId: member.id, topic }, orderBy: { createdAt: "asc" }, take: 40 });
    const detailQs = history.filter((h) => h.role === "HUSH" && (h.chips as { card?: string } | null)?.card === "details").length;
    let d: z.infer<typeof Detail> | null = null;
    if (detailQs < MAX_DETAIL_QUESTIONS) {
      const tz = acct?.timeZone ?? (await groupZone(member.circleId));
      const md = member.accountId ? await personMd(member.accountId) : "";
      const cal = member.accountId ? await myFreeSummary(member.accountId, tz).catch(() => null) : null;
      d = await llm({
        task: "plan_details",
        label: "Planning: private details",
        circleId: member.circleId,
        schema: Detail,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              `You are Hush, talking PRIVATELY with ${member.name}. ${voiceFor(style)} Nothing here is shown to anyone; the group only sees the final plan, with no names. ` +
              `Never ask why they can or can't do something. The current time is ${slotLabel(new Date(), tz)} (${tz}).\n\n` +
              `What you know about them:\n${md}\n` +
              (cal ? `\nTheir calendar (free/busy only):\n${cal}\n` : "") +
              `\nThe group is planning: ${planText}. ${s.reason}.` +
              (sum.flexibleTime ? " They can't make the proposed time but another time could work: find out when." : "") +
              ` They said they're ${r.attending === "MAYBE" ? "a maybe" : "in"}.\n` +
              "Ask ONLY what you still need to plan it well: when works (if not settled), and their preference for each part (e.g. genre, cuisine), unless their profile already answers it. " +
              "Don't ask about budget or where they're coming from (that's asked separately). If nothing is needed, set done=true right away.",
          },
          ...history
            .filter((h) => (h.chips as { card?: string } | null)?.card !== "attend" || h.role !== "HUSH")
            .slice(-12)
            .map((h) => ({ role: h.role === "HUSH" ? ("assistant" as const) : ("user" as const), content: h.content })),
          ...(afterAnswer ? [] : [{ role: "user" as const, content: "(Ask your first detail question now, or set done=true if nothing is needed.)" }]),
        ],
      });
    }
    if (d) {
      await db.hushCheckInReply.update({ where: key, data: { summary: { ...sum, ...d.summary }, turns: { increment: 1 } } });
      if (member.accountId && d.remember.length) await rememberFacts(member.accountId, d.remember);
    }
    if (d && !d.done && detailQs < MAX_DETAIL_QUESTIONS) {
      await say(member.id, topic, d.reply, d.options, { card: "details" });
      return {};
    }
    const fresh = await db.hushCheckInReply.findUniqueOrThrow({ where: key });
    await db.hushCheckInReply.update({ where: key, data: { summary: { ...((fresh.summary as object) ?? {}), detailsDone: true } } });
  }

  // 2) where they're coming from, if the plan needs a real place
  const kinds = ((s.item?.parts as unknown as Part[] | null) ?? []).map((p) => p.kind);
  const needsPlace = kinds.some((k) => k !== "other") || !!venueKindOf(`${s.item?.title ?? ""} ${s.item?.details ?? ""} ${s.brief ?? ""}`);
  const r2 = await db.hushCheckInReply.findUniqueOrThrow({ where: key });
  const sum2 = (r2.summary as Record<string, unknown> | null) ?? {};
  if (needsPlace && r2.lat === null && !sum2.locationSkipped && !s.item?.place) {
    await say(member.id, topic, "Where will you be coming from? Tap Share my location, or type a city or ZIP. Only I see it, rounded to about a kilometer, and I'll find somewhere in the middle for everyone.", [], {
      card: "location",
    });
    return {};
  }

  // 3) budget, if it'll cost money and we don't know their comfort level
  const costly = kinds.some((k) => k === "food" || k === "event") || /\b(dinner|lunch|brunch|concert|tickets?|show|game|trip|restaurant)\b/i.test(planText);
  const knowsBudget = !!acct?.hushStyle || r2.budgetCents !== null || sum2.budgetAsked;
  if (costly && !knowsBudget) {
    await say(member.id, topic, "What's comfortable to spend on this, all in? Totally private: it just helps me pick places that work for everyone.", ["Under $15", "$15 to $30", "$30 to $60", "No limit"], {
      card: "budget",
    });
    return {};
  }
  if (r2.budgetCents === null && acct?.hushStyle) await db.hushCheckInReply.update({ where: key, data: { budgetCents: budgetCents(style) } });

  // 4) done: stay here until the plan is ready
  await db.hushCheckInReply.update({ where: key, data: { status: "DONE" } });
  await say(member.id, topic, "That's everything, thanks! Stay here: once everyone's answered I'll show you the whole plan before anything goes to the group.", [], { card: "wait" });
  bg(() => maybeAnalyze(sessionId));
  return {};
}

// ---------------------------------------------------------------------------------------------
// Everyone's answered: build the plan (real places / events), then everyone confirms once
// ---------------------------------------------------------------------------------------------

export async function maybeAnalyze(sessionId: string) {
  const s = await db.hushCheckIn.findUnique({ where: { id: sessionId }, include: { replies: true } });
  if (!s || s.status !== "OPEN" || s.stage !== "ASKING") return;
  if (s.replies.length && s.replies.every((r) => r.status === "DONE")) await buildPlan(sessionId);
}

/** "Continue without the rest": plan with whoever has answered (someone went quiet). */
export async function continueWithoutRest(sessionId: string) {
  const s = await db.hushCheckIn.findUnique({ where: { id: sessionId }, include: { replies: true } });
  if (!s || s.status !== "OPEN") return false;
  if (s.stage === "ASKING") {
    await db.hushCheckInReply.updateMany({ where: { checkInId: sessionId, status: "ASKING" }, data: { status: "DONE" } });
    await buildPlan(sessionId);
    return true;
  }
  if (s.stage === "CONFIRMING") {
    await db.hushCheckInReply.updateMany({ where: { checkInId: sessionId, confirm: null, NOT: { attending: "OUT" } }, data: { confirm: "YES" } });
    await maybeFinalize(sessionId);
    return true;
  }
  return false;
}

const PlanOut = z.object({
  title: z.string(),
  summary: z.string().describe("One or two sentences for everyone. No names, nothing anyone said privately."),
  verdict: z.enum(["WORKS", "PARTIAL", "NO_TIME"]).describe("WORKS if it works for everyone; NO_TIME if no realistic time works for everyone going"),
  parts: z
    .array(
      z.object({
        label: z.string().describe("e.g. 'Concert' or 'Dinner after'"),
        kind: z.enum(["food", "activity", "event", "other"]),
        startsAt: z.string().nullable().describe("ISO 8601 with offset when you can pick a real time"),
        whenText: z.string().nullable(),
        search: z.string().nullable().describe("What to search for this part: 'jazz concert', 'ramen', 'bowling'. null for 'other'"),
      }),
    )
    .min(1)
    .max(4),
});

const PRICE: Record<string, number> = { $: 1500, $$: 3000, $$$: 6000, $$$$: 10000 };

async function buildPlan(sessionId: string, changes: string[] = []) {
  const claimed = await db.hushCheckIn.updateMany({ where: { id: sessionId, stage: { in: ["ASKING", "CONFIRMING"] } }, data: { stage: "PLANNING" } });
  if (!claimed.count) return;
  const s = await db.hushCheckIn.findUniqueOrThrow({
    where: { id: sessionId },
    include: { item: true, circle: { select: { mode: true, title: true } }, replies: { include: { member: { select: { name: true, accountId: true } } } } },
  });
  const going = s.replies.filter((r) => r.attending !== "OUT");
  if (!going.length) {
    await db.hushCheckIn.update({ where: { id: sessionId }, data: { stage: "DONE", status: "DONE", doneAt: new Date(), verdict: "NO_TIME" } });
    await db.groupMessage.create({ data: { circleId: s.circleId, kind: "HUSH", body: `“${s.item?.title ?? "This plan"}” won't work out this time. Say the word when you want to try again.` } });
    return;
  }
  const tz = await groupZone(s.circleId);
  const work = s.circle.mode === "WORK";
  const slots = await freeSlots(s.circleId, { work, days: 14 }).catch(() => ({ checked: 0, total: 0, slots: [] as { start: string; label: string }[] }));
  const people = await Promise.all(
    s.replies.map(async (r, i) => {
      const label = `P${i + 1}`;
      const md = r.member.accountId ? await anonymousMd(r.member.accountId, label) : `# ${label}`;
      return `${md}## In this plan\n- Going: ${r.attending ?? "didn't answer"}\n- Said: ${JSON.stringify(r.summary ?? {})}`;
    }),
  );
  const names = s.replies.map((r) => r.member.name);
  const plan = await llm({
    task: "plan_build",
    label: "Planning: build the plan everyone can say yes to",
    circleId: s.circleId,
    schema: PlanOut,
    reasoningEffort: "medium",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          `You are Hush, planning for a ${work ? "work team" : "friend group"} called "${s.circle.title}". The current time is ${slotLabel(new Date(), tz)} (${tz}). ` +
          `What they're planning: ${s.item?.title ?? ""} ${s.brief ?? ""} (${s.reason}).\n` +
          "You privately asked everyone what works. Build ONE realistic plan that works for everyone who's going (or as many as possible). " +
          "It can have several parts in order (e.g. a concert, then dinner after), each with a time. " +
          "IMPORTANT: answers like 'anything works', 'any genre', 'no preference' are FLEXIBLE: they're happy with whatever, so follow what the others specifically asked for. " +
          "Respect budgets, diets, access needs and times in the private notes without ever mentioning them. " +
          (changes.length ? `People asked for these changes to your last proposal: ${changes.map((c) => `"${c}"`).join("; ")}. Adjust.\n` : "") +
          "PRIVACY: title and summary are shown to everyone: never mention anyone, never say who can't, never quote anyone.",
      },
      {
        role: "user",
        content:
          `${await groupAbout(s.circleId)}\n\nEveryone (names hidden):\n\n${people.join("\n\n")}\n\n` +
          (slots.checked ? `Times when everyone who linked a calendar is free:\n${slots.slots.map((x) => `- ${x.label} = ${x.start}`).join("\n") || "- none"}` : "No calendars linked."),
      },
    ],
  });
  const safe = plan && !names.some((n) => n.length >= 2 && (nameRe(n).test(plan.title) || nameRe(n).test(plan.summary)));
  const out: Proposal = safe
    ? { title: clip(plan!.title, 80), summary: clip(plan!.summary, 400), verdict: plan!.verdict, parts: [], costCents: null }
    : { title: s.item?.title ?? "The plan", summary: "Here's what works for the group.", verdict: "PARTIAL", parts: [], costCents: null };
  const rawParts = safe ? plan!.parts : ((s.item?.parts as unknown as Part[] | null) ?? [{ label: s.item?.title ?? "Plan", kind: "other" }]).map((p) => ({ ...p, startsAt: null, whenText: s.item?.whenText ?? null, search: p.label }));

  // Real places and events, near the middle of where everyone's coming from.
  const pts = going.filter((r) => r.lat !== null && r.lng !== null).map((r) => ({ lat: r.lat!, lng: r.lng! }));
  const mid = pts.length ? middle(pts) : null;
  const area = mid ? await areaName(mid.lat, mid.lng).catch(() => ({ area: null, city: null, state: null })) : null;
  const areaLabel = area ? [area.area, area.city, area.state].filter(Boolean).join(", ") : "";
  for (const p of rawParts) {
    const part: Part = { label: p.label, kind: p.kind, startsAt: p.startsAt && !isNaN(+new Date(p.startsAt)) ? new Date(p.startsAt).toISOString() : null, whenText: p.whenText, place: null, address: null, why: null, costCents: null, links: null, venue: null };
    if (p.kind !== "other" && p.search) {
      if (mid) {
        const found = await findVenues(s.circleId, { title: `${p.search} (${p.label})`, details: null, startsAt: part.startsAt ? new Date(part.startsAt) : null }, mid, areaLabel).catch(() => null);
        const v = found?.venues[0];
        if (v) {
          const venue = { ...v, city: v.city ?? area?.city ?? null, state: v.state ?? area?.state ?? null };
          part.venue = venue;
          part.place = venue.name;
          part.address = venue.address;
          part.why = venue.why ?? null;
          if (venue.startsAt) part.startsAt = venue.startsAt;
          part.costCents = venue.price ? (PRICE[venue.price] ?? (Number(venue.price.replace(/\D/g, "")) * 100 || null)) : p.kind === "food" ? 3000 : null;
          part.links = bookingLinks(venue, { startsAt: part.startsAt ? new Date(part.startsAt) : null, party: going.length, tz });
        }
      }
      if (!part.links) {
        // No location or no key for this kind: still point people somewhere useful.
        const q = encodeURIComponent(`${p.search}${areaLabel ? ` near ${areaLabel}` : ""}`);
        part.links = {
          resy: null,
          opentable: null,
          tickets: p.kind === "event" ? `https://www.ticketmaster.com/search?q=${encodeURIComponent(p.search)}` : null,
          website: null,
          maps: `https://www.google.com/maps/search/?api=1&query=${q}`,
        };
        if (p.kind === "food") part.costCents = 3000;
      }
    }
    if (part.startsAt && !part.whenText) part.whenText = slotLabel(new Date(part.startsAt), tz);
    out.parts.push(part);
  }
  const costs = out.parts.map((p) => p.costCents ?? 0);
  out.costCents = costs.some((c) => c > 0) ? costs.reduce((a, b) => a + b, 0) : null;

  await db.hushCheckIn.update({ where: { id: sessionId }, data: { stage: "CONFIRMING", proposal: out as unknown as Prisma.InputJsonValue, verdict: out.verdict } });
  await db.hushCheckInReply.updateMany({ where: { checkInId: sessionId }, data: { confirm: null } });
  for (const r of s.replies) {
    const topic = topicOf(sessionId);
    if (r.attending === "OUT") {
      await say(r.memberId, topic, "Here's what the group is going with, in case you change your mind:", [], { card: "fyi", proposal: out });
      continue;
    }
    const lead =
      out.verdict === "NO_TIME"
        ? "No time worked for everyone as first planned, so here's the most realistic option:"
        : changes.length
          ? "I updated the plan with everyone's changes:"
          : "Here's the plan I put together from everyone's answers:";
    await say(r.memberId, topic, `${lead} Does this look right?`, ["Looks good ✓", "Change something"], { card: "confirm", proposal: out });
  }
}

// ---------- CONFIRMING: once, at the end ----------

async function confirmTurn(sessionId: string, member: Member, card: string | null, text: string) {
  const topic = topicOf(sessionId);
  const key = { checkInId_memberId: { checkInId: sessionId, memberId: member.id } };
  if (card === "change") {
    const r = await db.hushCheckInReply.findUniqueOrThrow({ where: key });
    await db.hushCheckInReply.update({ where: key, data: { confirm: "CHANGE", summary: { ...((r.summary as object) ?? {}), change: clip(text, 300) } } });
    await say(member.id, topic, "Got it. I'll fit that in and show everyone an updated plan.");
    bg(() => maybeFinalize(sessionId));
    return {};
  }
  if (/change|different|no\b|not quite|edit/i.test(text) && !/looks good|yes|✓/i.test(text)) {
    await say(member.id, topic, "What would you change? Just tell me. It stays private.", [], { card: "change" });
    return {};
  }
  await db.hushCheckInReply.update({ where: key, data: { confirm: "YES" } });
  await say(member.id, topic, "Great! Waiting for everyone else to confirm. It goes to the group once they do.", [], { card: "wait" });
  bg(() => maybeFinalize(sessionId));
  return {};
}

async function maybeFinalize(sessionId: string) {
  const s = await db.hushCheckIn.findUnique({ where: { id: sessionId }, include: { replies: true } });
  if (!s || s.status !== "OPEN" || s.stage !== "CONFIRMING") return;
  const voters = s.replies.filter((r) => r.attending !== "OUT");
  if (!voters.every((r) => r.confirm)) return;
  const changes = voters.filter((r) => r.confirm === "CHANGE").map((r) => String((r.summary as { change?: string } | null)?.change ?? "")).filter(Boolean);
  if (changes.length && s.revision < MAX_REVISIONS) {
    await db.hushCheckIn.update({ where: { id: sessionId }, data: { revision: { increment: 1 } } });
    await buildPlan(sessionId, changes);
    return;
  }
  await finalize(sessionId);
}

async function finalize(sessionId: string) {
  const claimed = await db.hushCheckIn.updateMany({ where: { id: sessionId, stage: "CONFIRMING" }, data: { stage: "DONE", status: "DONE", doneAt: new Date() } });
  if (!claimed.count) return;
  const s = await db.hushCheckIn.findUniqueOrThrow({ where: { id: sessionId }, include: { replies: true, circle: { select: { slug: true, title: true } } } });
  const p = s.proposal as unknown as Proposal;
  const firstPart = p.parts[0];
  const data = {
    title: p.title,
    details: clip(p.summary, 200),
    parts: p.parts as unknown as Prisma.InputJsonValue,
    startsAt: firstPart?.startsAt ? new Date(firstPart.startsAt) : null,
    whenText: firstPart?.whenText ?? null,
    place: firstPart?.place ? clip([firstPart.place, firstPart.address].filter(Boolean).join(", "), 120) : null,
    placeMeta: firstPart?.venue ? (firstPart.venue as unknown as Prisma.InputJsonValue) : undefined,
    costCents: p.costCents,
    outcome: "ALL_IN",
    status: "OPEN",
  };
  const item = s.itemId
    ? await db.chatItem.update({ where: { id: s.itemId }, data })
    : await db.chatItem.create({ data: { circleId: s.circleId, kind: "EVENT", ...data } });
  if (!s.itemId) await db.hushCheckIn.update({ where: { id: sessionId }, data: { itemId: item.id } });
  await db.groupMessage.create({ data: { circleId: s.circleId, kind: "HUSH", body: `It's a plan! 🎉 Everyone confirmed privately. Here's “${p.title}”:` } });
  await db.groupMessage.create({ data: { circleId: s.circleId, kind: "ITEM", body: "new", itemId: item.id } });

  // Money: everyone going gets a share; people with room are quietly asked to help.
  const going = s.replies.filter((r) => r.attending !== "OUT");
  if (p.costCents && p.costCents > 0) {
    await setupShares(
      item.id,
      going.map((r) => ({ memberId: r.memberId, capCents: r.budgetCents })),
      p.costCents,
    );
    const { need, helpers } = await helpersFor(item.id);
    for (const h of need > 0 ? helpers : [])
      await say(h.memberId, topicOf(sessionId), `The plan costs a bit more than some people are comfortable with. Want to quietly help? Nobody will ever know who gave, or who it helped.`, [], {
        card: "chipin",
        itemId: item.id,
        suggestCents: h.suggestCents,
      });
  }
  for (const r of s.replies) {
    const topic = topicOf(sessionId);
    if (r.attending !== "OUT" && p.costCents && p.costCents > 0) {
      const m = await myMoney(item.id, r.memberId);
      if (m)
        await say(r.memberId, topic, `Your share is about ${money(m.finalCents)}${m.coveredCents ? ` (the group quietly covered ${money(m.coveredCents)} of it)` : ""}.${stripeEnabled() ? " You can pay it now or later." : ""}`, [], {
          card: "pay",
          itemId: item.id,
          cents: m.finalCents,
        });
    }
    await say(r.memberId, topic, `It's posted in ${s.circle.title}. Taking you back to the group…`, [], { card: "final", slug: s.circle.slug, proposal: p });
  }
}

// ---------------------------------------------------------------------------------------------
// Free chat with Hush (no plan waiting on you)
// ---------------------------------------------------------------------------------------------

const Chat = z.object({
  reply: z.string().describe("Your private reply, 1-3 short sentences"),
  startPlanning: z.boolean().describe("true if they're asking you to plan something for their group now"),
  brief: z.string().nullable().describe("If startPlanning: what they want to plan, in a sentence"),
  remember: z.array(z.string()).max(3).describe("NEW lasting facts about them worth remembering. Empty if none."),
});

async function freeChat(member: Member, text: string) {
  const md = member.accountId ? await personMd(member.accountId) : "";
  const acct = member.accountId ? await db.account.findUnique({ where: { id: member.accountId }, select: { hushStyle: true } }) : null;
  const circle = await db.circle.findUnique({ where: { id: member.circleId }, select: { title: true, isDirect: true } });
  const recent = await db.groupMessage.findMany({
    where: { circleId: member.circleId, kind: { in: ["TEXT", "HUSH"] } },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { member: { select: { name: true } } },
  });
  const history = await db.message.findMany({ where: { memberId: member.id, topic: "dm" }, orderBy: { createdAt: "desc" }, take: 12 });
  const d = await llm({
    task: "hush_private_chat",
    label: "Private chat with Hush",
    circleId: member.circleId,
    schema: Chat,
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          `You are Hush, chatting PRIVATELY with ${member.name} about their group "${circle?.title ?? ""}". ${voiceFor(readStyle(acct?.hushStyle))} Nothing here is shared with anyone. ` +
          "You can help them think through plans, or remember things (put lasting facts in `remember`). You never reveal what anyone ELSE told you privately. " +
          "If they want you to plan something for the group, set startPlanning=true and tell them you'll check with everyone privately.\n\n" +
          `Their profile:\n${md}\n\nRecent group chat (everyone can see it):\n${recent
            .reverse()
            .map((r) => `${r.member?.name ?? (r.kind === "HUSH" ? "Hush" : "Someone")}: ${fileSafe(r.body)}`)
            .join("\n")}`,
      },
      ...history.reverse().map((h) => ({ role: h.role === "HUSH" ? ("assistant" as const) : ("user" as const), content: h.content })),
    ],
  });
  await say(member.id, "dm", d?.reply ?? "Sorry, I'm having trouble thinking right now. Try me again in a minute.");
  if (d && member.accountId && d.remember.length) await rememberFacts(member.accountId, d.remember);
  if (d?.startPlanning) {
    const id = await startSession(member.circleId, { reason: "Someone asked Hush to plan something", brief: d.brief, organizerId: member.id, intake: true });
    if (!id) await say(member.id, "dm", "I'm already planning something in this group. Let's finish that first!");
  }
}

/** Files never reach the model by accident: a FILE message is just a label here. */
const fileSafe = (body: string) => body;

// ---------------------------------------------------------------------------------------------
// Group chat: Hush noticed a plan (or a plan getting stuck) → go private automatically
// ---------------------------------------------------------------------------------------------

/** Auto-start, unless this chat set Hush to "only when asked". */
export async function autoPlan(circleId: string, itemId: string | null, reason: string, brief?: string | null) {
  const c = await db.circle.findUnique({ where: { id: circleId }, select: { hushStyle: true } });
  if (readRoomStyle(c?.hushStyle).proactivity === "ask") return null;
  return startSession(circleId, { itemId, reason, brief });
}

/** Group-facing voice for this chat's Hush (name, tone). */
export async function roomVoiceFor(circleId: string) {
  const c = await db.circle.findUnique({ where: { id: circleId }, select: { hushStyle: true } });
  return roomVoice(readRoomStyle(c?.hushStyle));
}

// Kept for callers of the old names.
export const dmTurn = async (member: Member, text: string) => ({ done: !!(await hushTurn(member, { text })).back });
export async function dmView(member: Member) {
  const t = member.accountId ? await hushThread(member.accountId) : { messages: [], groups: [], pending: [] };
  return { ...t, active: null };
}
