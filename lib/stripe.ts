// Stripe Checkout in TEST MODE ONLY. The project rule is "no real payments, ever" (docs/HANDOFF.md):
// a live key is treated as not configured, so live charges can't happen even by mistake.
// Plain REST over fetch (no SDK). Checkout descriptions never mention chip-ins or other members.

const API = "https://api.stripe.com/v1";

function testKey() {
  const k = process.env.STRIPE_SECRET_KEY ?? "";
  return /^(sk|rk)_test_/.test(k) ? k : null;
}

export const stripeEnabled = () => !!testKey();

async function stripe<T>(method: "GET" | "POST", path: string, form?: Record<string, string>): Promise<T> {
  const key = testKey();
  if (!key) throw new Error("Stripe test key is not configured");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${data.error?.message ?? "request failed"}`);
  return data;
}

type Session = {
  id: string;
  url: string | null;
  livemode: boolean;
  payment_status: string;
  amount_total: number | null;
  client_reference_id: string | null;
  metadata: Record<string, string>;
};

/** A hosted Checkout page for exactly this member's share of this plan. */
export function createShareCheckout(opts: {
  memberId: string;
  planId: string;
  amountCents: number;
  planTitle: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe<Session>("POST", "/checkout/sessions", {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(opts.amountCents),
    "line_items[0][price_data][product_data][name]": `Your share: ${opts.planTitle}`.slice(0, 120),
    "line_items[0][price_data][product_data][description]": "Silent Consensus test payment. No real money moves.",
    client_reference_id: opts.memberId,
    "metadata[memberId]": opts.memberId,
    "metadata[planId]": opts.planId,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
}

/** A hosted test-mode Checkout page for any amount (a plan share, or a quiet chip-in). */
export function createCheckout(opts: {
  amountCents: number;
  name: string;
  description: string;
  clientRef: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}) {
  const form: Record<string, string> = {
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(opts.amountCents),
    "line_items[0][price_data][product_data][name]": opts.name.slice(0, 120),
    "line_items[0][price_data][product_data][description]": opts.description.slice(0, 300),
    client_reference_id: opts.clientRef,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  };
  for (const [k, v] of Object.entries(opts.metadata)) form[`metadata[${k}]`] = v;
  return stripe<Session>("POST", "/checkout/sessions", form);
}

/** Is the configured test key actually accepted by Stripe? (Used to explain what's wrong.) */
export async function stripeKeyWorks() {
  try {
    await stripe("GET", "/balance");
    return true;
  } catch {
    return false;
  }
}

export function getCheckout(sessionId: string) {
  if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) throw new Error("Not a test Checkout session");
  return stripe<Session>("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
}
