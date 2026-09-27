import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/twilio/consent";
import { accountPhone, claimDeviceMemberships, isTrustedDevice, normalizeEmail, setPending2fa, startSession, verifyPassword } from "@/lib/account";
import { domainOf, orgForEmail } from "@/lib/org";
import { startVerification, verifyEnabled } from "@/lib/twilio/client";
import { maskPhone } from "@/lib/phone";

// Work sign-in: like a normal login, but only for an email at a company that uses Silent Consensus.
const Body = z.object({ email: z.string().trim().max(200), password: z.string().max(200) });
const WRONG = "That work email and password don't match.";

export async function POST(req: Request) {
  if (!rateLimit(`blogin:${clientIp(req) ?? "?"}`, 20, 15 * 60_000)) return jsonError("Too many attempts. Wait a few minutes.", 429);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const p = Body.safeParse(raw);
  if (!p.success) return jsonError(WRONG, 401);
  const email = normalizeEmail(p.data.email);
  const org = await orgForEmail(email);
  if (!org) return jsonError(`No company on Silent Consensus uses @${domainOf(email) || "that domain"} yet. Create a work account to set yours up.`, 404);
  const account = await db.account.findUnique({ where: { email } });
  if (!account || !(await verifyPassword(p.data.password, account.passwordHash))) return jsonError(WRONG, 401);
  if (account.orgId !== org.id) await db.account.update({ where: { id: account.id }, data: { orgId: org.id, orgRole: account.orgRole ?? "MEMBER" } });
  const phone = accountPhone(account);
  // Two-step codes are skipped on a device the person chose to remember.
  if (account.twoFactor && phone && verifyEnabled() && !(await isTrustedDevice(account.id))) {
    await startVerification(phone);
    await setPending2fa(account.id);
    return NextResponse.json({ needsCode: true, masked: maskPhone(phone) });
  }
  await startSession(account.id);
  await claimDeviceMemberships(account.id);
  return NextResponse.json({ account: { name: account.name, email: account.email }, org: { name: org.name } });
}
