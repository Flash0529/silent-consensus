import { z } from "zod";
import { callLLM, LLMUnavailableError } from "@/lib/ai/client";

// Spec §2.3: a cheap rules pass on every group message; an LLM judge only when a rule fires;
// then act only past a confidence threshold, a per-group cooldown and a daily cap.
// Message text is used transiently and never stored.

export type Kind = "budget" | "diet" | "drinks" | "access" | "timing" | "conflict" | "unclear" | "asked";
export type GroupLine = { author: string; body: string };

const HEDGE =
  /\b(maybe|i'?ll see|we'?ll see|idk|i dunno|not sure|busy|can'?t (?:this week|make it|do (?:it|that))|might (?:skip|pass)|probably (?:not|can'?t)|i'?ll pass|count me out)\b/i;
const PRICEY =
  /\b(steak ?house|omakase|tasting menu|bottle service|fancy|pricey|expensive|splurge|rooftop bar|club|concert tickets?)\b/i;
const DRINKS = /\b(bar|brewery|pub|drinks|happy hour|wine|shots|cocktails?)\b/i;
const FOOD = /\b(bbq|barbecue|pork|burgers?|sushi|steak|seafood|wings)\b/i;
const ACCESS = /\b(hike|hiking|climb|stairs|rooftop|walk up|escape room|bouldering)\b/i;
const MONEY = /\$\s?(\d{2,4})/;
const TIME =
  /\b(\d{1,2}(?::\d{2})?\s?(?:am|pm)|tonight|tomorrow|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|this weekend|next week)\b/gi;
const ASKED = /(^|\s)@?hush\b/i;

export type RuleResult = { fired: boolean; kind: Kind; score: number; reasons: string[] };

/** Pure rules pass over the latest message plus a little recent context. */
export function rulesPass(latest: GroupLine, recent: GroupLine[]): RuleResult {
  const text = latest.body;
  const reasons: string[] = [];
  let kind: Kind = "unclear";
  let score = 0;

  if (ASKED.test(text)) return { fired: true, kind: "asked", score: 1, reasons: ["asked"] };

  const cost = Number(text.match(MONEY)?.[1] ?? 0);
  if (HEDGE.test(text)) {
    reasons.push("hedge");
    score += 0.45;
  }
  if (PRICEY.test(text) || cost >= 30) {
    reasons.push("price");
    kind = "budget";
    score += 0.35;
  }
  if (DRINKS.test(text)) {
    reasons.push("drinks");
    if (kind === "unclear") kind = "drinks";
    score += 0.2;
  }
  if (ACCESS.test(text)) {
    reasons.push("access");
    if (kind === "unclear") kind = "access";
    score += 0.2;
  }
  if (FOOD.test(text)) {
    reasons.push("food");
    if (kind === "unclear") kind = "diet";
    score += 0.1;
  }

  // Clashing suggestions: two different people proposing different times.
  const byAuthor = new Map<string, Set<string>>();
  for (const l of [...recent, latest]) {
    for (const t of l.body.match(TIME) ?? []) {
      const set = byAuthor.get(l.author) ?? new Set<string>();
      set.add(t.toLowerCase().replace(/\s/g, ""));
      byAuthor.set(l.author, set);
    }
  }
  const times = new Set([...byAuthor.values()].flatMap((s) => [...s]));
  if (byAuthor.size >= 2 && times.size >= 2) {
    reasons.push("clash");
    if (kind === "unclear") kind = "timing";
    score += 0.3;
  }

  // A hedge right after a pricey or bar-heavy suggestion is the classic quiet-limit moment.
  const context = recent
    .slice(-4)
    .map((l) => l.body)
    .join(" ");
  if (HEDGE.test(text) && (PRICEY.test(context) || MONEY.test(context) || DRINKS.test(context))) {
    reasons.push("hedge-after-suggestion");
    if (kind === "unclear") kind = PRICEY.test(context) || MONEY.test(context) ? "budget" : "drinks";
    score += 0.25;
  }

  return { fired: score >= 0.3, kind, score: Math.min(1, score), reasons };
}

export const DisparityVerdict = z.object({
  disparity: z.boolean(),
  kind: z.enum(["budget", "diet", "drinks", "access", "timing", "conflict", "unclear"]),
  confidence: z.number().min(0).max(1),
});

/**
 * LLM judge on the last N messages, names replaced with P1..Pn. Returns null when no model is
 * available, so the caller can fall back to the rules score.
 */
export async function judge(lines: GroupLine[], circleId: string) {
  const alias = new Map<string, string>();
  const anon = lines.map((l) => {
    if (!alias.has(l.author)) alias.set(l.author, `P${alias.size + 1}`);
    return `${alias.get(l.author)}: ${l.body}`;
  });
  try {
    const { data } = await callLLM({
      task: "disparity",
      label: "Group check: is the plan leaving someone out?",
      circleId,
      schema: DisparityVerdict,
      reasoningEffort: "low",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You watch a friend group's chat for moments when a plan quietly isn't working for someone: a hedge " +
            "after a pricey or bar-heavy idea, a food or access mismatch, or clashing times. Answer only about " +
            "the most recent messages. Never guess anyone's private reason. confidence is 0 to 1.",
        },
        { role: "user", content: anon.join("\n") },
      ],
    });
    return data;
  } catch (e) {
    if (e instanceof LLMUnavailableError) return null;
    console.error("disparity judge failed", e);
    return null;
  }
}

export const DISPARITY_THRESHOLD = 0.6;
export const DAILY_CAP = 3;

export function cooldownMs() {
  const m = Number(process.env.DISPARITY_COOLDOWN_MIN ?? 30);
  return (Number.isFinite(m) && m >= 0 ? m : 30) * 60_000;
}

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

/** May Hush start a round of private check-ins in this circle right now? */
export function gate(
  circle: {
    proactiveMutedAt: Date | null;
    lastDisparityAt: Date | null;
    disparityDay: string | null;
    disparityCountToday: number;
  },
  opts: { asked: boolean; now?: Date },
) {
  const now = opts.now ?? new Date();
  // Being asked directly overrides a mute, but never the cooldown (no spam loops).
  if (circle.proactiveMutedAt && !opts.asked) return { ok: false as const, why: "muted" };
  if (circle.lastDisparityAt && now.getTime() - circle.lastDisparityAt.getTime() < cooldownMs())
    return { ok: false as const, why: "cooldown" };
  const today = circle.disparityDay === dayKey(now) ? circle.disparityCountToday : 0;
  if (today >= DAILY_CAP) return { ok: false as const, why: "daily-cap" };
  return { ok: true as const, why: "ok" };
}
