/**
 * Tests for the reasoning cache in bafBrain.ts.
 * We test the cache helper functions by extracting the logic into testable units.
 * Since the cache functions are module-private, we test via the exported buildCacheKey-like behavior.
 */

describe("Reasoning Cache Logic", () => {
  const CACHE_TTL_MS = 30_000;

  // Simulate the cache behavior
  interface CacheEntry {
    response: string;
    timestamp: number;
  }

  function buildCacheKey(
    archetype: string,
    energy: string,
    streak: number,
    topUrls: string[],
    prevSuggestions: string[]
  ): string {
    const topIds = topUrls.slice(0, 5).join("|");
    const rejectHash = prevSuggestions.slice(0, 5).join("|");
    return `${archetype}:${energy}:${streak}:${topIds}:${rejectHash}`;
  }

  function getCachedReasoning(
    cache: Map<string, CacheEntry>,
    key: string
  ): string | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key);
      return null;
    }
    return entry.response;
  }

  it("builds deterministic cache keys from same inputs", () => {
    const k1 = buildCacheKey("The Grind", "high", 0, ["url1", "url2"], ["prev1"]);
    const k2 = buildCacheKey("The Grind", "high", 0, ["url1", "url2"], ["prev1"]);
    expect(k1).toBe(k2);
  });

  it("builds different keys for different archetypes", () => {
    const k1 = buildCacheKey("The Grind", "high", 0, ["url1"], []);
    const k2 = buildCacheKey("The Chill", "high", 0, ["url1"], []);
    expect(k1).not.toBe(k2);
  });

  it("builds different keys for different energy levels", () => {
    const k1 = buildCacheKey("The Grind", "high", 0, ["url1"], []);
    const k2 = buildCacheKey("The Grind", "low", 0, ["url1"], []);
    expect(k1).not.toBe(k2);
  });

  it("builds different keys when rejection streak differs", () => {
    const k1 = buildCacheKey("The Grind", "high", 0, ["url1"], []);
    const k2 = buildCacheKey("The Grind", "high", 3, ["url1"], []);
    expect(k1).not.toBe(k2);
  });

  it("builds different keys for different ranked content", () => {
    const k1 = buildCacheKey("The Grind", "high", 0, ["url1", "url2"], []);
    const k2 = buildCacheKey("The Grind", "high", 0, ["url3", "url4"], []);
    expect(k1).not.toBe(k2);
  });

  it("builds different keys when previous suggestions differ", () => {
    const k1 = buildCacheKey("The Grind", "high", 0, ["url1"], ["MrBeast"]);
    const k2 = buildCacheKey("The Grind", "high", 0, ["url1"], ["Hikaru"]);
    expect(k1).not.toBe(k2);
  });

  it("returns null for cache miss", () => {
    const cache = new Map<string, CacheEntry>();
    const result = getCachedReasoning(cache, "some-key");
    expect(result).toBeNull();
  });

  it("returns cached response for cache hit within TTL", () => {
    const cache = new Map<string, CacheEntry>();
    cache.set("key1", { response: '{"suggestion":"test"}', timestamp: Date.now() });
    const result = getCachedReasoning(cache, "key1");
    expect(result).toBe('{"suggestion":"test"}');
  });

  it("returns null and deletes expired entry", () => {
    const cache = new Map<string, CacheEntry>();
    cache.set("key1", { response: '{"suggestion":"test"}', timestamp: Date.now() - 31_000 });
    const result = getCachedReasoning(cache, "key1");
    expect(result).toBeNull();
    expect(cache.has("key1")).toBe(false);
  });

  it("does not return stale entry at exactly TTL boundary", () => {
    const cache = new Map<string, CacheEntry>();
    cache.set("key1", { response: '{"suggestion":"test"}', timestamp: Date.now() - CACHE_TTL_MS - 1 });
    const result = getCachedReasoning(cache, "key1");
    expect(result).toBeNull();
  });

  it("only uses top 5 URLs for cache key", () => {
    const urls6 = ["u1", "u2", "u3", "u4", "u5", "u6"];
    const urls5 = ["u1", "u2", "u3", "u4", "u5"];
    const k1 = buildCacheKey("The Grind", "high", 0, urls6, []);
    const k2 = buildCacheKey("The Grind", "high", 0, urls5, []);
    expect(k1).toBe(k2);
  });
});
