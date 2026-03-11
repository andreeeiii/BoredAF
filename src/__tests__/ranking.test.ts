import { rankContent } from "@/lib/agent/ranking";
import type { SemanticMatch } from "@/lib/embeddings";
import type { TwitchStream } from "@/lib/tools/socialTools";

function makePoolEntry(overrides: Partial<SemanticMatch> = {}): SemanticMatch {
  return {
    id: "pool-1",
    content_text: "Test suggestion",
    category: "general",
    platform: "general",
    url: "",
    times_shown: 0,
    times_accepted: 0,
    times_rejected: 0,
    similarity: 0.8,
    ...overrides,
  };
}

const basePool: SemanticMatch[] = [
  makePoolEntry({ id: "yt1", content_text: "MrBeast latest challenge", category: "influencer", platform: "youtube", url: "https://youtube.com/@MrBeast", similarity: 0.9 }),
  makePoolEntry({ id: "tw1", content_text: "GothamChess live chess", category: "influencer", platform: "twitch", url: "https://twitch.tv/gothamchess", similarity: 0.85 }),
  makePoolEntry({ id: "tw2", content_text: "Hikaru bullet chess", category: "influencer", platform: "twitch", url: "https://twitch.tv/hikaru", similarity: 0.7 }),
  makePoolEntry({ id: "tk1", content_text: "Khaby Lame life hacks", category: "influencer", platform: "tiktok", url: "https://tiktok.com/@khaby.lame", similarity: 0.75 }),
  makePoolEntry({ id: "ch1", content_text: "Daily chess puzzle", category: "gaming", platform: "chess", url: "https://chess.com/daily-chess-puzzle", similarity: 0.8 }),
  makePoolEntry({ id: "gen1", content_text: "Do a 5-minute plank", category: "physical", platform: "general", url: "", similarity: 0.65 }),
];

const liveGotham: TwitchStream = {
  platform: "twitch",
  username: "gothamchess",
  title: "Chess with viewers!",
  url: "https://twitch.tv/gothamchess",
  isLive: true,
  viewerCount: 5000,
  gameName: "Chess",
};

