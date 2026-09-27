import { describe, expect, it } from "vitest";
import { allocate, helperCapacity, type AllocMember } from "@/lib/money/allocate";

const demo: AllocMember[] = [
  { id: "omar", baseCents: 2500, capCents: 4000 },
  { id: "maya", baseCents: 2500, capCents: 1500 },
  { id: "priya", baseCents: 2500, capCents: 3000 },
  { id: "jordan", baseCents: 2500, capCents: 3500 },
];

const byId = (a: ReturnType<typeof allocate>) => Object.fromEntries(a.lines.map((l) => [l.id, l]));
const sum = (a: ReturnType<typeof allocate>, k: "finalCents" | "baseCents") => a.lines.reduce((s, l) => s + l[k], 0);

describe("allocate", () => {
  it("demo: $10 shortfall, Maya only; helpers suggested $5", () => {
    const a = allocate(demo);
    const l = byId(a);
    expect(a.needCents).toBe(1000);
    expect(l.maya.shortfallCents).toBe(1000);
    expect([l.omar.isHelper, l.priya.isHelper, l.jordan.isHelper, l.maya.isHelper]).toEqual([true, true, true, false]);
    expect([l.omar.suggestCents, l.priya.suggestCents, l.jordan.suggestCents]).toEqual([500, 500, 500]);
    expect(a.cardOpen).toBe(true);
  });

  it("demo: Omar $5 + Priya $5 → Maya 15, Omar 30, Priya 30, Jordan 25", () => {
    const a = allocate(demo, [
      { memberId: "omar", amountCents: 500 },
      { memberId: "priya", amountCents: 500 },
    ]);
    const l = byId(a);
    expect([l.maya.finalCents, l.omar.finalCents, l.priya.finalCents, l.jordan.finalCents]).toEqual([1500, 3000, 3000, 2500]);
    expect(l.maya.coveredCents).toBe(1000);
    expect(sum(a, "finalCents")).toBe(10000);
    expect(a.poolCents).toBe(1000);
    expect(a.cardOpen).toBe(false);
  });

  it("no caps: no need, no helpers suggestions, finals = base", () => {
    const a = allocate(demo.map((m) => ({ ...m, capCents: null })));
    expect(a.needCents).toBe(0);
    expect(a.lines.every((l) => l.finalCents === l.baseCents && l.suggestCents === 0)).toBe(true);
    expect(a.cardOpen).toBe(false);
  });

  it("zero contributions: finals = base, card open", () => {
    const a = allocate(demo, []);
    expect(a.lines.every((l) => l.finalCents === l.baseCents)).toBe(true);
    expect(a.cardOpen).toBe(true);
  });

  it("over-contribution is refunded, pool never exceeds need", () => {
    const a = allocate(demo, [
      { memberId: "omar", amountCents: 1000 },
      { memberId: "priya", amountCents: 500 },
    ]);
    const l = byId(a);
    expect(a.poolCents).toBe(1000);
    expect(l.omar.chipInCents).toBe(1000);
    expect(l.priya.chipInCents).toBe(0);
    expect(l.priya.refundCents).toBe(500);
    expect(l.priya.finalCents).toBe(2500);
    expect(sum(a, "finalCents")).toBe(sum(a, "baseCents"));
  });

  it("contribution above headroom is clamped", () => {
    const a = allocate(demo, [{ memberId: "priya", amountCents: 1000 }]);
    const l = byId(a);
    expect(l.priya.chipInCents).toBe(500);
    expect(l.priya.refundCents).toBe(500);
    expect(l.priya.finalCents).toBe(3000);
  });

  it("a member with a shortfall cannot contribute", () => {
    const a = allocate(demo, [{ memberId: "maya", amountCents: 500 }]);
    expect(a.poolCents).toBe(0);
    expect(byId(a).maya.finalCents).toBe(2500);
  });

  it("two short members split proportionally with exact cents", () => {
    const m: AllocMember[] = [
      { id: "a", baseCents: 2500, capCents: 1800 }, // short 700
      { id: "b", baseCents: 2500, capCents: 2200 }, // short 300
      { id: "c", baseCents: 2500, capCents: null },
    ];
    const a = allocate(m, [{ memberId: "c", amountCents: 333 }]);
    const l = byId(a);
    expect(a.needCents).toBe(1000);
    expect(l.a.coveredCents + l.b.coveredCents).toBe(333);
    expect(l.a.coveredCents).toBe(233);
    expect(l.b.coveredCents).toBe(100);
    expect(sum(a, "finalCents")).toBe(sum(a, "baseCents"));
  });

  it("invariant: Σ final = Σ base and cover ≤ shortfall for random inputs", () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % n);
    for (let t = 0; t < 500; t++) {
      const n = 2 + rnd(6);
      const members: AllocMember[] = Array.from({ length: n }, (_, i) => ({
        id: `m${i}`,
        baseCents: 1000 + rnd(4000),
        capCents: rnd(4) === 0 ? null : 500 + rnd(6000),
      }));
      const contributions = Array.from({ length: rnd(5) }, () => ({ memberId: `m${rnd(n)}`, amountCents: rnd(2000) }));
      const a = allocate(members, contributions);
      expect(sum(a, "finalCents")).toBe(sum(a, "baseCents"));
      expect(a.poolCents).toBeLessThanOrEqual(a.needCents);
      for (const l of a.lines) {
        expect(l.coveredCents).toBeLessThanOrEqual(l.shortfallCents);
        expect(l.coveredCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("helper capacity caps each helper at $10", () => {
    expect(helperCapacity(demo)).toBe(1000 + 500 + 1000);
  });
});
