import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/ratelimit";
import { checkVerification, startVerification, verifyEnabled } from "@/lib/twilio/client";
import { canText, clientIp, SMS_CONSENT_VERSION } from "@/lib/twilio/consent";
import { ensureUser, sendOptInConfirmation } from "@/lib/twilio/hush";

// Public SMS opt-in at /sms (no plan needed). Same consent rules as the phone-link step in a plan:
// the unchecked box must be ticked to send a code, and consent is recorded once the number is verified.

const NO_CONSENT = "Tick the box to agree to texts from Silent Consensus first.";
const Start = z.object({ phone: z.string().trim().min(7).max(24), consent: z.boolean().optional() });
const Check = Start.extend({ code: z.string().trim().regex(/^\d{4,10}$/) });

/** Send a verification code. */
export async function POST(req: Request) {
  if (!verifyEnabled()) return jsonError("Texting isn't set up on this server yet.", 503);
  const ip = clientIp(req) ?? "unknown";
  if (!rateLimit(`sms-optin:${ip}`, 5, 10 * 60_000)) return jsonError("Too many codes. Try again in a few minutes.", 429);
  const body = await parseBody(req, Start);
  if (!body.ok) return body.res;
  if (body.data.consent !== true) return jsonError(NO_CONSENT);
  const phone = normalizePhone(body.data.phone);
  if (!phone) return jsonError("Enter a US or Canadian mobile number.");
  if (!rateLimit(`sms-optin-phone:${phone}`, 3, 10 * 60_000)) return jsonError("Too many codes. Try again in a few minutes.", 429);
  await startVerification(phone);
  return NextResponse.json({ sent: true, masked: maskPhone(phone) });
}

/** Check the code, record consent, and send the confirmation text. */
export async function PUT(req: Request) {
  if (!verifyEnabled()) return jsonError("Texting isn't set up on this server yet.", 503);
  const ip = clientIp(req) ?? "unknown";
  if (!rateLimit(`sms-optin-check:${ip}`, 10, 10 * 60_000)) return jsonError("Too many tries. Wait a few minutes.", 429);
  const body = await parseBody(req, Check);
  if (!body.ok) return body.res;
  if (body.data.consent !== true) return jsonError(NO_CONSENT);
  const phone = normalizePhone(body.data.phone);
  if (!phone) return jsonError("Enter a US or Canadian mobile number.");
  if (!(await checkVerification(phone, body.data.code)))
    return jsonError("That code didn't work. Check it, or send a new one.");

  const user = await ensureUser(phone);
  const consented = await db.user.update({
    where: { id: user.id },
    data: { smsConsentAt: new Date(), smsConsentIp: clientIp(req), smsConsentVersion: SMS_CONSENT_VERSION },
  });
  if (canText(consented)) await sendOptInConfirmation(consented).catch((e) => console.error("opt-in confirmation failed", e));
  return NextResponse.json({ optedIn: true, optedOut: !!consented.smsOptedOutAt, masked: maskPhone(phone) });
}
