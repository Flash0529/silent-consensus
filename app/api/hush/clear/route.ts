import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError, parseBody } from "@/lib/http";

// Clear your Hush chat for one group. If Hush is in the middle of planning something there, that plan
// is deleted too: the group sees "<you> deleted the plan", and nobody is asked anything more about it.
export async function POST(req: Request) {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  const body = await parseBody(req, z.object({ slug: z.string().min(4).max(40) }));
  if (!body.ok) return body.res;
  const me = await db.member.findFirst({ where: { accountId: a.id, circle: { slug: body.data.slug } } });
  if (!me) return jsonError("You're not in that chat.", 404);

  const cleared = await db.message.deleteMany({ where: { memberId: me.id, OR: [{ topic: "dm" }, { topic: { startsWith: "ci:" } }] } });

  let deletedPlan: string | null = null;
  const s = await db.hushCheckIn.findFirst({ where: { circleId: me.circleId, status: "OPEN" }, include: { item: true, replies: { select: { memberId: true } } } });
  if (s) {
    const claimed = await db.hushCheckIn.updateMany({ where: { id: s.id, status: "OPEN" }, data: { status: "DONE", stage: "CANCELLED", doneAt: new Date(), verdict: `DELETED:${me.name}` } });
    if (claimed.count) {
      deletedPlan = s.item?.title ?? s.brief?.slice(0, 60) ?? "the plan";
      if (s.item && s.item.outcome !== "ALL_IN") await db.chatItem.update({ where: { id: s.item.id }, data: { status: "DISMISSED" } });
      await db.groupMessage.create({ data: { circleId: me.circleId, kind: "EVENT", body: `${me.name} deleted the plan` } });
      for (const r of s.replies.filter((r) => r.memberId !== me.id))
        await db.message.create({
          data: { memberId: r.memberId, role: "HUSH", topic: "dm", content: `${me.name} deleted the plan “${deletedPlan}”, so there's nothing to answer for it anymore.` },
        });
    }
  }
  return NextResponse.json({ ok: true, cleared: cleared.count, deletedPlan });
}
