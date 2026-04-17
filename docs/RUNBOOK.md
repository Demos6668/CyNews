# CyNews Operations Runbook

This runbook describes how to diagnose and recover from common incidents in the
CyNews API server. It covers health probes, metrics, background jobs, data
lifecycle, and third-party integrations.

For local development, see the top-level `README.md`. This document targets
operators running the production deployment.

---

## 1. Service Topology

```
  Client (cyfy-news SPA)
         │
         ▼
  /api  (Express, port 5000)            /ws  (WebSocketServer)
   │      ├── /api/auth/*   (Better Auth)
   │      ├── /api/billing  (Stripe Checkout + Portal + webhook)
   │      ├── /api/account  (GDPR: delete + export)
   │      ├── /api/admin    (maintenance visibility)
   │      ├── /api/workspaces, /api/news, /api/threats, …
   │      ├── /healthz, /livez, /readyz
   │      └── /metrics      (Prometheus, optional token)
   │
   ├── Postgres 16 (DATABASE_URL)        ← pg pool + drizzle-orm
   ├── Stripe API                         ← STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
   ├── Resend (email OTP + receipts)      ← RESEND_API_KEY
   └── Sentry (optional)                  ← SENTRY_DSN
```

Background jobs (all in-process, coordinated via Postgres advisory locks):

| Job                 | Schedule          | Lock key       | Purpose                                                   |
|---------------------|-------------------|----------------|-----------------------------------------------------------|
| feed-update         | every 15 min      | –              | Pull CVEs, CERT-In, news feeds; broadcast via WebSocket   |
| data-retention      | daily 03:00       | `42_040_901`   | Legacy archive/purge (news + threats TTL)                 |
| maintenance-sweeps  | daily 04:00       | `42_040_902`   | Sessions, verifications, invites, Stripe events, orphans, saved-view caps, soft-delete purge |

---

## 2. Health Probes

| Endpoint    | Purpose                             | Expected                          |
|-------------|-------------------------------------|-----------------------------------|
| `/livez`    | Liveness (no DB touch)              | `200 { alive: true }`             |
| `/healthz`  | DB reachable + pool stats           | `200 { status: "healthy" }`       |
| `/readyz`   | DB + indexes + scheduler run once   | `200 { ready: true }`             |

**K8s probes:** use `/livez` for `livenessProbe` and `/readyz` for
`readinessProbe`. `/healthz` is a human-oriented quick check.

**Sample pool stats** (in `/healthz` and `/readyz`):
```json
"pool": { "total": 8, "idle": 7, "waiting": 0 }
```
High `waiting` (> 0 sustained) means the pool is saturated — see §6.

---

## 3. Metrics

`GET /metrics` exposes Prometheus-format metrics. If `METRICS_TOKEN` is set,
requests must include `Authorization: Bearer <METRICS_TOKEN>`.

Key series:

| Metric                                | Labels                        | What to watch                              |
|---------------------------------------|-------------------------------|--------------------------------------------|
| `http_request_duration_seconds`       | method, route, status_class   | p95/p99 latency per route                  |
| `http_requests_total`                 | method, route, status_class   | Error-rate (`5xx` / total)                 |
| `db_pool_connections_total`           | –                             | Pool ceiling (usually matches `PG_POOL_MAX`) |
| `db_pool_connections_idle`            | –                             | Should be most of total when idle          |
| `db_pool_connections_waiting`         | –                             | **> 0 for > 1 min = saturation**           |
| `job_runs_total`                      | job, outcome                  | `outcome=failure` is an alert signal       |
| `job_duration_seconds`                | job                           | Drift vs. baseline for feed-update         |
| `job_rows_processed_total`            | job, kind                     | Sweep throughput (deleted / archived)      |
| `process_cpu_*`, `nodejs_*`           | default Node runtime metrics  | Heap growth, event-loop lag                |

**Default Node metrics** (CPU, memory, GC, event-loop lag) are included via
`prom-client`'s `collectDefaultMetrics`.

---

## 4. Sentry

Errors are automatically sent to Sentry when `SENTRY_DSN` is set. Three
surfaces report:

1. **Express error handler** (`middlewares/errorHandler.ts`) — every unhandled
   error from a route handler; context includes `requestId`, `method`, `url`,
   `userId`, `orgId`.
2. **Process-level handlers** (`index.ts`) — `unhandledRejection` and
   `uncaughtException`. Process stays alive; container orchestrator handles
   real fatals via `/livez`.
3. **Background jobs** — feed-update and each maintenance sweep capture
   exceptions with job name context.

No PII is sent by default (`sendDefaultPii: false`). Production sampling is
10%; dev is 100%.

---

## 5. Data Lifecycle & GDPR

### Soft-delete flow

Users, orgs, and workspaces support a two-phase deletion:

1. **Schedule** — `deleted_at = now()`, `purge_after = now() + 30d`, a
   `delete_requests` row is inserted, audit log entry written.
2. **Purge** — the `softDeletePurge` sweep (runs 04:00) deletes rows where
   `purge_after <= now()` and marks the request as `purged`.

### Manual triggers

- **User-initiated deletion**: `DELETE /api/account` — authenticated user
  schedules their own deletion.
- **Cancel**: `POST /api/account/delete/cancel` — same user within grace.
- **Workspace restore**: `POST /api/workspaces/:id/restore` — owner clears
  soft-delete columns and cancels the pending request.
- **Export**: `GET /api/account/export` — returns a JSON attachment with
  bookmarks, savedViews, and audit log (GDPR Art. 20).

### Dry-run purge

Set `SOFT_DELETE_PURGE_DRY_RUN=true` to log what would be purged without
deleting. Useful when rolling out the feature.

### Audit-log retention

