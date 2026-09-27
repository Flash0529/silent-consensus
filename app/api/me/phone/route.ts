import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { decryptPhone, maskPhone, normalizePhone } from "@/lib/phone";
import { rateLimit } from "@/lib/ratelimit";
import { checkVerification, startVerification, textingEnabled, verifyEnabled } from "@/lib/twilio/client";
import { canText, clientIp, SMS_CONSENT_VERSION } from "@/lib/twilio/consent";
import { ensureUser, sendOptInConfirmation } from "@/lib/twilio/hush";

// "Get Hush by text": the caller links their own phone to their membership in one circle, via a
// Twilio Verify code. Only ever reads or writes the caller's own rows.
// This is also the SMS opt-in (A2P 10DLC): the unchecked consent box must be ticked to send a code,
// and consent (time, IP, wording version) is recorded on the User once the number is verified.

const slugOf = (req: Request) => new URL(req.url).searchParams.get("c") ?? "";

export async function GET(req: Request) {
  const me = await getMember(slugOf(req));
  if (!me) return jsonError("Not a member of this plan", 401);
  const user = me.userId ? await db.user.findUnique({ where: { id: me.userId } }) : null;
  return NextResponse.json(
    {
      // A number linked before the opt-in existed must go through the consent step again.
      linked: !!user && !!user.smsConsentAt,
      optedOut: !!user?.smsOptedOutAt,
      masked: user ? maskPhone(decryptPhone(user.phoneEnc)) : null,
      verifyEnabled: verifyEnabled(),
      textingEnabled: textingEnabled(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

// The consent checkbox value. Checked explicitly below so the user gets a clear message.
const consent = z.boolean().optional();
const NO_CONSENT = "Tick the box to agree to texts from Silent Consensus first.";
const Start = z.object({ phone: z.string().trim().min(7).max(24), consent });

/** Send a verification code. */
export async function POST(req: Request) {
  const me = await getMember(slugOf(req));
  if (!me) return jsonError("Not a member of this plan", 401);
  if (!verifyEnabled()) return jsonError("Texting isn't set up on this server yet.", 503);
  if (!rateLimit(`verify:${me.id}`, 3, 10 * 60_000))
    return jsonError("Too many codes. Try again in a few minutes.", 429);
  const body = await parseBody(req, Start);
  if (!body.ok) return body.res;
  if (body.data.consent !== true) return jsonError(NO_CONSENT);
  const phone = normalizePhone(body.data.phone);
  if (!phone) return jsonError("Enter a US or Canadian mobile number.");
  await startVerification(phone);
  return NextResponse.json({ sent: true, masked: maskPhone(phone) });
}

const Check = z.object({
  phone: z.string().trim().min(7).max(24),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/),
  consent,
});

/** Check the code and link the phone to this membership. */
export async function PUT(req: Request) {
  const me = await getMember(slugOf(req));
  if (!me) return jsonError("Not a member of this plan", 401);
  if (!verifyEnabled()) return jsonError("Texting isn't set up on this server yet.", 503);
  if (!rateLimit(`verify-check:${me.id}`, 8, 10 * 60_000)) return jsonError("Too many tries. Wait a few minutes.", 429);
  const body = await parseBody(req, Check);
  if (!body.ok) return body.res;
  if (body.data.consent !== true) return jsonError(NO_CONSENT);
  const phone = normalizePhone(body.data.phone);
  if (!phone) return jsonError("Enter a US or Canadian mobile number.");
  if (!(await checkVerification(phone, body.data.code)))
    return jsonError("That code didn't work. Check it, or send a new one.");

  const user = await ensureUser(phone, me.name);
  const clash = await db.member.findFirst({ where: { circleId: me.circleId, userId: user.id, NOT: { id: me.id } } });
  if (clash) return jsonError("That number is already part of this plan.", 409);
  await db.member.update({ where: { id: me.id }, data: { userId: user.id } });
  const consented = await db.user.update({
    where: { id: user.id },
    data: {
      displayName: user.displayName ?? me.name,
      activeMemberId: user.activeMemberId ?? me.id,
      smsConsentAt: new Date(),
      smsConsentIp: clientIp(req),
      smsConsentVersion: SMS_CONSENT_VERSION,
    },
  });
  // Confirmation text. A failure here must not undo the link; the user can text START later.
  if (canText(consented)) await sendOptInConfirmation(consented).catch((e) => console.error("opt-in confirmation failed", e));
  return NextResponse.json({ linked: true, optedOut: !!consented.smsOptedOutAt, masked: maskPhone(phone) });
}

/** Unlink: Hush stops texting this person about this plan. */
export async function DELETE(req: Request) {
  const me = await getMember(slugOf(req));
  if (!me) return jsonError("Not a member of this plan", 401);
  if (me.userId) {
    await db.user.updateMany({ where: { id: me.userId, activeMemberId: me.id }, data: { activeMemberId: null } });
    await db.member.update({ where: { id: me.id }, data: { userId: null } });
  }
  return NextResponse.json({ linked: false });
}