describe("rankContent (pool-first)", () => {
  it("returns ranked items sorted by score descending", () => {
    const items = rankContent(basePool, [], "The Chill", [], []);
    expect(items.length).toBe(basePool.length);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    }
  });

  it("scores pool entries with base 35 * similarity", () => {
    const pool = [makePoolEntry({ id: "x1", similarity: 0.8, platform: "general" })];
    const items = rankContent(pool, [], "The Spark", [], []);
    expect(items.length).toBe(1);
    expect(items[0].score).toBe(Math.round(35 * 0.8));
  });

  it("adds engagement bonus for entries with good accept ratio", () => {
    const pool = [
      makePoolEntry({ id: "e1", similarity: 0.8, times_shown: 10, times_accepted: 8 }),
    ];
    const items = rankContent(pool, [], "The Spark", [], []);
    // base: round(35*0.8)=28, engagement: round(10 * 8/10)=8, total=36
    expect(items[0].score).toBe(36);
  });

  it("marks Twitch pool entries as LIVE when they match live streams", () => {
    const items = rankContent(basePool, [liveGotham], "The Chill", [], []);
    const gotham = items.find((i) => i.url === "https://twitch.tv/gothamchess");
    expect(gotham).toBeDefined();
    expect(gotham!.isLive).toBe(true);
    // Has live bonus of +50
    expect(gotham!.score).toBeGreaterThan(Math.round(35 * 0.85));
  });

  it("gives live items +50 for The Chill", () => {
    const items = rankContent(basePool, [liveGotham], "The Chill", [], []);
    const gotham = items.find((i) => i.url === "https://twitch.tv/gothamchess");
    // base: round(35*0.85)=30, +50 live, +50 chill live bonus, +20 chill twitch = 150
    expect(gotham!.score).toBeGreaterThanOrEqual(140);
  });

  it("gives live items +50 for The Spark", () => {
    const items = rankContent(basePool, [liveGotham], "The Spark", [], []);
    const gotham = items.find((i) => i.url === "https://twitch.tv/gothamchess");
    // base: round(35*0.85)=30, +50 live, +50 spark live bonus = 130
    expect(gotham!.score).toBeGreaterThanOrEqual(120);
  });

  it("does NOT give live bonus for The Grind", () => {
    const items = rankContent(basePool, [liveGotham], "The Grind", [], []);
    const gotham = items.find((i) => i.url === "https://twitch.tv/gothamchess");
    // base: 30, +50 live enrichment, but NO extra +50 for Grind, -10 twitch grind penalty = 70
    expect(gotham!.score).toBeLessThan(100);
  });

  it("boosts chess for The Grind", () => {
    const items = rankContent(basePool, [], "The Grind", [], []);
    const chess = items.find((i) => i.platform === "chess");
    expect(chess).toBeDefined();
    // base: round(35*0.8)=28, +30 grind chess = 58
    expect(chess!.score).toBeGreaterThanOrEqual(50);
  });

  it("penalizes chess for The Chill", () => {
    const items = rankContent(basePool, [], "The Chill", [], []);
    const chess = items.find((i) => i.platform === "chess");
    expect(chess).toBeDefined();
    // base: round(35*0.8)=28, -15 chill chess = 13
    expect(chess!.score).toBeLessThan(20);
  });

  it("penalizes platforms used 3 times in a row", () => {
    const items = rankContent(
      basePool, [], "The Spark",
      ["youtube", "youtube", "youtube"],
      []
    );
    const youtube = items.find((i) => i.platform === "youtube");
    expect(youtube).toBeDefined();
    // base: round(35*0.9)=32, -40 for 3x rotation, -60 graduated rotation
    expect(youtube!.score).toBeLessThan(0);
  });

  it("penalizes duplicate suggestions by title", () => {
    const items = rankContent(
      basePool, [], "The Chill", [],
      ["MrBeast latest challenge"]
    );
    const yt = items.find((i) => i.title === "MrBeast latest challenge");
    expect(yt).toBeDefined();
    expect(yt!.score).toBeLessThan(0);
  });

  it("handles empty pool gracefully", () => {
    const items = rankContent([], [], "The Spark", [], []);
    expect(items).toHaveLength(0);
  });

  it("includes all platforms from pool in output", () => {
    const items = rankContent(basePool, [], "The Spark", [], []);
    const platforms = new Set(items.map((i) => i.platform));
    expect(platforms.has("youtube")).toBe(true);
    expect(platforms.has("twitch")).toBe(true);
    expect(platforms.has("chess")).toBe(true);
    expect(platforms.has("tiktok")).toBe(true);
    expect(platforms.has("general")).toBe(true);
  });

  it("sets blacklisted platform score to -999", () => {
    const items = rankContent(
      basePool, [], "The Grind", [], [], [],
      ["chess"]
    );
    const chess = items.find((i) => i.platform === "chess");
    expect(chess).toBeDefined();
    expect(chess!.score).toBe(-999);
  });

  it("applies category cooldown (-80%) when platform appears 3+ in last 5 history", () => {
    const history = [
      { suggestion: "s1", outcome: "rejected" as const, source: "chess" },
      { suggestion: "s2", outcome: "rejected" as const, source: "chess" },
      { suggestion: "s3", outcome: "rejected" as const, source: "chess" },
    ];
    const items = rankContent(
      basePool, [], "The Grind", [], [], history,
      []
    );
    const chess = items.find((i) => i.platform === "chess");
    expect(chess).toBeDefined();
    // base: 28 + 30 grind = 58, -80% = 58 - 46 = 12
    expect(chess!.score).toBeLessThan(20);
  });

  it("applies circuit breaker category weights to reduce scores", () => {
    const items = rankContent(
      basePool, [liveGotham], "The Chill", [], [], [], [], [],
      { chess: 0, youtube: 0.3, twitch: 1.0, tiktok: 1.0 }
    );
    const chess = items.find((i) => i.platform === "chess");
    const youtube = items.find((i) => i.platform === "youtube");
    const twitch = items.find((i) => i.platform === "twitch" && i.isLive);
    expect(chess!.score).toBe(0);
    expect(youtube!.score).toBeLessThan(15);
    expect(twitch!.score).toBeGreaterThan(50);
  });

  it("applies graduated rotation penalty (-60 last)", () => {
    const items = rankContent(
      basePool, [], "The Spark",
      ["chess"], []
    );
    const chess = items.find((i) => i.platform === "chess");
    expect(chess).toBeDefined();
    // base: 28, -60 rotation = -32
    expect(chess!.score).toBeLessThan(0);
  });

  it("does not penalize platforms that were NOT the last suggested", () => {
    const items = rankContent(
      basePool, [liveGotham], "The Chill",
      ["chess"], []
    );
    const twitch = items.find((i) => i.platform === "twitch" && i.isLive);
    expect(twitch).toBeDefined();
    expect(twitch!.score).toBeGreaterThanOrEqual(100);
  });
});

