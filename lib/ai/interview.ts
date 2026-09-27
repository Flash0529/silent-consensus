import type { Circle, Member, Message, MsgKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dateLabel, weekdayName } from "@/lib/dates";
import { callLLM, HUSH_TROUBLE, LLMUnavailableError } from "@/lib/ai/client";
import { MediationInterviewTurn, PlanInterviewTurn } from "@/lib/ai/schemas";
import { mediationInterviewPrompt, planInterviewPrompt } from "@/lib/ai/prompts/interview";
import { parseAlcohol, parseBudget, parseStepFree, parseTime } from "@/lib/ai/fastpath";
import { SAFETY_REPLY, screenText, stricter } from "@/lib/ai/safety";
import { chipsFromVault, mergePerspective, mergeVault, type PerspectiveShape, type VaultShape } from "@/lib/vault";
import { hasPrefs, prefsFromVault, rememberOnThisDevice } from "@/lib/profile";
import { onMemberDone } from "@/lib/pipeline";

type MemberWithCircle = Member & { circle: Circle };

const PLAN_BUDGET_OPTIONS = ["Under $15", "$15 to $30", "$30 to $60", "Money's not a worry", "I'd rather explain"];
const MEDIATE_STORY_OPTIONS = ["It's been building a while", "One thing set it off", "Not sure where to start"];

const HISTORY = 16;

const CONFIRM_STEP = {
  lead: "Here's what I'll plan around:",
  question: "Did I get that right?",
  options: ["That's right", "Change something"],
};
const CONSENT_STEP = {
  lead: "Here's the gist I'd bring to the group, without your name:",
  question: "Is it OK to use this?",
  options: ["Yes, use this", "Change it", "Keep all of this private"],
};

type NewMsg = {
  role: "HUSH" | "MEMBER";
  kind?: MsgKind;
  content: string;
  options?: string[];
  chips?: string[];
  topic?: string;
  transcript?: string;
};

async function save(memberId: string, msgs: NewMsg[]) {
  const out: Message[] = [];
  for (const m of msgs) {
    out.push(
      await db.message.create({
        data: {
          memberId,
          role: m.role,
          kind: m.kind ?? (m.chips?.length ? "CONFIRM" : m.options?.length ? "OPTIONS" : "TEXT"),
          content: m.content,
          options: m.options?.length ? m.options : undefined,
          chips: m.chips?.length ? m.chips : undefined,
          topic: m.topic,
          transcript: m.transcript,
        },
      }),
    );
  }
  return out;
}

async function organizerName(circle: Circle) {
  if (!circle.organizerId) return "Your friend";
  const o = await db.member.findUnique({ where: { id: circle.organizerId }, select: { name: true } });
  return o?.name ?? "Your friend";
}

/** Deterministic first turn, so the opening matches the design and costs no model call. */
export async function ensureOpening(member: MemberWithCircle) {
  const count = await db.message.count({ where: { memberId: member.id } });
  if (count > 0) return [];
  const c = member.circle;
  const org = await organizerName(c);
  const isOrg = member.id === c.organizerId;

  if (c.kind === "MEDIATE") {
    const intro = isOrg
      ? `Hi ${member.name}. Thanks for starting this. Your side matters too, so let's hear it.`
      : `Hi ${member.name}. ${org} asked me to help everyone work through ${c.topic ?? c.title}.`;
    return save(member.id, [
      {
        role: "HUSH",
        content: `${intro} This chat is just between us: I never quote anyone or say who said what, and anything you want kept private stays with me.`,
        topic: "intro",
      },
      { role: "HUSH", content: "In your own words, what's been going on?", options: MEDIATE_STORY_OPTIONS, topic: "story" },
    ]);
  }

  const intro = isOrg
    ? `Hey ${member.name}! Let's get your answers in for ${c.title} too. This chat is just between us, even from the group.`
    : `Hey ${member.name}! ${org}'s planning ${c.title}. This chat is just between us.`;

  // Returning on this phone with saved preferences: one "still right?" tap instead of the interview.
  const profile = member.profileId ? await db.profile.findUnique({ where: { id: member.profileId } }) : null;
  if (profile && hasPrefs(profile)) {
    return save(member.id, [
      { role: "HUSH", content: intro, topic: "intro" },
      {
        role: "HUSH",
        content: `Welcome back! Last time you told me:\nStill right for ${c.title}?`,
        chips: chipsFromVault({ ...profile, availableWindows: null, maxTravelMinutes: null, privateNote: null }),
        options: ["That's right", "Change something"],
        topic: "returning",
      },
    ]);
  }

  return save(member.id, [
    { role: "HUSH", content: intro, topic: "intro" },
    { role: "HUSH", content: "What's comfortable to spend, all in?", options: PLAN_BUDGET_OPTIONS, topic: "budget" },
  ]);
}

