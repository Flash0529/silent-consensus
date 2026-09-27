import type { Venue } from "@/lib/venues";

// Deterministic hard filter. Input is an anonymous, aggregated view of the group:
// no names, only the union of needs.

export const FILTERABLE_DIETS = ["halal", "kosher", "vegetarian", "vegan", "gluten_free"];

export type GroupNeeds = {
  diets: string[]; // filterable diets anyone needs
  otherDietNotes: string[]; // e.g. nut_allergy: passed to the composer, not filterable
  noAlcoholFocus: boolean; // anyone with alcohol "none"
  preferFewerBars: boolean; // anyone with "prefer_none"
  stepFree: boolean;
  quiet: boolean;
  window: { start: string; end: string };
  timingConflict: boolean;
  lowestCapCents: number | null;
  vibe: string[];
  memberCount: number;
};

export type VaultLike = {
  budgetCapCents: number | null;
  dietary: string[];
  alcohol: string | null;
  stepFreeRequired: boolean | null;
  availableWindows: unknown;
  noise: string | null;
  vibe: string[];
};

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

function windowsOf(v: VaultLike, day: string): [number, number][] | null {
  if (!Array.isArray(v.availableWindows) || v.availableWindows.length === 0) return null;
  const ws = (v.availableWindows as { day?: string; start?: string; end?: string }[])
    .filter((w) => w.start && w.end && (!w.day || w.day.toLowerCase().startsWith(day.toLowerCase().slice(0, 3))))
    .map((w) => [toMin(w.start!), toMin(w.end!) || 24 * 60] as [number, number]);
  return ws.length ? ws : null;
}

/** Intersection of the circle window with each member's free windows. */
export function intersectWindows(circle: { start: string; end: string }, vaults: VaultLike[], day: string) {
  let lo = toMin(circle.start);
  let hi = toMin(circle.end) || 24 * 60;
  for (const v of vaults) {
    const ws = windowsOf(v, day);
    if (!ws) continue;
    // Best single overlap for this member within [lo, hi].
    let best: [number, number] | null = null;
    for (const [s, e] of ws) {
      const a = Math.max(lo, s);
      const b = Math.min(hi, e);
      if (b > a && (!best || b - a > best[1] - best[0])) best = [a, b];
    }
    if (!best) return { start: circle.start, end: circle.end, conflict: true };
    [lo, hi] = best;
  }
  return { start: toHHMM(lo), end: toHHMM(Math.min(hi, 23 * 60 + 59)), conflict: false };
}

export function aggregateNeeds(vaults: VaultLike[], circle: { start: string; end: string; day: string }): GroupNeeds {
  const diets = new Set<string>();
  const notes = new Set<string>();
  for (const v of vaults)
    for (const d of v.dietary) (FILTERABLE_DIETS.includes(d) ? diets : notes).add(d);
  const w = intersectWindows(circle, vaults, circle.day);
  const caps = vaults.map((v) => v.budgetCapCents).filter((c): c is number => c !== null);
  return {
    diets: [...diets].sort(),
    otherDietNotes: [...notes].sort(),
    noAlcoholFocus: vaults.some((v) => v.alcohol === "none"),
    preferFewerBars: vaults.some((v) => v.alcohol === "prefer_none"),
    stepFree: vaults.some((v) => v.stepFreeRequired === true),
    quiet: vaults.some((v) => v.noise === "quiet"),
    window: { start: w.start, end: w.end },
    timingConflict: w.conflict,
    lowestCapCents: caps.length ? Math.min(...caps) : null,
    vibe: [...new Set(vaults.flatMap((v) => v.vibe.map((x) => x.toLowerCase())))].slice(0, 8),
    memberCount: vaults.length,
  };
}

const NEEDS_RESTROOM = new Set(["restaurant", "food_trucks", "food_hall", "market", "activity", "bar", "cafe"]);

export function openOverlapMinutes(v: Venue, window: { start: string; end: string }) {
  const o = toMin(v.hours.open);
  let c = toMin(v.hours.close);
  if (c <= o) c += 24 * 60; // closes after midnight
  const ws = toMin(window.start);
  const we = toMin(window.end) || 24 * 60;
  return Math.max(0, Math.min(c, we) - Math.max(o, ws));
}

export function venuePasses(v: Venue, n: GroupNeeds) {
  if (v.servesMeal && n.diets.some((d) => !v.diets.includes(d))) return false;
  if (n.noAlcoholFocus && v.alcoholFocus === "bar") return false;
  if (n.stepFree && !v.stepFreeEntry) return false;
  if (n.stepFree && NEEDS_RESTROOM.has(v.kind) && !v.accessibleRestroom) return false;
  if (openOverlapMinutes(v, n.window) < 60) return false;
  return true;
}

export function hardFilter(venues: Venue[], n: GroupNeeds) {
  const kept = venues.filter((v) => venuePasses(v, n));
  return { kept, before: venues.length, after: kept.length };
}
