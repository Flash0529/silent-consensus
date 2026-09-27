import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";

// The fixed question after sharing a file: "Would you like this to be seen by Hush AI?"
// Only the person who shared it can answer. No = Hush never sees it (the default).
export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this chat", 401);
  const body = await parseBody(req, z.object({ visible: z.boolean() }));
  if (!body.ok) return body.res;
  const a = await db.attachment.findUnique({ where: { id } });
  if (!a || a.circleId !== me.circleId) return jsonError("Not found", 404);
  if (a.memberId !== me.id) return jsonError("Only the person who shared this file can decide that.", 403);
  await db.attachment.update({ where: { id }, data: { aiVisible: body.data.visible, aiAnswered: true } });
  return NextResponse.json({ ok: true, aiVisible: body.data.visible });
}
