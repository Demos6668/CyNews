import { describe, it, expect, vi, beforeEach } from "vitest";
import { TtlCache } from "./cache";

describe("TtlCache", () => {
  let cache: TtlCache;

  beforeEach(() => {
    cache = new TtlCache(5);
  });

  it("returns undefined for missing keys", () => {
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("stores and retrieves values", () => {
    cache.set("key1", { data: "hello" }, 10_000);
    expect(cache.get("key1")).toEqual({ data: "hello" });
  });

  it("expires entries after TTL", () => {
    vi.useFakeTimers();
    cache.set("key1", "value", 1000);
    expect(cache.get("key1")).toBe("value");

    vi.advanceTimersByTime(1001);
    expect(cache.get("key1")).toBeUndefined();
    vi.useRealTimers();
  });

  it("evicts oldest entry when max size is reached", () => {
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    cache.set("c", 3, 60_000);
    cache.set("d", 4, 60_000);
    cache.set("e", 5, 60_000);
    expect(cache.size).toBe(5);

    // Adding a 6th should evict "a" (oldest)
    cache.set("f", 6, 60_000);
    expect(cache.size).toBe(5);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("f")).toBe(6);
  });

  it("promotes accessed entries (LRU behavior)", () => {
    cache.set("a", 1, 60_000);
    cache.set("b", 2, 60_000);
    cache.set("c", 3, 60_000);
    cache.set("d", 4, 60_000);
    cache.set("e", 5, 60_000);

    // Access "a" to promote it
    cache.get("a");

    // Fill two more — should evict "b" and "c" (oldest non-accessed)
    cache.set("f", 6, 60_000);
    cache.set("g", 7, 60_000);

    expect(cache.get("a")).toBe(1); // promoted, still present
    expect(cache.get("b")).toBeUndefined(); // evicted
    expect(cache.get("c")).toBeUndefined(); // evicted
  });

  it("invalidates all entries when no prefix given", () => {
    cache.set("news:1", "a", 60_000);
    cache.set("threats:1", "b", 60_000);
    cache.invalidate();
    expect(cache.size).toBe(0);
  });

  it("invalidates entries by prefix", () => {
    cache.set("news:1", "a", 60_000);
    cache.set("news:2", "b", 60_000);
    cache.set("threats:1", "c", 60_000);
    cache.invalidate("news:");
    expect(cache.size).toBe(1);
    expect(cache.get("threats:1")).toBe("c");
  });

  it("overwrites existing key without increasing size", () => {
    cache.set("key", "v1", 60_000);
    cache.set("key", "v2", 60_000);
    expect(cache.size).toBe(1);
    expect(cache.get("key")).toBe("v2");
  });
});
