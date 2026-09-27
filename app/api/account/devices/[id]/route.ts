import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError } from "@/lib/http";

// Remove a device: logs it out everywhere on that browser and forgets it.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  if (!/^[A-Za-z0-9:_-]{6,20}$/.test(id)) return jsonError("Not found", 404);
  const sessions = await db.accountSession.findMany({ where: { accountId: a.id }, select: { tokenHash: true, deviceHash: true } });
  const hit = sessions.filter((s) => (s.deviceHash ?? `session:${s.tokenHash}`).startsWith(id));
  if (!hit.length) return jsonError("Not found", 404);
  await db.accountSession.deleteMany({ where: { tokenHash: { in: hit.map((s) => s.tokenHash) } } });
  const dev = hit[0].deviceHash;
  if (dev) await db.trustedDevice.deleteMany({ where: { accountId: a.id, deviceHash: dev } });
  return NextResponse.json({ ok: true });
}
