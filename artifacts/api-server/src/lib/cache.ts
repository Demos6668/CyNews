/**
 * In-memory TTL cache with max-size eviction for API responses.
 * Entries expire after a configurable TTL. When max entries is reached,
 * the oldest entry (by insertion order) is evicted.
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const DEFAULT_MAX_ENTRIES = 1000;

export class TtlCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries: number;

  constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    // Move to end for LRU behavior (Map preserves insertion order)
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    // Delete first so re-insertion moves key to end
    this.store.delete(key);
    // Evict oldest entries if at capacity
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
      else break;
    }
    this.store.set(key, { data, expires: Date.now() + ttlMs });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

/** Shared cache instance for the API server */
export const apiCache = new TtlCache();

/** Standard TTLs */
export const CACHE_TTL = {
  DASHBOARD: 60_000,  // 60 seconds
  LIST: 30_000,       // 30 seconds
  SEARCH: 15_000,     // 15 seconds
} as const;
