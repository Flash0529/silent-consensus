import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/twilio/consent";
import { accountPhone, claimDeviceMemberships, isTrustedDevice, normalizeEmail, setPending2fa, startSession, verifyPassword } from "@/lib/account";
import { startVerification, verifyEnabled } from "@/lib/twilio/client";
import { maskPhone } from "@/lib/phone";

const Body = z.object({ email: z.string().trim().max(200), password: z.string().max(200) });
const WRONG = "That email and password don't match.";

export async function POST(req: Request) {
  if (!rateLimit(`login:${clientIp(req) ?? "?"}`, 20, 15 * 60_000)) return jsonError("Too many attempts. Wait a few minutes.", 429);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return jsonError(WRONG, 401);
  const email = normalizeEmail(parsed.data.email);
  if (!rateLimit(`login-email:${email}`, 10, 15 * 60_000)) return jsonError("Too many attempts. Wait a few minutes.", 429);
  const account = await db.account.findUnique({ where: { email } });
  if (!account || !(await verifyPassword(parsed.data.password, account.passwordHash))) return jsonError(WRONG, 401);
  // Two-step login: password was right; now a code texted to the linked phone.
  const phone = accountPhone(account);
  // Two-step codes are skipped on a device the person chose to remember.
  if (account.twoFactor && phone && verifyEnabled() && !(await isTrustedDevice(account.id))) {
    await startVerification(phone);
    await setPending2fa(account.id);
    return NextResponse.json({ needsCode: true, masked: maskPhone(phone) });
  }
  await startSession(account.id);
  const claimed = await claimDeviceMemberships(account.id);
  return NextResponse.json({ account: { name: account.name, email: account.email }, claimed });
}
