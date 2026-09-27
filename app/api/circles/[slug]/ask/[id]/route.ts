import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { answerAsk, resolveAsk } from "@/lib/hushask";
import { geocode } from "@/lib/places";

// Answer one of Hush's questions PRIVATELY: tap an option, write your own, or (for "where are you
// coming from?") share your location or type a city / ZIP. Nothing is posted to the group; Hush
// announces only the result once everyone has answered. Locations are rounded to about 1 km and
// never shown to anyone.
const Body = z.object({
  choice: z.number().int().min(0).max(9).optional(),
  text: z.string().trim().max(200).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  where: z.string().trim().max(100).optional(), // a city or ZIP, for location questions
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this chat", 401);
  if (!rateLimit(`ask:${me.id}`, 30, 5 * 60_000)) return jsonError("Slow down a little.", 429);
  const ask = await db.hushAsk.findUnique({ where: { id }, select: { circleId: true, field: true } });
  if (!ask || ask.circleId !== me.circleId) return jsonError("Not found", 404);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const answer = { ...body.data };
  let label: string | null = null;
  if (ask.field === "location" && answer.where) {
    const g = await geocode(answer.where).catch(() => null);
    if (!g) return jsonError("I couldn't find that place. Try a ZIP code or \"City, ST\".", 400);
    answer.lat = g.lat;
    answer.lng = g.lng;
    label = g.label;
  }
  const r = await answerAsk(id, me.id, answer);
  if (r.ready) after(() => resolveAsk(id).catch((e) => console.error("resolve ask failed", e)));
  return NextResponse.json({ ok: true, closed: r.closed, label });
}
