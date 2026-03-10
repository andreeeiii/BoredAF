import { getDefaultRescue } from "@/lib/tools/registry";

describe("getDefaultRescue", () => {
  it("returns a non-empty string", () => {
    const result = getDefaultRescue();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("excludes suggestions containing excluded terms", () => {
    const result = getDefaultRescue(["walk", "push-ups", "drink", "text", "album", "magic", "grateful", "desk", "stretch", "phone"]);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back to full pool when all are excluded", () => {
    const result = getDefaultRescue([
      "walk", "push-ups", "drink", "text", "album",
      "magic", "grateful", "desk", "stretch", "phone",
      "every possible keyword",
    ]);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns different results over multiple calls", () => {
    const results = new Set(
      Array.from({ length: 30 }, () => getDefaultRescue())
    );
    expect(results.size).toBeGreaterThan(1);
  });
});
