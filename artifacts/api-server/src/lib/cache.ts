/**
 * Simple in-memory TTL cache for API responses.
 * Cache entries expire after a configurable TTL (in milliseconds).
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
}

export class TtlCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
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
