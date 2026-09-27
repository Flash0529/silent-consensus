import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/http";
import { deleteAccount, getAccount, verifyPassword } from "@/lib/account";

// Delete your account for good. Needs your password and typing DELETE.
const Body = z.object({ currentPassword: z.string().max(200), confirm: z.literal("DELETE") });

export async function POST(req: Request) {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  const body = await parseBody(req, Body);
  if (!body.ok) return jsonError('Type DELETE to confirm.');
  if (!(await verifyPassword(body.data.currentPassword, a.passwordHash))) return jsonError("Your password isn't right.", 403);
  await deleteAccount(a.id);
  return NextResponse.json({ ok: true });
}