describe("Item Blacklist & Graduated Rotation (pool-first)", () => {
  it("sets blacklisted item score to -999 by URL", () => {
    const items = rankContent(
      basePool, [], "The Chill", [], [], [],
      [], ["https://twitch.tv/gothamchess"]
    );
    const gotham = items.find((i) => i.url === "https://twitch.tv/gothamchess");
    expect(gotham).toBeDefined();
    expect(gotham!.score).toBe(-999);
  });

  it("does not blacklist items whose URLs are not in the blacklist", () => {
    const items = rankContent(
      basePool, [], "The Chill", [], [], [],
      [], ["https://twitch.tv/some_other_streamer"]
    );
    const gotham = items.find((i) => i.url === "https://twitch.tv/gothamchess");
    expect(gotham).toBeDefined();
    expect(gotham!.score).toBeGreaterThan(0);
  });

  it("blacklists multiple items simultaneously", () => {
    const items = rankContent(
      basePool, [], "The Chill", [], [], [],
      [], ["https://twitch.tv/gothamchess", "https://tiktok.com/@khaby.lame"]
    );
    const gotham = items.find((i) => i.url === "https://twitch.tv/gothamchess");
    const tiktok = items.find((i) => i.url === "https://tiktok.com/@khaby.lame");
    expect(gotham!.score).toBe(-999);
    expect(tiktok!.score).toBe(-999);
  });

  it("applies graduated rotation: -60 for last, -30 for 2nd-last", () => {
    const items = rankContent(
      basePool, [], "The Chill",
      ["twitch", "youtube"], []
    );
    const twitch = items.find((i) => i.platform === "twitch" && i.url === "https://twitch.tv/gothamchess");
    const youtube = items.find((i) => i.platform === "youtube");
    // twitch was last: -60, youtube was 2nd-last: -30
    expect(twitch!.score).toBeLessThan(50);
    expect(youtube!.score).toBeLessThan(20);
  });

  it("applies all three levels of graduated rotation", () => {
    const items = rankContent(
      basePool, [], "The Chill",
      ["twitch", "youtube", "chess"], []
    );
    const chess = items.find((i) => i.platform === "chess");
    // chess base: 28, -15 chill, -15 3rd-last = -2
    expect(chess!.score).toBeLessThan(15);
  });

  it("detects duplicates by bidirectional title matching", () => {
    const items = rankContent(
      basePool, [], "The Chill", [],
      ["Khaby Lame life hacks on TikTok"]
    );
    const tiktok = items.find((i) => i.platform === "tiktok");
    expect(tiktok).toBeDefined();
    expect(tiktok!.score).toBeLessThan(0);
  });

  it("item blacklist and platform blacklist work independently", () => {
    const items = rankContent(
      basePool, [], "The Chill", [], [], [],
      ["tiktok"],
      ["https://twitch.tv/hikaru"]
    );
    const tiktok = items.find((i) => i.platform === "tiktok");
    const hikaru = items.find((i) => i.url === "https://twitch.tv/hikaru");
    const gotham = items.find((i) => i.url === "https://twitch.tv/gothamchess");
    expect(tiktok!.score).toBe(-999);
    expect(hikaru!.score).toBe(-999);
    expect(gotham!.score).toBeGreaterThan(0);
  });
});

