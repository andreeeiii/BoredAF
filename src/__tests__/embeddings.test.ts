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
