import {
  getCurrentMood,
  getTimeOfDay,
  mapToArchetype,
  getArchetypeStrategy,
} from "@/lib/mood";

describe("getTimeOfDay", () => {
  it("returns morning for 6-11am", () => {
    expect(getTimeOfDay(new Date("2025-01-01T08:00:00"))).toBe("morning");
    expect(getTimeOfDay(new Date("2025-01-01T06:00:00"))).toBe("morning");
    expect(getTimeOfDay(new Date("2025-01-01T11:59:00"))).toBe("morning");
  });

  it("returns afternoon for 12-4pm", () => {
    expect(getTimeOfDay(new Date("2025-01-01T12:00:00"))).toBe("afternoon");
    expect(getTimeOfDay(new Date("2025-01-01T16:59:00"))).toBe("afternoon");
  });

  it("returns evening for 5-9pm", () => {
    expect(getTimeOfDay(new Date("2025-01-01T17:00:00"))).toBe("evening");
    expect(getTimeOfDay(new Date("2025-01-01T21:59:00"))).toBe("evening");
  });

  it("returns night for 10pm-5am", () => {
    expect(getTimeOfDay(new Date("2025-01-01T22:00:00"))).toBe("night");
    expect(getTimeOfDay(new Date("2025-01-01T03:00:00"))).toBe("night");
    expect(getTimeOfDay(new Date("2025-01-01T05:59:00"))).toBe("night");
  });
});

describe("mapToArchetype", () => {
  it("maps grind-related terms", () => {
    expect(mapToArchetype("The Grinder")).toBe("The Grind");
    expect(mapToArchetype("Competitive Learner")).toBe("The Grind");
    expect(mapToArchetype("The Grind")).toBe("The Grind");
  });

  it("maps chill-related terms", () => {
    expect(mapToArchetype("The Lurker")).toBe("The Chill");
    expect(mapToArchetype("Passive Consumer")).toBe("The Chill");
    expect(mapToArchetype("The Chill")).toBe("The Chill");
  });

  it("maps spark-related terms", () => {
    expect(mapToArchetype("The Explorer")).toBe("The Spark");
    expect(mapToArchetype("The Creator")).toBe("The Spark");
    expect(mapToArchetype("The Spark")).toBe("The Spark");
    expect(mapToArchetype("Novelty Seeker")).toBe("The Spark");
  });

  it("defaults to The Spark for unknown archetypes", () => {
    expect(mapToArchetype("something random")).toBe("The Spark");
    expect(mapToArchetype("")).toBe("The Spark");
  });
});

describe("getArchetypeStrategy", () => {
  it("returns strategy for The Grind", () => {
    const strategy = getArchetypeStrategy("The Grind");
    expect(strategy).toContain("high-effort");
    expect(strategy).toContain("tutorial");
  });

  it("returns strategy for The Chill", () => {
    const strategy = getArchetypeStrategy("The Chill");
    expect(strategy).toContain("passive");
    expect(strategy).toContain("low-effort");
  });

  it("returns strategy for The Spark", () => {
    const strategy = getArchetypeStrategy("The Spark");
    expect(strategy).toContain("novelty");
    expect(strategy).toContain("LEAST");
  });
});

describe("getCurrentMood", () => {
  const now = new Date("2025-01-01T14:00:00");

  it("returns base archetype when no overrides", () => {
    const mood = getCurrentMood("The Grind", "high", [], now);
    expect(mood.effectiveArchetype).toBe("The Grind");
    expect(mood.moodOverride).toBe(false);
    expect(mood.timeOfDay).toBe("afternoon");
    expect(mood.energyLevel).toBe("high");
  });

  it("switches to The Chill when tired rejection in last hour", () => {
    const recentHistory = [
      {
        outcome: "rejected" as const,
        reason: "too tired",
        created_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      },
    ];
    const mood = getCurrentMood("The Grind", "high", recentHistory, now);
    expect(mood.effectiveArchetype).toBe("The Chill");
    expect(mood.isTired).toBe(true);
    expect(mood.moodOverride).toBe(true);
  });

  it("does NOT switch for tired rejection older than 1 hour", () => {
    const recentHistory = [
      {
        outcome: "rejected" as const,
        reason: "too tired",
        created_at: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
      },
    ];
    const mood = getCurrentMood("The Grind", "high", recentHistory, now);
    expect(mood.effectiveArchetype).toBe("The Grind");
    expect(mood.isTired).toBe(false);
  });

  it("switches to The Chill at night with low energy", () => {
    const nightTime = new Date("2025-01-01T23:00:00");
    const mood = getCurrentMood("The Grind", "low", [], nightTime);
    expect(mood.effectiveArchetype).toBe("The Chill");
    expect(mood.moodOverride).toBe(true);
    expect(mood.timeOfDay).toBe("night");
  });

  it("stays Grind at night with high energy", () => {
    const nightTime = new Date("2025-01-01T23:00:00");
    const mood = getCurrentMood("The Grind", "high", [], nightTime);
    expect(mood.effectiveArchetype).toBe("The Grind");
    expect(mood.moodOverride).toBe(false);
  });

  it("switches to The Spark after 3+ consecutive rejections", () => {
    const now2 = new Date("2025-01-01T14:00:00");
    const recentHistory = [
      { outcome: "rejected" as const, reason: "not interested", created_at: new Date(now2.getTime() - 5 * 60 * 1000).toISOString() },
      { outcome: "rejected" as const, reason: "boring", created_at: new Date(now2.getTime() - 10 * 60 * 1000).toISOString() },
      { outcome: "rejected" as const, reason: "nah", created_at: new Date(now2.getTime() - 15 * 60 * 1000).toISOString() },
    ];
    const mood = getCurrentMood("The Chill", "mixed", recentHistory, now2);
    expect(mood.effectiveArchetype).toBe("The Spark");
    expect(mood.recentRejectionStreak).toBe(3);
    expect(mood.moodOverride).toBe(true);
  });

  it("counts rejection streak correctly (breaks on accept)", () => {
    const recentHistory = [
      { outcome: "rejected" as const, reason: "meh", created_at: new Date(now.getTime() - 5 * 60 * 1000).toISOString() },
      { outcome: "accepted" as const, reason: null, created_at: new Date(now.getTime() - 10 * 60 * 1000).toISOString() },
      { outcome: "rejected" as const, reason: "nah", created_at: new Date(now.getTime() - 15 * 60 * 1000).toISOString() },
    ];
    const mood = getCurrentMood("The Grind", "high", recentHistory, now);
    expect(mood.recentRejectionStreak).toBe(1);
    expect(mood.moodOverride).toBe(false);
  });

  it("normalizes energy levels", () => {
    expect(getCurrentMood("The Spark", "high", [], now).energyLevel).toBe("high");
    expect(getCurrentMood("The Spark", "low", [], now).energyLevel).toBe("low");
    expect(getCurrentMood("The Spark", "mixed", [], now).energyLevel).toBe("mixed");
    expect(getCurrentMood("The Spark", "unknown", [], now).energyLevel).toBe("mixed");
  });
});
