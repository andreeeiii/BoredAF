jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
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
