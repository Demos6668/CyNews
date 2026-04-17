/**
 * Resilient fetch: timeout + retry + per-host circuit breaker.
 *
 * Wraps `fetchWithTimeout` with:
 *   1. Exponential backoff retry (default 3 attempts) on network errors
 *      and retriable HTTP status codes (408, 425, 429, 500, 502, 503, 504).
 *   2. Per-host circuit breaker: after N consecutive failures in a rolling
 *      window, calls to that host short-circuit for a cooldown period.
 *   3. Honors `Retry-After` header (seconds or HTTP-date) on 429/503.
 *
 * This keeps feed scheduler ticks from being wiped out by transient upstream
 * issues, and stops hammering a dead endpoint until it recovers.
 */

import { fetchWithTimeout } from "./fetchWithTimeout";
import { logger } from "./logger";

const RETRIABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface ResilienceOptions {
  timeout?: number;
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  circuitBreaker?: boolean;
}

interface BreakerState {
  failures: number;
  openedAt: number | null;
  cooldownUntil: number | null;
}

const BREAKER_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 60_000;
const breakers = new Map<string, BreakerState>();

function hostKey(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function getBreaker(host: string): BreakerState {
  let state = breakers.get(host);
  if (!state) {
    state = { failures: 0, openedAt: null, cooldownUntil: null };
    breakers.set(host, state);
  }
  return state;
}

function isCircuitOpen(state: BreakerState): boolean {
  if (state.cooldownUntil === null) return false;
  if (Date.now() >= state.cooldownUntil) {
    // Half-open: allow the next call to test the endpoint.
    state.cooldownUntil = null;
    state.openedAt = null;
    return false;
  }
  return true;
}

function recordSuccess(state: BreakerState): void {
  state.failures = 0;
  state.openedAt = null;
  state.cooldownUntil = null;
}

function recordFailure(state: BreakerState, host: string): void {
  state.failures += 1;
  if (state.failures >= BREAKER_THRESHOLD && state.cooldownUntil === null) {
    state.openedAt = Date.now();
    state.cooldownUntil = Date.now() + BREAKER_COOLDOWN_MS;
    logger.warn(
      { host, failures: state.failures, cooldownMs: BREAKER_COOLDOWN_MS },
      "Circuit breaker opened for host",
    );
  }
}

function backoffDelay(attempt: number, base: number, max: number): number {
  const exp = Math.min(max, base * 2 ** attempt);
  // Full jitter — avoids synchronized retries across replicas.
  return Math.floor(Math.random() * exp);
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get("retry-after");
  if (!header) return null;
  const asSeconds = Number(header);
  if (Number.isFinite(asSeconds)) return Math.max(0, asSeconds * 1000);
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) return Math.max(0, asDate - Date.now());
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CircuitOpenError extends Error {
  constructor(host: string) {
    super(`Circuit breaker open for ${host}`);
    this.name = "CircuitOpenError";
  }
}

export async function fetchWithResilience(
  url: string,
  options?: RequestInit & ResilienceOptions,
): Promise<Response> {
  const {
    timeout,
    retries = 3,
    baseDelayMs = 500,
    maxDelayMs = 8_000,
    circuitBreaker = true,
    ...fetchOptions
  } = options ?? {};

  const host = hostKey(url);
  const breaker = circuitBreaker ? getBreaker(host) : null;

  if (breaker && isCircuitOpen(breaker)) {
    throw new CircuitOpenError(host);
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, { ...fetchOptions, timeout });
      if (res.ok || !RETRIABLE_STATUS.has(res.status)) {
        if (breaker) recordSuccess(breaker);
        return res;
      }
      // Retriable status — drain body, decide whether to retry.
      lastError = new Error(`HTTP ${res.status} for ${url}`);
      if (attempt === retries) {
        if (breaker) recordFailure(breaker, host);
        return res;
      }
      const retryAfter = retryAfterMs(res);
      const delay = retryAfter ?? backoffDelay(attempt, baseDelayMs, maxDelayMs);
      logger.debug({ url, status: res.status, attempt: attempt + 1, delay }, "Retrying after retriable status");
      await sleep(delay);
    } catch (err) {
      lastError = err;
      if (attempt === retries) {
        if (breaker) recordFailure(breaker, host);
        throw err;
      }
      const delay = backoffDelay(attempt, baseDelayMs, maxDelayMs);
      logger.debug({ url, err: (err as Error).message, attempt: attempt + 1, delay }, "Retrying after fetch error");
      await sleep(delay);
    }
  }

  // Unreachable — loop either returns or throws.
  throw lastError instanceof Error ? lastError : new Error("fetchWithResilience exhausted retries");
}

/** Testing helper: reset all breaker state. */
export function __resetCircuitBreakers(): void {
  breakers.clear();
}
