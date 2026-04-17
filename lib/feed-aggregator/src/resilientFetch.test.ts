import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithResilience, CircuitOpenError, __resetCircuitBreakers } from "./resilientFetch";

describe("fetchWithResilience", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    __resetCircuitBreakers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  it("returns a 200 response on the first try", async () => {
    mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const res = await fetchWithResilience("https://a.example.com/feed");
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry on non-retriable status (404)", async () => {
    mockFetch.mockResolvedValueOnce(new Response("missing", { status: 404 }));
    const res = await fetchWithResilience("https://b.example.com/missing", { retries: 3, baseDelayMs: 1 });
    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and succeeds on second attempt", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = fetchWithResilience("https://c.example.com/api", { retries: 3, baseDelayMs: 10, maxDelayMs: 50 });
    await vi.advanceTimersByTimeAsync(200);
    const res = await promise;

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("retries on thrown network errors", async () => {
    const err = new TypeError("network down");
    mockFetch
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = fetchWithResilience("https://d.example.com/", { retries: 3, baseDelayMs: 10, maxDelayMs: 50 });
    await vi.advanceTimersByTimeAsync(500);
    const res = await promise;

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("honors Retry-After seconds on 429", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "Retry-After": "2" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = fetchWithResilience("https://e.example.com/", { retries: 2, baseDelayMs: 1, maxDelayMs: 1 });
    // Before the header-dictated 2s, only the first call should have fired.
    await vi.advanceTimersByTimeAsync(500);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    const res = await promise;

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("opens the circuit after 5 consecutive failures and blocks the 6th call", async () => {
    const err = new Error("boom");
    mockFetch.mockRejectedValue(err);
    const host = "https://f.example.com/";

    for (let i = 0; i < 5; i += 1) {
      const promise = fetchWithResilience(host, { retries: 0, baseDelayMs: 1 });
      const caught = promise.catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(10);
      await caught;
    }

    // 6th call — circuit is now open.
    await expect(fetchWithResilience(host, { retries: 0 })).rejects.toBeInstanceOf(CircuitOpenError);
    // fetch was only called 5 times total; the 6th short-circuited.
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it("half-opens after the cooldown elapses", async () => {
    const err = new Error("boom");
    mockFetch.mockRejectedValue(err);
    const host = "https://g.example.com/";

    for (let i = 0; i < 5; i += 1) {
      const promise = fetchWithResilience(host, { retries: 0, baseDelayMs: 1 });
      const caught = promise.catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(10);
      await caught;
    }

    // Circuit is open — skip 60s cooldown.
    await vi.advanceTimersByTimeAsync(60_001);

    // Half-open probe succeeds; circuit resets.
    mockFetch.mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const res = await fetchWithResilience(host, { retries: 0 });
    expect(res.status).toBe(200);
  });

  it("does not open circuit when circuitBreaker is disabled", async () => {
    const err = new Error("boom");
    mockFetch.mockRejectedValue(err);
    const host = "https://h.example.com/";

    for (let i = 0; i < 10; i += 1) {
      const promise = fetchWithResilience(host, { retries: 0, baseDelayMs: 1, circuitBreaker: false });
      const caught = promise.catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(10);
      await caught;
    }

    expect(mockFetch).toHaveBeenCalledTimes(10);
  });

  it("returns the last retriable response when all retries exhausted", async () => {
    mockFetch.mockResolvedValue(new Response("gone", { status: 502 }));

    const promise = fetchWithResilience("https://i.example.com/", { retries: 2, baseDelayMs: 1, maxDelayMs: 2 });
    await vi.advanceTimersByTimeAsync(100);
    const res = await promise;

    expect(res.status).toBe(502);
    expect(mockFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
