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
});
