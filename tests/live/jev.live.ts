import { describe, expect, it } from "vitest";
import { z } from "zod";
import { callLLM, configuredProviders } from "@/lib/ai/client";

// Live smoke test (hits the network). Run: npm run test:live
describe("callLLM live", () => {
  it("extracts constraints through the configured chain", async () => {
    console.log("providers:", configuredProviders());
    const res = await callLLM({
      task: "smoke",
      schema: z.object({
        budgetCapCents: z.number().int().nullable(),
        alcohol: z.enum(["fine", "prefer_none", "none"]).nullable(),
        stepFreeRequired: z.boolean().nullable(),
      }),
      messages: [
        { role: "system", content: "Extract planning constraints. Output JSON only." },
        { role: "user", content: "Under 15 honestly. I don't drink, and I use a wheelchair." },
      ],
      reasoningEffort: "low",
    });
    console.log(res);
    expect(res.data).toEqual({ budgetCapCents: 1500, alcohol: "none", stepFreeRequired: true });
  }, 60_000);
});
