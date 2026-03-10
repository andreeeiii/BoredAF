import {
  fetchTwitchStreams,
  fetchTikTokLinks,
  TwitchResultSchema,
  TikTokResultSchema,
} from "@/lib/tools/socialTools";

global.fetch = jest.fn();

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_ACCESS_TOKEN;
});

describe("fetchTwitchStreams", () => {
  it("returns offline streams when API keys are missing", async () => {
    const result = await fetchTwitchStreams(["gothamchess", "hikaru"]);
    expect(result.streams).toHaveLength(2);
    expect(result.streams[0].isLive).toBe(false);
    expect(result.streams[0].url).toBe("https://twitch.tv/gothamchess");
    expect(result.error).toBe("Twitch API keys not configured");
    expect(() => TwitchResultSchema.parse(result)).not.toThrow();
  });

  it("limits to 5 usernames when no API keys", async () => {
    const usernames = Array.from({ length: 10 }, (_, i) => `user${i}`);
    const result = await fetchTwitchStreams(usernames);
    expect(result.streams).toHaveLength(5);
  });

  it("returns live streams when API responds", async () => {
    process.env.TWITCH_CLIENT_ID = "test_id";
    process.env.TWITCH_ACCESS_TOKEN = "test_token";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            user_login: "gothamchess",
            title: "Chess with viewers!",
            viewer_count: 5000,
            game_name: "Chess",
          },
        ],
      }),
    });

    const result = await fetchTwitchStreams(["gothamchess", "hikaru"]);
    expect(result.error).toBeNull();

    const live = result.streams.find((s) => s.username === "gothamchess");
    expect(live?.isLive).toBe(true);
    expect(live?.title).toBe("Chess with viewers!");
    expect(live?.viewerCount).toBe(5000);
    expect(live?.gameName).toBe("Chess");

    const offline = result.streams.find((s) => s.username === "hikaru");
    expect(offline?.isLive).toBe(false);
  });

  it("handles API errors gracefully", async () => {
    process.env.TWITCH_CLIENT_ID = "test_id";
    process.env.TWITCH_ACCESS_TOKEN = "test_token";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const result = await fetchTwitchStreams(["gothamchess"]);
    expect(result.error).toContain("Twitch API");
    expect(result.streams).toHaveLength(1);
    expect(result.streams[0].isLive).toBe(false);
  });
});

describe("fetchTikTokLinks", () => {
  it("generates correct TikTok deep links", () => {
    const result = fetchTikTokLinks(["charlidamelio", "khaby.lame"]);
    expect(result.links).toHaveLength(2);
    expect(result.links[0].url).toBe("https://www.tiktok.com/@charlidamelio");
    expect(result.links[0].displayName).toBe("@charlidamelio");
    expect(result.links[1].url).toBe("https://www.tiktok.com/@khaby.lame");
    expect(result.error).toBeNull();
    expect(() => TikTokResultSchema.parse(result)).not.toThrow();
  });

  it("limits to 5 usernames", () => {
    const usernames = Array.from({ length: 10 }, (_, i) => `user${i}`);
    const result = fetchTikTokLinks(usernames);
    expect(result.links).toHaveLength(5);
  });

  it("returns empty array for no usernames", () => {
    const result = fetchTikTokLinks([]);
    expect(result.links).toHaveLength(0);
    expect(result.error).toBeNull();
  });

  it("all links have platform tiktok", () => {
    const result = fetchTikTokLinks(["user1", "user2"]);
    for (const link of result.links) {
      expect(link.platform).toBe("tiktok");
    }
  });
});
