import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { SITE_URL } from "@/lib/twilio/consent";

// "Invite a friend": a link for someone who isn't on Silent Consensus yet. When they sign up (or log
// in) with it, you're connected: a DM opens between you. One link per friend; it works once.
export async function POST() {
  const a = await getAccount();
  if (!a) return jsonError("Log in first.", 401);
  if (!rateLimit(`invite:${a.id}`, 20, 60 * 60_000)) return jsonError("That's a lot of invites. Try again in a bit.", 429);
  const token = randomBytes(12).toString("base64url");
  await db.friendInvite.create({ data: { token, fromId: a.id } });
  return NextResponse.json({ url: `${SITE_URL}/invite/${token}`, from: a.name });
}
