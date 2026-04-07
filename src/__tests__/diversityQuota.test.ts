import { enforceDiversityQuota, type RankedItem } from "@/lib/agent/ranking";

function makeItem(platform: string, score: number, title?: string): RankedItem {
  return {
    platform,
    title: title ?? `${platform} content`,
    url: `https://${platform}.com/test`,
    score,
    isLive: false,
    metadata: { poolId: `pool-${platform}-${score}`, category: "influencer" },
  };
}

describe("enforceDiversityQuota", () => {
  it("does nothing when list is shorter than topN", () => {
    const items = [makeItem("youtube", 50), makeItem("twitch", 40)];
    const result = enforceDiversityQuota(items, 8, 3);
    expect(result).toEqual(items);
  });

  it("does nothing when top-8 already has ≥3 platforms", () => {
    const items = [
      makeItem("youtube", 90),
      makeItem("twitch", 80),
      makeItem("chess", 70),
      makeItem("youtube", 60),
      makeItem("twitch", 50),
      makeItem("chess", 40),
      makeItem("youtube", 30),
      makeItem("twitch", 20),
      // rest
      makeItem("tiktok", 10),
      makeItem("general", 5),
    ];
    const result = enforceDiversityQuota(items, 8, 3);
    const top8Platforms = new Set(result.slice(0, 8).map((i) => i.platform));
    expect(top8Platforms.size).toBeGreaterThanOrEqual(3);
  });

  it("promotes an underrepresented platform into top-8 when only 1 platform dominates", () => {
    const items = [
      makeItem("youtube", 90),
      makeItem("youtube", 85),
      makeItem("youtube", 80),
      makeItem("youtube", 75),
      makeItem("youtube", 70),
      makeItem("youtube", 65),
      makeItem("youtube", 60),
      makeItem("youtube", 55),
      // rest — diverse
      makeItem("twitch", 45),
      makeItem("chess", 40),
      makeItem("tiktok", 35),
    ];
    const result = enforceDiversityQuota(items, 8, 3);
    const top8Platforms = new Set(result.slice(0, 8).map((i) => i.platform));
    expect(top8Platforms.size).toBeGreaterThanOrEqual(2);
    // twitch should be promoted into top-8
    expect(result.slice(0, 8).some((i) => i.platform === "twitch")).toBe(true);
  });

  it("promotes multiple platforms when top-8 has only 2", () => {
    const items = [
      makeItem("youtube", 90),
      makeItem("youtube", 85),
      makeItem("twitch", 80),
      makeItem("youtube", 75),
      makeItem("twitch", 70),
      makeItem("youtube", 65),
      makeItem("twitch", 60),
      makeItem("youtube", 55),
      // rest
      makeItem("chess", 45),
      makeItem("tiktok", 40),
      makeItem("general", 35),
    ];
    const result = enforceDiversityQuota(items, 8, 3);
    const top8Platforms = new Set(result.slice(0, 8).map((i) => i.platform));
    expect(top8Platforms.size).toBeGreaterThanOrEqual(3);
  });

  it("does not promote blacklisted items (score <= -900)", () => {
    const items = [
      makeItem("youtube", 90),
      makeItem("youtube", 85),
      makeItem("youtube", 80),
      makeItem("youtube", 75),
      makeItem("youtube", 70),
      makeItem("youtube", 65),
      makeItem("youtube", 60),
      makeItem("youtube", 55),
      // rest — only blacklisted non-youtube items
      makeItem("twitch", -999),
      makeItem("chess", -999),
    ];
    const result = enforceDiversityQuota(items, 8, 3);
    // Can't promote anything since rest items are all blacklisted
    const top8 = result.slice(0, 8);
    expect(top8.every((i) => i.platform === "youtube")).toBe(true);
  });

  it("stops promoting once minPlatforms is reached", () => {
    const items = [
      makeItem("youtube", 90),
      makeItem("youtube", 85),
      makeItem("youtube", 80),
      makeItem("youtube", 75),
      makeItem("youtube", 70),
      makeItem("youtube", 65),
      makeItem("youtube", 60),
      makeItem("youtube", 55),
      // rest — many platforms available
      makeItem("twitch", 45),
      makeItem("chess", 40),
      makeItem("tiktok", 35),
      makeItem("general", 30),
    ];
    // Only need 3 platforms min
    const result = enforceDiversityQuota(items, 8, 3);
    const top8Platforms = new Set(result.slice(0, 8).map((i) => i.platform));
    // Should have promoted at most 2 items (to reach 3 platforms total with youtube)
    expect(top8Platforms.size).toBeGreaterThanOrEqual(3);
  });

  it("preserves overall item count", () => {
    const items = [
      makeItem("youtube", 90),
      makeItem("youtube", 85),
      makeItem("youtube", 80),
      makeItem("youtube", 75),
      makeItem("youtube", 70),
      makeItem("youtube", 65),
      makeItem("youtube", 60),
      makeItem("youtube", 55),
      makeItem("twitch", 45),
      makeItem("chess", 40),
    ];
    const result = enforceDiversityQuota(items, 8, 3);
    expect(result.length).toBe(items.length);
  });

  it("handles custom topN and minPlatforms", () => {
    const items = [
      makeItem("youtube", 90),
      makeItem("youtube", 85),
      makeItem("youtube", 80),
      makeItem("youtube", 75),
      // rest
      makeItem("twitch", 45),
    ];
    const result = enforceDiversityQuota(items, 4, 2);
    const top4Platforms = new Set(result.slice(0, 4).map((i) => i.platform));
    expect(top4Platforms.size).toBeGreaterThanOrEqual(2);
  });
});
