export type Archetype = "The Grind" | "The Chill" | "The Spark";

export interface MoodState {
  effectiveArchetype: Archetype;
  energyLevel: "high" | "low" | "mixed";
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
  recentRejectionStreak: number;
  isTired: boolean;
  moodOverride: boolean;
}

interface HistoryEntry {
  outcome: "accepted" | "rejected";
  reason: string | null;
  created_at: string;
}

export function getTimeOfDay(now: Date = new Date()): MoodState["timeOfDay"] {
  const hour = now.getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function getCurrentMood(
  baseArchetype: string,
  energyLevel: string,
  recentHistory: HistoryEntry[],
  now: Date = new Date()
): MoodState {
  const timeOfDay = getTimeOfDay(now);

  const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
  const recentRejects = recentHistory.filter(
    (h) =>
      h.outcome === "rejected" &&
      new Date(h.created_at) > lastHour
  );

  const recentRejectionStreak = countLeadingRejections(recentHistory);

  const isTired = recentRejects.some(
    (h) => h.reason?.toLowerCase().includes("tired")
  );

  const isNightLowEnergy = timeOfDay === "night" && energyLevel !== "high";

  let effectiveArchetype = mapToArchetype(baseArchetype);
  let moodOverride = false;

  if (isTired || isNightLowEnergy) {
    effectiveArchetype = "The Chill";
    moodOverride = true;
  }

  if (recentRejectionStreak >= 3) {
    effectiveArchetype = "The Spark";
    moodOverride = true;
  }

  return {
    effectiveArchetype,
    energyLevel: normalizeEnergy(energyLevel),
    timeOfDay,
    recentRejectionStreak,
    isTired,
    moodOverride,
  };
}

function countLeadingRejections(history: HistoryEntry[]): number {
  let count = 0;
  for (const h of history) {
    if (h.outcome === "rejected") {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function mapToArchetype(raw: string): Archetype {
  const lower = raw.toLowerCase();
  if (lower.includes("grind") || lower.includes("competitive") || lower.includes("learner")) {
    return "The Grind";
  }
  if (lower.includes("chill") || lower.includes("lurk") || lower.includes("passive") || lower.includes("consumer")) {
    return "The Chill";
  }
  if (lower.includes("spark") || lower.includes("explorer") || lower.includes("creator") || lower.includes("novel")) {
    return "The Spark";
  }
  return "The Spark";
}

function normalizeEnergy(raw: string): "high" | "low" | "mixed" {
  const lower = raw.toLowerCase();
  if (lower === "high") return "high";
  if (lower === "low") return "low";
  return "mixed";
}

export function getArchetypeStrategy(archetype: Archetype): string {
  switch (archetype) {
    case "The Grind":
      return "Prioritize high-effort/high-reward: puzzles, coding katas, how-to videos, rank updates. If user just lost/failed, suggest a tutorial instead of another challenge.";
    case "The Chill":
      return "Filter out stressful tasks. Suggest passive entertainment: long-form video essays, Twitch streams, fashion lookbooks, relaxing content. Keep it low-effort.";
    case "The Spark":
      return "Intentionally pick the LEAST frequently used tool/platform to provide novelty. Suggest something unexpected: random Wikipedia, new hobby, chaos mode.";
  }
}
