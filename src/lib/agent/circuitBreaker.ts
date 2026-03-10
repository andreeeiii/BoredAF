export type CategoryWeights = Record<string, number>;

export function computeCategoryWeights(
  recentHistory: Array<{ outcome: string; source?: string | null; created_at: string }>
): CategoryWeights {
  const weights: CategoryWeights = {
    youtube: 1.0,
    twitch: 1.0,
    tiktok: 1.0,
    chess: 1.0,
    custom: 1.0,
  };

  const recent = recentHistory.slice(0, 10);

  const rejectionCounts: Record<string, number> = {};
  const consecutiveRejects: Record<string, number> = {};

  for (const entry of recent) {
    const src = entry.source ?? "custom";
    if (entry.outcome === "rejected") {
      rejectionCounts[src] = (rejectionCounts[src] ?? 0) + 1;
    }
  }

  for (const entry of recent) {
    const src = entry.source ?? "custom";
    if (entry.outcome === "rejected") {
      consecutiveRejects[src] = (consecutiveRejects[src] ?? 0) + 1;
    } else {
      break;
    }
  }

  for (const [platform, count] of Object.entries(rejectionCounts)) {
    if (consecutiveRejects[platform] && consecutiveRejects[platform] >= 2) {
      weights[platform] = 0;
      console.log(`[BAF][CircuitBreaker] "${platform}" LOCKED (2+ consecutive rejections) — weight: 0%`);
    } else if (count >= 1) {
      weights[platform] = Math.max(0, 1.0 - count * 0.7);
      console.log(`[BAF][CircuitBreaker] "${platform}" penalized (${count} rejections) — weight: ${Math.round(weights[platform] * 100)}%`);
    }
  }

  return weights;
}
