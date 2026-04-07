const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockDelete = jest.fn();
const mockUpdate = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { isOnboardingComplete } from "@/lib/onboarding";

function setupChain() {
  mockFrom.mockReturnValue({
    select: mockSelect,
    delete: mockDelete,
    update: mockUpdate,
  });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ eq: jest.fn().mockReturnValue({ single: mockSingle }) });
}

describe("isOnboardingComplete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupChain();
  });

  it("returns true when persona_stats has onboarding_complete with completed: true", async () => {
    mockSingle.mockResolvedValue({
      data: { value: { completed: true, completedAt: "2024-01-01" } },
      error: null,
    });

    const result = await isOnboardingComplete("user-123");
    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("persona_stats");
  });

  it("returns false when persona_stats row does not exist (data is null)", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const result = await isOnboardingComplete("user-123");
    expect(result).toBe(false);
  });

  it("returns false when persona_stats has completed: false", async () => {
    mockSingle.mockResolvedValue({
      data: { value: { completed: false } },
      error: null,
    });

    const result = await isOnboardingComplete("user-123");
    expect(result).toBe(false);
  });

  it("returns false when value has no completed field", async () => {
    mockSingle.mockResolvedValue({
      data: { value: {} },
      error: null,
    });

    const result = await isOnboardingComplete("user-123");
    expect(result).toBe(false);
  });

  it("returns false when value is null", async () => {
    mockSingle.mockResolvedValue({
      data: { value: null },
      error: null,
    });

    const result = await isOnboardingComplete("user-123");
    expect(result).toBe(false);
  });
});

describe("Onboarding reset — service role key usage", () => {
  it("reset action in route.ts imports server singleton (not anon key client)", async () => {
    // This is a structural test: verify the route imports @/lib/supabase (service role)
    // rather than creating a new anon-key client
    const routeSource = require("fs").readFileSync(
      require("path").resolve(__dirname, "../app/api/onboarding/route.ts"),
      "utf-8"
    );

    // Should import from @/lib/supabase (server singleton with service role key)
    expect(routeSource).toContain('import("@/lib/supabase")');
    // Should NOT create a new anon-key client for the reset action
    expect(routeSource).not.toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });
});
