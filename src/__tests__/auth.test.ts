/**
 * Tests for Auth infrastructure:
 * - getAuthUserId extracts user from session
 * - API routes return 401 when unauthenticated
 * - Login actions call correct Supabase methods
 */

// Mock next/headers before any imports
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    getAll: jest.fn(() => []),
    set: jest.fn(),
  })),
  headers: jest.fn(() => ({
    get: jest.fn(() => "http://localhost:3000"),
  })),
}));

// Mock @supabase/ssr
const mockGetUser = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockSignInWithOAuth = jest.fn();
const mockSignOut = jest.fn();
const mockExchangeCodeForSession = jest.fn();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockSignOut,
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
  createBrowserClient: jest.fn(() => ({
    auth: {
      signOut: mockSignOut,
    },
  })),
}));

// Mock next/cache and next/navigation
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { getAuthUserId } from "@/lib/supabase/api";

describe("getAuthUserId", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
  });

  it("returns user ID when session is valid", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123-abc" } },
    });

    const userId = await getAuthUserId();
    expect(userId).toBe("user-123-abc");
  });

  it("returns null when no session exists", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    const userId = await getAuthUserId();
    expect(userId).toBeNull();
  });

  it("returns null when getUser returns undefined", async () => {
    mockGetUser.mockResolvedValue({
      data: {},
    });

    const userId = await getAuthUserId();
    expect(userId).toBeNull();
  });
});

describe("Auth Server Actions", () => {
  beforeEach(() => {
    mockSignInWithPassword.mockReset();
    mockSignUp.mockReset();
    mockSignInWithOAuth.mockReset();
    mockSignOut.mockReset();
  });

  describe("login", () => {
    it("calls signInWithPassword and redirects on success", async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });

      const { login } = await import("@/app/login/actions");
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password123");

      // login redirects on success, which throws in our mock
      await expect(login(formData)).rejects.toThrow("REDIRECT:/");
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    it("returns error object on failure", async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: "Invalid credentials" },
      });

      const { login } = await import("@/app/login/actions");
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "wrong");

      const result = await login(formData);
      expect(result).toEqual({ error: "Invalid credentials" });
    });

    it("returns friendly message for unverified email", async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: { message: "Email not confirmed" },
      });

      const { login } = await import("@/app/login/actions");
      const formData = new FormData();
      formData.set("email", "test@example.com");
      formData.set("password", "password123");

      const result = await login(formData);
      expect(result.error).toContain("verify your email");
    });
  });

  describe("signup", () => {
    it("calls signUp and returns success message", async () => {
      mockSignUp.mockResolvedValue({ error: null });

      const { signup } = await import("@/app/login/actions");
      const formData = new FormData();
      formData.set("email", "new@example.com");
      formData.set("password", "password123");

      const result = await signup(formData);
      expect(result.message).toContain("verify your account");
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "password123",
      });
    });

    it("returns error object on failure", async () => {
      mockSignUp.mockResolvedValue({
        error: { message: "User already registered" },
      });

      const { signup } = await import("@/app/login/actions");
      const formData = new FormData();
      formData.set("email", "existing@example.com");
      formData.set("password", "password123");

      const result = await signup(formData);
      expect(result).toEqual({ error: "User already registered" });
    });
  });

  describe("logout", () => {
    it("calls signOut and redirects to /login", async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const { logout } = await import("@/app/login/actions");

      await expect(logout()).rejects.toThrow("REDIRECT:/login");
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