Audit logs are retained indefinitely by default. To enable purging, set:

```
AUDIT_LOG_RETENTION_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=730
```

---

## 6. Common Incidents

### 6.1 Pool exhaustion (`db_pool_connections_waiting > 0`)

**Symptoms:** Requests hang, `/healthz` returns 503.

**Diagnose:**
```
# In Postgres
SELECT state, count(*) FROM pg_stat_activity
  WHERE application_name LIKE '%cynews%' GROUP BY state;
```

**Fixes:**
- Kill long-running queries: `SELECT pg_cancel_backend(pid) …`.
- Restart the API server (graceful shutdown drains in-flight for 10s).
- Scale horizontally: each replica has its own pool.

### 6.2 Feed-update failures

**Symptoms:** `job_runs_total{job="feed-update",outcome="failure"}` rising;
WebSocket clients receive `REFRESH_ERROR` events.

**Diagnose:**
- Check logs: `pino` emits `{ error: "...", "Feed update failed" }`.
- Check upstream sources are reachable (CVE API, CERT-In RSS, news feeds).

**Fixes:**
- A single tick failure is expected occasionally. Three consecutive failures
  merit investigation.
- Manually trigger: `POST /api/scheduler/refresh` (requires `API_KEY`).

### 6.3 Stripe webhook replay

**Symptoms:** Customer reports "I paid but my plan didn't upgrade".

**Diagnose:**
- `SELECT * FROM stripe_events ORDER BY received_at DESC LIMIT 20;`
- Compare with Stripe dashboard → Developers → Webhooks → event log.

**Fix:** In the Stripe dashboard, click "Resend" on the event. The API server
dedupes by `stripe_events.id` so double-delivery is safe.

### 6.4 Maintenance sweep failures

**Symptoms:** `/api/admin/maintenance` shows a run with `state: "failed"` or
non-empty `errors` in `details`.

**Diagnose:**
- Admin UI: `GET /api/admin/maintenance` (requires `audit_log:read`
  permission — typically owner/admin roles).
- Inspect `details` JSON for per-sweep error messages.

**Fix:** Most sweeps retry on the next tick. For persistent errors, inspect
the specific sweep module in `artifacts/api-server/src/services/maintenance/`
and re-run manually:

```ts
// In a Node REPL attached to the running server process:
import { runMaintenanceSweeps } from "./services/maintenance";
await runMaintenanceSweeps({ feedUpdateRunning: false });
```

### 6.5 Advisory lock stuck

If a process crashed while holding the maintenance advisory lock, sweeps will
skip with "advisory lock held by another process". Postgres releases advisory
locks when the session disconnects, so reconnecting should clear it. If the
message persists:

```sql
SELECT pid, granted FROM pg_locks
  WHERE locktype = 'advisory' AND objid = 42040902;
SELECT pg_terminate_backend(<pid>);
```

### 6.6 Rate-limit triggered

**Endpoints and limits:**

| Scope                  | Window | Max |
|------------------------|--------|-----|
| All `/api`             | 15m    | 500 |
| Writes (news/exports)  | 15m    | 50  |
| Auth endpoints         | 15m    | 20  |
| Account deletion       | 60m    | 5   |
| Stripe webhook         | 60s    | 60  |

If a legitimate client is being rate-limited, inspect `x-request-id` in logs
to trace their pattern before widening limits. Limits are per-IP by default.

---

## 7. Secret Rotation

All secrets live in env vars loaded from `.env` (dev) or the orchestrator's
secret store (prod). To rotate:

1. Generate new value in the source of truth (Stripe dashboard, Sentry, etc.).
2. Update the deployment env var.
3. `kill -TERM` the API server — it drains HTTP for 10s, closes the DB pool,
   and exits cleanly. The orchestrator restarts it with the new secret.
4. For `API_KEY`: rotating invalidates all scheduled-write consumers — notify
   them first.
5. For `STRIPE_WEBHOOK_SECRET`: update in Stripe dashboard simultaneously.

Never commit secrets. The repo's `.gitignore` covers `.env*`.

---

## 8. Environment Variables (production)

Required:

- `DATABASE_URL`
- `SESSION_SECRET`
- `API_KEY` (server-to-server writes; warn if unset in prod)
- `CORS_ORIGINS` (comma-separated; warn if unset)

Strongly recommended:

- `SENTRY_DSN` (error tracking)
- `METRICS_TOKEN` (protect `/metrics` from public scrape)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY` (email OTP + receipts)

Optional knobs:

- `LOG_LEVEL` (default: info in prod, debug otherwise)
- `WORKSPACE_SOFT_DELETE=true` (enables soft-delete path for workspaces)
- `SOFT_DELETE_PURGE_DRY_RUN=true` (purge sweep logs instead of deletes)
- `AUDIT_LOG_RETENTION_ENABLED=true`, `AUDIT_LOG_RETENTION_DAYS=730`
- `SINGLE_TENANT=true` (bypasses auth; for on-prem single-user installs)

---

## 9. Deploy Checklist

Before a production deploy:

- [ ] `pnpm --filter @workspace/api-server typecheck` passes
- [ ] `pnpm --filter @workspace/api-server test` passes
- [ ] E2E matrix green on CI (`.github/workflows/ci.yml`)
- [ ] Migrations applied (`pnpm --filter @workspace/db migrate`)
- [ ] `SENTRY_DSN` configured for the target environment
- [ ] `METRICS_TOKEN` set (or `/metrics` network-isolated)
- [ ] Stripe webhook endpoint registered and `STRIPE_WEBHOOK_SECRET` rotated
- [ ] Run `/livez`, `/healthz`, `/readyz` post-deploy
- [ ] Scrape `/metrics` and confirm `http_requests_total` increments
