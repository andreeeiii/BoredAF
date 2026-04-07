/**
 * URL Health Cache — tracks known-bad URLs (dead channels, 404s, deleted accounts).
 * Flagged URLs get score = -999 at ranking time.
 * Cache entries expire after 24 hours (URL_HEALTH_TTL_MS).
 */

const URL_HEALTH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface HealthEntry {
  flaggedAt: number;
  reason: string;
}

const unhealthyUrls = new Map<string, HealthEntry>();

/**
 * Flag a URL as unhealthy (dead channel, 404, etc.).
 */
export function flagUnhealthyUrl(url: string, reason: string): void {
  if (!url) return;
  unhealthyUrls.set(url.toLowerCase(), { flaggedAt: Date.now(), reason });
}

/**
 * Check if a URL is flagged as unhealthy (and still within TTL).
 */
export function isUrlUnhealthy(url: string): boolean {
  if (!url) return false;
  const entry = unhealthyUrls.get(url.toLowerCase());
  if (!entry) return false;
  if (Date.now() - entry.flaggedAt > URL_HEALTH_TTL_MS) {
    unhealthyUrls.delete(url.toLowerCase());
    return false;
  }
  return true;
}

/**
 * Get the reason a URL was flagged, or null if not flagged.
 */
export function getUnhealthyReason(url: string): string | null {
  if (!url) return null;
  const entry = unhealthyUrls.get(url.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.flaggedAt > URL_HEALTH_TTL_MS) {
    unhealthyUrls.delete(url.toLowerCase());
    return null;
  }
  return entry.reason;
}

/**
 * Clear a specific URL from the unhealthy cache (e.g., if it's been verified healthy).
 */
export function clearUnhealthyUrl(url: string): void {
  if (!url) return;
  unhealthyUrls.delete(url.toLowerCase());
}

/**
 * Get count of currently cached unhealthy URLs.
 */
export function getUnhealthyCacheSize(): number {
  return unhealthyUrls.size;
}

/**
 * Cleanup expired entries from the cache.
 */
export function cleanupExpiredUrlHealth(): number {
  const now = Date.now();
  let cleaned = 0;
  Array.from(unhealthyUrls.entries()).forEach(([url, entry]) => {
    if (now - entry.flaggedAt > URL_HEALTH_TTL_MS) {
      unhealthyUrls.delete(url);
      cleaned++;
    }
  });
  return cleaned;
}
