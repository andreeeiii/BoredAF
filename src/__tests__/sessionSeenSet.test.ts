import {
  hasBeenSeen,
  markSeen,
  getSeenPoolIds,
  clearSession,
  cleanupExpiredSessions,
} from "@/lib/agent/sessionSeenSet";

describe("Session Seen-Set", () => {
  const userId = "user-123";
  const poolId1 = "pool-aaa";
  const poolId2 = "pool-bbb";
  const poolId3 = "pool-ccc";

  beforeEach(() => {
    clearSession(userId);
    clearSession("user-other");
  });

  it("returns false for unseen poolId", () => {
    expect(hasBeenSeen(userId, poolId1)).toBe(false);
  });

  it("returns true after marking a poolId as seen", () => {
    markSeen(userId, poolId1);
    expect(hasBeenSeen(userId, poolId1)).toBe(true);
  });

  it("returns false for a different poolId that was not marked", () => {
    markSeen(userId, poolId1);
    expect(hasBeenSeen(userId, poolId2)).toBe(false);
  });

  it("tracks multiple poolIds per user", () => {
    markSeen(userId, poolId1);
    markSeen(userId, poolId2);
    markSeen(userId, poolId3);
    expect(hasBeenSeen(userId, poolId1)).toBe(true);
    expect(hasBeenSeen(userId, poolId2)).toBe(true);
    expect(hasBeenSeen(userId, poolId3)).toBe(true);
  });

  it("isolates sessions between different users", () => {
    markSeen(userId, poolId1);
    markSeen("user-other", poolId2);
    expect(hasBeenSeen(userId, poolId1)).toBe(true);
    expect(hasBeenSeen(userId, poolId2)).toBe(false);
    expect(hasBeenSeen("user-other", poolId1)).toBe(false);
    expect(hasBeenSeen("user-other", poolId2)).toBe(true);
  });

  it("getSeenPoolIds returns all seen IDs", () => {
    markSeen(userId, poolId1);
    markSeen(userId, poolId2);
    const seen = getSeenPoolIds(userId);
    expect(seen.has(poolId1)).toBe(true);
    expect(seen.has(poolId2)).toBe(true);
    expect(seen.size).toBe(2);
  });

  it("getSeenPoolIds returns empty set for unknown user", () => {
    const seen = getSeenPoolIds("nonexistent-user");
    expect(seen.size).toBe(0);
  });

  it("clearSession removes all seen IDs for a user", () => {
    markSeen(userId, poolId1);
    markSeen(userId, poolId2);
    clearSession(userId);
    expect(hasBeenSeen(userId, poolId1)).toBe(false);
    expect(hasBeenSeen(userId, poolId2)).toBe(false);
    expect(getSeenPoolIds(userId).size).toBe(0);
  });

  it("clearSession does not affect other users", () => {
    markSeen(userId, poolId1);
    markSeen("user-other", poolId2);
    clearSession(userId);
    expect(hasBeenSeen("user-other", poolId2)).toBe(true);
  });

  it("cleanupExpiredSessions returns 0 when no sessions exist", () => {
    expect(cleanupExpiredSessions()).toBe(0);
  });

  it("cleanupExpiredSessions returns 0 when sessions are fresh", () => {
    markSeen(userId, poolId1);
    expect(cleanupExpiredSessions()).toBe(0);
    // Session should still be active
    expect(hasBeenSeen(userId, poolId1)).toBe(true);
  });

  it("marking seen on an already-seen poolId is idempotent", () => {
    markSeen(userId, poolId1);
    markSeen(userId, poolId1);
    markSeen(userId, poolId1);
    const seen = getSeenPoolIds(userId);
    expect(seen.size).toBe(1);
    expect(seen.has(poolId1)).toBe(true);
  });

  it("getSeenPoolIds returns a copy (not a reference)", () => {
    markSeen(userId, poolId1);
    const seen = getSeenPoolIds(userId);
    seen.add("fake-id");
    // Original should not be affected
    expect(hasBeenSeen(userId, "fake-id")).toBe(false);
  });
});
