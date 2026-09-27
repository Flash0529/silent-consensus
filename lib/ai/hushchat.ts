import { z } from "zod";
import { db } from "@/lib/db";
import { callLLM, LLMUnavailableError } from "@/lib/ai/client";
import { groupAbout } from "@/lib/personmd";
import { aiFileLines } from "@/lib/files";
import { roomVoiceFor } from "@/lib/checkin";
import { replying } from "@/lib/ai/detect";
import { clip, clipOrNull } from "@/lib/text";

// Hush answering in the group when someone talks to it (mentions "Hush" or replies to Hush).
// It only knows the group chat (which everyone can see) and the pinned cards, never private answers,
// so it can't leak them. When the group needs to decide something, it asks a question that everyone
// answers privately instead of polling in public.

const Reply = z.object({
  reply: z.string().describe("Short answer to the person, 1-3 sentences. Never say who wants or said what."),
  startPlanning: z
    .boolean()
    .describe("true if the group wants help planning or deciding something (then you'll ask everyone privately in their Hush chat)"),
  brief: z.string().nullable().describe("If startPlanning: what they're planning, in one sentence (e.g. 'A concert this month, then food after')"),
  itemId: z.string().nullable().describe("If startPlanning and it's about a pinned plan: its id"),
});

export async function hushChat(circleId: string, text: string) {
  replying.add(circleId);
  try {
    await reply(circleId, text);
  } finally {
    replying.delete(circleId);
  }
}

async function reply(circleId: string, text: string) {
  const circle = await db.circle.findUnique({ where: { id: circleId }, select: { mode: true, isDirect: true } });
  const rows = await db.groupMessage.findMany({
    where: { circleId, kind: { in: ["TEXT", "HUSH"] } },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { member: { select: { name: true } } },
  });
  const lines = rows.reverse().map((r) => `${r.kind === "HUSH" ? "Hush (you)" : (r.member?.name ?? "Someone")}: ${r.body}`);
  const items = await db.chatItem.findMany({ where: { circleId, status: "OPEN" }, orderBy: { createdAt: "desc" }, take: 10 });
  const pinned = items.map((i) => `- id=${i.id} ${i.kind} "${i.title}" when: ${i.whenText ?? i.startsAt?.toISOString() ?? "not set"} place: ${i.place ?? "not set"}`).join("\n") || "(none)";
  let data: z.infer<typeof Reply>;
  try {
    ({ data } = await callLLM({
      task: "hush_group_reply",
      label: "Group chat: someone talked to Hush",
      circleId,
      schema: Reply,
      reasoningEffort: "low",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            `You are Hush, a quiet helper inside a ${circle?.mode === "WORK" ? "work team's" : "friend group's"} chat. ${await roomVoiceFor(circleId)} Someone just talked to you. ` +
            "Answer helpfully and briefly, like a thoughtful friend (professional in work chats). Suggest concrete ideas when asked. " +
            "You never reveal or guess anyone's private preferences, and never say who wants or said what. " +
            "If the group wants help planning or choosing something (a time, a place, an activity, a concert), set startPlanning=true and say you'll check with each of them privately in their Hush chat. Never poll the group in public.",
        },
        { role: "user", content: `${await groupAbout(circleId)}\n\nPinned plans:\n${pinned}\n\nRecent chat (oldest first):\n${lines.join("\n")}${(await aiFileLines(circleId)).map((f) => `\n${f}`).join("")}\n\nThey said to you: ${text}` },
      ],
    }));
  } catch (e) {
    if (!(e instanceof LLMUnavailableError)) console.error("hush chat failed", e);
    await db.groupMessage.create({ data: { circleId, kind: "HUSH", body: "Sorry, I'm having trouble thinking right now. Try me again in a minute." } });
    return;
  }
  await db.groupMessage.create({ data: { circleId, kind: "HUSH", body: clip(data.reply, 1000) } });
  if (data.startPlanning) {
    const { startSession } = await import("@/lib/checkin");
    const itemId = data.itemId && items.some((i) => i.id === data.itemId) ? data.itemId : null;
    const id = await startSession(circleId, { itemId, reason: "The group asked Hush to help plan", brief: data.brief });
    if (!id) await db.groupMessage.create({ data: { circleId, kind: "HUSH", body: "I'm already planning something with everyone privately. Check your Hush chat!" } });
  }
}

