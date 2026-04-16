/**
 * Sentry initialisation for the API server.
 *
 * Call `initSentry()` as the very first line of the entry point (index.ts),
 * before any other imports, so that Sentry can instrument all modules.
 *
 * When SENTRY_DSN is absent the module becomes a no-op — on-prem and local
 * dev deployments work without a Sentry account.
 */

import * as Sentry from "@sentry/node";
import { logger } from "./logger";

let _initialised = false;

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.debug("Sentry DSN not set — error tracking disabled");
    return;
  }
  if (_initialised) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    // Sample 10 % of traces in production; 100 % everywhere else.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Attach the request handler automatically so req.user etc. is captured.
    integrations: [Sentry.httpIntegration()],
    // Never send PII by default.
    sendDefaultPii: false,
  });

  _initialised = true;
  logger.info("Sentry error tracking initialised");
}

/**
 * Capture an exception manually (e.g. in catch blocks where you want to
 * log to Sentry but continue execution rather than crash).
 */
export function captureException(
  err: unknown,
  context?: Record<string, unknown>
): void {
  if (!_initialised) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}

export { Sentry };
