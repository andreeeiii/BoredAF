import { supabase } from "./supabase";

export interface Persona {
  profile: {
    id: string;
    username: string;
    bio: string | null;
    archetype: string;
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
    created_at: string;
  }>;
}

export interface Feedback {
  suggestion: string;
  outcome: "accepted" | "rejected";
  reason?: string;
}

export async function getPersona(userId: string): Promise<Persona> {
  const [profileRes, statsRes, interestsRes, historyRes] = await Promise.all([
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
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);

  const stats: Record<string, Record<string, unknown>> = {};
  for (const row of statsRes.data ?? []) {
    stats[row.category] = row.value as Record<string, unknown>;
  }

  return {
    profile: profileRes.data,
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
      created_at: h.created_at,
    })),
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
  });

  if (historyError) throw new Error(historyError.message);

  if (feedback.outcome === "rejected" && feedback.reason) {
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
