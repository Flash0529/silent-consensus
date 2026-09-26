// Deterministic extraction for the key demo values, so they never depend on a model.

export type Win = { day: string; start: string; end: string };

const WORDS: Record<string, number> = {
  five: 5, ten: 10, fifteen: 15, twenty: 20, "twenty five": 25, "twenty-five": 25, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, hundred: 100,
};

function num(s: string): number | null {
  const n = Number(s.replace(/[$,]/g, ""));
  if (Number.isFinite(n)) return n;
  return WORDS[s.toLowerCase()] ?? null;
}

/**
 * Budget cap from a budget answer. Returns undefined when the text isn't about a cap,
 * null for "no cap", or integer cents.
 */
export function parseBudget(text: string): number | null | undefined {
  const t = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (/money'?s not a worry|not a worry|no (budget|limit)|doesn'?t matter|whatever works/.test(t)) return null;
  const range = t.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (range) return Math.round(Number(range[2]) * 100);
  const under = t.match(/(?:under|below|less than|up to|max(?:imum)?|at most|around|about|no more than)\s*\$?\s*(\d+(?:\.\d+)?|[a-z]+(?:[ -][a-z]+)?)/);
  if (under) {
    const n = num(under[1]);
    if (n !== null) return Math.round(n * 100);
  }
  const bare = t.match(/^\$\s*(\d+(?:\.\d+)?)\b/) ?? t.match(/\$\s*(\d+(?:\.\d+)?)/);
  if (bare) return Math.round(Number(bare[1]) * 100);
  return undefined;
}

function to24(h: number, ampm: string | undefined, assumeEvening: boolean) {
  if (ampm === "am") return h % 12;
  if (ampm === "pm") return (h % 12) + 12;
  return assumeEvening && h >= 1 && h <= 11 ? h + 12 : h;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "free after 6", "after six pm", "from 7 to 10". */
export function parseTime(text: string, day: string): Win[] | undefined {
  const t = text.toLowerCase();
  const wordHour = (s: string) => {
    const n = num(s) ?? ({ one: 1, two: 2, three: 3, four: 4, six: 6, seven: 7, eight: 8, nine: 9, eleven: 11, twelve: 12 } as Record<string, number>)[s];
    return n ?? null;
  };
  const range = t.match(/(?:from|between)\s*(\d{1,2}|[a-z]+)(?::(\d{2}))?\s*(am|pm)?\s*(?:to|and|-|until|till)\s*(\d{1,2}|[a-z]+)(?::(\d{2}))?\s*(am|pm)?/);
  if (range) {
    const h1 = wordHour(range[1]);
    const h2 = wordHour(range[4]);
    if (h1 !== null && h2 !== null)
      return [{ day, start: `${pad(to24(h1, range[3] ?? range[6], true))}:${range[2] ?? "00"}`, end: `${pad(to24(h2, range[6], true))}:${range[5] ?? "00"}` }];
  }
  const after = t.match(/after\s*(\d{1,2}|[a-z]+)(?::(\d{2}))?\s*(am|pm)?/);
  if (after) {
    const h = wordHour(after[1]);
    if (h !== null && h <= 12) return [{ day, start: `${pad(to24(h, after[3], true))}:${after[2] ?? "00"}`, end: "23:59" }];
  }
  const before = t.match(/(?:before|until|till)\s*(\d{1,2}|[a-z]+)(?::(\d{2}))?\s*(am|pm)?/);
  if (before) {
    const h = wordHour(before[1]);
    if (h !== null && h <= 12) return [{ day, start: "00:00", end: `${pad(to24(h, before[3], true))}:${before[2] ?? "00"}` }];
  }
  if (/any ?time|all (day|night)|whenever|totally free|wide open/.test(t)) return [{ day, start: "00:00", end: "23:59" }];
  return undefined;
}

export function parseStepFree(text: string): boolean | undefined {
  const t = text.toLowerCase();
  if (/wheelchair|step[- ]free|no (stairs|steps)|can'?t do stairs|mobility|walker|crutches|ramp/.test(t)) return true;
  return undefined;
}

export function parseAlcohol(text: string): "fine" | "prefer_none" | "none" | undefined {
  const t = text.toLowerCase();
  if (/(don'?t|do not|never|can'?t) drink|sober|no alcohol|not drinking|alcohol[- ]free|dry/.test(t)) return "none";
  if (/rather not.*(drink|bar)|not (really )?into (bars|drinking)|prefer (no|fewer) (bars|drinks)/.test(t)) return "prefer_none";
  if (/drinks? (are|is) fine|happy to drink|bars? (are|is) fine|love a (bar|drink)/.test(t)) return "fine";
  return undefined;
}
