import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { isAdmin } from "@/lib/members";

// Delete a chat.
// - "me": like deleting a conversation in iMessage. The history disappears for you and the chat leaves
//   your list; if someone posts again it comes back with just the new messages. Nobody else is affected.
// - "everyone": a group admin can delete it for everybody (messages, cards, private answers, all of
//   it). Not for DMs or the demo company.
const Body = z.object({ scope: z.enum(["me", "everyone"]) });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this chat", 401);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;

  if (body.data.scope === "me") {
    const now = new Date();
    await db.member.update({ where: { id: me.id }, data: { clearedAt: now, lastReadAt: now } });
    return NextResponse.json({ ok: true });
  }

  const circle = await db.circle.findUnique({ where: { id: me.circleId }, select: { organizerId: true, isDirect: true, isDemo: true, org: { select: { isDemo: true } } } });
  if (!circle) return jsonError("This chat doesn't exist.", 404);
  if (circle.isDirect) return jsonError("Direct messages can only be deleted for you.", 400);
  if (circle.isDemo || circle.org?.isDemo) return jsonError("The demo company's chats can't be deleted.", 403);
  if (!isAdmin(me)) return jsonError("Only group admins can delete it for everyone.", 403);
  await db.circle.delete({ where: { id: me.circleId } });
  return NextResponse.json({ ok: true });
}