async function loadVault(memberId: string): Promise<VaultShape> {
  const v = await db.vault.findUnique({ where: { memberId } });
  return {
    budgetCapCents: v?.budgetCapCents ?? null,
    dietary: v?.dietary ?? [],
    alcohol: v?.alcohol ?? null,
    stepFreeRequired: v?.stepFreeRequired ?? null,
    availableWindows: v?.availableWindows ?? null,
    noise: v?.noise ?? null,
    vibe: v?.vibe ?? [],
    maxTravelMinutes: v?.maxTravelMinutes ?? null,
    privateNote: v?.privateNote ?? null,
  };
}

async function writeVault(memberId: string, v: VaultShape) {
  const data = { ...v, availableWindows: (v.availableWindows ?? undefined) as Prisma.InputJsonValue | undefined };
  await db.vault.upsert({ where: { memberId }, create: { memberId, ...data }, update: data });
}

async function loadPerspective(memberId: string): Promise<PerspectiveShape> {
  const p = await db.perspective.findUnique({ where: { memberId } });
  return {
    story: p?.story ?? null,
    feelings: p?.feelings ?? [],
    needs: p?.needs ?? [],
    hopes: p?.hopes ?? [],
    offers: p?.offers ?? [],
    offLimits: p?.offLimits ?? [],
    gist: p?.gist ?? null,
  };
}

async function writePerspective(memberId: string, p: Partial<PerspectiveShape> & Record<string, unknown>) {
  await db.perspective.upsert({ where: { memberId }, create: { memberId, ...p }, update: p });
}

/** Fast paths: deterministic values that override whatever the model extracts. */
function fastPlanUpdates(text: string, lastTopic: string | null, day: string) {
  const u: Partial<VaultShape> = {};
  const budget = parseBudget(text);
  if (budget !== undefined && (lastTopic === "budget" || /\$|\bbucks?\b|dollars?/.test(text))) u.budgetCapCents = budget;
  const time = parseTime(text, day);
  if (time && (lastTopic === "timing" || /\bfree\b|after|before|until/.test(text.toLowerCase()))) u.availableWindows = time;
  if (parseStepFree(text)) u.stepFreeRequired = true;
  const alc = parseAlcohol(text);
  if (alc) u.alcohol = alc;
  return u;
}

function historyFor(msgs: Message[]) {
  return msgs.slice(-HISTORY).map((m) => {
    if (m.role === "MEMBER") return { role: "user" as const, content: m.transcript ?? m.content };
    const opts = Array.isArray(m.options) ? `\n[Options: ${(m.options as string[]).map((o, i) => `${"ABCDE"[i]}) ${o}`).join(", ")}]` : "";
    const chips = Array.isArray(m.chips) ? `\n[Chips: ${(m.chips as string[]).join(" | ")}]` : "";
    return { role: "assistant" as const, content: `${m.content}${chips}${opts}` };
  });
}

/**
 * Pacing so an interview can never loop: a topic asked twice moves on, and after
 * enough answers Hush wraps up with what it has. Real people give vague answers too.
 */
export function pacingNote(history: { role: string; topic: string | null }[], kind: "PLAN" | "MEDIATE") {
  const asked: Record<string, number> = {};
  for (const m of history) if (m.role === "HUSH" && m.topic && !m.topic.endsWith("-ack")) asked[m.topic] = (asked[m.topic] ?? 0) + 1;
  const answers = history.filter((m) => m.role === "MEMBER").length;
  const finalTopic = kind === "MEDIATE" ? "consent" : "confirm";
  const lines: string[] = [];
  const stale = Object.entries(asked).filter(([t, n]) => n >= 2 && t !== finalTopic && t !== "intro");
  if (stale.length)
    lines.push(`PACING: you already asked about ${stale.map(([t]) => t).join(", ")} twice. Do not ask about those again; work with what you have and move to the next topic.`);
  if (answers >= 8)
    lines.push(`PACING: this has gone on long enough. Go to "${finalTopic}" NOW with whatever you know; fill gaps sensibly.`);
  return lines.join("\n");
}

