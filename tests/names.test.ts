import { describe, expect, it } from "vitest";
import { cleanName, zPersonName, zTitle } from "@/lib/names";

// Only Hush gets the verified check: people can't put check marks in names or chat titles.
describe("names", () => {
  it("strips check marks and look-alikes", () => {
    expect(cleanName("Ana ✓")).toBe("Ana");
    expect(cleanName("✔️ Ben ☑ ✅")).toBe("Ben");
    expect(cleanName("Cal 🗸")).toBe("Cal");
  });
  it("refuses names that are only check marks, or reserved", () => {
    expect(zPersonName().safeParse("✓").success).toBe(false);
    expect(zPersonName().safeParse("Hush").success).toBe(false);
    expect(zPersonName().safeParse("hush ✓").success).toBe(false);
    expect(zPersonName().safeParse("Silent Consensus").success).toBe(false);
    expect(zPersonName().safeParse("Hushpuppy").success).toBe(true);
  });
  it("cleans chat titles", () => {
    expect(zTitle().parse("Friday night ✅")).toBe("Friday night");
  });
});
