import { describe, expect, it } from "vitest";
import { clip } from "@/lib/text";

// Cutting text must never split an emoji (the database rejects the broken half).
describe("clip", () => {
  it("never leaves half an emoji", () => {
    const s = "yesss 🙌 concert and then food after? / maybe 👀";
    for (let n = 0; n < 60; n++) expect(clip(s, n).isWellFormed()).toBe(true);
  });
  it("keeps short text as is", () => {
    expect(clip("hi 👋", 50)).toBe("hi 👋");
    expect(clip(null, 5)).toBe("");
  });
});
