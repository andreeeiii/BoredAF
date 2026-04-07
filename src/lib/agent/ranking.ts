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

    const entryAny = entry as unknown as Record<string, unknown>;
    const isSponsored = !!entryAny.is_sponsored;
    const sponsorBonus = isSponsored ? 30 : 0;

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
      score: baseScore + engagementBonus + sponsorBonus + (isLive ? 50 : 0),
      isLive,
      metadata: {
        category: entry.category,
        similarity: entry.similarity,
        poolId: entry.id,
        isSponsored,
        ...(isSponsored ? { sponsorId: entryAny.sponsor_id } : {}),
        ...(liveData ? {
          username: liveData.username,
          viewerCount: liveData.viewerCount,
          gameName: liveData.gameName,
          streamTitle: liveData.title,
        } : {}),
      },
    });
  }

  // Cap sponsored entries: max 1 sponsored in top 5
  const sponsoredInTop5 = items.slice(0, 5).filter((i) => i.metadata.isSponsored);
  if (sponsoredInTop5.length > 1) {
    let skipped = 0;
    for (const item of items) {
      if (item.metadata.isSponsored && skipped > 0) {
        item.score -= 200;
      }
      if (item.metadata.isSponsored) skipped++;
    }
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
      console.log(`[BAF][Duplicate] "${item.title.slice(0, 30)}" matches previous suggestion — score ${item.score} → -999`);
      item.score = -999;
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

  // Diversity quota: ensure top-8 has at least 3 different platforms (when available)
  return enforceDiversityQuota(sorted);
}

/**
 * Enforce platform diversity in the top-8 items passed to the LLM.
 * If the top-8 has fewer than 3 platforms, promote items from underrepresented
 * platforms into the top-8 by swapping with over-represented ones.
 */
export function enforceDiversityQuota(sorted: RankedItem[], topN: number = 8, minPlatforms: number = 3): RankedItem[] {
  if (sorted.length <= topN) return sorted;

  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);

  const platformsInTop = new Set(top.filter((i) => i.score > -900).map((i) => i.platform));
  if (platformsInTop.size >= minPlatforms) return sorted;

  // Find platforms NOT in top that exist in rest with positive scores
  const missingPlatforms = new Set<string>();
  for (const item of rest) {
    if (item.score > -900 && !platformsInTop.has(item.platform)) {
      missingPlatforms.add(item.platform);
    }
  }

  if (missingPlatforms.size === 0) return sorted;

  // For each missing platform, promote the best item from rest into top
  const result = [...sorted];
  for (const platform of Array.from(missingPlatforms)) {
    if (platformsInTop.size >= minPlatforms) break;

    const promoteIdx = result.findIndex(
      (item, idx) => idx >= topN && item.platform === platform && item.score > -900
    );
    if (promoteIdx === -1) continue;

    // Find the last over-represented item in top to demote
    const platformCounts: Record<string, number> = {};
    for (let i = 0; i < topN && i < result.length; i++) {
      const p = result[i].platform;
      platformCounts[p] = (platformCounts[p] ?? 0) + 1;
    }
    const overRepPlatform = Object.entries(platformCounts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    if (!overRepPlatform) break;

    // Find last occurrence of over-represented platform in top
    let demoteIdx = -1;
    for (let i = topN - 1; i >= 0; i--) {
      if (result[i].platform === overRepPlatform) {
        demoteIdx = i;
        break;
      }
    }

    if (demoteIdx === -1) break;

    // Swap
    const promoted = result[promoteIdx];
    const demoted = result[demoteIdx];
    result[demoteIdx] = promoted;
    result[promoteIdx] = demoted;
    platformsInTop.add(platform);
    console.log(`[BAF][Diversity] Promoted "${promoted.platform}" (score ${promoted.score}) into top-${topN}, demoted "${demoted.platform}" (score ${demoted.score})`);
  }

  return result;
}
