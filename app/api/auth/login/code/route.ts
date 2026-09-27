import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { checkVerification } from "@/lib/twilio/client";
import { accountPhone, claimDeviceMemberships, clearPending2fa, readPending2fa, startSession } from "@/lib/account";

// Second step of two-step login: the code texted to the linked phone.
const Body = z.object({ code: z.string().trim().regex(/^\d{4,10}$/) });

export async function POST(req: Request) {
  const pendingId = await readPending2fa();
  if (!pendingId) return jsonError("That sign-in expired. Enter your password again.", 401);
  if (!rateLimit(`2fa:${pendingId}`, 8, 10 * 60_000)) return jsonError("Too many tries. Wait a few minutes.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return jsonError("Enter the code we texted you.");
  const account = await db.account.findUnique({ where: { id: pendingId } });
  const phone = account && accountPhone(account);
  if (!account || !phone) return jsonError("That sign-in expired. Enter your password again.", 401);
  if (!(await checkVerification(phone, body.data.code))) return jsonError("That code didn't work.");
  await clearPending2fa();
  await startSession(account.id);
  const claimed = await claimDeviceMemberships(account.id);
  return NextResponse.json({ account: { name: account.name, email: account.email }, claimed });
}
