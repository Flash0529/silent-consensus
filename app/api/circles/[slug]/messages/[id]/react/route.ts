import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";

// Tapback on a message: one emoji per person (a new one replaces it; null or the same one removes it).
const Body = z.object({
  emoji: z
    .string()
    .max(16)
    .regex(/^\p{Extended_Pictographic}/u, "Pick an emoji")
    .nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  if (!rateLimit(`react:${me.id}`, 60, 60_000)) return jsonError("Slow down a little.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const msg = await db.groupMessage.findUnique({ where: { id }, select: { circleId: true, kind: true } });
  if (!msg || msg.circleId !== me.circleId || msg.kind === "EVENT") return jsonError("That message isn't in this chat.", 404);
  const key = { messageId_memberId: { messageId: id, memberId: me.id } };
  const cur = await db.groupReaction.findUnique({ where: key });
  if (!body.data.emoji || cur?.emoji === body.data.emoji) {
    if (cur) await db.groupReaction.delete({ where: key });
    return NextResponse.json({ emoji: null });
  }
  await db.groupReaction.upsert({
    where: key,
    create: { messageId: id, memberId: me.id, emoji: body.data.emoji },
    update: { emoji: body.data.emoji, at: new Date() },
  });
  return NextResponse.json({ emoji: body.data.emoji });
}
