import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAccount } from "@/lib/account";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { chipInCheckout } from "@/lib/chipin";
import { stripeKeyWorks } from "@/lib/stripe";

// Quietly chip in for a plan (Stripe Checkout, TEST MODE). Nobody learns who gave or who it helped.
export async function POST(req: Request) {
  const account = await getAccount();
  if (!account) return jsonError("Log in first.", 401);
  if (!rateLimit(`chip:${account.id}`, 10, 60_000)) return jsonError("Give it a moment and try again.", 429);
  const body = await parseBody(req, z.object({ itemId: z.string().max(40), amountCents: z.number().int().min(0).max(10000) }));
  if (!body.ok) return body.res;
  const item = await db.chatItem.findUnique({ where: { id: body.data.itemId }, select: { circleId: true } });
  const m = item ? await db.member.findFirst({ where: { accountId: account.id, circleId: item.circleId } }) : null;
  if (!m) return jsonError("Not found", 404);
  if (body.data.amountCents === 0) {
    await db.message.create({ data: { memberId: m.id, role: "HUSH", topic: "dm", content: "No problem at all. Nothing changes for you." } });
    return NextResponse.json({ ok: true });
  }
  try {
    return NextResponse.json({ url: await chipInCheckout(body.data.itemId, m.id, body.data.amountCents) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't start the chip-in.";
    if (/Stripe 401/.test(msg) || !(await stripeKeyWorks())) return jsonError("Payments aren't set up right now (the Stripe test key isn't valid).", 503);
    return jsonError(msg.replace(/^Stripe \d+: /, ""), 400);
  }
}
