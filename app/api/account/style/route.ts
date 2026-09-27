import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError } from "@/lib/http";
import { readStyle, StyleSchema } from "@/lib/hushstyle";
import { cleanName } from "@/lib/names";

// "Make Hush yours": how your Hush talks to you and what it plans around. Only you see these; Hush
// uses them (without your name) when it plans for a group.
export async function GET() {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  const row = await db.account.findUnique({ where: { id: a.id }, select: { hushStyle: true } });
  return NextResponse.json({ style: readStyle(row?.hushStyle), saved: !!row?.hushStyle }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request) {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const p = StyleSchema.safeParse(raw);
  if (!p.success) return jsonError(p.error.issues[0]?.message ?? "Check your settings.");
  // The bot's name can't carry a check mark either (only the real Hush badge is verified).
  const style = { ...p.data, botName: cleanName(p.data.botName) || "Hush", you: cleanName(p.data.you) };
  await db.account.update({ where: { id: a.id }, data: { hushStyle: style } });
  return NextResponse.json({ ok: true, style });
}

export async function DELETE() {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  await db.account.update({ where: { id: a.id }, data: { hushStyle: Prisma.DbNull } });
  return NextResponse.json({ ok: true });
}
