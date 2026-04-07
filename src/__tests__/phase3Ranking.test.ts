import {
  computeFreshnessDecay,
  shouldExplore,
  applyCategoryVarietyBonus,
  applyExplorationBonus,
  type RankedItem,
} from "@/lib/agent/ranking";
import { flagUnhealthyUrl, clearUnhealthyUrl } from "@/lib/agent/urlHealthCache";

function makeItem(
  platform: string,
  score: number,
  opts?: { category?: string; similarity?: number; createdAt?: string; url?: string }
): RankedItem {
  return {
    platform,
    title: `${platform} content ${score}`,
    url: opts?.url ?? `https://${platform}.com/test-${score}`,
    score,
    isLive: false,
    metadata: {
      category: opts?.category ?? "influencer",
      similarity: opts?.similarity ?? 0.8,
      poolId: `pool-${platform}-${score}`,
      isSponsored: false,
      createdAt: opts?.createdAt,
    },
  };
}

describe("computeFreshnessDecay", () => {
  it("returns 0 for undefined createdAt", () => {
    expect(computeFreshnessDecay(undefined)).toBe(0);
  });

  it("returns 0 for entry created today", () => {
    expect(computeFreshnessDecay(new Date().toISOString())).toBe(0);
  });

  it("returns 0 for entry created 15 days ago", () => {
    const d = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessDecay(d)).toBe(0);
  });

  it("returns -5 for entry created 35 days ago", () => {
    const d = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessDecay(d)).toBe(-5);
  });

  it("returns -10 for entry created 65 days ago", () => {
    const d = new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessDecay(d)).toBe(-10);
  });

  it("returns -15 for entry created 100 days ago", () => {
    const d = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessDecay(d)).toBe(-15);
  });

  it("returns -15 for entry created 365 days ago", () => {
    const d = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeFreshnessDecay(d)).toBe(-15);
  });
});

describe("shouldExplore", () => {
  it("returns true when random value is below 0.15", () => {
    expect(shouldExplore(0.0)).toBe(true);
    expect(shouldExplore(0.10)).toBe(true);
    expect(shouldExplore(0.14)).toBe(true);
  });

  it("returns false when random value is >= 0.15", () => {
    expect(shouldExplore(0.15)).toBe(false);
    expect(shouldExplore(0.5)).toBe(false);
    expect(shouldExplore(0.99)).toBe(false);
  });
});

describe("applyCategoryVarietyBonus", () => {
  it("does nothing when all items have the same category", () => {
    const items = [
      makeItem("youtube", 50, { category: "influencer" }),
      makeItem("youtube", 40, { category: "influencer" }),
      makeItem("youtube", 30, { category: "influencer" }),
    ];
    const originalScores = items.map((i) => i.score);
    applyCategoryVarietyBonus(items);
    expect(items.map((i) => i.score)).toEqual(originalScores);
  });

  it("boosts underrepresented category when dominant has ≥60%", () => {
    const items = [
      makeItem("youtube", 50, { category: "influencer" }),
      makeItem("youtube", 45, { category: "influencer" }),
      makeItem("youtube", 40, { category: "influencer" }),
      makeItem("youtube", 35, { category: "learning" }),
      makeItem("youtube", 30, { category: "influencer" }),
    ];
    applyCategoryVarietyBonus(items);
    // "learning" item should get +10
    const learningItem = items.find((i) => (i.metadata.category as string) === "learning");
    expect(learningItem!.score).toBe(45); // 35 + 10
  });

  it("does not boost when no category dominates (50/50 split)", () => {
    const items = [
      makeItem("youtube", 50, { category: "influencer" }),
      makeItem("youtube", 40, { category: "learning" }),
      makeItem("youtube", 30, { category: "influencer" }),
      makeItem("youtube", 20, { category: "learning" }),
    ];
    const originalScores = items.map((i) => i.score);
    applyCategoryVarietyBonus(items);
    // 50% each, not ≥60%, no boost
    expect(items.map((i) => i.score)).toEqual(originalScores);
  });

  it("ignores blacklisted items (score <= -900)", () => {
    const items = [
      makeItem("youtube", 50, { category: "influencer" }),
      makeItem("youtube", -999, { category: "influencer" }),
      makeItem("youtube", -999, { category: "influencer" }),
      makeItem("youtube", 35, { category: "learning" }),
    ];
    applyCategoryVarietyBonus(items);
    // Only 2 non-blacklisted items, < 3, so no bonus applied
    expect(items[3].score).toBe(35);
  });

  it("handles platforms independently", () => {
    const items = [
      makeItem("youtube", 50, { category: "influencer" }),
      makeItem("youtube", 45, { category: "influencer" }),
      makeItem("youtube", 40, { category: "influencer" }),
      makeItem("youtube", 35, { category: "learning" }),
      makeItem("twitch", 30, { category: "gaming" }),
      makeItem("twitch", 25, { category: "gaming" }),
      makeItem("twitch", 20, { category: "gaming" }),
    ];
    applyCategoryVarietyBonus(items);
    // YouTube: influencer dominates (75%), learning gets +10
    expect(items[3].score).toBe(45); // 35 + 10
    // Twitch: only 1 category, no bonus
    expect(items[4].score).toBe(30);
  });
});

describe("applyExplorationBonus", () => {
  it("does not apply bonus when randomOverride >= 0.15 (no exploration)", () => {
    const items = [
      makeItem("youtube", 50, { similarity: 0.9 }),
      makeItem("twitch", 40, { similarity: 0.7 }),
      makeItem("chess", 30, { similarity: 0.5 }),
      makeItem("tiktok", 20, { similarity: 0.3 }),
    ];
    const originalScores = items.map((i) => i.score);
    applyExplorationBonus(items, 0.5); // No exploration
    expect(items.map((i) => i.score)).toEqual(originalScores);
  });

  it("applies +20 bonus to a low-similarity item when exploration triggers", () => {
    const items = [
      makeItem("youtube", 50, { similarity: 0.9 }),
      makeItem("twitch", 40, { similarity: 0.8 }),
      makeItem("chess", 30, { similarity: 0.5 }),
      makeItem("tiktok", 20, { similarity: 0.3 }),
    ];
    const totalBefore = items.reduce((sum, i) => sum + i.score, 0);
    applyExplorationBonus(items, 0.05); // Triggers exploration
    const totalAfter = items.reduce((sum, i) => sum + i.score, 0);
    // Exactly one item should get +20
    expect(totalAfter).toBe(totalBefore + 20);
  });

  it("does not apply bonus when fewer than 4 eligible items", () => {
    const items = [
      makeItem("youtube", 50, { similarity: 0.9 }),
      makeItem("twitch", 40, { similarity: 0.7 }),
      makeItem("chess", 30, { similarity: 0.5 }),
    ];
    const originalScores = items.map((i) => i.score);
    applyExplorationBonus(items, 0.05); // Triggers, but too few items
    expect(items.map((i) => i.score)).toEqual(originalScores);
  });

  it("skips blacklisted items for exploration", () => {
    const items = [
      makeItem("youtube", 50, { similarity: 0.9 }),
      makeItem("twitch", 40, { similarity: 0.7 }),
      makeItem("chess", -999, { similarity: 0.5 }),
      makeItem("tiktok", -999, { similarity: 0.3 }),
      makeItem("general", 10, { similarity: 0.2 }),
    ];
    // Only 3 eligible (non-blacklisted), so no exploration
    const originalScores = items.map((i) => i.score);
    applyExplorationBonus(items, 0.05);
    expect(items.map((i) => i.score)).toEqual(originalScores);
  });
});
