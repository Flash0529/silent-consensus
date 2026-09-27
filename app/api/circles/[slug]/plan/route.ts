import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { startPipeline } from "@/lib/pipeline";

export const maxDuration = 60;

const Body = z.object({ replan: z.boolean().optional() });

// Organizer only: "Plan now" (skip people who haven't finished) or one replan.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this plan", 401);
  if (me.id !== me.circle.organizerId) return jsonError("Only the organizer can do that", 403);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;

  if (!body.data.replan) {
    const done = await db.member.count({ where: { circleId: me.circleId, interviewStatus: "DONE" } });
    if (done < 2) return jsonError("Hush needs at least two finished chats first.", 409);
  }
  const started = await startPipeline(me.circleId, { replan: body.data.replan });
  if (!started) return jsonError(body.data.replan ? "Hush already replanned once." : "Hush is already on it.", 409);
  return NextResponse.json({ ok: true }, { status: 202 });
}
