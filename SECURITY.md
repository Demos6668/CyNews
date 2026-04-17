# Security Policy

Thank you for helping keep CyNews secure. This policy describes how to report
vulnerabilities, what we consider in scope, and what you can expect from us
during the disclosure process.

## Supported Versions

Only the `main` branch is supported for security fixes. Tagged releases
receive back-ports for the most recent minor version.

| Version         | Supported |
|-----------------|-----------|
| `main`          | Yes       |
| Latest minor    | Yes       |
| Older minors    | No        |

## Reporting a Vulnerability

**Please do not file public GitHub issues for security problems.**

Email the maintainers at **security@cynews.local** (or the address published
in [/.well-known/security.txt](./artifacts/api-server/src/app.ts)). Encrypt
with GPG if the finding is sensitive — request the key in your first message
and we will respond with it.

Include:

- A description of the issue and its impact
- Reproduction steps (a proof-of-concept or curl recipe is ideal)
- Affected component (API server, SPA, feed aggregator, Docker image, etc.)
- Any relevant logs, stack traces, or HTTP traces — **redact tokens first**

You will receive an acknowledgement within **3 business days**. A status
update, including our assessment and an expected remediation timeline,
follows within **10 business days**.

## Scope

In scope:

- The API server (`artifacts/api-server`)
- The SPA (`artifacts/cyfy-news`)
- Background workers (feed-aggregator, scheduler, maintenance sweeps)
- Database migrations and row-level access patterns (`lib/db`)
- Published Docker images and deploy manifests
- Authentication, authorization, and multi-tenant isolation
- CSRF, XSS, SSRF, injection, and authz bypass

Out of scope:

- Third-party services we integrate with (Stripe, Resend, Sentry) — report
  directly to those vendors
- Denial-of-service and brute-force attacks that rely on overwhelming
  network capacity rather than exploiting a bug
- Self-XSS and social-engineering attacks
- Findings from automated scanners without a working exploit
- Missing security headers on endpoints that do not serve HTML
- Issues in outdated forks or unsupported versions

## Disclosure Timeline

- **Day 0** — Report received, tracking issue opened privately.
- **Day 3** — Initial acknowledgement and triage result.
- **Day 10** — Remediation plan and expected fix date.
- **Day ≤ 90** — Patch released for high/critical findings.
- **Day +7 (after patch)** — Coordinated public disclosure with credit.

We support coordinated disclosure and will credit reporters in release
notes unless they ask to remain anonymous.

## Our Commitments

- We will not pursue legal action against researchers who follow this
  policy in good faith.
- We will keep you informed of progress and consult you before publishing
  details that identify the reporter.
- We will work with you to agree on public wording if you plan to write
  about the issue.

## Safe Harbor

Research conducted consistent with this policy is considered authorized,
and we will not initiate or support legal action against you for
accidental, good-faith violations of the following:

- Accessing the minimum data necessary to demonstrate the issue.
- Stopping testing the moment you realize you can access data belonging
  to other users or tenants.
- Not exfiltrating, modifying, or destroying data.
- Not degrading service for other users.

## Security Practices

The codebase enforces several baseline practices:

- **Dependency audit** — `pnpm audit --prod --audit-level=high` gates CI.
- **Secret scanning** — gitleaks runs on every PR (see `.gitleaks.toml`).
- **Security headers** — CSP, HSTS, Permissions-Policy, Referrer-Policy
  configured in [`artifacts/api-server/src/app.ts`](./artifacts/api-server/src/app.ts).
- **Rate limits** — per-route limits on auth, writes, and account deletion
  (see the routing table in [`docs/RUNBOOK.md`](./docs/RUNBOOK.md)).
- **Sentry** — unhandled errors and background-job failures are captured
  without PII (`sendDefaultPii: false`).
- **Tenant isolation** — every data access goes through the tenant
  context middleware; `SINGLE_TENANT=true` is only for on-prem single-user
  deployments.

For operational incident handling, see
[`docs/RUNBOOK.md`](./docs/RUNBOOK.md).
