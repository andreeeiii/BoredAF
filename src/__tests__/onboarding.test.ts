import {
  ONBOARDING_SLOTS,
  getRandomOnboardingSet,
} from "@/constants/onboarding";

describe("Onboarding Question Bank", () => {
  it("has exactly 4 slots", () => {
    expect(ONBOARDING_SLOTS).toHaveLength(4);
  });

  it("each slot has exactly 3 variants", () => {
    for (const slot of ONBOARDING_SLOTS) {
      expect(slot.variants).toHaveLength(3);
    }
  });

  it("each variant has required fields", () => {
    for (const slot of ONBOARDING_SLOTS) {
      for (const variant of slot.variants) {
        expect(variant.id).toBeTruthy();
        expect(variant.slot).toBeTruthy();
        expect(variant.text).toBeTruthy();
        expect(variant.placeholder).toBeTruthy();
      }
    }
  });

  it("slots cover all 4 categories", () => {
    const slotTypes = ONBOARDING_SLOTS.flatMap((s) =>
      s.variants.map((v) => v.slot)
    );
    expect(slotTypes).toContain("digital");
    expect(slotTypes).toContain("skill");
    expect(slotTypes).toContain("energy");
    expect(slotTypes).toContain("wildcard");
  });

  it("all variant IDs are unique", () => {
    const ids = ONBOARDING_SLOTS.flatMap((s) => s.variants.map((v) => v.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getRandomOnboardingSet", () => {
  it("returns exactly 4 questions", () => {
    const set = getRandomOnboardingSet();
    expect(set).toHaveLength(4);
  });

  it("returns one question from each slot", () => {
    const set = getRandomOnboardingSet();
    const slots = set.map((q) => q.slot);
    expect(slots).toContain("digital");
    expect(slots).toContain("skill");
    expect(slots).toContain("energy");
    expect(slots).toContain("wildcard");
  });

  it("returns valid questions from the bank", () => {
    const allIds = ONBOARDING_SLOTS.flatMap((s) =>
      s.variants.map((v) => v.id)
    );
    const set = getRandomOnboardingSet();
    for (const q of set) {
      expect(allIds).toContain(q.id);
    }
  });

  it("can produce different sets (randomness)", () => {
    const sets = Array.from({ length: 20 }, () =>
      getRandomOnboardingSet().map((q) => q.id).join(",")
    );
    const unique = new Set(sets);
    expect(unique.size).toBeGreaterThan(1);
  });
});
