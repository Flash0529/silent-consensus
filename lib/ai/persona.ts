import { z } from "zod";
import { callLLM } from "@/lib/ai/client";
import type { Persona } from "@/lib/demo";

const Reply = z.object({ optionIndex: z.number().int().min(0).max(4).nullable(), text: z.string().max(300).nullable() });

/** An LLM plays a demo persona for one turn. Scripted lines win for key demo beats. */
export async function personaReply(
  p: Persona,
  last: { content: string; options: string[] | null; topic: string | null },
  history: { role: "HUSH" | "MEMBER"; content: string }[],
  circleId: string,
) {
  const script = p.script?.[last.topic ?? ""] ?? (history.filter((h) => h.role === "MEMBER").length === 0 ? p.script?.any : undefined);
  if (script) return { text: script };
  if (last.topic === "confirm" || last.topic === "consent" || last.topic === "returning" || last.topic === "remember")
    return { optionIndex: 0 };

  const { data } = await callLLM({
    task: "persona",
    label: "Demo persona reply",
    circleId,
    schema: Reply,
    reasoningEffort: "low",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `You are ${p.name}, texting a private assistant called Hush. Style: ${p.style}.
Your private facts (stay consistent, never invent new ones, only share what the question asks about):
${p.facts.map((f) => `- ${f}`).join("\n")}
Reply to Hush's LAST message, sharing the fact that answers it.
- Pick an option (optionIndex, 0-based, text null) ONLY if it states your fact accurately. Never pick vague options like "Something else", "I'd rather type it", "I'd rather explain", "Yes, a hard line", "Leave out a specific topic".
- Otherwise write text (optionIndex null): one short casual sentence, max 20 words, that states the relevant fact plainly.
- If asked what must stay private, name your off-limits item directly, or say "Nothing's off-limits".
Output JSON only.`,
      },
      {
        role: "user",
        content: `Conversation so far:\n${history
          .slice(-10)
          .map((h) => `${h.role === "HUSH" ? "Hush" : p.name}: ${h.content}`)
          .join("\n")}\n\nHush's last message: ${last.content}${
          last.options?.length ? `\nOptions: ${last.options.map((o, i) => `${i}) ${o}`).join(", ")}` : ""
        }`,
      },
    ],
  });
  if (data.optionIndex !== null && last.options?.[data.optionIndex]) return { optionIndex: data.optionIndex };
  return { text: data.text ?? "Sounds good." };
}
