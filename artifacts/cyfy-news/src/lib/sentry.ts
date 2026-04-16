/**
 * Sentry initialisation for the CyNews React app.
 *
 * Call `initSentry()` at the very top of main.tsx, before ReactDOM.render,
 * so that Sentry wraps the entire component tree.
 *
 * When VITE_SENTRY_DSN is absent the function is a no-op — local dev and
 * on-prem installs work without a Sentry account.
 */

import * as Sentry from "@sentry/react";

let _initialised = false;

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  if (_initialised) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // 10 % of page-load traces in production; 100 % in dev/staging.
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Only record sessions that include an error.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Replay 0 % of all sessions, 100 % of sessions with an error.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });

  _initialised = true;
}

/**
 * Higher-order component that wraps a subtree in a Sentry error boundary.
 *
 * Usage:
 *   const SafeDashboard = withSentryErrorBoundary(Dashboard, {
 *     fallback: <ErrorFallback />,
 *   });
 */
export const withSentryErrorBoundary = Sentry.withErrorBoundary;

export { Sentry };
