import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { myShareView } from "@/lib/mine";
import { rateLimit } from "@/lib/ratelimit";
import { createShareCheckout, getCheckout, stripeEnabled } from "@/lib/stripe";

// Paying your own share. With a Stripe TEST key this goes through a real Stripe Checkout page in test
// mode; without one it's the original mock. Either way no real money moves, ever (docs/HANDOFF.md).
// The amount always comes from the server (myShareView), never from the client.

const slugOf = (req: Request) => new URL(req.url).searchParams.get("c") ?? "";
const siteUrl = () => process.env.APP_URL ?? "http://localhost:3000";
const STRIPE_MIN_CENTS = 50;

/** Start paying. Returns { url } to redirect to Stripe Checkout, or { ok } when marked paid directly. */
export async function POST(req: Request) {
  const slug = slugOf(req);
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  if (!rateLimit(`pay:${me.id}`, 6, 60_000)) return jsonError("Give it a moment and try again.", 429);

  const view = await myShareView(me.id, me.circleId);
  if (!view?.money) return jsonError("There's nothing to pay for yet.");
  if (view.paid) return NextResponse.json({ ok: true, alreadyPaid: true });

  const amount = view.money.finalCents;
  // No Stripe key, or nothing to charge (Stripe's minimum is $0.50): mark paid directly (mock).
  if (!stripeEnabled() || amount < STRIPE_MIN_CENTS) {
    await db.member.update({ where: { id: me.id }, data: { paidAt: new Date() } });
    return NextResponse.json({ ok: true, demo: true });
  }

  try {
    const session = await createShareCheckout({
      memberId: me.id,
      planId: view.planId,
      amountCents: amount,
      planTitle: view.title,
      successUrl: `${siteUrl()}/c/${slug}/share?paid={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl()}/c/${slug}/share`,
    });
    if (!session.url) return jsonError("Stripe didn't return a checkout page.", 502);
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("stripe checkout failed", e);
    return jsonError("Couldn't start the payment. Try again in a minute.", 502);
  }
}

const Confirm = z.object({ sessionId: z.string().trim().min(10).max(200) });

/** Back from Stripe: check the session with Stripe itself before marking this member paid. */
export async function PUT(req: Request) {
  const me = await getMember(slugOf(req));
  if (!me) return jsonError("Not a member of this plan", 401);
  if (!stripeEnabled()) return jsonError("Payments aren't set up.", 503);
  const body = await parseBody(req, Confirm);
  if (!body.ok) return body.res;

  const view = await myShareView(me.id, me.circleId);
  if (!view?.money) return jsonError("There's nothing to pay for yet.");
  if (view.paid) return NextResponse.json({ ok: true, paid: true });

  let session;
  try {
    session = await getCheckout(body.data.sessionId);
  } catch (e) {
    console.error("stripe confirm failed", e);
    return jsonError("Couldn't check that payment.", 400);
  }
  const mine =
    !session.livemode &&
    session.client_reference_id === me.id &&
    session.metadata?.planId === view.planId &&
    session.amount_total === view.money.finalCents;
  if (!mine) return jsonError("That payment doesn't match your share.", 400);
  if (session.payment_status !== "paid") return NextResponse.json({ ok: false, paid: false });

  await db.member.update({ where: { id: me.id }, data: { paidAt: new Date() } });
  return NextResponse.json({ ok: true, paid: true });
}
