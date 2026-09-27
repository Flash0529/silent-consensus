import { describe, expect, it } from "vitest";
import { parseAlcohol, parseBudget, parseStepFree, parseTime } from "@/lib/ai/fastpath";
import { screenText } from "@/lib/ai/safety";
import { mergePerspective, mergeVault } from "@/lib/vault";

describe("parseBudget", () => {
  it.each([
    ["Under $15", 1500],
    ["Under 15 honestly. It's why I keep skipping dinners.", 1500],
    ["$15 to $30", 3000],
    ["$30 to $60", 6000],
    ["up to 40 bucks", 4000],
    ["under fifteen", 1500],
    ["Money's not a worry", null],
  ])("%s → %s", (text, cents) => expect(parseBudget(text)).toBe(cents));
  it("ignores non-budget text", () => expect(parseBudget("I'd rather explain")).toBeUndefined());
});

describe("parseTime", () => {
  it("after six", () =>
    expect(parseTime("I'm free after six", "Saturday")).toEqual([{ day: "Saturday", start: "18:00", end: "23:59" }]));
  it("after 6 PM", () => expect(parseTime("Free after 6 PM", "Saturday")?.[0].start).toBe("18:00"));
  it("from 7 to 10", () =>
    expect(parseTime("from 7 to 10", "Friday")).toEqual([{ day: "Friday", start: "19:00", end: "22:00" }]));
  it("nothing", () => expect(parseTime("sounds good", "Saturday")).toBeUndefined());
});

describe("other fast paths", () => {
  it("step-free", () => expect(parseStepFree("I use a wheelchair, so step-free places only")).toBe(true));
  it("alcohol none", () => expect(parseAlcohol("I don't drink")).toBe("none"));
  it("alcohol unknown", () => expect(parseAlcohol("halal please")).toBeUndefined());
});

describe("safety rules", () => {
  it("flags danger", () => {
    expect(screenText("sometimes I want to hurt myself")).toBe("stop");
    expect(screenText("he threatened to kick me out and hit me")).toBe("stop");
  });
  it("flags heavy but safe", () => expect(screenText("I've been having panic attacks")).toBe("concern"));
  it("passes normal conflict", () => expect(screenText("They never do the dishes and it drives me nuts")).toBe("none"));
});

describe("merge", () => {
  const empty = {
    budgetCapCents: null, dietary: [], alcohol: null, stepFreeRequired: null,
    availableWindows: null, noise: null, vibe: [], maxTravelMinutes: null, privateNote: null,
  };
  it("unions arrays and keeps unknowns", () => {
    const a = mergeVault(empty, { budgetCapCents: 1500, dietary: ["Halal"] });
    const b = mergeVault(a, { dietary: ["halal", "Nut allergy"] });
    expect(b.budgetCapCents).toBe(1500);
    expect(b.dietary).toEqual(["halal", "nut_allergy"]);
  });
  it("null clears a cap", () => expect(mergeVault({ ...empty, budgetCapCents: 1500 }, { budgetCapCents: null }).budgetCapCents).toBeNull());
  it("perspective appends story", () => {
    const p = mergePerspective(
      { story: "A.", feelings: [], needs: [], hopes: [], offers: [], offLimits: [], gist: null },
      { story: "B.", needs: ["sleep"] },
    );
    expect(p.story).toBe("A. B.");
    expect(p.needs).toEqual(["sleep"]);
  });
});

import { chipsFromVault } from "@/lib/vault";

describe("chipsFromVault", () => {
  const empty = {
    budgetCapCents: null, dietary: [], alcohol: null, stepFreeRequired: null,
    availableWindows: null, noise: null, vibe: [], maxTravelMinutes: null, privateNote: null,
  };
  it("returning Omar", () =>
    expect(chipsFromVault({ ...empty, budgetCapCents: 4000, dietary: ["halal"], alcohol: "fine", vibe: ["chill"] })).toEqual([
      "Up to $40",
      "Halal",
      "Chill",
    ]));
  it("Jordan's voice answers", () =>
    expect(
      chipsFromVault({ ...empty, stepFreeRequired: true, availableWindows: [{ day: "Saturday", start: "18:00", end: "23:59" }] }),
    ).toEqual(["Step-free places only", "Free after 6 PM"]));
  it("nothing saved", () => expect(chipsFromVault(empty)).toEqual(["No special needs"]));
});

import { pacingNote } from "@/lib/ai/interview";

describe("interview pacing", () => {
  const h = (topics: string[], answers: number) => [
    ...topics.map((topic) => ({ role: "HUSH", topic })),
    ...Array.from({ length: answers }, () => ({ role: "MEMBER", topic: null })),
  ];
  it("moves on after a topic is asked twice", () =>
    expect(pacingNote(h(["intro", "story", "impact", "impact-ack", "impact"], 3), "MEDIATE")).toMatch(/impact twice/));
  it("wraps up after 8 answers", () => expect(pacingNote(h(["story"], 8), "MEDIATE")).toMatch(/"consent" NOW/));
  it("says nothing early on", () => expect(pacingNote(h(["intro", "budget"], 1), "PLAN")).toBe(""));
});
