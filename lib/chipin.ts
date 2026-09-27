import { db } from "@/lib/db";
import { allocate } from "@/lib/money/allocate";
import { createCheckout, getCheckout, stripeEnabled } from "@/lib/stripe";
import { SITE_URL } from "@/lib/twilio/consent";

// The quiet chip-in, for plans Hush put together:
// - Everyone going gets a share (the plan's estimated cost per person).
// - If someone told Hush privately that it's more than they're comfortable with, friends with room
//   are asked (privately, in their Hush chat) if they'd like to quietly help. Nobody learns who gave,
//   who got help, or that a pool even exists.
// - Paying (your share, or a chip-in) goes through Stripe Checkout in TEST MODE ONLY: use the test
//   card 4242 4242 4242 4242. No real money moves, ever.

export const TEST_CARD_NOTE = "Test payment: use card 4242 4242 4242 4242, any future date, any CVC. No real money moves.";
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

/** Create everyone's share for a finished plan, then invite helpers to chip in and everyone to pay. */
export async function setupShares(itemId: string, going: { memberId: string; capCents: number | null }[], costCents: number) {
  if (costCents <= 0 || !going.length) return;
  await db.itemShare.deleteMany({ where: { itemId } });
  for (const g of going)
    await db.itemShare.create({ data: { itemId, memberId: g.memberId, baseCents: costCents, capCents: g.capCents, finalCents: costCents } });
  await recompute(itemId);
}

/** Recompute everyone's final share from the chip-ins that are actually paid. */
export async function recompute(itemId: string) {
  const shares = await db.itemShare.findMany({ where: { itemId } });
  const paid = await db.itemChipIn.findMany({ where: { itemId, status: "PAID" }, orderBy: { createdAt: "asc" } });
  const a = allocate(
    shares.map((s) => ({ id: s.memberId, baseCents: s.baseCents, capCents: s.capCents })),
    paid.map((c) => ({ memberId: c.fromMemberId, amountCents: c.amountCents })),
  );
  for (const l of a.lines)
    await db.itemShare.update({ where: { itemId_memberId: { itemId, memberId: l.id } }, data: { coveredCents: l.coveredCents, finalCents: l.finalCents } });
  return a;
}

/** What one person sees about money for a plan: only their own numbers (+ helpers: how to help). */
export async function myMoney(itemId: string, memberId: string) {
  const share = await db.itemShare.findUnique({ where: { itemId_memberId: { itemId, memberId } } });
  if (!share) return null;
  const shares = await db.itemShare.findMany({ where: { itemId } });
  const paid = await db.itemChipIn.findMany({ where: { itemId, status: "PAID" } });
  const a = allocate(
    shares.map((s) => ({ id: s.memberId, baseCents: s.baseCents, capCents: s.capCents })),
    paid.map((c) => ({ memberId: c.fromMemberId, amountCents: c.amountCents })),
  );
  const mine = a.lines.find((l) => l.id === memberId)!;
  const myChip = await db.itemChipIn.findUnique({ where: { itemId_fromMemberId: { itemId, fromMemberId: memberId } } });
  return {
    baseCents: share.baseCents,
    coveredCents: mine.coveredCents,
    finalCents: share.finalCents,
    paid: !!share.paidAt,
    // Helpers only: the open need as an aggregate, and a suggestion. Never who needs it.
    canHelp: mine.isHelper && a.cardOpen,
    suggestCents: mine.suggestCents,
    chippedIn: myChip?.status === "PAID" ? myChip.amountCents : 0,
  };
}

/** Everyone who has room and could help (for the private chip-in invitation). */
export async function helpersFor(itemId: string) {
  const shares = await db.itemShare.findMany({ where: { itemId } });
  const a = allocate(shares.map((s) => ({ id: s.memberId, baseCents: s.baseCents, capCents: s.capCents })));
  return { need: a.needCents, helpers: a.lines.filter((l) => l.isHelper).map((l) => ({ memberId: l.id, suggestCents: l.suggestCents })) };
}

const back = (kind: string, itemId: string) => `${SITE_URL}/hush?paid={CHECKOUT_SESSION_ID}&k=${kind}&i=${itemId}`;

/** Start paying your own share. Returns the Stripe Checkout URL. */
export async function payShareCheckout(itemId: string, memberId: string) {
  if (!stripeEnabled()) throw new Error("Payments aren't set up yet (Stripe test key missing).");
  const share = await db.itemShare.findUnique({ where: { itemId_memberId: { itemId, memberId } }, include: { item: { select: { title: true } } } });
  if (!share) throw new Error("There's nothing to pay for this plan.");
  if (share.paidAt) throw new Error("You've already paid your share.");
  if (share.finalCents < 50) throw new Error("Your share is covered. Nothing to pay.");
  const s = await createCheckout({
    amountCents: share.finalCents,
    name: `Your share: ${share.item.title}`,
    description: "Silent Consensus test payment. No real money moves.",
    clientRef: memberId,
    metadata: { kind: "share", itemId, memberId },
    successUrl: back("share", itemId),
    cancelUrl: `${SITE_URL}/hush`,
  });
  await db.itemShare.update({ where: { itemId_memberId: { itemId, memberId } }, data: { stripeSession: s.id } });
  return s.url;
}

