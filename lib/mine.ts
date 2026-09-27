import { db } from "@/lib/db";
import { currentPlan } from "@/lib/shares";
import { allocate } from "@/lib/money/allocate";
import type { PlanStop } from "@/lib/ai/planner";

/**
 * The caller's own view of money and chip-in. A recipient sees only their own
 * coverage; helpers additionally see the pool as an aggregate. Never who gave or who got.
 */
export async function myShareView(memberId: string, circleId: string) {
  const plan = await currentPlan(circleId);
  if (!plan) return null;
  const share = await db.memberShare.findUnique({ where: { planId_memberId: { planId: plan.id, memberId } } });
  if (!share) return null;
  const vote = await db.vote.findUnique({ where: { planId_memberId: { planId: plan.id, memberId } } });
  const member = await db.member.findUniqueOrThrow({ where: { id: memberId }, select: { paidAt: true } });

  const base = {
    planId: plan.id,
    kind: plan.kind,
    status: plan.status,
    title: plan.title,
    dateLabel: plan.dateLabel,
    myVote: vote?.choice ?? null,
    paid: !!member.paidAt,
    privateNote: share.privateNote,
  };

  if (plan.kind === "MEDIATE") {
    return { ...base, brief: share.brief, card: plan.content, money: null, chipIn: null };
  }

  const stops = (plan.stops as unknown as PlanStop[]) ?? [];
  const shares = await db.memberShare.findMany({ where: { planId: plan.id } });
  const chipIns = await db.chipIn.findMany({ where: { planId: plan.id }, orderBy: { createdAt: "asc" } });
  const a = allocate(
    shares.map((s) => ({ id: s.memberId, baseCents: s.baseCents, capCents: s.capCents })),
    chipIns.map((c) => ({ memberId: c.fromMemberId, amountCents: c.amountCents })),
  );
  const mine = a.lines.find((l) => l.id === memberId)!;
  // Most this helper can still add: their headroom, the $10 cap, and what the pool still needs.
  const remaining = Math.min(mine.headroomCents ?? 1000, 1000, Math.max(0, a.needCents - a.poolCents + mine.chipInCents));
  const responded = await db.message.count({ where: { memberId, topic: "chipin-done", createdAt: { gte: plan.createdAt } } });

  return {
    ...base,
    brief: null,
    card: null,
    money: {
      lines: stops.flatMap((s) => s.items),
      baseCents: mine.baseCents,
      coveredCents: mine.coveredCents,
      chipInCents: mine.chipInCents,
      finalCents: mine.finalCents,
    },
    // Only helpers get the chip-in view, and only as an aggregate.
    chipIn: mine.isHelper
      ? {
          open: a.cardOpen,
          responded: responded > 0,
          suggestCents: Math.min(mine.suggestCents, remaining),
          maxCents: remaining,
          poolCents: a.poolCents,
          needCents: a.needCents,
          myChipInCents: mine.chipInCents,
        }
      : null,
  };
}
export type MyShareView = NonNullable<Awaited<ReturnType<typeof myShareView>>>;
