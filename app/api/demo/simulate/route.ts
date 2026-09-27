import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, parseBody } from "@/lib/http";
import { ensureOpening, handleTurn, toOwnMessage } from "@/lib/ai/interview";
import { personaFor, type Story } from "@/lib/demo";
import { personaReply } from "@/lib/ai/persona";
import { demoOnly } from "../guard";

export const maxDuration = 60;

const Body = z.object({ memberId: z.string() });

/** One simulated turn for a demo persona: persona answers, then Hush replies. */
export async function POST(req: Request) {
  const off = demoOnly();
  if (off) return off;
  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const member = await db.member.findUnique({ where: { id: body.data.memberId }, include: { circle: true } });
  if (!member || !member.circle.isDemo || !member.persona) return jsonError("Not a demo member", 404);
  if (member.interviewStatus === "DONE") return NextResponse.json({ done: true, messages: [] });

  await ensureOpening(member);
  const history = await db.message.findMany({ where: { memberId: member.id }, orderBy: { createdAt: "asc" } });
  if (history.at(-1)?.role === "MEMBER") {
    // Hush's last reply failed: retry it rather than answering the same question twice.
    const res = await handleTurn(member, { retry: true });
    const fresh = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { interviewStatus: true } });
    return NextResponse.json({ done: fresh.interviewStatus === "DONE", error: res.error ?? null, messages: res.messages.map(toOwnMessage) });
  }
  const last = [...history].reverse().find((m) => m.role === "HUSH");
  if (!last) return jsonError("No question to answer", 409);

  const [story, key] = member.persona.split(":") as [Story, string];
  const p = personaFor(story, key);
  if (!p) return jsonError("Unknown persona", 404);

  let reply: Awaited<ReturnType<typeof personaReply>>;
  try {
    reply = await personaReply(
    p,
    { content: last.content, options: (last.options as string[] | null) ?? null, topic: last.topic },
    history.map((h) => ({ role: h.role, content: h.transcript ?? h.content })),
    member.circleId,
  );
  } catch {
    return NextResponse.json({ done: false, error: "persona_unavailable", messages: [] });
  }
  const text = "optionIndex" in reply && reply.optionIndex !== undefined ? (last.options as string[])[reply.optionIndex] : reply.text;
  const res = await handleTurn(member, { text });
  const fresh = await db.member.findUniqueOrThrow({ where: { id: member.id }, select: { interviewStatus: true } });
  return NextResponse.json({ done: fresh.interviewStatus === "DONE", error: res.error ?? null, messages: res.messages.map(toOwnMessage) });
}
