import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";

// Mock payment. No real money moves, ever.
export async function POST(req: Request) {
  const slug = new URL(req.url).searchParams.get("c") ?? "";
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  await db.member.update({ where: { id: me.id }, data: { paidAt: new Date() } });
  return NextResponse.json({ ok: true, demo: true });
}
