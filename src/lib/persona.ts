import { supabase } from "./supabase";
import { nudgePersonaVector, updatePoolEngagement, expandPoolFromAccept, deactivateUnderperformingEntries } from "./embeddings";

export interface Persona {
  profile: {
    id: string;
    username: string | null;
    bio: string | null;
    archetype: string;
    persona_embedding: number[] | null;
  };
  stats: Record<string, Record<string, unknown>>;
  interests: Array<{
    platform: string;
    ref_id: string;
    weight: number;
  }>;
  recentHistory: Array<{
    suggestion: string;
    outcome: "accepted" | "rejected";
    reason: string | null;
    source?: string | null;
    created_at: string;
  }>;
  blacklistedPlatforms: string[];
  blacklistedItems: string[];
}

export interface Feedback {
  suggestion: string;
  outcome: "accepted" | "rejected";
  reason?: string;
  archetype?: string;
  source?: string;
  link?: string | null;
  poolId?: string | null;
  category?: string | null;
}

export async function getPersona(userId: string): Promise<Persona> {
  const [profileRes, statsRes, interestsRes, historyRes, blacklistRes, itemBlacklistRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("persona_stats").select("*").eq("user_id", userId),
    supabase
      .from("interests")
      .select("*")
      .eq("user_id", userId)
      .order("weight", { ascending: false }),
    supabase
      .from("baf_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("persona_stats")
      .select("value")
      .eq("user_id", userId)
      .eq("category", "platform_blacklist")
      .single(),
    supabase
      .from("persona_stats")
      .select("value")
      .eq("user_id", userId)
      .eq("category", "item_blacklist")
      .single(),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);

  const stats: Record<string, Record<string, unknown>> = {};
  for (const row of statsRes.data ?? []) {
    stats[row.category] = row.value as Record<string, unknown>;
  }

  const now = Date.now();

  // No platform-level blacklist — rejecting one item should NOT block the entire platform.
  // The vector nudge + item blacklist + circuit breaker handle deprioritization naturally.
  const blacklistedPlatforms: string[] = [];

  const rawItemBlacklist = (itemBlacklistRes.data?.value as { entries?: Array<{ text?: string; url: string; until: string }> })?.entries ?? [];
  const activeItemBlacklist = rawItemBlacklist.filter((e) => new Date(e.until).getTime() > now);
  const blacklistedItems = [
    ...activeItemBlacklist.map((e) => e.url).filter(Boolean),
    ...activeItemBlacklist.map((e) => e.text).filter((t): t is string => !!t),
  ];

  if (blacklistedItems.length > 0) {
    console.log(`[BAF] Active item blacklist (${blacklistedItems.length} items): [${blacklistedItems.slice(0, 3).join(", ")}${blacklistedItems.length > 3 ? "..." : ""}]`);
  }

  const rawEmbedding = profileRes.data.persona_embedding as string | null;
  const personaEmbedding = rawEmbedding ? parseEmbeddingString(rawEmbedding) : null;

  return {
    profile: {
      ...profileRes.data,
      persona_embedding: personaEmbedding,
    },
    stats,
    interests: (interestsRes.data ?? []).map((i) => ({
      platform: i.platform,
      ref_id: i.ref_id,
      weight: i.weight,
    })),
    recentHistory: (historyRes.data ?? []).map((h) => ({
      suggestion: h.suggestion,
      outcome: h.outcome as "accepted" | "rejected",
      reason: h.reason,
      source: h.source ?? null,
      created_at: h.created_at,
    })),
    blacklistedPlatforms,
    blacklistedItems,
  };
}

export async function updatePersona(
  userId: string,
  feedback: Feedback
): Promise<void> {
  const { error: historyError } = await supabase.from("baf_history").insert({
    user_id: userId,
    suggestion: feedback.suggestion,
    outcome: feedback.outcome,
    reason: feedback.reason ?? null,
    archetype: feedback.archetype ?? null,
    source: feedback.source ?? null,
  });

  if (historyError) throw new Error(historyError.message);

  nudgePersonaVector(
    userId,
    feedback.suggestion,
    feedback.outcome === "accepted" ? "toward" : "away"
  ).catch((err) =>
    console.error("[BAF][VectorFeedback] Non-blocking error:", err)
  );

  if (feedback.poolId) {
    updatePoolEngagement(
      feedback.poolId,
      feedback.outcome === "accepted" ? "accepted" : "rejected"
    ).catch((err) =>
      console.error("[BAF][PoolEngagement] Non-blocking error:", err)
    );
  }

  if (feedback.outcome === "rejected") {
    // Blacklist by BOTH suggestion text and URL — prevents exact re-suggestion for 30 min
    const ITEM_BLACKLIST_DURATION_MS = 30 * 60 * 1000;
    const itemUntil = new Date(Date.now() + ITEM_BLACKLIST_DURATION_MS).toISOString();

    const { data: existingItems } = await supabase
      .from("persona_stats")
      .select("value")
      .eq("user_id", userId)
      .eq("category", "item_blacklist")
      .single();

    const currentItemEntries = (existingItems?.value as { entries?: Array<{ text: string; url: string; until: string }> })?.entries ?? [];
    const filteredItems = currentItemEntries.filter((e) => new Date(e.until).getTime() > Date.now());

    const rejectedUrl = feedback.link ?? "";
    const rejectedText = feedback.suggestion;
    if (!filteredItems.some((e) => e.text === rejectedText)) {
      filteredItems.push({ text: rejectedText, url: rejectedUrl, until: itemUntil });
    }

    await supabase.from("persona_stats").upsert(
      {
        user_id: userId,
        category: "item_blacklist",
        value: { entries: filteredItems },
        last_updated: new Date().toISOString(),
      },
      { onConflict: "user_id,category" }
    );

    console.log(`[BAF] Blacklisted "${rejectedText.slice(0, 40)}..." for 30 minutes`);

    // Reject-expansion removed: vector nudge + circuit breaker handle personalization.
    // Pool expansion only happens on accept (rate-limited) to cut costs ~61%.

    if (feedback.reason === "too tired") {
      await supabase
        .from("persona_stats")
        .upsert(
          {
            user_id: userId,
            category: "energy_level",
            value: { current: "low" },
            last_updated: new Date().toISOString(),
          },
          { onConflict: "user_id,category" }
        );
    }
  }

  // Run pool cleanup on every interaction (accept or reject)
  deactivateUnderperformingEntries().catch((err) =>
    console.error("[BAF][PoolCleanup] Non-blocking error:", err)
  );

  if (feedback.outcome === "accepted") {
    // Dynamically add accepted content's platform+category as interest
    if (feedback.source && feedback.source !== "fallback" && feedback.source !== "custom") {
      const refId = feedback.suggestion.slice(0, 60);
      await supabase.from("interests").upsert(
        {
          user_id: userId,
          platform: feedback.source,
          ref_id: refId,
          weight: 8,
        },
        { onConflict: "user_id,platform,ref_id" }
      );
      console.log(`[BAF][InterestUpdate] Added interest: ${feedback.source}/${refId.slice(0, 30)}...`);

      expandPoolFromAccept(
        feedback.suggestion,
        feedback.source,
        feedback.category ?? "general"
      ).catch((err) =>
        console.error("[BAF][PoolExpansion] Non-blocking error:", err)
      );
    }
  }
}

function parseEmbeddingString(raw: string): number[] | null {
  try {
    if (typeof raw === "string" && raw.startsWith("[")) {
      return JSON.parse(raw) as number[];
    }
    return null;
  } catch {
    return null;
  }
}

export async function logNegativeSignal(
  userId: string,
  category: string,
  reason: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("persona_stats")
    .select("value")
    .eq("user_id", userId)
    .eq("category", category)
    .single();

  const currentValue = (existing?.value as Record<string, unknown>) ?? {};
  const signals = (currentValue.negative_signals as string[]) ?? [];
  signals.push(`${reason}|${new Date().toISOString()}`);
  const recentSignals = signals.slice(-10);

  await supabase.from("persona_stats").upsert(
    {
      user_id: userId,
      category,
      value: { ...currentValue, negative_signals: recentSignals },
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,category" }
  );
}
