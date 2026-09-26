// Rule layer for the safety screen. The model's own safety field is combined with
// this; the stricter of the two wins.

export type SafetyLevel = "none" | "concern" | "stop";

const STOP = [
  /\b(kill|hurt|harm)(ing)? (myself|me)\b/,
  /\bsuicid/,
  /\bend (it all|my life)\b/,
  /\bwant to die\b/,
  /\bself[- ]harm/,
  /\b(hit|hits|hitting|punched|slapped|choked|shoved|beat|beats) (me|her|him|them)\b/,
  /\bthreat(en|ened|ening|s)? (me|to)\b/,
  /\b(afraid|scared) (of|for) (him|her|them|my life)\b/,
  /\babus(e|ed|ive|ing)\b/,
  /\bstalk/,
  /\b(won'?t|doesn'?t|don'?t) let me (leave|go|see)\b/,
  /\bweapon|\bgun\b|\bknife\b/,
];

const CONCERN = [/\bpanic attack/, /\bdepress/, /\bcan'?t cope\b/, /\bgrie(f|ving)\b/, /\bpassed away\b/, /\bbreakdown\b/];

export function screenText(text: string): SafetyLevel {
  const t = text.toLowerCase();
  if (STOP.some((r) => r.test(t))) return "stop";
  if (CONCERN.some((r) => r.test(t))) return "concern";
  return "none";
}

export function stricter(a: SafetyLevel, b: SafetyLevel): SafetyLevel {
  const rank = { none: 0, concern: 1, stop: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

export const SAFETY_REPLY =
  "Thank you for telling me. That sounds really hard, and you deserve support from a person, not just an app. " +
  "If you're thinking about hurting yourself, you can call or text 988 any time. " +
  "If someone is hurting or threatening you, the National Domestic Violence Hotline is 1-800-799-7233 (or text START to 88788), and 911 is there if you're in danger right now. " +
  "I won't share any of this with the group.";
