import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { ensureOpening, handleTurn, toOwnMessage } from "@/lib/ai/interview";
import { rateLimit } from "@/lib/ratelimit";
import { HUSH_TROUBLE } from "@/lib/ai/client";

export const maxDuration = 60;

function slugOf(req: Request) {
  return new URL(req.url).searchParams.get("c") ?? "";
}

// The caller's own private chat. Never returns anyone else's messages.
export async function GET(req: Request) {
  const me = await getMember(slugOf(req));
  if (!me) return jsonError("Not a member of this plan", 401);
  await ensureOpening(me);
  const messages = await db.message.findMany({ where: { memberId: me.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json(
    {
      me: { id: me.id, name: me.name, interviewStatus: me.interviewStatus, isOrganizer: me.id === me.circle.organizerId },
      circle: { kind: me.circle.kind, title: me.circle.title, status: me.circle.status },
      messages: messages.map(toOwnMessage),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const Body = z.object({
  text: z.string().trim().max(1000).optional(),
  optionIndex: z.number().int().min(0).max(4).optional(),
  retry: z.boolean().optional(),
});

export async function POST(req: Request) {
  const me = await getMember(slugOf(req));
  if (!me) return jsonError("Not a member of this plan", 401);
  if (!rateLimit(`chat:${me.id}`)) return jsonError("Slow down a little and try again in a minute.", 429);

  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  let text = body.data.text;
  if (body.data.optionIndex !== undefined) {
    const lastHush = await db.message.findFirst({
      where: { memberId: me.id, role: "HUSH" },
      orderBy: { createdAt: "desc" },
    });
    const opts = (lastHush?.options as string[] | null) ?? [];
    text = opts[body.data.optionIndex];
    if (!text) return jsonError("That option isn't available anymore.");
  }
  if (!text && !body.data.retry) return jsonError("Say something to Hush first.");

  const res = await handleTurn(me, { text, retry: body.data.retry });
  return NextResponse.json({ messages: res.messages.map(toOwnMessage), error: res.error ?? null, trouble: res.error ? HUSH_TROUBLE : null });
}
