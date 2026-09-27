import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/twilio/consent";
import { checkVerification } from "@/lib/twilio/client";
import { accountPhone, endAllSessions, hashPassword, normalizeEmail, startSession } from "@/lib/account";

// Forgot password, step 2: the texted code + a new password. Signs out every other device.
const Body = z.object({
  email: z.string().trim().max(200),
  code: z.string().trim().regex(/^\d{4,10}$/, "Enter the code we texted you."),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
});

export async function POST(req: Request) {
  if (!rateLimit(`reset:${clientIp(req) ?? "?"}`, 10, 15 * 60_000)) return jsonError("Too many tries. Wait a few minutes.", 429);
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request");
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Check your details.");
  const account = await db.account.findUnique({ where: { email: normalizeEmail(parsed.data.email) } });
  const phone = account && accountPhone(account);
  if (!account || !phone || !(await checkVerification(phone, parsed.data.code)))
    return jsonError("That code didn't work. Request a new one.");
  await db.account.update({ where: { id: account.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await endAllSessions(account.id);
  await startSession(account.id);
  return NextResponse.json({ ok: true });
}
