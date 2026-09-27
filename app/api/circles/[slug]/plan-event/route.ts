import { NextResponse } from "next/server";
import { getMember } from "@/lib/identity";
import { jsonError } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { openSession, startSession } from "@/lib/checkin";

// "Plan event": you describe it to Hush in your Hush chat, then Hush checks with everyone privately.
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this chat", 401);
  if (!rateLimit(`plan-event:${me.id}`, 5, 10 * 60_000)) return jsonError("Give it a minute and try again.", 429);
  if (await openSession(me.circleId)) return NextResponse.json({ ok: true, already: true });
  await startSession(me.circleId, { reason: `${me.name} wants to plan something`, organizerId: me.id, intake: true });
  return NextResponse.json({ ok: true });
}
