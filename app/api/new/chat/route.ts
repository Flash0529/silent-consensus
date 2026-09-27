import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseBody } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { configuredProviders, HUSH_TROUBLE, LLMUnavailableError } from "@/lib/ai/client";
import { SetupDraft } from "@/lib/ai/schemas";
import { handleSetupTurn } from "@/lib/ai/setup";

export const maxDuration = 60;

// Organizer setup chat for /new. Server-side proxy: API keys never reach the browser.
const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(40),
  draft: SetupDraft.default({}),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`setup:${ip}`)) return jsonError("Slow down a little and try again in a minute.", 429);

  const body = await parseBody(req, Body);
  if (!body.ok) return body.res;
  const { messages, draft } = body.data;
  if (messages.at(-1)!.role !== "user") return jsonError("Say something to Hush first.");

  if (configuredProviders().length === 0) {
    console.error("setup chat: no LLM provider configured (set MODEL_API_KEY, XAI_API_KEY or OPENROUTER_API_KEY)");
    return jsonError(
      process.env.NODE_ENV === "production" ? HUSH_TROUBLE : "No AI provider is configured. Set MODEL_API_KEY in .env and restart the dev server.",
      503,
    );
  }

  try {
    // Keep the most recent turns; the draft carries everything older.
    return NextResponse.json(await handleSetupTurn(messages.slice(-24), draft));
  } catch (e) {
    if (!(e instanceof LLMUnavailableError)) console.error("setup turn failed", e);
    else console.error("setup turn: all providers failed", e.attempts);
    return jsonError(HUSH_TROUBLE, 503);
  }
}
