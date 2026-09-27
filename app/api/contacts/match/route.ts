import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccount, normalizeEmail } from "@/lib/account";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { normalizePhone, phoneHash } from "@/lib/phone";
import { connectToken } from "@/lib/dm";

// Find people you know who are on Silent Consensus: phone numbers from your contacts (or typed in)
// are hashed and compared against accounts with a verified linked phone, then discarded. Nothing is
// stored. Only people who linked a phone can be found by number.
const Body = z.object({
  phones: z.array(z.string().max(40)).max(500).default([]),
  email: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  const me = await getAccount();
  if (!me) return jsonError("Log in first.", 401);
  if (!rateLimit(`match:${me.id}`, 10, 10 * 60_000)) return jsonError("Too many searches. Try again in a few minutes.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const hashes = [...new Set(body.data.phones.map((p) => normalizePhone(p)).filter((p): p is string => !!p).map(phoneHash))];
  const byPhone = hashes.length
    ? await db.account.findMany({ where: { phoneHash: { in: hashes }, phoneVerifiedAt: { not: null } }, select: { id: true, name: true, photo: true, bio: true } })
    : [];
  const byEmail = body.data.email
    ? await db.account.findMany({ where: { email: normalizeEmail(body.data.email) }, select: { id: true, name: true, photo: true, bio: true } })
    : [];
  const seen = new Map<string, { id: string; name: string; photo: string | null; bio: string | null }>();
  for (const a of [...byPhone, ...byEmail]) if (a.id !== me.id) seen.set(a.id, a);
  return NextResponse.json({
    checked: hashes.length,
    found: [...seen.values()].map((a) => ({ ...a, token: connectToken(me.id, a.id) })),
  });
}
