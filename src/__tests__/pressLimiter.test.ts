import { checkPressLimit, recordPress, addCredits, setPremiumStatus } from "@/lib/pressLimiter";

// Mock supabase
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockUpsert = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              eq: (...eqArgs2: unknown[]) => {
                mockEq(...eqArgs2);
                return {
                  single: () => {
                    mockSingle();
                    return mockSingle();
                  },
                };
              },
            };
          },
        };
      },
      upsert: (...args: unknown[]) => {
        mockUpsert(...args);
        return Promise.resolve({ error: null });
      },
    })),
  },
}));

describe("checkPressLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows first press for new user (no existing data)", async () => {
    mockSingle.mockReturnValue({ data: null, error: null });
    const status = await checkPressLimit("user-1");
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(3);
    expect(status.isPremium).toBe(false);
  });

  it("allows press when user has used fewer than 3 today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockSingle.mockReturnValue({
      data: { value: { count: 2, date: today, is_premium: false, credits: 0 } },
      error: null,
    });
    const status = await checkPressLimit("user-1");
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(1);
  });

  it("blocks press when daily limit reached and no credits", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockSingle.mockReturnValue({
      data: { value: { count: 3, date: today, is_premium: false, credits: 0 } },
      error: null,
    });
    const status = await checkPressLimit("user-1");
    expect(status.allowed).toBe(false);
    expect(status.remaining).toBe(0);
    expect(status.reason).toBe("limit_reached");
  });

  it("allows press when daily limit reached but has credits", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockSingle.mockReturnValue({
      data: { value: { count: 3, date: today, is_premium: false, credits: 5 } },
      error: null,
    });
    const status = await checkPressLimit("user-1");
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(0);
    expect(status.credits).toBe(5);
  });

  it("allows unlimited presses for premium users", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockSingle.mockReturnValue({
      data: { value: { count: 100, date: today, is_premium: true, credits: 0 } },
      error: null,
    });
    const status = await checkPressLimit("user-1");
    expect(status.allowed).toBe(true);
    expect(status.isPremium).toBe(true);
    expect(status.remaining).toBe(Infinity);
  });

  it("resets count on new day", async () => {
    mockSingle.mockReturnValue({
      data: { value: { count: 3, date: "2024-01-01", is_premium: false, credits: 0 } },
      error: null,
    });
    const status = await checkPressLimit("user-1");
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(3);
  });
});

describe("recordPress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("increments count for new user", async () => {
    mockSingle.mockReturnValue({ data: null, error: null });
    await recordPress("user-1");
    expect(mockUpsert).toHaveBeenCalled();
    const upsertCall = mockUpsert.mock.calls[0][0];
    expect(upsertCall.value).toBeDefined();
    const value = JSON.parse(JSON.stringify(upsertCall.value));
    expect(value.count).toBe(1);
  });

  it("deducts credit when over free limit", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockSingle.mockReturnValue({
      data: { value: { count: 3, date: today, is_premium: false, credits: 5 } },
      error: null,
    });
    await recordPress("user-1");
    expect(mockUpsert).toHaveBeenCalled();
    const value = JSON.parse(JSON.stringify(mockUpsert.mock.calls[0][0].value));
    expect(value.count).toBe(4);
    expect(value.credits).toBe(4);
  });

  it("does not deduct credit for premium users", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockSingle.mockReturnValue({
      data: { value: { count: 10, date: today, is_premium: true, credits: 5 } },
      error: null,
    });
    await recordPress("user-1");
    const value = JSON.parse(JSON.stringify(mockUpsert.mock.calls[0][0].value));
    expect(value.count).toBe(11);
    expect(value.credits).toBe(5);
  });
});

describe("addCredits", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds credits to existing balance", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockSingle.mockReturnValue({
      data: { value: { count: 0, date: today, is_premium: false, credits: 3 } },
      error: null,
    });
    const total = await addCredits("user-1", 10);
    expect(total).toBe(13);
    const value = JSON.parse(JSON.stringify(mockUpsert.mock.calls[0][0].value));
    expect(value.credits).toBe(13);
  });

  it("initializes credits for new user", async () => {
    mockSingle.mockReturnValue({ data: null, error: null });
    const total = await addCredits("user-1", 10);
    expect(total).toBe(10);
  });
});

describe("setPremiumStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sets premium flag to true", async () => {
    mockSingle.mockReturnValue({ data: null, error: null });
    await setPremiumStatus("user-1", true);
    const value = JSON.parse(JSON.stringify(mockUpsert.mock.calls[0][0].value));
    expect(value.is_premium).toBe(true);
  });

  it("sets premium flag to false", async () => {
    const today = new Date().toISOString().slice(0, 10);
    mockSingle.mockReturnValue({
      data: { value: { count: 5, date: today, is_premium: true, credits: 10 } },
      error: null,
    });
    await setPremiumStatus("user-1", false);
    const value = JSON.parse(JSON.stringify(mockUpsert.mock.calls[0][0].value));
    expect(value.is_premium).toBe(false);
    expect(value.credits).toBe(10);
  });
});