/** Start a quiet chip-in. The amount is checked against what's actually needed and your headroom. */
export async function chipInCheckout(itemId: string, memberId: string, amountCents: number) {
  if (!stripeEnabled()) throw new Error("Payments aren't set up yet (Stripe test key missing).");
  const shares = await db.itemShare.findMany({ where: { itemId } });
  const paid = await db.itemChipIn.findMany({ where: { itemId, status: "PAID", NOT: { fromMemberId: memberId } }, orderBy: { createdAt: "asc" } });
  const trial = allocate(
    shares.map((s) => ({ id: s.memberId, baseCents: s.baseCents, capCents: s.capCents })),
    [...paid.map((c) => ({ memberId: c.fromMemberId, amountCents: c.amountCents })), { memberId, amountCents }],
  );
  const mine = trial.lines.find((l) => l.id === memberId);
  if (!mine?.isHelper) throw new Error("This isn't needed from you.");
  const take = mine.chipInCents;
  if (take < 50) throw new Error("The group doesn't need that much anymore. Thank you!");
  const item = await db.chatItem.findUniqueOrThrow({ where: { id: itemId }, select: { title: true } });
  const s = await createCheckout({
    amountCents: take,
    name: `Quiet chip-in: ${item.title}`,
    description: "Anonymous. Nobody in the group will know who gave. Silent Consensus test payment; no real money moves.",
    clientRef: memberId,
    metadata: { kind: "chipin", itemId, memberId },
    successUrl: back("chipin", itemId),
    cancelUrl: `${SITE_URL}/hush`,
  });
  await db.itemChipIn.upsert({
    where: { itemId_fromMemberId: { itemId, fromMemberId: memberId } },
    create: { itemId, fromMemberId: memberId, amountCents: take, stripeSession: s.id },
    update: { amountCents: take, stripeSession: s.id, status: "PENDING" },
  });
  return s.url;
}

/**
 * Back from Stripe: verify the session with Stripe itself (test mode, this member, this plan, the
 * exact amount), then record it. Returns a short note for the person, or null if it didn't check out.
 */
export async function confirmCheckout(sessionId: string, memberIds: string[]) {
  const s = await getCheckout(sessionId);
  if (s.livemode || s.payment_status !== "paid") return null;
  const { kind, itemId, memberId } = s.metadata ?? {};
  if (!itemId || !memberId || !memberIds.includes(memberId) || s.client_reference_id !== memberId) return null;
  if (kind === "share") {
    const share = await db.itemShare.findUnique({ where: { itemId_memberId: { itemId, memberId } } });
    if (!share || share.stripeSession !== sessionId || s.amount_total !== share.finalCents) return null;
    if (!share.paidAt) await db.itemShare.update({ where: { itemId_memberId: { itemId, memberId } }, data: { paidAt: new Date() } });
    return { memberId, itemId, note: `Paid ${money(share.finalCents)} for your share. Thank you! (Test payment, no real money moved.)` };
  }
  if (kind === "chipin") {
    const c = await db.itemChipIn.findUnique({ where: { itemId_fromMemberId: { itemId, fromMemberId: memberId } } });
    if (!c || c.stripeSession !== sessionId || s.amount_total !== c.amountCents) return null;
    const first = c.status !== "PAID";
    if (first) await db.itemChipIn.update({ where: { id: c.id }, data: { status: "PAID" } });
    const before = await db.itemShare.findMany({ where: { itemId } });
    const a = await recompute(itemId);
    // Tell anyone whose share just went down (privately, and without saying who helped).
    if (first)
      for (const l of a.lines) {
        const old = before.find((b) => b.memberId === l.id);
        if (old && l.finalCents < old.finalCents) {
          await db.message.create({
            data: {
              memberId: l.id,
              role: "HUSH",
              topic: "dm",
              content: `Good news: your share is now ${money(l.finalCents)} (was ${money(old.finalCents)}). The group quietly covered the difference. Nobody knows it was for you.`,
            },
          });
        }
      }
    return { memberId, itemId, note: `Thank you. ${money(c.amountCents)} went into the quiet pool. No one will ever know it came from you. (Test payment, no real money moved.)` };
  }
  return null;
}
