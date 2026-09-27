import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { postToGroup } from "@/lib/groupchat";
import { evaluateRsvps } from "@/lib/hushask";

// Respond to something Hush noticed: I'm in / Maybe / Can't (events), Done (to-dos), or dismiss it.
const Body = z.object({
  answer: z.enum(["IN", "MAYBE", "OUT"]).optional(),
  status: z.enum(["OPEN", "DONE", "DISMISSED"]).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  const item = await db.chatItem.findUnique({ where: { id } });
  if (!item || item.circleId !== me.circleId) return jsonError("Not found", 404);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  if (body.data.answer) {
    await db.chatItemResponse.upsert({
      where: { itemId_memberId: { itemId: id, memberId: me.id } },
      create: { itemId: id, memberId: me.id, answer: body.data.answer },
      update: { answer: body.data.answer, at: new Date() },
    });
    // Everyone answered → Hush announces only the outcome (and may start private check-ins).
    after(() => evaluateRsvps(id).catch((e) => console.error("rsvp outcome failed", e)));
  }
  if (body.data.status && body.data.status !== item.status) {
    await db.chatItem.update({ where: { id }, data: { status: body.data.status } });
    if (body.data.status === "DONE") await postToGroup(me.circleId, "EVENT", `${me.name} marked "${item.title}" done`);
    if (body.data.status === "DISMISSED") await postToGroup(me.circleId, "EVENT", `${me.name} removed "${item.title}"`);
  }
  return NextResponse.json({ ok: true });
}
