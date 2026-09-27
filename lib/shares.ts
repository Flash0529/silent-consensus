import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { allocate } from "@/lib/money/allocate";

type Tx = Prisma.TransactionClient;

export async function currentPlan(circleId: string, tx: Tx | typeof db = db) {
  return tx.plan.findFirst({
    where: { circleId, status: { in: ["PROPOSED", "CONFIRMED"] } },
    orderBy: { version: "desc" },
  });
}

/** Recompute every share on a plan from the caps and the chip-ins. The only writer of money fields. */
export async function recomputeShares(planId: string, tx: Tx | typeof db = db) {
  const shares = await tx.memberShare.findMany({ where: { planId }, orderBy: { id: "asc" } });
  const chipIns = await tx.chipIn.findMany({ where: { planId }, orderBy: { createdAt: "asc" } });
  const a = allocate(
    shares.map((s) => ({ id: s.memberId, baseCents: s.baseCents, capCents: s.capCents })),
    chipIns.map((c) => ({ memberId: c.fromMemberId, amountCents: c.amountCents })),
  );
  for (const l of a.lines) {
    await tx.memberShare.update({
      where: { planId_memberId: { planId, memberId: l.id } },
      data: { coveredCents: l.coveredCents, chipInCents: l.chipInCents, refundCents: l.refundCents, finalCents: l.finalCents },
    });
  }
  return a;
}

/** Everyone voted "I'm in" and (for hangouts) the quiet pool is full → confirmed. */
export async function maybeConfirm(circleId: string) {
  const plan = await currentPlan(circleId);
  if (!plan || plan.status !== "PROPOSED") return false;
  const [members, ins] = await Promise.all([
    db.member.count({ where: { circleId } }),
    db.vote.count({ where: { planId: plan.id, choice: "IN" } }),
  ]);
  if (ins < members) return false;
  if (plan.kind === "PLAN") {
    const a = await recomputeShares(plan.id);
    if (a.poolCents < a.needCents) return false;
  }
  await db.$transaction([
    db.plan.update({ where: { id: plan.id }, data: { status: "CONFIRMED" } }),
    db.circle.update({ where: { id: circleId }, data: { status: "CONFIRMED" } }),
  ]);
  return true;
}
