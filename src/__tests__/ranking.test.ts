import { rankContent, type RankingInput } from "@/lib/agent/ranking";

const baseTools: RankingInput = {
  youtube: {
    videos: [
      {
        title: "Chess Opening Tricks",
        videoId: "abc123",
        publishedAt: "2025-01-01T00:00:00Z",
        thumbnail: "https://img.youtube.com/vi/abc123/0.jpg",
        channelTitle: "GothamChess",
        url: "https://youtube.com/watch?v=abc123",
      },
    ],
    error: null,
  },
  chess: {
    currentElo: 420,
    dailyPuzzleUrl: "https://chess.com/puzzle/12345",
    dailyPuzzleTitle: "Mate in 2",
    error: null,
  },
  twitch: {
    streams: [
      {
        platform: "twitch",
        username: "gothamchess",
        title: "Chess with viewers!",
        url: "https://twitch.tv/gothamchess",
        isLive: true,
        viewerCount: 5000,
        gameName: "Chess",
      },
      {
        platform: "twitch",
        username: "hikaru",
        title: "hikaru's channel",
        url: "https://twitch.tv/hikaru",
        isLive: false,
        viewerCount: null,
        gameName: null,
      },
    ],
    error: null,
  },
  tiktok: {
    links: [
      {
        platform: "tiktok",
        username: "chessguy",
        url: "https://www.tiktok.com/@chessguy",
        displayName: "@chessguy",
      },
    ],
    error: null,
  },
};

describe("rankContent", () => {
  it("returns ranked items sorted by score descending", () => {
    const items = rankContent(baseTools, "The Chill", [], []);
    expect(items.length).toBeGreaterThan(0);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    }
  });

  it("gives live Twitch streams +50 for The Chill", () => {
    const items = rankContent(baseTools, "The Chill", [], []);
    const liveStream = items.find(
      (i) => i.platform === "twitch" && i.isLive
    );
    expect(liveStream).toBeDefined();
    expect(liveStream!.score).toBeGreaterThanOrEqual(110);
  });

  it("gives live Twitch streams +50 for The Spark", () => {
    const items = rankContent(baseTools, "The Spark", [], []);
    const liveStream = items.find(
      (i) => i.platform === "twitch" && i.isLive
    );
    expect(liveStream).toBeDefined();
    expect(liveStream!.score).toBeGreaterThanOrEqual(110);
  });

  it("does NOT give live bonus for The Grind", () => {
    const items = rankContent(baseTools, "The Grind", [], []);
    const liveStream = items.find(
      (i) => i.platform === "twitch" && i.isLive
    );
    expect(liveStream).toBeDefined();
    expect(liveStream!.score).toBeLessThan(110);
  });

  it("boosts chess for The Grind", () => {
    const items = rankContent(baseTools, "The Grind", [], []);
    const chess = items.find((i) => i.platform === "chess");
    expect(chess).toBeDefined();
    expect(chess!.score).toBeGreaterThanOrEqual(55);
  });

  it("penalizes chess for The Chill", () => {
    const items = rankContent(baseTools, "The Chill", [], []);
    const chess = items.find((i) => i.platform === "chess");
    expect(chess).toBeDefined();
    expect(chess!.score).toBeLessThan(25);
  });

  it("penalizes platforms used 3 times in a row", () => {
    const items = rankContent(
      baseTools,
      "The Spark",
      ["youtube", "youtube", "youtube"],
      []
    );
    const youtube = items.find((i) => i.platform === "youtube");
    expect(youtube).toBeDefined();
    expect(youtube!.score).toBeLessThan(30);
  });

  it("penalizes duplicate suggestions", () => {
    const items = rankContent(
      baseTools,
      "The Chill",
      [],
      ["Chess Opening Tricks"]
    );
    const yt = items.find((i) => i.title === "Chess Opening Tricks");
    expect(yt).toBeDefined();
    expect(yt!.score).toBeLessThan(0);
  });

  it("handles null tool results gracefully", () => {
    const emptyTools: RankingInput = {
      youtube: null,
      chess: null,
      twitch: null,
      tiktok: null,
    };
    const items = rankContent(emptyTools, "The Spark", [], []);
    expect(items).toHaveLength(0);
  });

  it("includes all platforms in output", () => {
    const items = rankContent(baseTools, "The Spark", [], []);
    const platforms = new Set(items.map((i) => i.platform));
    expect(platforms.has("youtube")).toBe(true);
    expect(platforms.has("twitch")).toBe(true);
    expect(platforms.has("chess")).toBe(true);
    expect(platforms.has("tiktok")).toBe(true);
  });

  it("marks live items correctly", () => {
    const items = rankContent(baseTools, "The Spark", [], []);
    const liveItems = items.filter((i) => i.isLive);
    expect(liveItems.length).toBe(1);
    expect(liveItems[0].platform).toBe("twitch");
  });

  it("sets blacklisted platform score to -999", () => {
    const items = rankContent(
      baseTools,
      "The Grind",
      [],
      [],
      [],
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
      baseTools,
      "The Grind",
      [],
      [],
      history,
      []
    );
    const chess = items.find((i) => i.platform === "chess");
    expect(chess).toBeDefined();
    // Base 25 + Grind +30 = 55, then -80% = 55 - 44 = 11
    expect(chess!.score).toBeLessThan(20);
  });

  it("applies circuit breaker category weights to reduce scores", () => {
    const items = rankContent(
      baseTools,
      "The Chill",
      [],
      [],
      [],
      [],
      { chess: 0, youtube: 0.3, twitch: 1.0, tiktok: 1.0 }
    );
    const chess = items.find((i) => i.platform === "chess");
    const youtube = items.find((i) => i.platform === "youtube");
    const twitch = items.find((i) => i.platform === "twitch" && i.isLive);
    expect(chess!.score).toBe(0);
    expect(youtube!.score).toBeLessThan(15);
    expect(twitch!.score).toBeGreaterThan(50);
  });

  it("applies strict rotation penalty (-60) when platform matches last suggested", () => {
    const items = rankContent(
      baseTools,
      "The Spark",
      ["chess"],
      [],
      [],
      []
    );
    const chess = items.find((i) => i.platform === "chess");
    expect(chess).toBeDefined();
    // Base 25, then Spark adjustments, then -60 for strict rotation
    expect(chess!.score).toBeLessThan(0);
  });

  it("does not penalize platforms that were NOT the last suggested", () => {
    const items = rankContent(
      baseTools,
      "The Chill",
      ["chess"],
      [],
      [],
      []
    );
    const twitch = items.find((i) => i.platform === "twitch" && i.isLive);
    expect(twitch).toBeDefined();
    // Live twitch for Chill = 60 + 50 + 20 = 130, no rotation penalty
    expect(twitch!.score).toBeGreaterThanOrEqual(100);
  });
});

