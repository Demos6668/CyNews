/**
 * Prometheus metrics registry for the API server.
 *
 * A single shared Registry is exported so all modules (routes, jobs, sweeps)
 * contribute to the same /metrics snapshot. Default Node process metrics
 * (CPU, memory, event-loop lag, GC) are collected automatically.
 *
 * Cardinality notes:
 *   - http_request_duration_seconds labels on { method, route, status_class }.
 *     We deliberately bucket status into 2xx/3xx/4xx/5xx rather than raw
 *     status codes to keep series count bounded.
 *   - Route label is populated from req.route.path (normalised, e.g.
 *     /api/workspaces/:id), NOT the raw URL, so :id values don't explode
 *     the series cardinality.
 *
 * The /metrics endpoint is wired in app.ts and gated by METRICS_TOKEN when
 * that env var is set.
 */

import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from "prom-client";

export const registry = new Registry();
registry.setDefaultLabels({ service: "api-server" });

collectDefaultMetrics({ register: registry });

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests handled by the Express app, in seconds.",
  labelNames: ["method", "route", "status_class"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total HTTP requests handled by the Express app.",
  labelNames: ["method", "route", "status_class"] as const,
  registers: [registry],
});

// ---------------------------------------------------------------------------
// Database pool
// ---------------------------------------------------------------------------

export const dbPoolTotal = new Gauge({
  name: "db_pool_connections_total",
  help: "Total connections in the Postgres pool (idle + in-use).",
  registers: [registry],
});

export const dbPoolIdle = new Gauge({
  name: "db_pool_connections_idle",
  help: "Idle connections in the Postgres pool.",
  registers: [registry],
});

export const dbPoolWaiting = new Gauge({
  name: "db_pool_connections_waiting",
  help: "Clients waiting to acquire a Postgres connection.",
  registers: [registry],
});

// ---------------------------------------------------------------------------
// Background jobs (feed scheduler, maintenance sweeps)
// ---------------------------------------------------------------------------

export const jobRunsTotal = new Counter({
  name: "job_runs_total",
  help: "Total background job runs, labelled by job name and outcome.",
  labelNames: ["job", "outcome"] as const,
  registers: [registry],
});

export const jobDuration = new Histogram({
  name: "job_duration_seconds",
  help: "Duration of background job runs, in seconds.",
  labelNames: ["job"] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600],
  registers: [registry],
});

export const jobRowsProcessed = new Counter({
  name: "job_rows_processed_total",
  help: "Total rows processed by background jobs (inserts/updates/deletes).",
  labelNames: ["job", "kind"] as const,
  registers: [registry],
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function statusClass(code: number): string {
  if (code >= 500) return "5xx";
  if (code >= 400) return "4xx";
  if (code >= 300) return "3xx";
  if (code >= 200) return "2xx";
  return "1xx";
}
