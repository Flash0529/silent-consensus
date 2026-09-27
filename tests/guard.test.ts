import { describe, expect, it } from "vitest";
import { ruleCheck, type GuardContext } from "@/lib/ai/guard";

const plan: GuardContext = {
  mode: "PLAN",
  allowedCents: [2500, 400, 1600, 500],
  members: [
    { name: "Omar", facts: ["eats halal", "budget up to $40"], capCents: 4000, privatePhrases: [] },
    { name: "Maya", facts: ["budget under $15"], capCents: 1500, privatePhrases: ["keeps skipping dinners because of rent"] },
    { name: "Priya", facts: ["doesn't drink"], capCents: 3000, privatePhrases: [] },
    { name: "Jordan", facts: ["uses a wheelchair"], capCents: 3500, privatePhrases: [] },
  ],
};

const fails = (t: string, ctx = plan) => ruleCheck([t], ctx).length > 0;

describe("rule layer: must fail", () => {
  it.each([
    "Since Priya doesn't drink, we skipped bars",
    "Maya's budget is $15",
    "We kept it cheap for someone who's tight on money",
    "Picked step-free places because Jordan uses a wheelchair",
    "Everything is halal for Omar",
    "One of you can't spend much, so we kept it low",
    "Keeps under $15 per person",
    "Maya keeps skipping dinners because of rent",
  ])("%s", (t) => expect(fails(t)).toBe(true));
});

describe("rule layer: must pass", () => {
  it.each([
    "Picked to fit everyone's budget, food, and getting around",
    "Fits every budget Hush heard",
    "Easy for everyone to get around",
    "Food the whole group can eat",
    "Paved, step-free paths",
    "Halal, veggie and dessert trucks",
    "Flat, five-minute stroll",
    "Picnic + food truck night",
    "About $25 per person",
  ])("%s", (t) => expect(fails(t)).toBe(false));
});

const mediate: GuardContext = {
  mode: "MEDIATE",
  allowedCents: [],
  members: [
    { name: "Maya", facts: ["works a second job", "cooks late"], capCents: null, privatePhrases: ["I work a second job until 11 so that's the only time I can eat", "second job", "money"] },
    { name: "Omar", facts: ["feels he does most of the dishes"], capCents: null, privatePhrases: ["I'm always the one doing the dishes and I'm sick of it"] },
  ],
};

describe("mediation rules", () => {
  it.each([
    "Maya needs to cook late",
    "Omar feels unappreciated about the dishes",
    "Someone said they're always the one doing the dishes",
    "Because of a second job, the kitchen gets used late",
    "I work a second job until 11 so that's the only time",
  ])("fails: %s", (t) => expect(fails(t, mediate)).toBe(true));
  it.each([
    "Rotate dishes weekly on a shared chart",
    "Kitchen stays quiet after 11:30 PM on weeknights",
    "Everyone wants the apartment to feel calm and fair",
    "Check in together for 15 minutes in two weeks",
  ])("passes: %s", (t) => expect(fails(t, mediate)).toBe(false));
});

describe("why-lines are reasons", () => {
  const ctx = (reasons: string[]): GuardContext => ({ ...plan, reasons });
  it.each(["Step-free access throughout the route", "Meal choices suit varied dietary preferences", "Nothing built around drinking", "Halal options everywhere"])(
    "fails: %s",
    (t) => expect(ruleCheck([t], ctx([t])).length).toBeGreaterThan(0),
  );
  it.each(["Fits every budget Hush heard", "Easy for everyone to get around", "Food the whole group can eat", "Chill, outdoors, and unhurried"])(
    "passes: %s",
    (t) => expect(ruleCheck([t], ctx([t]))).toEqual([]),
  );
});
