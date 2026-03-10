import type { Archetype } from "../mood";
import type { YouTubeResult } from "../tools/registry";
import type { ChessResult } from "../tools/registry";
import type { TwitchResult, TikTokResult } from "../tools/socialTools";

export interface RankedItem {
  platform: "youtube" | "twitch" | "tiktok" | "chess";
  title: string;
  url: string;
  score: number;
  isLive: boolean;
  metadata: Record<string, unknown>;
}

export interface RankingInput {
  youtube: YouTubeResult | null;
  chess: ChessResult | null;
  twitch: TwitchResult | null;
  tiktok: TikTokResult | null;
}

export function rankContent(
  tools: RankingInput,
  archetype: Archetype,
  recentPlatforms: string[],
  previousSuggestions: string[]
): RankedItem[] {
  const items: RankedItem[] = [];

  for (const video of tools.youtube?.videos ?? []) {
    items.push({
      platform: "youtube",
      title: video.title,
      url: video.url,
      score: 30,
      isLive: false,
      metadata: { channelTitle: video.channelTitle, thumbnail: video.thumbnail },
    });
  }

  for (const stream of tools.twitch?.streams ?? []) {
    items.push({
      platform: "twitch",
      title: stream.title,
      url: stream.url,
      score: stream.isLive ? 60 : 10,
      isLive: stream.isLive,
      metadata: {
        username: stream.username,
        viewerCount: stream.viewerCount,
        gameName: stream.gameName,
      },
    });
  }

  for (const link of tools.tiktok?.links ?? []) {
    items.push({
      platform: "tiktok",
      title: `Check out ${link.displayName} on TikTok`,
      url: link.url,
      score: 20,
      isLive: false,
      metadata: { username: link.username },
    });
  }

  if (tools.chess?.dailyPuzzleUrl) {
    items.push({
      platform: "chess",
      title: tools.chess.dailyPuzzleTitle ?? "Daily Chess Puzzle",
      url: tools.chess.dailyPuzzleUrl,
      score: 25,
      isLive: false,
      metadata: { currentElo: tools.chess.currentElo },
    });
  }

  for (const item of items) {
    if (item.isLive && (archetype === "The Chill" || archetype === "The Spark")) {
      item.score += 50;
    }

    if (archetype === "The Grind") {
      if (item.platform === "chess") item.score += 30;
      if (item.platform === "youtube") item.score += 15;
      if (item.platform === "twitch" && !item.isLive) item.score -= 10;
      if (item.platform === "tiktok") item.score -= 5;
    }

    if (archetype === "The Chill") {
      if (item.platform === "twitch") item.score += 20;
      if (item.platform === "tiktok") item.score += 15;
      if (item.platform === "youtube") item.score += 10;
      if (item.platform === "chess") item.score -= 15;
    }

    if (archetype === "The Spark") {
      const platformCounts = recentPlatforms.reduce(
        (acc, p) => ({ ...acc, [p]: (acc[p] || 0) + 1 }),
        {} as Record<string, number>
      );
      const leastUsed = Object.entries(platformCounts).sort(
        (a, b) => a[1] - b[1]
      )[0]?.[0];

      if (leastUsed && item.platform === leastUsed) {
        item.score += 25;
      }
      if (
        platformCounts[item.platform] &&
        platformCounts[item.platform] >= 2
      ) {
        item.score -= 20;
      }
    }

    const lastThree = recentPlatforms.slice(0, 3);
    if (lastThree.length === 3 && lastThree.every((p) => p === item.platform)) {
      item.score -= 40;
    }

    const isDuplicate = previousSuggestions.some(
      (prev) =>
        prev.toLowerCase().includes(item.title.toLowerCase().slice(0, 20))
    );
    if (isDuplicate) {
      item.score -= 100;
    }
  }

  return items.sort((a, b) => b.score - a.score);
}
