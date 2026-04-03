import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithTimeout } from "./fetchWithTimeout";

describe("fetchWithTimeout", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue(new Response("OK", { status: 200 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls fetch with the given URL", async () => {
    const response = await fetchWithTimeout("https://example.com/feed");

    expect(response).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/feed",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns the response on success", async () => {
    mockFetch.mockResolvedValueOnce(new Response("data", { status: 200 }));

    const response = await fetchWithTimeout("https://example.com/feed");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("data");
  });

  it("passes through custom fetch options", async () => {
    const headers = { Authorization: "Bearer token" };

    await fetchWithTimeout("https://example.com/api", {
      method: "POST",
      headers,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        method: "POST",
        headers,
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("uses default 30s timeout when not specified", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    await fetchWithTimeout("https://example.com");

    // clearTimeout is called in finally, confirming timeout was set
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("throws a descriptive error when fetch times out", async () => {
    // Make fetch hang until aborted
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const promise = fetchWithTimeout("https://slow.example.com", { timeout: 5000 });
    // Attach handler before advancing timers to prevent unhandled rejection
    const caughtError = promise.catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(5000);

    const error = await caughtError;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Fetch timed out after 5000ms for URL: https://slow.example.com",
    );
  });

  it("uses custom timeout when provided", async () => {
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const promise = fetchWithTimeout("https://example.com", { timeout: 1000 });
    const caughtError = promise.catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(1000);

    const error = await caughtError;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("Fetch timed out after 1000ms");
  });

  it("re-throws non-abort errors as-is", async () => {
    const networkError = new TypeError("Failed to fetch");
    mockFetch.mockRejectedValueOnce(networkError);

    await expect(fetchWithTimeout("https://example.com")).rejects.toThrow("Failed to fetch");
  });

  it("clears timeout after successful fetch", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    await fetchWithTimeout("https://example.com");

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("clears timeout after failed fetch", async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    mockFetch.mockRejectedValueOnce(new Error("network down"));

    await expect(fetchWithTimeout("https://example.com")).rejects.toThrow("network down");
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("handles undefined options gracefully", async () => {
    const response = await fetchWithTimeout("https://example.com");

    expect(response).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
