import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { currentPlan, maybeConfirm, recomputeShares } from "@/lib/shares";
import { allocate } from "@/lib/money/allocate";
import { money } from "@/lib/format";

const Body = z.object({ amountCents: z.number().int().min(0).max(10000) });

// Private. The response carries only the caller's own amounts and the pool aggregate.
export async function POST(req: Request) {
  const slug = new URL(req.url).searchParams.get("c") ?? "";
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;

  const plan = await currentPlan(me.circleId);
  if (!plan || plan.kind !== "PLAN") return jsonError("There's no plan to chip in on.", 409);

  const result = await db.$transaction(async (tx) => {
    const shares = await tx.memberShare.findMany({ where: { planId: plan.id } });
    const others = await tx.chipIn.findMany({ where: { planId: plan.id, NOT: { fromMemberId: me.id } }, orderBy: { createdAt: "asc" } });
    const members = shares.map((s) => ({ id: s.memberId, baseCents: s.baseCents, capCents: s.capCents }));
    const trial = allocate(members, [
      ...others.map((c) => ({ memberId: c.fromMemberId, amountCents: c.amountCents })),
      { memberId: me.id, amountCents: body.data.amountCents },
    ]);
    const mine = trial.lines.find((l) => l.id === me.id);
    if (!mine || !mine.isHelper) return { error: "This isn't needed from you." };
    const accepted = mine.chipInCents;
    if (accepted > 0)
      await tx.chipIn.upsert({
        where: { planId_fromMemberId: { planId: plan.id, fromMemberId: me.id } },
        create: { planId: plan.id, fromMemberId: me.id, amountCents: accepted },
        update: { amountCents: accepted },
      });
    else await tx.chipIn.deleteMany({ where: { planId: plan.id, fromMemberId: me.id } });
    const a = await recomputeShares(plan.id, tx);
    await tx.message.create({
      data: {
        memberId: me.id,
        role: "HUSH",
        topic: "chipin-done",
        content:
          accepted > 0
            ? `Thank you. ${money(accepted)} went into the quiet pool. No one will know it came from you.${
                mine.refundCents > 0 ? ` The pool only needed ${money(accepted)}, so you won't be charged the rest.` : ""
              }`
            : "No problem at all. Your share stays the same.",
      },
    });
    return { accepted, poolCents: a.poolCents, needCents: a.needCents };
  });
  if ("error" in result) return jsonError(result.error!, 409);
  await maybeConfirm(me.circleId);
  return NextResponse.json(result);
}
