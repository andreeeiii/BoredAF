/**
 * Server-side session seen-set — tracks pool IDs shown to each user per session.
 * Prevents the same suggestion from appearing twice in a single session.
 * Entries expire after 30 minutes of inactivity (SESSION_TTL_MS).
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface SessionEntry {
  seenPoolIds: Set<string>;
  lastActivity: number;
}

const sessions = new Map<string, SessionEntry>();

/**
 * Check if a pool ID has already been shown to this user in the current session.
 */
export function hasBeenSeen(userId: string, poolId: string): boolean {
  const session = sessions.get(userId);
  if (!session) return false;
  if (Date.now() - session.lastActivity > SESSION_TTL_MS) {
    sessions.delete(userId);
    return false;
  }
  return session.seenPoolIds.has(poolId);
}

/**
 * Mark a pool ID as shown to this user.
 */
export function markSeen(userId: string, poolId: string): void {
  let session = sessions.get(userId);
  if (!session || Date.now() - session.lastActivity > SESSION_TTL_MS) {
    session = { seenPoolIds: new Set(), lastActivity: Date.now() };
    sessions.set(userId, session);
  }
  session.seenPoolIds.add(poolId);
  session.lastActivity = Date.now();
}

/**
 * Get all pool IDs seen by this user in the current session.
 * Returns an empty set if the session has expired.
 */
export function getSeenPoolIds(userId: string): Set<string> {
  const session = sessions.get(userId);
  if (!session) return new Set();
  if (Date.now() - session.lastActivity > SESSION_TTL_MS) {
    sessions.delete(userId);
    return new Set();
  }
  return new Set(session.seenPoolIds);
}

/**
 * Clear a user's session (for testing or manual reset).
 */
export function clearSession(userId: string): void {
  sessions.delete(userId);
}

/**
 * Cleanup expired sessions (call periodically to prevent memory leaks).
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  Array.from(sessions.entries()).forEach(([userId, session]) => {
    if (now - session.lastActivity > SESSION_TTL_MS) {
      sessions.delete(userId);
      cleaned++;
    }
  });
  return cleaned;
}
