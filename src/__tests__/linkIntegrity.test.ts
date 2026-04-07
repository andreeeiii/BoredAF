import {
  validateLinkTextConsistency,
  extractSubjectName,
} from "@/lib/agent/linkIntegrity";

describe("extractSubjectName", () => {
  it("extracts name before ' — ' separator", () => {
    expect(extractSubjectName("MrBeast — insane production value")).toBe("MrBeast");
  });

  it("extracts name before ' — ' with multi-word creator", () => {
    expect(extractSubjectName("GothamChess live — learn chess while being entertained")).toBe("GothamChess live");
  });

  it("extracts name before ' - ' (alt dash) separator", () => {
    expect(extractSubjectName("Kurzgesagt - explains the universe")).toBe("Kurzgesagt");
  });

  it("falls back to first 3 words when no separator", () => {
    expect(extractSubjectName("Watch shroud streaming FPS")).toBe("Watch shroud streaming");
  });

  it("handles short single-word text", () => {
    expect(extractSubjectName("Chess")).toBe("Chess");
  });

  it("handles empty string", () => {
    expect(extractSubjectName("")).toBe("");
  });

  it("handles text with only separator at start", () => {
    // " — description" starts with the separator — should return empty
    expect(extractSubjectName(" — description")).toBe("");
  });

  it("handles text with very short prefix before separator", () => {
    expect(extractSubjectName("A — description")).toBe("A");
  });

  it("prefers ' — ' over ' - ' when both exist", () => {
    expect(extractSubjectName("Creator A — does stuff - extra")).toBe("Creator A");
  });

  it("extracts activity-style entries (no creator name)", () => {
    expect(extractSubjectName("Do a 5-minute plank challenge and time yourself")).toBe("Do a 5-minute");
  });

  it("extracts from pool entry with Twitch username", () => {
    expect(extractSubjectName("Pokimane is live — chill vibes and chat energy")).toBe("Pokimane is live");
  });
});

describe("validateLinkTextConsistency", () => {
  it("returns true when LLM suggestion mentions the creator from pool text", () => {
    expect(
      validateLinkTextConsistency(
        "MrBeast just dropped an insane new challenge!",
        "MrBeast — insane production value"
      )
    ).toBe(true);
  });

  it("returns true for case-insensitive match", () => {
    expect(
      validateLinkTextConsistency(
        "gothamchess is streaming right now!",
        "GothamChess live — learn chess while being entertained"
      )
    ).toBe(true);
  });

  it("returns false when LLM writes about a different creator", () => {
    expect(
      validateLinkTextConsistency(
        "The Fat Jewish has the funniest content!",
        "iJustine — tech reviews and unboxings"
      )
    ).toBe(false);
  });

  it("returns false when LLM writes about completely unrelated topic", () => {
    expect(
      validateLinkTextConsistency(
        "Check out this amazing chess puzzle today",
        "Khaby Lame — life hacks without saying a word"
      )
    ).toBe(false);
  });

  it("returns true for activity-style entries where first words match", () => {
    expect(
      validateLinkTextConsistency(
        "Do a 5-minute plank and feel the burn!",
        "Do a 5-minute plank challenge and time yourself"
      )
    ).toBe(true);
  });

  it("returns false for empty LLM suggestion", () => {
    expect(
      validateLinkTextConsistency("", "MrBeast — challenges")
    ).toBe(false);
  });

  it("returns false for empty pool content text", () => {
    expect(
      validateLinkTextConsistency("Watch MrBeast!", "")
    ).toBe(false);
  });

  it("returns true when subject name is very short (< 2 chars) — too ambiguous to check", () => {
    expect(
      validateLinkTextConsistency("Something random", "A")
    ).toBe(true);
  });

  it("handles pool text with ' - ' alt separator", () => {
    expect(
      validateLinkTextConsistency(
        "Kurzgesagt explains black holes beautifully",
        "Kurzgesagt - explains the universe in 10 minutes"
      )
    ).toBe(true);
  });

  it("returns false when subject name not in LLM text (partial word doesn't count)", () => {
    expect(
      validateLinkTextConsistency(
        "Watch incredible chess moves by Hikaru",
        "GothamChess live — learn chess while being entertained"
      )
    ).toBe(false);
  });

  it("returns true when pool text has no separator and first words match", () => {
    expect(
      validateLinkTextConsistency(
        "Solve today's daily chess puzzle!",
        "Solve today's daily chess puzzle on Chess.com"
      )
    ).toBe(true);
  });
});

describe("Link Integrity — Integration Scenarios", () => {
  it("mismatch scenario: Fat Jewish text + iJustin URL would be caught", () => {
    const llmText = "Get ready to laugh with The Fat Jewish";
    const poolText = "iJustine — tech reviews and unboxings";
    expect(validateLinkTextConsistency(llmText, poolText)).toBe(false);
  });

  it("correct match: GothamChess text + GothamChess pool entry", () => {
    const llmText = "GothamChess is live with viewer games — jump in!";
    const poolText = "GothamChess live — learn chess while being entertained";
    expect(validateLinkTextConsistency(llmText, poolText)).toBe(true);
  });

  it("correct match: Pokimane text + Pokimane pool entry", () => {
    const llmText = "Pokimane is live — chill vibes tonight";
    const poolText = "Pokimane is live — chill vibes and chat energy";
    expect(validateLinkTextConsistency(llmText, poolText)).toBe(true);
  });

  it("mismatch scenario: xQc text + Hikaru URL would be caught", () => {
    const llmText = "xQc is going absolutely wild right now";
    const poolText = "Hikaru playing bullet chess at 3000 ELO";
    expect(validateLinkTextConsistency(llmText, poolText)).toBe(false);
  });

  it("general activity entries pass without creator name matching", () => {
    const llmText = "Go for a 15-minute walk and clear your head";
    const poolText = "Go for a 15-minute walk without your phone";
    expect(validateLinkTextConsistency(llmText, poolText)).toBe(true);
  });
});
