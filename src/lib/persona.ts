import { supabase } from "./supabase";
import { nudgePersonaVector, updatePoolEngagement, expandPoolFromAccept, deactivateUnderperformingEntries } from "./embeddings";

export interface Persona {
  profile: {
    id: string;
    username: string;
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

  const rawItemBlacklist = (itemBlacklistRes.data?.value as { entries?: Array<{ url: string; until: string }> })?.entries ?? [];
  const blacklistedItems = rawItemBlacklist
    .filter((e) => new Date(e.until).getTime() > now)
    .map((e) => e.url);

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
    // NOTE: No platform-level blacklist — rejecting a single item should NOT block
    // the entire platform. The vector nudge (persona shifts away from rejected content)
    // and item-level blacklist handle deprioritization naturally.

    const rejectedUrl = feedback.link ?? null;
    if (rejectedUrl) {
      const ITEM_BLACKLIST_DURATION_MS = 60 * 60 * 1000;
      const itemUntil = new Date(Date.now() + ITEM_BLACKLIST_DURATION_MS).toISOString();

      const { data: existingItems } = await supabase
        .from("persona_stats")
        .select("value")
        .eq("user_id", userId)
        .eq("category", "item_blacklist")
        .single();

      const currentItemEntries = (existingItems?.value as { entries?: Array<{ url: string; until: string }> })?.entries ?? [];
      const filteredItems = currentItemEntries.filter((e) => new Date(e.until).getTime() > Date.now());
      if (!filteredItems.some((e) => e.url === rejectedUrl)) {
        filteredItems.push({ url: rejectedUrl, until: itemUntil });
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

      console.log(`[BAF] Blacklisted item "${rejectedUrl}" for 60 minutes (until ${itemUntil})`);
    }

    if (feedback.reason) {
      const { data: interests } = await supabase
        .from("interests")
        .select("*")
        .eq("user_id", userId);

      for (const interest of interests ?? []) {
        if (
          feedback.suggestion
            .toLowerCase()
            .includes(interest.platform.toLowerCase())
        ) {
          const newWeight = Math.max(1, interest.weight - 1);
          await supabase
            .from("interests")
            .update({ weight: newWeight })
            .eq("user_id", userId)
            .eq("platform", interest.platform)
            .eq("ref_id", interest.ref_id);
        }
      }

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
  }

  if (feedback.outcome === "accepted") {
    const { data: interests } = await supabase
      .from("interests")
      .select("*")
      .eq("user_id", userId);

    for (const interest of interests ?? []) {
      if (
        feedback.suggestion
          .toLowerCase()
          .includes(interest.platform.toLowerCase())
      ) {
        const newWeight = Math.min(20, interest.weight + 1);
        await supabase
          .from("interests")
          .update({ weight: newWeight })
          .eq("user_id", userId)
          .eq("platform", interest.platform)
          .eq("ref_id", interest.ref_id);
      }
    }

    if (feedback.source && feedback.source !== "fallback" && feedback.source !== "custom") {
      expandPoolFromAccept(
        feedback.suggestion,
        feedback.source,
        feedback.category ?? "general"
      ).catch((err) =>
        console.error("[BAF][PoolExpansion] Non-blocking error:", err)
      );
    }

    deactivateUnderperformingEntries().catch((err) =>
      console.error("[BAF][PoolCleanup] Non-blocking error:", err)
    );
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
