import OpenAI from "openai";
import { z } from "zod";
import { db } from "@/lib/db";

// One LLM client, three OpenAI-compatible providers, tried in LLM_PROVIDERS order:
//   meta       → Meta Model API (muse-spark), primary
//   xai        → SpaceXAI Grok, fallback
//   openrouter → TypeSafe Jev router via OpenRouter, second fallback
// Providers without a key are skipped. Every call writes an AiTrace row.

export type ProviderId = "meta" | "xai" | "openrouter";
export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

type Provider = {
  id: ProviderId;
  label: string;
  model: string;
  client: OpenAI;
  supportsReasoningEffort: boolean;
};

const TIMEOUT_MS = 20_000;

let providersCache: Provider[] | null = null;

function providers(): Provider[] {
  if (providersCache) return providersCache;
  const all: Record<ProviderId, Provider | null> = {
    meta: process.env.MODEL_API_KEY
      ? {
          id: "meta",
          label: "Meta",
          model: process.env.META_MODEL ?? "muse-spark-1.3",
          client: new OpenAI({ apiKey: process.env.MODEL_API_KEY, baseURL: process.env.META_BASE_URL ?? "https://api.meta.ai/v1", maxRetries: 0 }),
          supportsReasoningEffort: true,
        }
      : null,
    xai: process.env.XAI_API_KEY
      ? {
          id: "xai",
          label: "Grok",
          model: process.env.XAI_MODEL ?? "grok-4.7",
          client: new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: process.env.XAI_BASE_URL ?? "https://api.x.ai/v1", maxRetries: 0 }),
          supportsReasoningEffort: false,
        }
      : null,
    openrouter: process.env.OPENROUTER_API_KEY
      ? {
          id: "openrouter",
          label: "Jev",
          model: process.env.OPENROUTER_MODEL ?? "typesafe/jev-router",
          client: new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
            maxRetries: 0,
            defaultHeaders: { "X-Title": "Silent Consensus", "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000" },
          }),
          // Jev's router chooses reasoning effort itself.
          supportsReasoningEffort: false,
        }
      : null,
  };
  const order = (process.env.LLM_PROVIDERS ?? "meta,xai,openrouter")
    .split(",")
    .map((s) => s.trim() as ProviderId)
    .filter((id) => id in all);
  providersCache = order.map((id) => all[id]).filter((p): p is Provider => p !== null);
  return providersCache;
}

export function configuredProviders() {
  return providers().map((p) => ({ id: p.id, label: p.label, model: p.model }));
}

// Providers that rejected json_schema once get json_object from then on.
const jsonObjectOnly = new Set<ProviderId>();

export class LLMUnavailableError extends Error {
  constructor(public attempts: string[]) {
    super("All LLM providers failed");
  }
}

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

export type CallArgs<S extends z.ZodType> = {
  task: string;
  messages: Msg[];
  schema: S;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  maxTokens?: number;
  circleId?: string | null;
  /** Human line for the trace panel. Counts and labels only: never private text. */
  label?: string;
  traceMeta?: Record<string, unknown>;
};

export type CallResult<T> = { data: T; provider: ProviderId; providerLabel: string; model: string; ms: number };

function responseFormat(p: Provider, task: string, schema: z.ZodType) {
  if (jsonObjectOnly.has(p.id)) return { type: "json_object" as const };
  return {
    type: "json_schema" as const,
    json_schema: {
      name: task.replace(/[^a-zA-Z0-9_-]/g, "_"),
      strict: false,
      schema: z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as Record<string, unknown>,
    },
  };
}

function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Output was not JSON");
  }
}

function isFormatRejection(e: unknown) {
  const status = (e as { status?: number })?.status;
  const msg = String((e as { message?: string })?.message ?? "").toLowerCase();
  return status === 400 && (msg.includes("response_format") || msg.includes("json_schema") || msg.includes("schema"));
}

const schemaCache = new WeakMap<z.ZodType, string>();
function schemaText(schema: z.ZodType) {
  let t = schemaCache.get(schema);
  if (!t) {
    t = JSON.stringify(z.toJSONSchema(schema, { target: "draft-7", io: "input" }));
    schemaCache.set(schema, t);
  }
  return t;
}

