import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { confirmCheckout, payShareCheckout } from "@/lib/chipin";
import { stripeKeyWorks } from "@/lib/stripe";

// Pay your share of a plan (Stripe Checkout, TEST MODE: card 4242 4242 4242 4242), and confirm a
// finished Checkout (share or chip-in) when Stripe sends you back.

async function myMemberFor(accountId: string, itemId: string) {
  const item = await db.chatItem.findUnique({ where: { id: itemId }, select: { circleId: true } });
  if (!item) return null;
  return db.member.findFirst({ where: { accountId, circleId: item.circleId } });
}

export async function POST(req: Request) {
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  if (!rateLimit(`pay:${account.id}`, 10, 60_000)) return jsonError("Give it a moment and try again.", 429);
  const body = await parseBody(req, z.object({ itemId: z.string().max(40) }));
  if (!body.ok) return body.res;
  const m = await myMemberFor(account.id, body.data.itemId);
  if (!m) return jsonError("Not found", 404);
  try {
    return NextResponse.json({ url: await payShareCheckout(body.data.itemId, m.id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't start the payment.";
    if (/Stripe 401/.test(msg) || !(await stripeKeyWorks())) return jsonError("Payments aren't set up right now (the Stripe test key isn't valid).", 503);
    return jsonError(msg.replace(/^Stripe \d+: /, ""), 400);
  }
}

export async function PUT(req: Request) {
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  const body = await parseBody(req, z.object({ sessionId: z.string().regex(/^cs_test_[A-Za-z0-9]+$/) }));
  if (!body.ok) return body.res;
  const mine = await db.member.findMany({ where: { accountId: account.id }, select: { id: true } });
  try {
    const r = await confirmCheckout(body.data.sessionId, mine.map((m) => m.id));
    if (!r) return jsonError("That payment didn't go through (or isn't yours).", 400);
    await db.message.create({ data: { memberId: r.memberId, role: "HUSH", topic: "dm", content: r.note } });
    return NextResponse.json({ ok: true, note: r.note });
  } catch (e) {
    console.error("confirm checkout failed", e);
    return jsonError("Couldn't check that payment.", 400);
  }
}
