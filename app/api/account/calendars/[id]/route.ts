import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError } from "@/lib/http";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  await db.calendarLink.deleteMany({ where: { id, accountId: account.id } });
  return NextResponse.json({ ok: true });
}
