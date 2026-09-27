import { NextResponse } from "next/server";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";
import { myShareView } from "@/lib/mine";
import { stripeEnabled } from "@/lib/stripe";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("c") ?? "";
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  const view = await myShareView(me.id, me.circleId);
  // stripe: whether paying goes through Stripe Checkout (test mode) or the mock.
  return NextResponse.json({ name: me.name, share: view, stripe: stripeEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
