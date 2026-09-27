import { z } from "zod";
import { callLLM } from "@/lib/ai/client";

// Leak guard for every group-facing string. Two layers, both must pass:
//   1. Rules (deterministic): names next to needs, needs stated as reasons,
//      private numbers, private phrases, "someone who..." targeting.
//   2. LLM judge: could anyone infer a specific person's private constraint?

export type GuardMember = {
  name: string;
  facts: string[]; // private facts in plain words, for the judge only
  capCents: number | null;
  privatePhrases: string[]; // privateNote, story, offLimits, raw messages...
};

export type GuardContext = {
  /** Texts that explain WHY (e.g. "Why this works"). Any sensitive topic in them is a leak. */
  reasons?: string[];
  members: GuardMember[];
  allowedCents: number[]; // public numbers (per-person cost, item prices)
  mode: "PLAN" | "MEDIATE";
};

export type Leak = { text: string; reason: string };

const SENSITIVE = [
  // money
  "afford", "broke", "money", "cash", "budget", "cheap", "expensive", "cost", "poor", "rent", "debt", "paycheck", "job",
  // alcohol
  "drink", "drinking", "drinks", "sober", "sobriety", "alcohol", "booze", "recovery",
  // health, disability
  "wheelchair", "disab", "mobility", "accessib", "step-free", "stairs", "allerg", "injur", "health", "medical", "dietary",
  "anxiety", "anxious", "panic", "depress", "sick", "illness", "pregnan",
  // religion, diet
  "halal", "kosher", "religio", "muslim", "jewish", "hindu", "faith", "pray", "fasting", "vegetarian", "vegan", "diet",
];

const FEELINGS = [
  "upset", "angry", "annoyed", "frustrat", "hurt", "embarrass", "ashamed", "resent", "stress", "overwhelm", "feels",
  "felt", "unappreciated", "ignored", "judged", "scared", "afraid", "sad", "lonely", "jealous",
];

const CAUSAL =
  /\b(since|because|due to|given (that )?|so that|for (someone|somebody|those|anyone|the one|one of you|a friend|people|the person)( who| that)?|as (he|she|they|someone|one of you))\b/i;

const TARGETING =
  /\b(someone|somebody|one of you|one person|a friend|a roommate|one roommate|a member|certain people|some of you|anyone who|those who|the person who)\b[^.!?]{0,40}\b(can'?t|cannot|doesn'?t|don'?t|won'?t|needs?|has|have|is|are|feels?|felt|wants?|asked|said|told)\b/i;

const WHO_SAID = /\b(who said|said that|told (me|hush)|mentioned that|according to)\b/i;

function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9$' ]+/g, " ").split(/\s+/).filter(Boolean);

function ngrams(s: string, n: number) {
  const w = words(s);
  const out: string[] = [];
  for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join(" "));
  return out;
}

const hasTerm = (sentence: string, terms: string[]) => {
  const s = sentence.toLowerCase();
  return terms.find((t) => new RegExp(`\\b${t.replace(/[-]/g, "[- ]?")}`, "i").test(s));
};

const NUMBER_WORDS: Record<number, string> = {
  5: "five", 10: "ten", 15: "fifteen", 20: "twenty", 25: "twenty[- ]five", 30: "thirty", 35: "thirty[- ]five",
  40: "forty", 45: "forty[- ]five", 50: "fifty", 60: "sixty",
};

function moneyMentions(sentence: string, dollars: number) {
  const n = String(dollars);
  const word = NUMBER_WORDS[dollars];
  const re = new RegExp(
    `\\$\\s?${n}(\\.00)?\\b|\\b${n}\\s?(dollars|bucks|usd)\\b${word ? `|\\b${word}\\s?(dollars|bucks)\\b` : ""}`,
    "i",
  );
  return re.test(sentence);
}