async function complete(p: Provider, args: CallArgs<z.ZodType>, messages: Msg[]) {
  // Some routed models ignore response_format, so the schema also goes in the prompt.
  const withSchema: Msg[] = [
    ...messages,
    {
      role: "system",
      content: `Respond with ONE JSON object that matches this JSON Schema exactly. Include every required key, use arrays where arrays are expected, no extra text:\n${schemaText(args.schema)}`,
    },
  ];
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: p.model,
    messages: withSchema,
    response_format: responseFormat(p, args.task, args.schema),
    temperature: args.temperature ?? 0.5,
    // Reasoning tokens count against max_tokens, so reasoning providers get headroom for the answer.
    max_tokens: (args.maxTokens ?? 1200) + (p.supportsReasoningEffort ? 3000 : 0),
  };
  if (p.supportsReasoningEffort && args.reasoningEffort) {
    // Measured Sep 26: muse-spark at low/medium can spend its whole budget reasoning and return no
    // content (finish_reason "length"). "minimal" answers reliably in ~2-13s. Override with META_REASONING.
    const effort = process.env.META_REASONING ?? "minimal";
    (body as unknown as Record<string, unknown>).reasoning_effort = effort;
  }
  const res = await p.client.chat.completions.create(body, { timeout: TIMEOUT_MS });
  if (res?.choices?.[0]?.finish_reason === "length" && !res.choices[0].message?.content) {
    throw Object.assign(new Error("Ran out of tokens before answering"), { status: 502 });
  }
  if (!res?.choices?.length) {
    // OpenRouter can answer 200 with an error body (upstream overload). Treat it as transient.
    const upstream = (res as unknown as { error?: { message?: string; code?: number } })?.error;
    throw Object.assign(new Error(`Upstream error: ${upstream?.message ?? "no choices"}`), { status: upstream?.code ?? 502 });
  }
  return { text: res.choices[0]?.message?.content ?? "", routedModel: res.model };
}

async function trace(
  args: CallArgs<z.ZodType>,
  provider: string,
  ms: number,
  ok: boolean,
  meta: Record<string, unknown>,
) {
  try {
    await db.aiTrace.create({
      data: {
        circleId: args.circleId ?? null,
        task: args.task,
        provider,
        ms,
        ok,
        label: args.label ?? args.task,
        meta: { ...args.traceMeta, ...meta } as object,
      },
    });
  } catch {
    // Tracing must never break a user request.
  }
}

/**
 * Call the provider chain and return Zod-validated data.
 * Per provider: try once; on invalid output, one repair retry; on a timeout,
 * 429, 5xx or second invalid output, move to the next provider.
 */
export async function callLLM<S extends z.ZodType>(args: CallArgs<S>): Promise<CallResult<z.infer<S>>> {
  const chain = providers();
  const attempts: string[] = [];
  const started = Date.now();

  for (const p of chain) {
    let messages = args.messages;
    let repaired = false;
    let transientRetries = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      const t0 = Date.now();
      try {
        let out;
        try {
          out = await complete(p, args, messages);
        } catch (e) {
          if (!isFormatRejection(e) || jsonObjectOnly.has(p.id)) throw e;
          jsonObjectOnly.add(p.id);
          out = await complete(p, args, messages);
        }
        let json: unknown;
        try {
          json = parseJson(out.text);
        } catch {
          json = undefined; // not JSON at all: fails validation below and gets the repair retry
        }
        const parsed = args.schema.safeParse(json);
        if (parsed.success) {
          const ms = Date.now() - t0;
          await trace(args, p.id, ms, true, {
            model: out.routedModel ?? p.model,
            providerLabel: p.label,
            fallbacks: attempts.length,
            totalMs: Date.now() - started,
          });
          return { data: parsed.data, provider: p.id, providerLabel: p.label, model: out.routedModel ?? p.model, ms };
        }
        if (repaired) {
          attempts.push(`${p.id}: invalid output after repair`);
          break;
        }
        repaired = true;
        attempts.push(
          `${p.id}: invalid output ${parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")} | ${out.text.slice(0, 160)}`,
        );
        // Repair retry on the same provider, then give up on it.
        messages = [
          ...args.messages,
          { role: "assistant", content: out.text.slice(0, 4000) },
          {
            role: "user",
            content: `Your JSON failed validation: ${parsed.error.issues
              .slice(0, 5)
              .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
              .join("; ")}. Return only the corrected JSON.`,
          },
        ];
      } catch (e) {
        const status = (e as { status?: number })?.status;
        const err = e as Error & { status?: number };
        attempts.push(`${p.id}: ${status ?? err?.constructor?.name ?? "error"} ${String(err?.message ?? "").slice(0, 120)}`);
        // Transient (timeout, 429, 5xx, bad JSON): up to two backoff retries on this provider, then move on.
        const transient = status === undefined || status === 429 || status >= 500;
        if (transient && transientRetries < 2) {
          await new Promise((r) => setTimeout(r, 600 * ++transientRetries));
          continue;
        }
        break;
      }
    }
  }

  await trace(args, "none", Date.now() - started, false, { attempts });
  throw new LLMUnavailableError(attempts);
}

export const HUSH_TROUBLE = "I'm having trouble thinking right now. Try again in a moment.";
