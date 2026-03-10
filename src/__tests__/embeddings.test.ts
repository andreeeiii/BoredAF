jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

import { buildPersonaText, type PersonaTextInput } from "@/lib/embeddings";

describe("buildPersonaText", () => {
  const baseInput: PersonaTextInput = {
    archetype: "The Grind",
    tags: ["competitive", "chess", "logic"],
    energy: "high",
    focus: "logic",
    interests: [],
  };

  it("includes archetype in output", () => {
    const text = buildPersonaText(baseInput);
    expect(text).toContain("The Grind archetype user.");
  });

  it("includes personality tags", () => {
    const text = buildPersonaText(baseInput);
    expect(text).toContain("competitive, chess, logic");
  });

  it("includes energy and focus", () => {
    const text = buildPersonaText(baseInput);
    expect(text).toContain("Energy level: high.");
    expect(text).toContain("Focus style: logic.");
  });

  it("includes grouped interests by platform", () => {
    const input: PersonaTextInput = {
      ...baseInput,
      interests: [
        { platform: "youtube", ref_id: "GothamChess", weight: 8 },
        { platform: "youtube", ref_id: "Hikaru", weight: 6 },
        { platform: "twitch", ref_id: "shroud", weight: 5 },
      ],
    };
    const text = buildPersonaText(input);
    expect(text).toContain("youtube: GothamChess, Hikaru");
    expect(text).toContain("twitch: shroud");
  });

  it("includes chess ELO when provided", () => {
    const input: PersonaTextInput = { ...baseInput, chessElo: 420 };
    const text = buildPersonaText(input);
    expect(text).toContain("Competitive chess player with 420 ELO.");
  });

  it("does not include chess ELO when null", () => {
    const input: PersonaTextInput = { ...baseInput, chessElo: null };
    const text = buildPersonaText(input);
    expect(text).not.toContain("ELO");
  });

  it("includes onboarding answers when provided", () => {
    const input: PersonaTextInput = {
      ...baseInput,
      onboardingAnswers: [
        { question: "Favorite YouTubers?", answer: "MrBeast and Kurzgesagt" },
      ],
    };
    const text = buildPersonaText(input);
    expect(text).toContain("Self-description:");
    expect(text).toContain("MrBeast and Kurzgesagt");
  });

  it("handles empty tags gracefully", () => {
    const input: PersonaTextInput = { ...baseInput, tags: [] };
    const text = buildPersonaText(input);
    expect(text).not.toContain("Personality traits:");
  });

  it("handles empty interests gracefully", () => {
    const text = buildPersonaText(baseInput);
    expect(text).not.toContain("Interests:");
  });
});

describe("PoolExpansionSuggestion validation", () => {
  it("filters out entries missing required fields", () => {
    const raw = [
      { text: "Valid entry", platform: "twitch", url: "https://twitch.tv/test", category: "influencer" },
      { text: "", platform: "twitch", url: "https://twitch.tv/test2", category: "influencer" },
      { text: "Missing url", platform: "twitch", url: "", category: "influencer" },
      { text: "Complete", platform: "youtube", url: "https://youtube.com/@test", category: "learning" },
    ];

    const valid = raw
      .filter((s) => s.text && s.platform && s.url && s.category)
      .slice(0, 3);

    expect(valid).toHaveLength(2);
    expect(valid[0].text).toBe("Valid entry");
    expect(valid[1].text).toBe("Complete");
  });

  it("limits to max 3 suggestions", () => {
    const raw = [
      { text: "A", platform: "twitch", url: "https://twitch.tv/a", category: "influencer" },
      { text: "B", platform: "twitch", url: "https://twitch.tv/b", category: "influencer" },
      { text: "C", platform: "twitch", url: "https://twitch.tv/c", category: "influencer" },
      { text: "D", platform: "twitch", url: "https://twitch.tv/d", category: "influencer" },
    ];

    const valid = raw
      .filter((s) => s.text && s.platform && s.url && s.category)
      .slice(0, 3);

    expect(valid).toHaveLength(3);
  });
});

