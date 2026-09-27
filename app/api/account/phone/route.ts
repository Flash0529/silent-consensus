import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { encryptPhone, maskPhone, normalizePhone, phoneHash } from "@/lib/phone";
import { checkVerification, startVerification, verifyEnabled } from "@/lib/twilio/client";
import { getAccount, verifyPassword } from "@/lib/account";

// Link a phone to your account (for password reset and two-step login), verified by an SMS code.
// These are one-time codes you ask for; this doesn't sign you up for Hush group texts.

const Start = z.object({ phone: z.string().trim().min(7).max(24) });
const Check = Start.extend({ code: z.string().trim().regex(/^\d{4,10}$/) });

export async function POST(req: Request) {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  if (!verifyEnabled()) return jsonError("Phone codes aren't available right now.", 503);
  if (!rateLimit(`acct-phone:${a.id}`, 3, 10 * 60_000)) return jsonError("Too many codes. Try again in a few minutes.", 429);
  const body = await parseBody(req, Start);
  if (!body.ok) return jsonError("Enter a US or Canadian mobile number.");
  const phone = normalizePhone(body.data.phone);
  if (!phone) return jsonError("Enter a US or Canadian mobile number.");
  const taken = await db.account.findUnique({ where: { phoneHash: phoneHash(phone) } });
  if (taken && taken.id !== a.id) return jsonError("That number is linked to another account.", 409);
  await startVerification(phone);
  return NextResponse.json({ sent: true, masked: maskPhone(phone) });
}

export async function PUT(req: Request) {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  if (!rateLimit(`acct-phone-check:${a.id}`, 8, 10 * 60_000)) return jsonError("Too many tries. Wait a few minutes.", 429);
  const body = await parseBody(req, Check);
  if (!body.ok) return jsonError("Enter the code we texted you.");
  const phone = normalizePhone(body.data.phone);
  if (!phone) return jsonError("Enter a US or Canadian mobile number.");
  if (!(await checkVerification(phone, body.data.code))) return jsonError("That code didn't work.");
  const taken = await db.account.findUnique({ where: { phoneHash: phoneHash(phone) } });
  if (taken && taken.id !== a.id) return jsonError("That number is linked to another account.", 409);
  await db.account.update({
    where: { id: a.id },
    data: { phoneHash: phoneHash(phone), phoneEnc: encryptPhone(phone), phoneVerifiedAt: new Date() },
  });
  return NextResponse.json({ ok: true, masked: maskPhone(phone) });
}

/** Unlink (needs your password; also turns off two-step login). */
export async function DELETE(req: Request) {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  const body = await parseBody(req, z.object({ currentPassword: z.string().max(200) }));
  if (!body.ok || !(await verifyPassword(body.data.currentPassword, a.passwordHash)))
    return jsonError("Your current password isn't right.", 403);
  await db.account.update({
    where: { id: a.id },
    data: { phoneHash: null, phoneEnc: null, phoneVerifiedAt: null, twoFactor: false },
  });
  return NextResponse.json({ ok: true });
}