describe("Pool Engagement & Live Enrichment", () => {
  it("entries with zero shows get no engagement bonus", () => {
    const pool = [makePoolEntry({ similarity: 0.8, times_shown: 0, times_accepted: 0 })];
    const items = rankContent(pool, [], "The Spark", [], []);
    expect(items[0].score).toBe(Math.round(35 * 0.8));
  });

  it("entries with high engagement get bonus up to 10", () => {
    const pool = [makePoolEntry({ similarity: 0.8, times_shown: 100, times_accepted: 100 })];
    const items = rankContent(pool, [], "The Spark", [], []);
    // base 28 + engagement round(10 * 100/100)=10 = 38
    expect(items[0].score).toBe(38);
  });

  it("live enrichment adds Twitch metadata to ranked items", () => {
    const pool = [makePoolEntry({ id: "tw1", platform: "twitch", url: "https://twitch.tv/gothamchess", similarity: 0.9 })];
    const items = rankContent(pool, [liveGotham], "The Chill", [], []);
    expect(items[0].isLive).toBe(true);
    expect(items[0].metadata.username).toBe("gothamchess");
    expect(items[0].metadata.viewerCount).toBe(5000);
    expect(items[0].metadata.gameName).toBe("Chess");
  });

  it("non-matching Twitch URLs are not marked live", () => {
    const pool = [makePoolEntry({ id: "tw2", platform: "twitch", url: "https://twitch.tv/hikaru", similarity: 0.8 })];
    const items = rankContent(pool, [liveGotham], "The Chill", [], []);
    // hikaru is not in live streams
    expect(items[0].isLive).toBe(false);
  });

  it("stores poolId in metadata for engagement tracking", () => {
    const pool = [makePoolEntry({ id: "my-pool-id-123", similarity: 0.8 })];
    const items = rankContent(pool, [], "The Spark", [], []);
    expect(items[0].metadata.poolId).toBe("my-pool-id-123");
  });
});

describe("Sponsored Content", () => {
  it("gives +30 score boost to sponsored entries", () => {
    const sponsored = { ...makePoolEntry({ id: "sp1", similarity: 0.8, platform: "youtube" }), is_sponsored: true, sponsor_id: "brand-1" } as SemanticMatch;
    const organic = makePoolEntry({ id: "org1", similarity: 0.8, platform: "youtube" });
    const items = rankContent([sponsored, organic], [], "The Spark", [], []);
    const sp = items.find((i) => i.metadata.isSponsored);
    const org = items.find((i) => !i.metadata.isSponsored);
    expect(sp).toBeDefined();
    expect(org).toBeDefined();
    expect(sp!.score - org!.score).toBe(30);
  });

  it("passes sponsorId through metadata", () => {
    const sponsored = { ...makePoolEntry({ id: "sp2", similarity: 0.8 }), is_sponsored: true, sponsor_id: "brand-xyz" } as SemanticMatch;
    const items = rankContent([sponsored], [], "The Spark", [], []);
    expect(items[0].metadata.isSponsored).toBe(true);
    expect(items[0].metadata.sponsorId).toBe("brand-xyz");
  });

  it("marks non-sponsored entries as isSponsored=false", () => {
    const pool = [makePoolEntry({ id: "org1", similarity: 0.8 })];
    const items = rankContent(pool, [], "The Spark", [], []);
    expect(items[0].metadata.isSponsored).toBe(false);
  });
});
