import { describe, expect, it } from "vitest";
import { toGroupSafe } from "@/lib/serialize";

// A circle loaded with every kind of private data, as if a careless query had
// included it all. toGroupSafe must drop every private field.
function loadedCircle() {
  const member = (id: string, name: string, color: string, vault: object, messages: string[]) => ({
    id,
    name,
    avatarColor: color,
    role: "MEMBER",
    interviewStatus: "DONE",
    persona: `persona-${name}-secret`,
    tokenHash: `tokenhash-${id}-secret`,
    vault,
    messages: messages.map((content, i) => ({ id: `${id}-m${i}`, role: "MEMBER", content })),
  });
  return {
    slug: "abc12345",
    title: "Saturday night",
    activity: "dinner",
    area: "Midtown Atlanta",
    windowStart: new Date("2026-10-03T22:00:00Z"),
    status: "PROPOSED",
    planningStage: "DONE",
    organizerId: "m_omar",
    members: [
      member("m_omar", "Omar", "blue", { budgetCapCents: 4000, dietary: ["halal"] }, ["I only eat halal food"]),
      member(
        "m_maya",
        "Maya",
        "peach",
        { budgetCapCents: 1500, privateNote: "keeps skipping dinners because of rent" },
        ["Under 15 honestly. It's why I keep skipping dinners."],
      ),
      member("m_priya", "Priya", "green", { budgetCapCents: 3000, alcohol: "none" }, ["I don't drink, I'm sober"]),
      member("m_jordan", "Jordan", "lilac", { budgetCapCents: 3500, stepFreeRequired: true }, [
        "I use a wheelchair, so step-free places only",
      ]),
    ],
    plans: [
      {
        id: "p1",
        version: 1,
        title: "Picnic + food truck night",
        dateLabel: "Sat, Oct 3 · Midtown Atlanta",
        stops: [
          {
            time: "6:30 PM",
            name: "Food trucks",
            note: "Halal, veggie and dessert trucks",
            venueId: "v07",
            items: [{ label: "Food truck dinner", cents: 1600 }],
            verified: false,
          },
        ],
        perPersonCents: 2500,
        whyItWorks: ["Picked to fit everyone's budget, food, and getting around"],
        leakCheckPassed: true,
        status: "PROPOSED",
        votes: [{ memberId: "m_maya", choice: "TWEAK" }],
        shares: [{ memberId: "m_maya", baseCents: 2500, coveredCents: 1000, finalCents: 1500, privateNote: "Fits what you told Hush" }],
        chipIns: [{ fromMemberId: "m_omar", amountCents: 500 }],
      },
    ],
  };
}

const PRIVATE_STRINGS = [
  "halal food",
  "Under 15",
  "skipping dinners",
  "because of rent",
  "sober",
  "wheelchair",
  "secret",
  "tokenhash",
  "1500",
  "1000",
  "4000",
  "3000",
  "3500",
  "amountCents",
  "budgetCap",
  "privateNote",
  "alcohol",
  "stepFree",
  "Fits what you told Hush",
  "chipIn",
  "fromMemberId",
  "coveredCents",
  "venueId",
  "TWEAK",
];

describe("toGroupSafe", () => {
  const out = JSON.stringify(toGroupSafe(loadedCircle() as Parameters<typeof toGroupSafe>[0]));

  it.each(PRIVATE_STRINGS)("never contains %s", (s) => {
    expect(out).not.toContain(s);
  });

  it("keeps the group-facing fields", () => {
    const g = toGroupSafe(loadedCircle() as Parameters<typeof toGroupSafe>[0]);
    expect(g.members.map((m) => m.name)).toEqual(["Omar", "Maya", "Priya", "Jordan"]);
    expect(g.plan?.title).toBe("Picnic + food truck night");
    expect(g.plan?.perPersonCents).toBe(2500);
    expect(g.plan?.stops[0]).toEqual({
      time: "6:30 PM",
      name: "Food trucks",
      note: "Halal, veggie and dessert trucks",
      demoVenue: true,
    });
    expect(g.members.find((m) => m.name === "Maya")?.hasVoted).toBe(true);
    expect(g.plan?.voteCounts).toEqual({ in: 0, differentTime: 0, tweak: 1, notReady: 0 });
  });

  it("only exposes allowlisted member keys", () => {
    const g = toGroupSafe(loadedCircle() as Parameters<typeof toGroupSafe>[0]);
    for (const m of g.members)
      expect(Object.keys(m).sort()).toEqual(["avatarColor", "hasVoted", "id", "interviewStatus", "isOrganizer", "name"]);
  });
});
