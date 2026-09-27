import { it } from "vitest";
import { callLLM } from "@/lib/ai/client";
import { MediationInterviewTurn } from "@/lib/ai/schemas";
import { mediationInterviewPrompt } from "@/lib/ai/prompts/interview";

it("20 mediation turns: failure causes", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      callLLM({
        task: "stress",
        schema: MediationInterviewTurn,
        reasoningEffort: "low",
        messages: [
          { role: "system", content: mediationInterviewPrompt({ name: "Omar", organizer: "Jordan", isOrganizer: false, title: "The apartment", activity: "conversation", dateLabel: "Sat, Oct 3", topic: "The apartment", known: {} }) },
          { role: "assistant", content: "In your own words, what's been going on?" },
          { role: "user", content: "I'm always the one doing the dishes and I'm sick of it." },
        ],
      }),
    ),
  );
  const fails = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
  console.log("ok", results.length - fails.length, "failed", fails.length);
  for (const f of fails) console.log(JSON.stringify((f.reason as { attempts?: string[] }).attempts));
}, 180_000);
