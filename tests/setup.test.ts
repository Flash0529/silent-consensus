import { describe, expect, it } from "vitest";
import { mergeDraft, missingFields, summarize, toCirclePayload } from "@/lib/ai/setup";

const TODAY = "2026-09-26";

describe("mergeDraft", () => {
  it("keeps known values when the model returns null or blanks", () => {
    expect(mergeDraft({ name: "Maya", kind: "PLAN" }, { name: null, kind: null, area: "  " })).toEqual({ name: "Maya", kind: "PLAN" });
  });
  it("lets new values win", () => {
    expect(mergeDraft({ area: "Midtown" }, { area: "Decatur" }).area).toBe("Decatur");
  });
});

describe("missingFields", () => {
  const plan = { name: "Maya", kind: "PLAN" as const, activity: "dinner", title: "Friday dinner", area: "Midtown", date: "2026-10-02" };
  it("accepts a complete plan", () => expect(missingFields(plan, TODAY)).toEqual([]));
  it("accepts a complete mediation", () =>
    expect(missingFields({ name: "Maya", kind: "MEDIATE", topic: "Chores", date: "2026-10-01" }, TODAY)).toEqual([]));
  it("flags missing plan fields", () =>
    expect(missingFields({ name: "Maya", kind: "PLAN", date: TODAY }, TODAY)).toEqual([
      "draft.activity is missing",
      "draft.area is missing",
      "draft.title is missing",
    ]));
  it("rejects past and far-future dates", () => {
    expect(missingFields({ ...plan, date: "2026-09-25" }, TODAY)[0]).toMatch(/in the past/);
    expect(missingFields({ ...plan, date: "2027-03-01" }, TODAY)[0]).toMatch(/days away/);
  });
  it("rejects an end before the start", () =>
    expect(missingFields({ ...plan, startTime: "20:00", endTime: "18:00" }, TODAY)).toEqual([
      "draft.endTime must be after draft.startTime",
    ]));
});

describe("toCirclePayload", () => {
  it("builds a plan window in Eastern time", () => {
    const p = toCirclePayload({ name: "Maya", kind: "PLAN", activity: "Dinner", title: "Friday dinner", area: "Midtown", date: "2026-10-02", startTime: "18:30", endTime: "22:00" });
    expect(p).toMatchObject({ organizerName: "Maya", kind: "PLAN", activity: "dinner", area: "Midtown", title: "Friday dinner" });
    // EDT is UTC-4 in October.
    expect(p.windowStart).toBe("2026-10-02T22:30:00.000Z");
    expect(p.windowEnd).toBe("2026-10-03T02:00:00.000Z");
    expect(summarize(p)).toEqual(["Dinner", "Fri, Oct 2, 6:30 PM to 10:00 PM", "Midtown"]);
  });
  it("defaults to a 5-hour evening window", () => {
    const p = toCirclePayload({ name: "Maya", kind: "PLAN", activity: "bowling", title: "Bowling", area: "Decatur", date: "2026-10-03" });
    expect(p.windowStart).toBe("2026-10-03T22:00:00.000Z");
    expect(p.windowEnd).toBe("2026-10-04T03:00:00.000Z");
  });
  it("uses the topic as the title for mediation", () => {
    const p = toCirclePayload({ name: "Maya", kind: "MEDIATE", topic: "The apartment", date: "2026-10-01" });
    expect(p).toMatchObject({ kind: "MEDIATE", title: "The apartment", topic: "The apartment", activity: "conversation", area: "" });
    expect(summarize(p)).toEqual(["The apartment", "Way forward by Thu, Oct 1"]);
  });
});