describe("Semantic Ranking", () => {
  const semanticMatches = [
    { id: "s1", content_text: "Learn to juggle with 3 items", category: "physical", similarity: 0.85 },
    { id: "s2", content_text: "Try a 5-min plank challenge", category: "physical", similarity: 0.72 },
    { id: "s3", content_text: "Write a haiku about your mood", category: "creative", similarity: 0.60 },
  ];

  it("scores semantic matches with base 35 * similarity", () => {
    const items = rankContent(
      baseTools,
      "The Spark",
      [],
      [],
      [],
      [],
      {},
      semanticMatches
    );
    const semanticItems = items.filter((i) => i.platform === "semantic");
    expect(semanticItems.length).toBe(3);

    const juggle = semanticItems.find((i) => i.title.includes("juggle"));
    expect(juggle).toBeDefined();
    // 35 * 0.85 = 29.75 → round to 30
    expect(juggle!.score).toBe(Math.round(35 * 0.85));
  });

  it("ranks semantic matches alongside platform content by score", () => {
    const items = rankContent(
      baseTools,
      "The Chill",
      [],
      [],
      [],
      [],
      {},
      semanticMatches
    );
    // Semantic items should be interleaved with platform items by score
    expect(items.length).toBeGreaterThan(semanticMatches.length);
    // Items should be sorted descending
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    }
  });

  it("semantic items have empty url and semantic platform", () => {
    const items = rankContent(
      baseTools,
      "The Spark",
      [],
      [],
      [],
      [],
      {},
      semanticMatches
    );
    const semanticItems = items.filter((i) => i.platform === "semantic");
    for (const item of semanticItems) {
      expect(item.url).toBe("");
      expect(item.isLive).toBe(false);
      expect(item.metadata).toHaveProperty("category");
      expect(item.metadata).toHaveProperty("similarity");
    }
  });

  it("semantic items are not affected by circuit breaker weights for other platforms", () => {
    const items = rankContent(
      baseTools,
      "The Spark",
      [],
      [],
      [],
      [],
      { youtube: 0.3, chess: 0, semantic: 1.0 },
      semanticMatches
    );
    const semanticItems = items.filter((i) => i.platform === "semantic");
    const juggle = semanticItems.find((i) => i.title.includes("juggle"));
    // semantic weight = 1.0, so score unchanged: round(35 * 0.85) = 30
    expect(juggle!.score).toBe(Math.round(35 * 0.85));
  });

  it("works with empty semantic matches", () => {
    const items = rankContent(
      baseTools,
      "The Spark",
      [],
      [],
      [],
      [],
      {},
      []
    );
    const semanticItems = items.filter((i) => i.platform === "semantic");
    expect(semanticItems.length).toBe(0);
  });
});
