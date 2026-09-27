import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMember } from "@/lib/identity";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { dmTurn, dmView, ensureDmHello, maybeAnalyze } from "@/lib/checkin";

// Your private chat with Hush about this group. Only your own messages; nothing here is ever shown to
// anyone else. When Hush is checking in about a plan, its questions come here; when you're done you
// go back to the group chat.

export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this chat", 401);
  await ensureDmHello(me);
  const view = await dmView(me);
  return NextResponse.json(
    { ...view, group: { title: me.circle.isDirect ? "your DM" : me.circle.title, slug } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const Body = z.object({ text: z.string().trim().min(1).max(1000).optional(), optionIndex: z.number().int().min(0).max(5).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const me = await getMember(slug);
  if (!me) return jsonError("Not a member of this chat", 401);
  if (!rateLimit(`dm:${me.id}`, 20, 60_000)) return jsonError("Slow down a little and try again in a minute.", 429);
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  let text = body.data.text;
  if (body.data.optionIndex !== undefined) {
    const last = await db.message.findFirst({
      where: { memberId: me.id, role: "HUSH", OR: [{ topic: "dm" }, { topic: { startsWith: "ci:" } }] },
      orderBy: { createdAt: "desc" },
    });
    text = ((last?.options as string[] | null) ?? [])[body.data.optionIndex];
    if (!text) return jsonError("That option isn't available anymore.");
  }
  if (!text) return jsonError("Say something to Hush first.");
  const active = await db.hushCheckInReply.findFirst({ where: { memberId: me.id, status: "ASKING", checkIn: { status: "OPEN" } }, select: { checkInId: true } });
  const r = await dmTurn(me, text);
  // Last one to finish → Hush looks at everything together and tells the group the result.
  if (r.done && active) after(() => maybeAnalyze(active.checkInId).catch((e) => console.error("check-in analysis failed", e)));
  return NextResponse.json({ ok: true, done: r.done, ...(await dmView(me)) });
}