async function markDone(member: MemberWithCircle) {
  await db.member.update({ where: { id: member.id }, data: { interviewStatus: "DONE" } });
  try {
    await onMemberDone(member.circleId);
  } catch (e) {
    // The member's chat must never fail because planning couldn't start; the organizer can retry.
    console.error("could not start planning", e);
  }
}

async function safetyStop(member: MemberWithCircle) {
  if (member.circle.kind === "MEDIATE") {
    await writePerspective(member.id, { safety: "STOP" });
    await db.circle.update({ where: { id: member.circleId }, data: { status: "PAUSED" } });
  }
  return save(member.id, [{ role: "HUSH", content: SAFETY_REPLY, topic: "safety" }]);
}

export type TurnResult = { messages: Message[]; error?: string };

/**
 * Handle one member message (or a retry with no new message) and produce Hush's reply.
 * All writes are to this member's own private rows.
 */
export async function handleTurn(
  member: MemberWithCircle,
  input: { text?: string; kind?: "TEXT" | "VOICE"; transcript?: string; retry?: boolean },
): Promise<TurnResult> {
  const c = member.circle;
  const created: Message[] = [];
  const history = await db.message.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "asc" } });
  const lastHush = [...history].reverse().find((m) => m.role === "HUSH");
  const lastTopic = lastHush?.topic ?? null;
  const text = input.text?.trim() ?? "";

  if (!input.retry) {
    if (!text) return { messages: [], error: "Empty message" };
    created.push(
      ...(await save(member.id, [{ role: "MEMBER", kind: input.kind ?? "TEXT", content: text, transcript: input.transcript }])),
    );
    history.push(created[0]);
    if (member.interviewStatus === "NOT_STARTED")
      await db.member.update({ where: { id: member.id }, data: { interviewStatus: "IN_PROGRESS" } });

    const rule = screenText(text);
    if (rule === "stop") return { messages: [...created, ...(await safetyStop(member))] };

    // Returning member: "That's right" reuses the saved preferences as this plan's answers.
    if (lastTopic === "returning" && member.profileId) {
      const profile = await db.profile.findUnique({ where: { id: member.profileId } });
      if (profile) {
        const cur = await loadVault(member.id);
        await writeVault(member.id, { ...cur, ...prefsFromVault({ ...profile, availableWindows: null, maxTravelMinutes: null, privateNote: null }) });
      }
      if (/^that'?s right$/i.test(text)) {
        created.push(
          ...(await save(member.id, [
            {
              role: "HUSH",
              content: "Perfect, that's all I need. No one will know any of it came from you. I'll let you know when the plan's ready.",
              topic: "done",
            },
          ])),
        );
        await markDone(member);
        return { messages: created };
      }
      // "Change something" falls through to the model, which now sees the saved answers as KNOWN.
    }

    // Deterministic confirm / consent answers.
    if (lastTopic === "confirm" && /^that'?s right$/i.test(text)) {
      const msgs: NewMsg[] = [
        {
          role: "HUSH",
          content: "Perfect. I'll plan around this, and no one will know it came from you. I'll let you know when the plan's ready.",
          topic: "done",
        },
      ];
      if (member.profileId) {
        // Already opted in on this phone: keep the saved preferences current.
        await db.profile.update({ where: { id: member.profileId }, data: prefsFromVault(await loadVault(member.id)) }).catch(() => {});
      } else if (c.kind === "PLAN") {
        msgs.push({
          role: "HUSH",
          content: "Want me to remember this for next time? Only this phone can use it.",
          options: ["Yes, remember me", "No thanks"],
          topic: "remember",
        });
      }
      created.push(...(await save(member.id, msgs)));
      await markDone(member);
      return { messages: created };
    }

    // Opt-in memory, offered once after confirming.
    if (lastTopic === "remember") {
      const yes = /^yes/i.test(text);
      if (yes && !member.profileId) {
        const profile = await rememberOnThisDevice(member.name, prefsFromVault(await loadVault(member.id)));
        await db.member.update({ where: { id: member.id }, data: { profileId: profile.id } });
      }
      created.push(
        ...(await save(member.id, [
          {
            role: "HUSH",
            content: yes
              ? "Done. Next time on this phone, it's one tap. You can make me forget any time in Settings."
              : "No problem. I won't keep anything after this plan.",
            topic: "remember-done",
          },
        ])),
      );
      return { messages: created };
    }
    if (lastTopic === "consent" && /^(yes, use this|keep all of this private)$/i.test(text)) {
      const share = /^yes/i.test(text);
      await writePerspective(member.id, { gistConsent: share ? "SHARE" : "PRIVATE" });
      created.push(
        ...(await save(member.id, [
          {
            role: "HUSH",
            content: share
              ? "Thank you. I'll bring that gist to the group without your name, and nothing else. I'll let you know when there's a way forward to look at."
              : "Understood. Everything you told me stays with me. I'll still look for a way forward that works for you, and I'll let you know when it's ready.",
            topic: "done",
          },
        ])),
      );
      await markDone(member);
      return { messages: created };
    }

    // Replies after a "Different time" / "Tweak" / "Not ready" vote: note privately, no model call.
    if (lastTopic === "followup" || lastTopic === "followup-more") {
      const typeIt = /^i'?ll type it$/i.test(text);
      if (typeIt) {
        created.push(...(await save(member.id, [{ role: "HUSH", content: "Go ahead, I'm listening.", topic: "followup-more" }])));
        return { messages: created };
      }
      if (c.kind === "PLAN") {
        const v = await loadVault(member.id);
        const fast = fastPlanUpdates(text, "timing", weekdayName(c.windowStart));
        await writeVault(member.id, { ...v, ...fast, privateNote: [v.privateNote, `After the first plan: ${text}`].filter(Boolean).join(" ").slice(0, 400) });
      } else {
        const p = await loadPerspective(member.id);
        await writePerspective(member.id, { hopes: [...p.hopes, text.slice(0, 100)] });
      }
      created.push(
        ...(await save(member.id, [
          {
            role: "HUSH",
            content:
              c.kind === "PLAN"
                ? "Got it. I've noted that privately. If the group replans, I'll build it in without saying where it came from."
                : "Thank you. I've noted that privately. If there's a second draft, I'll shape it around this without saying where it came from.",
            topic: "followup-done",
          },
        ])),
      );
      return { messages: created };
    }

    // Finished interviews don't reopen: answer kindly without a model call.
    if (member.interviewStatus === "DONE") {
      created.push(
        ...(await save(member.id, [
          {
            role: "HUSH",
            content:
              c.status === "COLLECTING" || c.status === "PLANNING"
                ? "Thanks, I've noted that. I have what I need, and I'll let you know when it's ready."
                : "Thanks, I've noted that privately.",
            topic: "after-done",
          },
        ])),
      );
      if (c.kind === "PLAN") {
        const v = await loadVault(member.id);
        await writeVault(member.id, { ...v, privateNote: [v.privateNote, text].filter(Boolean).join(" ").slice(0, 400) });
      }
      return { messages: created };
    }

    if (c.kind === "PLAN") {
      const fast = fastPlanUpdates(text, lastTopic, weekdayName(c.windowStart));
      if (Object.keys(fast).length) await writeVault(member.id, { ...(await loadVault(member.id)), ...fast });
    }
  }

  const org = await organizerName(c);
  const ctx = {
    name: member.name,
    organizer: org,
    isOrganizer: member.id === c.organizerId,
    title: c.title,
    activity: c.activity,
    dateLabel: dateLabel(c.windowStart, c.area),
    topic: c.topic,
  };

  try {
    if (c.kind === "MEDIATE") {
      const persp = await loadPerspective(member.id);
      const { data: turn } = await callLLM({
        task: "interview",
        label: "Private interview turn",
        circleId: c.id,
        schema: MediationInterviewTurn,
        reasoningEffort: "low",
        temperature: 0.6,
        messages: [{ role: "system", content: mediationInterviewPrompt({ ...ctx, known: persp, pacing: pacingNote(history, "MEDIATE") }) }, ...historyFor(history)],
      });
      if (stricter(screenText(text), turn.safety) === "stop") return { messages: [...created, ...(await safetyStop(member))] };
      const merged = mergePerspective(persp, turn.updates);
      if (turn.topic === "consent" && !merged.gist) merged.gist = gistFromParts(merged);
      await writePerspective(member.id, merged);
      if (turn.safety === "concern") await writePerspective(member.id, { safety: "CONCERN" });
      // What the person approves must be exactly what gets shared: chips come from the stored gist.
      const chips = turn.topic === "consent" ? splitGist(merged.gist ?? "") : undefined;
      created.push(...(await save(member.id, turnMessages(turn, chips))));
      if (turn.done && turn.topic === "done") await markDone(member);
    } else {
      const vault = await loadVault(member.id);
      const { data: turn } = await callLLM({
        task: "interview",
        label: "Private interview turn",
        circleId: c.id,
        schema: PlanInterviewTurn,
        reasoningEffort: "low",
        temperature: 0.6,
        messages: [{ role: "system", content: planInterviewPrompt({ ...ctx, known: vault, pacing: pacingNote(history, "PLAN") }) }, ...historyFor(history)],
      });
      if (stricter(screenText(text), turn.safety) === "stop") return { messages: [...created, ...(await safetyStop(member))] };
      const fast = text ? fastPlanUpdates(text, lastTopic, weekdayName(c.windowStart)) : {};
      const merged = { ...mergeVault(vault, turn.constraintUpdates), ...fast };
      await writeVault(member.id, merged);
      const chips = turn.topic === "confirm" && !turn.confirmChips?.length ? chipsFromVault(merged) : undefined;
      created.push(...(await save(member.id, turnMessages(turn, chips))));
      if (turn.done && turn.topic === "done") await markDone(member);
    }
    return { messages: created };
  } catch (e) {
    if (e instanceof LLMUnavailableError) return { messages: created, error: HUSH_TROUBLE };
    console.error("interview turn failed", e);
    return { messages: created, error: HUSH_TROUBLE };
  }
}