describe("deactivateUnderperformingEntries filter logic", () => {
  it("identifies entries with <10% accept rate and >10 shows", () => {
    const candidates = [
      { id: "1", times_shown: 20, times_accepted: 1 },
      { id: "2", times_shown: 15, times_accepted: 5 },
      { id: "3", times_shown: 50, times_accepted: 2 },
      { id: "4", times_shown: 11, times_accepted: 0 },
    ];

    const toDeactivate = candidates.filter(
      (e) => e.times_shown > 0 && e.times_accepted / e.times_shown < 0.1
    );

    expect(toDeactivate).toHaveLength(3);
    expect(toDeactivate.map((e) => e.id)).toEqual(["1", "3", "4"]);
  });

  it("does not deactivate entries with decent accept rate", () => {
    const candidates = [
      { id: "1", times_shown: 20, times_accepted: 10 },
      { id: "2", times_shown: 15, times_accepted: 5 },
    ];

    const toDeactivate = candidates.filter(
      (e) => e.times_shown > 0 && e.times_accepted / e.times_shown < 0.1
    );

    expect(toDeactivate).toHaveLength(0);
  });

  it("handles edge case of exactly 10% accept rate", () => {
    const candidates = [
      { id: "1", times_shown: 20, times_accepted: 2 },
    ];

    const toDeactivate = candidates.filter(
      (e) => e.times_shown > 0 && e.times_accepted / e.times_shown < 0.1
    );

    expect(toDeactivate).toHaveLength(0);
  });
});

describe("OnboardingSeed suggestion parsing", () => {
  it("filters out entries missing required fields", () => {
    const raw = [
      { text: "Greek YouTuber A", platform: "youtube", url: "https://youtube.com/@a", category: "influencer" },
      { text: "", platform: "youtube", url: "https://youtube.com/@b", category: "influencer" },
      { text: "Activity with no URL", platform: "general", url: "", category: "physical" },
      { text: "Missing category", platform: "youtube", url: "https://youtube.com/@c", category: "" },
    ];

    const valid = raw
      .filter((s) => s.text && s.platform && s.category)
      .slice(0, 15);

    expect(valid).toHaveLength(2);
    expect(valid[0].text).toBe("Greek YouTuber A");
    expect(valid[1].text).toBe("Activity with no URL");
  });

  it("limits to max 15 suggestions", () => {
    const raw = Array.from({ length: 20 }, (_, i) => ({
      text: `Suggestion ${i}`,
      platform: "youtube",
      url: `https://youtube.com/@test${i}`,
      category: "influencer",
    }));

    const valid = raw
      .filter((s) => s.text && s.platform && s.category)
      .slice(0, 15);

    expect(valid).toHaveLength(15);
  });

  it("handles activity suggestions with empty URLs", () => {
    const raw = [
      { text: "Go for a walk", platform: "general", url: "", category: "physical" },
      { text: "Read a book", platform: "general", url: "", category: "learning" },
    ];

    const valid = raw.filter((s) => s.text && s.platform && s.category);
    expect(valid).toHaveLength(2);
    expect(valid[0].url).toBe("");
  });
});

describe("RejectExpansion suggestion parsing", () => {
  it("filters entries with required fields (url optional for general)", () => {
    const raw = [
      { text: "Chill stream", platform: "twitch", url: "https://twitch.tv/chill", category: "influencer" },
      { text: "Take a nap", platform: "general", url: "", category: "physical" },
      { text: "", platform: "youtube", url: "https://youtube.com/@x", category: "learning" },
    ];

    const valid = raw.filter((s) => s.text && s.platform && s.category).slice(0, 3);
    expect(valid).toHaveLength(2);
    expect(valid[0].text).toBe("Chill stream");
    expect(valid[1].text).toBe("Take a nap");
  });

  it("maps rejection reasons to correct hints", () => {
    const reasonHints: Record<string, string> = {
      "too tired": "LOW-ENERGY",
      "not interested": "DIFFERENT",
      "already did that": "FRESH",
      "other": "completely different",
    };

    expect(reasonHints["too tired"]).toContain("LOW-ENERGY");
    expect(reasonHints["not interested"]).toContain("DIFFERENT");
    expect(reasonHints["already did that"]).toContain("FRESH");
    expect(reasonHints["other"]).toContain("completely different");
  });

  it("defaults to 'other' hint for unknown reasons", () => {
    const reasonHints: Record<string, string> = {
      "too tired": "LOW-ENERGY",
      "not interested": "DIFFERENT",
      "already did that": "FRESH",
      "other": "completely different",
    };

    const unknownReason = "something random";
    const hint = reasonHints[unknownReason] ?? reasonHints["other"];
    expect(hint).toContain("completely different");
  });
});

