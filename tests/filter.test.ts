import { describe, expect, it } from "vitest";
import { aggregateNeeds, hardFilter, intersectWindows, type VaultLike } from "@/lib/ai/filter";
import { VENUES } from "@/lib/venues";

const base: VaultLike = { budgetCapCents: null, dietary: [], alcohol: null, stepFreeRequired: null, availableWindows: null, noise: null, vibe: [] };
const demoVaults: VaultLike[] = [
  { ...base, budgetCapCents: 4000, dietary: ["halal"] }, // Omar
  { ...base, budgetCapCents: 1500, vibe: ["outdoors"] }, // Maya
  { ...base, budgetCapCents: 3000, alcohol: "none" }, // Priya
  { ...base, budgetCapCents: 3500, stepFreeRequired: true, availableWindows: [{ day: "Saturday", start: "18:00", end: "23:59" }] }, // Jordan
];
const circle = { start: "18:00", end: "23:00", day: "Saturday" };

describe("hard filter", () => {
  it("demo group: 23 → 9, the expected venues", () => {
    const needs = aggregateNeeds(demoVaults, circle);
    const r = hardFilter(VENUES, needs);
    expect(r.before).toBe(23);
    expect(r.kept.map((v) => v.id)).toEqual(["v01", "v02", "v03", "v07", "v10", "v14", "v15", "v18", "v23"]);
  });

  it("aggregates anonymously", () => {
    const n = aggregateNeeds(demoVaults, circle);
    expect(n).toMatchObject({ diets: ["halal"], noAlcoholFocus: true, stepFree: true, lowestCapCents: 1500, window: { start: "18:00", end: "23:00" } });
    expect(JSON.stringify(n)).not.toMatch(/omar|maya|priya|jordan/i);
  });

  it("no needs keeps everything open in the window", () => {
    const r = hardFilter(VENUES, aggregateNeeds([base, base], circle));
    expect(r.kept.find((v) => v.id === "v11")).toBeUndefined(); // board game café closes at 6 PM
    expect(r.kept.length).toBeGreaterThan(15);
  });

  it("window intersection narrows and flags conflicts", () => {
    const a = { ...base, availableWindows: [{ day: "Saturday", start: "19:00", end: "23:59" }] };
    const b = { ...base, availableWindows: [{ day: "Saturday", start: "12:00", end: "21:30" }] };
    expect(intersectWindows({ start: "18:00", end: "23:00" }, [a, b], "Saturday")).toEqual({ start: "19:00", end: "21:30", conflict: false });
    const c = { ...base, availableWindows: [{ day: "Saturday", start: "08:00", end: "10:00" }] };
    expect(intersectWindows({ start: "18:00", end: "23:00" }, [a, c], "Saturday").conflict).toBe(true);
  });
});
