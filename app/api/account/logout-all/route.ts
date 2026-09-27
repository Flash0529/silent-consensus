import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jsonError } from "@/lib/http";
import { ACCOUNT_COOKIE, endAllSessions, getAccount } from "@/lib/account";

/** Log out on every device, including this one. */
export async function POST() {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  await endAllSessions(a.id);
  (await cookies()).delete(ACCOUNT_COOKIE);
  return NextResponse.json({ ok: true });
}
