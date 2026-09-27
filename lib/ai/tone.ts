import { z } from "zod";
import { callLLM, LLMUnavailableError } from "@/lib/ai/client";

// Work groups: Hush reads each message before it's delivered, and if it would come across as rude,
// hostile, passive-aggressive or unprofessional, it suggests a cordial rewrite that keeps the same
// point. Only the sender sees the suggestion. Fails open: if the model is slow or down, the message
// goes out as written, so chat never breaks because of the check.

const TIMEOUT_MS = 7_000;

const Review = z.object({
  verdict: z.enum(["ok", "revise"]),
  issue: z.string().nullable().describe("Very short, kind reason, e.g. 'This may read as blaming Sam.' Null if ok."),
  suggestion: z.string().nullable().describe("The rewrite, in the sender's voice, same point, cordial. Null if ok."),
  severity: z
    .enum(["none", "tone", "serious"])
    .describe("serious = harassment, threats, slurs, discrimination or sexual comments about someone; tone = rude/unprofessional; none if ok"),
});
export type ToneReview = z.infer<typeof Review>;

export async function reviewWorkMessage(text: string, recent: string[], circleId: string): Promise<ToneReview | null> {
  const ask = callLLM({
    task: "work_tone_review",
    label: "Work chat: tone check before delivery",
    circleId,
    schema: Review,
    reasoningEffort: "low",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You review a message someone is about to send in a work team's group chat, before anyone else sees it. " +
          "Say 'revise' if it has an unprofessional tone or unprofessional language: rude, hostile, insulting, " +
          "condescending, sarcastic at someone, passive-aggressive, blaming or shaming, yelling in ALL CAPS, swearing " +
          "or crude language (even if not aimed at anyone), slurs, or inappropriate personal comments. Direct, brief, " +
          "casual-but-polite, or respectfully disagreeing messages are fine: say 'ok'. When revising, keep the " +
          "sender's point and voice, keep it short, remove the unprofessional words, make it cordial and constructive, " +
          "and don't add apologies or corporate filler.",
      },
      {
        role: "user",
        content: `Recent chat (for context):\n${recent.slice(-8).join("\n") || "(none)"}\n\nMessage to review:\n${text}`,
      },
    ],
  }).then((r) => r.data);
  try {
    return await Promise.race([ask, new Promise<null>((res) => setTimeout(() => res(null), TIMEOUT_MS))]);
  } catch (e) {
    if (!(e instanceof LLMUnavailableError)) console.error("tone review failed", e);
    return null;
  }
}
