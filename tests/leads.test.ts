import { describe, expect, it } from "vitest";
import { LeadBody, leadData } from "@/lib/leads";

describe("LeadBody", () => {
  it("normalizes a waitlist email and defaults the source", () => {
    const r = LeadBody.parse({ kind: "WAITLIST", email: "  Maya@Example.COM " });
    expect(r).toEqual({ kind: "WAITLIST", email: "maya@example.com", source: "site" });
  });

  it("rejects a bad email", () => {
    expect(LeadBody.safeParse({ kind: "WAITLIST", email: "maya@" }).success).toBe(false);
  });

  it("requires name, company and a known team size for a pilot", () => {
    const base = { kind: "PILOT", email: "dana@acme.co", name: "Dana", company: "Acme" };
    expect(LeadBody.safeParse({ ...base, teamSize: "26 to 100" }).success).toBe(true);
    expect(LeadBody.safeParse({ ...base, teamSize: "a lot" }).success).toBe(false);
    expect(LeadBody.safeParse({ ...base, name: " ", teamSize: "500+" }).success).toBe(false);
  });

  it("still parses when the honeypot is filled, but never stores it", () => {
    const r = LeadBody.parse({ kind: "WAITLIST", email: "bot@spam.io", website: "spam.io" });
    expect(r.website).toBe("spam.io");
    expect(leadData(r)).not.toHaveProperty("website");
  });
});
