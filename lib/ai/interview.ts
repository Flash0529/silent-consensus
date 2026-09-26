import type { Circle, Member, Message, MsgKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dateLabel, weekdayName } from "@/lib/dates";
import { callLLM, HUSH_TROUBLE, LLMUnavailableError } from "@/lib/ai/client";
import { MediationInterviewTurn, PlanInterviewTurn } from "@/lib/ai/schemas";
import { mediationInterviewPrompt, planInterviewPrompt } from "@/lib/ai/prompts/interview";
import { parseAlcohol, parseBudget, parseStepFree, parseTime } from "@/lib/ai/fastpath";
import { SAFETY_REPLY, screenText, stricter } from "@/lib/ai/safety";
import { mergePerspective, mergeVault, type PerspectiveShape, type VaultShape } from "@/lib/vault";
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

async function markDone(member: MemberWithCircle) {
  await db.member.update({ where: { id: member.id }, data: { interviewStatus: "DONE" } });
  await onMemberDone(member.circleId);
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

    // Deterministic confirm / consent answers.
    if (lastTopic === "confirm" && /^that'?s right$/i.test(text)) {
      created.push(
        ...(await save(member.id, [
          {
            role: "HUSH",
            content: "Perfect. I'll plan around this, and no one will know it came from you. I'll let you know when the plan's ready.",
            topic: "done",
          },
        ])),
      );
      await markDone(member);
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
        messages: [{ role: "system", content: mediationInterviewPrompt({ ...ctx, known: persp }) }, ...historyFor(history)],
      });
      if (stricter(screenText(text), turn.safety) === "stop") return { messages: [...created, ...(await safetyStop(member))] };
      await writePerspective(member.id, mergePerspective(persp, turn.updates));
      if (turn.safety === "concern") await writePerspective(member.id, { safety: "CONCERN" });
      created.push(...(await save(member.id, turnMessages(turn))));
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
        messages: [{ role: "system", content: planInterviewPrompt({ ...ctx, known: vault }) }, ...historyFor(history)],
      });
      if (stricter(screenText(text), turn.safety) === "stop") return { messages: [...created, ...(await safetyStop(member))] };
      const fast = text ? fastPlanUpdates(text, lastTopic, weekdayName(c.windowStart)) : {};
      await writeVault(member.id, { ...mergeVault(vault, turn.constraintUpdates), ...fast });
      created.push(...(await save(member.id, turnMessages(turn))));
      if (turn.done && turn.topic === "done") await markDone(member);
    }
    return { messages: created };
  } catch (e) {
    if (e instanceof LLMUnavailableError) return { messages: created, error: HUSH_TROUBLE };
    console.error("interview turn failed", e);
    return { messages: created, error: HUSH_TROUBLE };
  }
}

function turnMessages(turn: {
  ack?: string;
  question: string;
  options: string[];
  topic: string;
  confirmChips?: string[];
}): NewMsg[] {
  const out: NewMsg[] = [];
  const chips = turn.topic === "confirm" || turn.topic === "consent" ? turn.confirmChips : undefined;
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
