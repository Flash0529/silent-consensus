import type { Circle } from "@prisma/client";
import { db } from "@/lib/db";
import { groupInclude, toGroupSafe } from "@/lib/serialize";
import { DISPARITY_THRESHOLD, dayKey, gate, judge, rulesPass, type GroupLine } from "@/lib/twilio/disparity";
import { clip, clipOrNull } from "@/lib/text";

// The in-app group chat: people message each other; Hush is a participant that stays quiet unless
// it's asked ("Hush, …") or the rules + judge see a plan getting stuck. Then it checks in with
// EVERY member privately (never only the hesitant one) and later posts one plan everyone can see.
// What anyone tells Hush privately never appears here: plan posts use toGroupSafe() only, and only
// after the leak check passed.

export type GroupKind = "TEXT" | "HUSH" | "EVENT" | "PLAN";

export function postToGroup(
  circleId: string,
  kind: GroupKind,
  body: string,
  memberId: string | null = null,
  replyToId: string | null = null,
) {
  return db.groupMessage.create({ data: { circleId, kind, body: clip(body, 2000), memberId, replyToId } });
}

export const hushSays = (circleId: string, body: string) => postToGroup(circleId, "HUSH", body);

export const HUSH_INTRO =
  "Hi everyone, I'm Hush. Just chat like normal: when you start making a plan, I'll check with each of you privately " +
  "in your Hush chat and bring back one plan everyone can say yes to. Tap Plan event to start one. Nothing you tell me " +
  "privately is ever shared.";

export const HUSH_INTRO_WORK =
  "Hi team, I'm Hush. I'll quietly keep track of meetings, action items and decisions as you chat, so nothing " +
  "slips. Press and hold an empty spot in the chat (right-click on a computer) if you want me to step in.";

export async function onGroupCreated(circleId: string, organizerName: string, mode: "FRIENDS" | "WORK" = "FRIENDS") {
  await postToGroup(circleId, "EVENT", `${organizerName} started the group`);
  await hushSays(circleId, mode === "WORK" ? HUSH_INTRO_WORK : HUSH_INTRO);
}

export const onMemberJoined = (circleId: string, name: string) => postToGroup(circleId, "EVENT", `${name} joined`);

const ASKED = /\bhush\b/i;

/** Runs in the background after a person posts in the group chat. */
const PLAN_ASK = /\b(plan (this|it|something)|figure (it|this) out|organi[sz]e|check in with (us|everyone)|find (a|something that) works?)\b/i;

export async function hushListens(circleId: string, authorMemberId: string, body: string, opts: { toHush?: boolean } = {}) {
  // Talked to directly (mention or reply to Hush) and not asking it to run a planning round: answer.
  if ((opts.toHush || ASKED.test(body)) && !PLAN_ASK.test(body)) {
    const { hushChat } = await import("@/lib/ai/hushchat");
    await hushChat(circleId, body);
    return;
  }
  const circle = await db.circle.findUnique({
    where: { id: circleId },
    include: { members: { select: { id: true, interviewStatus: true } } },
  });
  if (!circle) return;
  const asked = ASKED.test(body);
  const total = circle.members.length;
  const done = circle.members.filter((m) => m.interviewStatus === "DONE").length;

  // Once planning is underway, Hush only answers when asked.
  if (circle.status !== "COLLECTING") {
    if (!asked) return;
    const msg =
      circle.status === "PLANNING"
        ? "I'm putting the plan together now. It'll show up here in a minute."
        : circle.status === "PROPOSED"
          ? "The plan is up in this chat. Tap \"See the plan\" to vote."
          : "This plan is settled. Start a new plan anytime.";
    await hushSays(circleId, msg);
    return;
  }

  // Recent lines (people only) for the rules and the judge. Names become P1..Pn inside judge().
  const rows = await db.groupMessage.findMany({
    where: { circleId, kind: "TEXT" },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const lines: GroupLine[] = rows.reverse().map((r) => ({ author: r.memberId ?? "?", body: r.body }));
  const latest: GroupLine = { author: authorMemberId, body };
  const before = lines.length && lines[lines.length - 1].body === body ? lines.slice(0, -1) : lines;

  const rule = rulesPass(latest, before);
  const fired = asked || rule.fired;
  if (!fired) return;

  let kind = asked ? "asked" : rule.kind;
  let confidence = asked ? 1 : rule.score;
  if (!asked) {
    const verdict = await judge([...before, latest], circleId);
    if (verdict) {
      kind = verdict.kind;
      confidence = verdict.disparity ? verdict.confidence : 0;
    }
  }

  const g = gate(circle, { asked });
  const acted = confidence >= DISPARITY_THRESHOLD && g.ok;
  await db.disparityEvent.create({
    data: { circleId, kind: kind as never, confidence, acted },
  });

  if (!acted) {
    // Asked again during the cooldown: a status line instead of a second round of check-ins.
    if (asked)
      await hushSays(
        circleId,
        done === total
          ? "Everyone's told me what works. The plan is on its way."
          : "I'm on it. Check your Hush chat if I asked you something.",
      );
    return;
  }

  const today = dayKey();
  await db.circle.update({
    where: { id: circleId },
    data: {
      lastDisparityAt: new Date(),
      disparityDay: today,
      disparityCountToday: circle.disparityDay === today ? { increment: 1 } : 1,
    },
  });
  // Go private right away: everyone gets asked in their Hush chat (the session posts the group line).
  const { autoPlan, startSession } = await import("@/lib/checkin");
  const item = await db.chatItem.findFirst({ where: { circleId, kind: "EVENT", status: "OPEN" }, orderBy: { createdAt: "desc" } });
  const brief = clip(lines.slice(-6).map((l) => l.body).join(" / "), 300);
  const reason = asked ? "Someone asked Hush to plan this" : "A plan in the chat seemed to be getting stuck";
  const id = asked ? await startSession(circleId, { itemId: item?.id ?? null, reason, brief }) : await autoPlan(circleId, item?.id ?? null, reason, brief);
  if (!id && asked) await hushSays(circleId, "I'm already working on a plan with everyone privately. Check your Hush chat!");
}

/** Everyone finished their private chat: tell the group (without saying who said what). */
export async function announceAllCheckedIn(circle: Pick<Circle, "id" | "kind">) {
  await hushSays(
    circle.id,
    circle.kind === "MEDIATE"
      ? "Everyone's been heard privately. I'm working on a fair way forward and will share it here."
      : "Everyone's checked in privately. I'm putting together a plan that works for everyone.",
  );
}

/** The planner finished: post the plan (group-safe fields only, leak check passed) to the chat. */
export async function announcePlanInChat(circleId: string) {
  const circle = await db.circle.findUnique({ where: { id: circleId }, include: groupInclude });
  if (!circle) return false;
  const g = toGroupSafe(circle);
  if (!g.plan || !g.plan.leakCheckPassed) return false;
  const lines = [g.plan.title, g.plan.dateLabel, ...g.plan.stops.map((s) => `${s.time}  ${s.name}`)].filter(Boolean);
  await postToGroup(circleId, "PLAN", lines.join("\n"));
  return true;
}