/** Deterministic rule layer. Returns every leak found (empty = pass). */
export function ruleCheck(texts: string[], ctx: GuardContext): Leak[] {
  const leaks: Leak[] = [];
  const allowed = new Set(ctx.allowedCents.filter((c) => c % 100 === 0).map((c) => c / 100));
  const privateGrams = new Set<string>();
  for (const m of ctx.members)
    for (const p of m.privatePhrases) for (const g of ngrams(p, ctx.mode === "MEDIATE" ? 5 : 4)) privateGrams.add(g);

  for (const text of texts) {
    for (const s of sentences(text)) {
      const lower = s.toLowerCase();
      const named = ctx.members.find((m) => new RegExp(`\\b${m.name.replace(/[^a-z]/gi, "")}\\b`, "i").test(s));
      const sens = hasTerm(s, SENSITIVE);
      const feel = hasTerm(s, FEELINGS);

      if (named && (sens || (ctx.mode === "MEDIATE" && feel)))
        leaks.push({ text: s, reason: `Names ${named.name} next to a private topic ("${sens ?? feel}")` });
      else if (named && ctx.mode === "MEDIATE")
        leaks.push({ text: s, reason: `Names ${named.name} in the shared proposal` });

      if (sens && CAUSAL.test(s)) leaks.push({ text: s, reason: `States a private need as a reason ("${sens}")` });
      if (TARGETING.test(s)) leaks.push({ text: s, reason: "Points at a specific person's situation" });
      if (WHO_SAID.test(s)) leaks.push({ text: s, reason: "Attributes what someone said" });

      for (const m of ctx.members) {
        if (m.capCents === null || m.capCents % 100 !== 0) continue;
        const d = m.capCents / 100;
        if (!allowed.has(d) && moneyMentions(s, d)) leaks.push({ text: s, reason: "Mentions a private budget number" });
      }

      const grams = ngrams(lower, ctx.mode === "MEDIATE" ? 5 : 4);
      if (grams.some((g) => privateGrams.has(g))) leaks.push({ text: s, reason: "Repeats words from a private chat" });
    }
  }
  // "Why" lines are reasons by definition: they may not name any sensitive topic,
  // except the generic "every budget" / "everyone's budget" phrasing.
  for (const r of ctx.reasons ?? []) {
    const cleaned = r.replace(/\b(every|everyone'?s|each person'?s|all) budgets?\b/gi, "");
    const t = hasTerm(cleaned, SENSITIVE);
    if (t) leaks.push({ text: r, reason: `A "why" line mentions a private topic ("${t}")` });
  }
  // De-duplicate identical findings.
  const seen = new Set<string>();
  return leaks.filter((l) => {
    const k = `${l.text}|${l.reason}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const JudgeOut = z.object({
  pass: z.boolean(),
  leaks: z.array(z.object({ text: z.string(), reason: z.string() })).max(10),
});

async function judge(texts: string[], ctx: GuardContext, circleId?: string) {
  const facts = ctx.members.map((m) => `- ${m.name}: ${m.facts.join("; ") || "(nothing private)"}`).join("\n");
  const kind =
    ctx.mode === "MEDIATE"
      ? "a shared proposal for resolving a disagreement"
      : "a group plan for a hangout";
  const { data } = await callLLM({
    task: "judge",
    label: "Leak check",
    circleId,
    schema: JudgeOut,
    reasoningEffort: "medium",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `You are a strict privacy reviewer. Each group member told an assistant private things. The assistant wrote ${kind} that EVERY member will read.

PRIVATE FACTS (never to be revealed):
${facts}

Question: could any group member infer a SPECIFIC person's private fact from the group text, or tell who said what?
- Neutral venue amenities are fine ("Paved, step-free paths", "Halal, veggie and dessert trucks").
- Generic group statements are fine ("Fits every budget Hush heard", "Food the whole group can eat").
- In a disagreement, neutral agreements are fine ("Kitchen stays quiet after 11:30 PM on weeknights").
- A leak is: naming or narrowing to a person, stating a private need as the reason for a choice, repeating private details (numbers, jobs, health, faith, money, feelings) or quoting private words.
Return pass=false with each leaking sentence if there is any leak. Output JSON only.`,
      },
      { role: "user", content: `GROUP TEXT:\n${texts.map((t) => `- ${t}`).join("\n")}` },
    ],
  });
  return data;
}

export type GuardResult = { pass: boolean; leaks: Leak[]; layer: "rules" | "judge" | "both" };

export async function checkGroupText(texts: string[], ctx: GuardContext, circleId?: string): Promise<GuardResult> {
  const rules = ruleCheck(texts, ctx);
  if (rules.length) return { pass: false, leaks: rules, layer: "rules" };
  const j = await judge(texts, ctx, circleId);
  const pass = j.pass && j.leaks.length === 0;
  return { pass, leaks: j.leaks, layer: pass ? "both" : "judge" };
}
