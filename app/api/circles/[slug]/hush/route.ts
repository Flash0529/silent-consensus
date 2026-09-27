import { NextResponse } from "next/server";
import { z } from "zod";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { hushListens } from "@/lib/groupchat";
import { detectNow } from "@/lib/ai/detect";

// Bring Hush in by hand (press and hold an empty spot in the chat): "plan" = check in with everyone
// privately and find one plan; "scan" = read the chat for plans and to-dos right now.
const Body = z.object({ action: z.enum(["plan", "scan"]) });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  if (!rateLimit(`hush-action:${me.circleId}`, 6, 5 * 60_000)) return jsonError("Hush is already on it. Give it a minute.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  if (body.data.action === "plan") {
    await hushListens(me.circleId, me.id, "Hush, plan this");
    return NextResponse.json({ ok: true });
  }
  const r = await detectNow(me.circleId);
  return NextResponse.json({ ok: true, ...r });
}
