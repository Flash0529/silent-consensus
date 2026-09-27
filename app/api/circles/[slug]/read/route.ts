import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";

/** Mark the group chat read for the caller (clears their unread badge). */
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  await db.member.update({ where: { id: me.id }, data: { lastReadAt: new Date() } });
  return NextResponse.json({ ok: true });
}
