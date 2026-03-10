import type { Archetype } from "../mood";
import type { SemanticMatch } from "../embeddings";
import type { TwitchStream } from "../tools/socialTools";

export interface RankedItem {
  platform: string;
  title: string;
  url: string;
  score: number;
  isLive: boolean;
  metadata: Record<string, unknown>;
}

export interface HistoryEntry {
  suggestion: string;
  outcome: "accepted" | "rejected";
  source?: string | null;
}

export function rankContent(
  poolSuggestions: SemanticMatch[],
  liveStreams: TwitchStream[],
  archetype: Archetype,
  recentPlatforms: string[],
  previousSuggestions: string[],
  recentHistory: HistoryEntry[] = [],
  blacklistedPlatforms: string[] = [],
  blacklistedItems: string[] = [],
  categoryWeights: Record<string, number> = {}
): RankedItem[] {
  const items: RankedItem[] = [];

  const liveByUsername = new Map<string, TwitchStream>();
  for (const stream of liveStreams) {
    if (stream.isLive) {
      liveByUsername.set(stream.username.toLowerCase(), stream);
    }
  }

  for (const entry of poolSuggestions) {
    const baseScore = Math.round(35 * entry.similarity);

    const engagementBonus = entry.times_shown > 0
      ? Math.round(10 * (entry.times_accepted / Math.max(entry.times_shown, 1)))
      : 0;

    let isLive = false;
    const twitchMatch = entry.platform === "twitch" && entry.url
      ? entry.url.match(/twitch\.tv\/([^/?]+)/)
      : null;
    const twitchUsername = twitchMatch ? twitchMatch[1].toLowerCase() : null;
    const liveData = twitchUsername ? liveByUsername.get(twitchUsername) : null;

    if (liveData) {
      isLive = true;
    }

    items.push({
      platform: entry.platform || "general",
      title: entry.content_text,
      url: entry.url || "",
      score: baseScore + engagementBonus + (isLive ? 50 : 0),
      isLive,
      metadata: {
        category: entry.category,
        similarity: entry.similarity,
        poolId: entry.id,
        ...(liveData ? {
          username: liveData.username,
          viewerCount: liveData.viewerCount,
          gameName: liveData.gameName,
          streamTitle: liveData.title,
        } : {}),
      },
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

    const isItemBlacklisted =
      (item.url && blacklistedItems.includes(item.url)) ||
      blacklistedItems.some((bl) =>
        bl.includes(item.title) || item.title.includes(bl)
      );
    if (isItemBlacklisted) {
      console.log(`[BAF][ItemBlacklist] "${item.title.slice(0, 40)}" is blacklisted — score ${item.score} → -999`);
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
