import type { Archetype } from "../mood";
import type { YouTubeResult } from "../tools/registry";
import type { ChessResult } from "../tools/registry";
import type { TwitchResult, TikTokResult } from "../tools/socialTools";
import type { SemanticMatch } from "../embeddings";

export interface RankedItem {
  platform: "youtube" | "twitch" | "tiktok" | "chess" | "semantic";
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

export interface HistoryEntry {
  suggestion: string;
  outcome: "accepted" | "rejected";
  source?: string | null;
}

export function rankContent(
  tools: RankingInput,
  archetype: Archetype,
  recentPlatforms: string[],
  previousSuggestions: string[],
  recentHistory: HistoryEntry[] = [],
  blacklistedPlatforms: string[] = [],
  blacklistedItems: string[] = [],
  categoryWeights: Record<string, number> = {},
  semanticMatches: SemanticMatch[] = []
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

  for (const match of semanticMatches) {
    const semanticScore = Math.round(35 * match.similarity);
    items.push({
      platform: "semantic",
      title: match.content_text,
      url: "",
      score: semanticScore,
      isLive: false,
      metadata: { category: match.category, similarity: match.similarity, poolId: match.id },
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

    const isDuplicateUrl = previousSuggestions.some(
      (prev) => item.url && prev.toLowerCase().includes(item.url.toLowerCase())
    );
    const isDuplicateTitle = previousSuggestions.some(
      (prev) =>
        item.title.length > 5 &&
        (prev.toLowerCase().includes(item.title.toLowerCase().slice(0, 20)) ||
         item.title.toLowerCase().includes(prev.toLowerCase().slice(0, 20)))
    );
    if (isDuplicateUrl || isDuplicateTitle) {
      console.log(`[BAF][Duplicate] "${item.title.slice(0, 30)}" matches previous suggestion — score ${item.score} → ${item.score - 100}`);
      item.score -= 100;
    }

    const last5Sources = recentHistory.slice(0, 5).map((h) => h.source ?? "");
    const categoryCount = last5Sources.filter((s) => s === item.platform).length;
    if (categoryCount >= 3) {
      const penalty = Math.round(item.score * 0.8);
      console.log(`[BAF][Cooldown] "${item.platform}" appeared ${categoryCount}/5 recent — score ${item.score} → ${item.score - penalty} (-80%)`);
      item.score -= penalty;
    }

    if (blacklistedPlatforms.includes(item.platform)) {
      console.log(`[BAF][Blacklist] platform "${item.platform}" is blacklisted — score ${item.score} → -999`);
      item.score = -999;
    }

    if (item.url && blacklistedItems.includes(item.url)) {
      console.log(`[BAF][ItemBlacklist] "${item.url}" is blacklisted — score ${item.score} → -999`);
      item.score = -999;
    }

    const weight = categoryWeights[item.platform] ?? 1.0;
    if (weight < 1.0) {
      const before = item.score;
      item.score = Math.round(item.score * weight);
      console.log(`[BAF][CircuitBreaker] "${item.platform}" weight=${Math.round(weight * 100)}% — score ${before} → ${item.score}`);
    }

    const rotationPenalties = [60, 30, 15];
    for (let ri = 0; ri < Math.min(recentPlatforms.length, rotationPenalties.length); ri++) {
      if (recentPlatforms[ri] === item.platform) {
        console.log(`[BAF][GraduatedRotation] "${item.platform}" was ${ri === 0 ? "last" : ri === 1 ? "2nd-last" : "3rd-last"} suggested — penalty -${rotationPenalties[ri]}`);
        item.score -= rotationPenalties[ri];
      }
    }
  }

  const sorted = items.sort((a, b) => b.score - a.score);
  console.log(`[BAF][Ranking] Final scores: ${sorted.map((i) => `${i.platform}:${i.score}`).join(", ")}`);
  return sorted;
}
