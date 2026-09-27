import { NextResponse } from "next/server";
import { z } from "zod";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { TwilioError } from "@/lib/twilio/client";
import { createGroupText, GroupTextError } from "@/lib/twilio/hush";

const Body = z.object({
  invite: z
    .array(z.object({ name: z.string().trim().min(1).max(30), phone: z.string().trim().min(7).max(24) }))
    .max(8)
    .default([]),
});

/**
 * Organizer only: start the Twilio group text for this circle with every member who linked a
 * phone and opted in to texts (plus invited friends who already opted in), and add Hush.
 * Anyone who hasn't opted in is left out and gets no texts. Never returns phone numbers.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  if (me.id !== me.circle.organizerId) return jsonError("Only the organizer can start the group text.", 403);
  if (!rateLimit(`group:${me.circleId}`, 3, 10 * 60_000)) return jsonError("Give it a minute and try again.", 429);

  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  try {
    const r = await createGroupText(me.circle, body.data.invite);
    // Names only (typed by the organizer), never numbers: people left out because they haven't opted in.
    return NextResponse.json({ ok: true, participants: r.participants, notOptedIn: r.notOptedIn });
  } catch (e) {
    if (e instanceof GroupTextError) return jsonError(e.message, 400);
    if (e instanceof TwilioError) {
      console.error("group text failed", e.code, e.message);
      return jsonError("Twilio couldn't start the group text. Check the numbers and try again.", 502);
    }
    throw e;
  }
}
