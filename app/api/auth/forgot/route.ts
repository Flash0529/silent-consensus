import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/twilio/consent";
import { startVerification, verifyEnabled } from "@/lib/twilio/client";
import { accountPhone, normalizeEmail } from "@/lib/account";

// Forgot password, step 1: text a code to the phone linked to this account. The reply is the same
// whether or not the account exists, so this can't be used to discover who has an account.
const Body = z.object({ email: z.string().trim().max(200) });
const GENERIC = "If that account has a phone linked, we just texted it a code.";

export async function POST(req: Request) {
  if (!verifyEnabled()) return jsonError("Password reset isn't available right now.", 503);
  if (!rateLimit(`forgot:${clientIp(req) ?? "?"}`, 5, 15 * 60_000)) return jsonError("Too many requests. Try again later.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return jsonError("Enter your email.");
  const email = normalizeEmail(body.data.email);
  if (!rateLimit(`forgot-email:${email}`, 3, 15 * 60_000)) return NextResponse.json({ ok: true, message: GENERIC });
  const account = await db.account.findUnique({ where: { email } });
  const phone = account && accountPhone(account);
  if (phone) await startVerification(phone).catch((e) => console.error("forgot: verify failed", e));
  return NextResponse.json({ ok: true, message: GENERIC });
}
