import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { ensureDmHello, hushThread, hushTurn } from "@/lib/checkin";

// Your Hush chat: one private chat with Hush across all your groups. Only your own messages; nothing
// here is ever shown to anyone else.

export const maxDuration = 120;

export async function GET(req: Request) {
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  const slug = new URL(req.url).searchParams.get("c");
  if (slug) {
    const m = await db.member.findFirst({ where: { accountId: account.id, circle: { slug } } });
    if (m) await ensureDmHello(m);
  }
  return NextResponse.json(await hushThread(account.id), { headers: { "Cache-Control": "no-store" } });
}

const Body = z.object({
  slug: z.string().min(4).max(40),
  text: z.string().trim().max(1000).optional(),
  optionIndex: z.number().int().min(0).max(5).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export async function POST(req: Request) {
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  if (!rateLimit(`hush:${account.id}`, 30, 60_000)) return jsonError("Slow down a little and try again in a minute.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const m = await db.member.findFirst({ where: { accountId: account.id, circle: { slug: body.data.slug } } });
  if (!m) return jsonError("You're not in that chat.", 404);
  // Long model work runs after the response when it's the last answer; the page polls for it.
  const r = await hushTurn(m, body.data);
  if (r.error) return jsonError(r.error);
  after(() => {});
  return NextResponse.json({ ok: true, ...(await hushThread(account.id)) });
}
