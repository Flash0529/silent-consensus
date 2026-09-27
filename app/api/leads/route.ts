import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { LeadBody, leadData } from "@/lib/leads";
import { rateLimit } from "@/lib/ratelimit";

// Early-access waitlist and Teams pilot requests from the marketing site.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`lead:${ip}`, 5)) return jsonError("Too many tries. Give it a minute.", 429);

  const body = await parseBody(req, LeadBody);
  if (!body.ok) return body.res;
  // Bots fill the hidden field; tell them it worked and store nothing.
  if (body.data.website) return NextResponse.json({ ok: true });

  const data = leadData(body.data);
  try {
    // Re-submitting updates the row instead of erroring, so the response never reveals who already signed up.
    await db.lead.upsert({
      where: { kind_email: { kind: data.kind, email: data.email } },
      create: data,
      update: data,
    });
  } catch (err) {
    console.error("lead upsert failed", err);
    return jsonError("We couldn't save that right now. Please try again.", 503);
  }
  return NextResponse.json({ ok: true });
}
