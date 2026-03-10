import { computeCategoryWeights } from "@/lib/agent/circuitBreaker";

function makeHistory(
  entries: Array<{ outcome: string; source: string }>
): Array<{ outcome: string; source: string; created_at: string }> {
  const now = Date.now();
  return entries.map((e, i) => ({
    ...e,
    created_at: new Date(now - i * 60_000).toISOString(),
  }));
}

describe("computeCategoryWeights", () => {
  it("returns 1.0 for all platforms when no history", () => {
    const weights = computeCategoryWeights([]);
    expect(weights.youtube).toBe(1.0);
    expect(weights.twitch).toBe(1.0);
    expect(weights.chess).toBe(1.0);
    expect(weights.tiktok).toBe(1.0);
  });

  it("returns 1.0 for all platforms when only accepts in history", () => {
    const history = makeHistory([
      { outcome: "accepted", source: "chess" },
      { outcome: "accepted", source: "youtube" },
    ]);
    const weights = computeCategoryWeights(history);
    expect(weights.chess).toBe(1.0);
    expect(weights.youtube).toBe(1.0);
  });

  it("reduces weight by 70% on first rejection", () => {
    const history = makeHistory([
      { outcome: "rejected", source: "chess" },
      { outcome: "accepted", source: "youtube" },
    ]);
    const weights = computeCategoryWeights(history);
    expect(weights.chess).toBeCloseTo(0.3, 1);
    expect(weights.youtube).toBe(1.0);
  });

  it("locks weight to 0 on 2+ consecutive rejections of same platform", () => {
    const history = makeHistory([
      { outcome: "rejected", source: "chess" },
      { outcome: "rejected", source: "chess" },
      { outcome: "accepted", source: "youtube" },
    ]);
    const weights = computeCategoryWeights(history);
    expect(weights.chess).toBe(0);
    expect(weights.youtube).toBe(1.0);
  });

  it("does not lock if rejections are non-consecutive (interrupted by accept)", () => {
    const history = makeHistory([
      { outcome: "rejected", source: "chess" },
      { outcome: "accepted", source: "youtube" },
      { outcome: "rejected", source: "chess" },
    ]);
    const weights = computeCategoryWeights(history);
    // 2 total rejections → weight = max(0, 1.0 - 2*0.7) = 0
    // BUT consecutive check: only first entry is consecutive reject
    // so it's penalized but NOT locked by the consecutive rule
    // However, 2 rejections * 0.7 = 1.4, capped at 0
    expect(weights.chess).toBe(0);
  });

  it("penalizes multiple different platforms independently", () => {
    const history = makeHistory([
      { outcome: "rejected", source: "chess" },
      { outcome: "rejected", source: "twitch" },
      { outcome: "accepted", source: "youtube" },
    ]);
    const weights = computeCategoryWeights(history);
    expect(weights.chess).toBeCloseTo(0.3, 1);
    expect(weights.twitch).toBeCloseTo(0.3, 1);
    expect(weights.youtube).toBe(1.0);
  });

  it("handles history with null/undefined sources gracefully", () => {
    const history = makeHistory([
      { outcome: "rejected", source: "" },
    ]);
    // null source maps to "custom"
    const weights = computeCategoryWeights(
      history.map((h) => ({ ...h, source: null }))
    );
    expect(weights.custom).toBeCloseTo(0.3, 1);
    expect(weights.chess).toBe(1.0);
  });
});