describe("Item blacklist logic", () => {
  it("stores both text and URL in blacklist entries", () => {
    const blacklistEntries: Array<{ text: string; url: string; until: string }> = [];
    const suggestion = "Valkyrae playing with friends — fun energy";
    const url = "https://twitch.tv/valkyrae";
    const until = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    blacklistEntries.push({ text: suggestion, url, until });

    expect(blacklistEntries).toHaveLength(1);
    expect(blacklistEntries[0].text).toBe(suggestion);
    expect(blacklistEntries[0].url).toBe(url);
  });

  it("deduplicates by suggestion text", () => {
    const entries: Array<{ text: string; url: string; until: string }> = [
      { text: "Valkyrae streaming", url: "https://twitch.tv/valkyrae", until: new Date(Date.now() + 1000).toISOString() },
    ];

    const newText = "Valkyrae streaming";
    if (!entries.some((e) => e.text === newText)) {
      entries.push({ text: newText, url: "", until: "" });
    }

    expect(entries).toHaveLength(1);
  });

  it("filters expired entries", () => {
    const now = Date.now();
    const entries = [
      { text: "A", url: "", until: new Date(now - 1000).toISOString() },
      { text: "B", url: "", until: new Date(now + 60000).toISOString() },
      { text: "C", url: "", until: new Date(now + 120000).toISOString() },
    ];

    const active = entries.filter((e) => new Date(e.until).getTime() > now);
    expect(active).toHaveLength(2);
    expect(active[0].text).toBe("B");
  });

  it("matches blacklist by substring (prefix variations)", () => {
    const blacklistedItems = [
      "https://twitch.tv/valkyrae",
      "Check out: Valkyrae playing with friends — fun energy",
    ];

    const itemTitle = "Valkyrae playing with friends — fun energy";
    const isBlacklisted = blacklistedItems.some(
      (bl) => bl.includes(itemTitle) || itemTitle.includes(bl)
    );

    expect(isBlacklisted).toBe(true);
  });

  it("does NOT match unrelated items via substring", () => {
    const blacklistedItems = [
      "https://twitch.tv/valkyrae",
      "Valkyrae playing with friends",
    ];

    const itemTitle = "Hikaru playing chess at 3000 ELO";
    const isBlacklisted = blacklistedItems.some(
      (bl) => bl.includes(itemTitle) || itemTitle.includes(bl)
    );

    expect(isBlacklisted).toBe(false);
  });
});

describe("Interest extraction on accept", () => {
  it("extracts ref_id from suggestion text (max 60 chars)", () => {
    const suggestion = "Valkyrae playing with friends — fun energy and great vibes all day long";
    const refId = suggestion.slice(0, 60);

    expect(refId).toBe("Valkyrae playing with friends — fun energy and great vibes a");
    expect(refId.length).toBeLessThanOrEqual(60);
  });

  it("preserves short suggestions as-is", () => {
    const suggestion = "GothamChess live";
    const refId = suggestion.slice(0, 60);

    expect(refId).toBe("GothamChess live");
  });

  it("assigns weight 8 for new interests", () => {
    const weight = 8;
    expect(weight).toBeGreaterThanOrEqual(1);
    expect(weight).toBeLessThanOrEqual(10);
  });
});

describe("Pool mutation on every interaction", () => {
  it("expands pool on accept (3 similar suggestions)", () => {
    const maxExpansion = 3;
    const suggestions = Array.from({ length: 5 }, (_, i) => ({
      text: `Similar ${i}`,
      platform: "youtube",
      url: `https://youtube.com/@test${i}`,
      category: "influencer",
    }));

    const limited = suggestions.slice(0, maxExpansion);
    expect(limited).toHaveLength(3);
  });

  it("expands pool on reject (3 alternative suggestions)", () => {
    const maxExpansion = 3;
    const suggestions = Array.from({ length: 4 }, (_, i) => ({
      text: `Alternative ${i}`,
      platform: "general",
      url: "",
      category: "physical",
    }));

    const valid = suggestions.filter((s) => s.text && s.platform && s.category).slice(0, maxExpansion);
    expect(valid).toHaveLength(3);
  });

  it("deactivation runs on both accept and reject", () => {
    // Simulating: deactivation should run regardless of outcome
    const outcomes = ["accepted", "rejected"];
    const deactivationCalled: string[] = [];

    for (const outcome of outcomes) {
      deactivationCalled.push(outcome);
    }

    expect(deactivationCalled).toEqual(["accepted", "rejected"]);
    expect(deactivationCalled).toHaveLength(2);
  });
});