function splitGist(gist: string) {
  return gist
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim().replace(/[.]$/, ""))
    .filter(Boolean)
    .slice(0, 4);
}

function gistFromParts(p: PerspectiveShape) {
  const parts = [
    p.needs.length ? `Needs ${p.needs.slice(0, 2).join(" and ")}.` : "",
    p.hopes.length ? `Hopes for ${p.hopes[0]}.` : "",
    p.offers.length ? `Would ${p.offers.slice(0, 2).join(" and ")}.` : "",
  ].filter(Boolean);
  return parts.join(" ") || "Wants things to feel fair and calm.";
}

function turnMessages(
  turn: {
    ack?: string;
    question: string;
    options: string[];
    topic: string;
    confirmChips?: string[];
  },
  overrideChips?: string[],
): NewMsg[] {
  const out: NewMsg[] = [];
  const chips =
    turn.topic === "confirm" || turn.topic === "consent" ? (overrideChips?.length ? overrideChips : turn.confirmChips) : undefined;
  if (chips?.length) {
    // Fixed wording and options so the deterministic confirm/consent handlers always match.
    const fixed = turn.topic === "confirm" ? CONFIRM_STEP : CONSENT_STEP;
    const lead = (turn.ack ?? "").replace(/\s*\n+\s*/g, " ").trim() || fixed.lead;
    out.push({ role: "HUSH", content: `${lead}\n${fixed.question}`, options: fixed.options, chips, topic: turn.topic });
    return out;
  }
  if (turn.ack) out.push({ role: "HUSH", content: turn.ack, topic: `${turn.topic}-ack` });
  out.push({ role: "HUSH", content: turn.question, options: turn.options.slice(0, 5), topic: turn.topic });
  return out;
}

/** Client-safe view of the caller's own messages. */
export function toOwnMessage(m: Message) {
  return {
    id: m.id,
    role: m.role,
    kind: m.kind,
    content: m.content,
    options: (m.options as string[] | null) ?? null,
    chips: (m.chips as string[] | null) ?? null,
    topic: m.topic,
    transcript: m.transcript,
    createdAt: m.createdAt.toISOString(),
  };
}
export type OwnMessage = ReturnType<typeof toOwnMessage>;
