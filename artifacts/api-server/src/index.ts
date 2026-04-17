// ─── Sentry MUST be initialised before any other module ──────────────────────
// Import and call initSentry() as the first executable statement so that
// Sentry can instrument all subsequently loaded modules.
import { initSentry } from "./lib/sentry";
initSentry();
// ─────────────────────────────────────────────────────────────────────────────

import http from "http";
import { WebSocketServer } from "ws";
import { timingSafeEqual } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env as early as possible (fallback for environments that don't use
// the --env-file flag, e.g. running tests directly).
config({ path: resolve(import.meta.dirname, "../../../.env") });

import { validateEnv } from "@workspace/config";
const env = validateEnv();

import app from "./app";
import { ensureMasterWorkspace } from "./services/workspaceService";
import { createFeedScheduler } from "./services/feedScheduler";
import { ensurePerformanceIndexes } from "./services/performanceIndexes";
import { setScheduler } from "./routes/scheduler";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { dbPoolTotal, dbPoolIdle, dbPoolWaiting } from "./lib/metrics";
import { captureException } from "./lib/sentry";

const { PORT: port } = env;

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

function broadcast(event: string, data: unknown): void {
  const msg = JSON.stringify({ type: event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client: { readyState: number; send: (data: string) => void }) => {
    if (client.readyState === 1) client.send(msg);
  });
}

const scheduler = createFeedScheduler(broadcast);
setScheduler(scheduler);

// Surface idle-client errors that would otherwise be swallowed silently
pool.on("error", (err: Error) => {
  logger.error({ err }, "Unexpected DB pool error on idle client");
});

// DB pool metrics — sample every 5s so Prometheus sees a live gauge.
const poolMetricsTimer = setInterval(() => {
  dbPoolTotal.set(pool.totalCount);
  dbPoolIdle.set(pool.idleCount);
  dbPoolWaiting.set(pool.waitingCount);
}, 5_000);
poolMetricsTimer.unref?.();

// WebSocket heartbeat to detect stale connections
const HEARTBEAT_INTERVAL = 30_000;
const heartbeatTimer = setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on("close", () => clearInterval(heartbeatTimer));

wss.on("connection", (ws: any, req: import("http").IncomingMessage) => {
  // Validate API key on WebSocket connect if configured
  const apiKey = env.API_KEY;
  if (apiKey) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const providedKey = url.searchParams.get("api_key") ?? req.headers["x-api-key"];
    if (
      !providedKey ||
      typeof providedKey !== "string" ||
      providedKey.length !== apiKey.length ||
      !timingSafeEqual(Buffer.from(providedKey), Buffer.from(apiKey))
    ) {
      ws.close(4001, "Unauthorized");
      return;
    }
  }

  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.send(
    JSON.stringify({
      type: "CONNECTED",
      data: {
        status: "connected",
        serverTime: new Date().toISOString(),
        nextUpdate: scheduler.getNextUpdateTime(),
      },
    })
  );
});

// Graceful shutdown — order matters:
//   1. Stop accepting new cron jobs / feed updates
//   2. Close WebSocket clients
//   3. Drain in-flight HTTP requests
//   4. End DB pool (only after HTTP drains so in-flight queries complete)
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down gracefully");

  scheduler.stop();
  clearInterval(heartbeatTimer);
  clearInterval(poolMetricsTimer);

  wss.clients.forEach((ws: any) => {
    ws.close(1001, "Server shutting down");
  });
  wss.close();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    setTimeout(() => {
      logger.warn("Graceful HTTP drain timed out — forcing close");
      resolve();
    }, 10_000);
  });

  await pool.end().catch((err: Error) => {
    logger.error({ err }, "Error closing DB pool");
  });

  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
// SIGHUP: log rotation signal — no action required but log it so it's visible
process.on("SIGHUP", () => logger.info("SIGHUP received — log rotation event"));

// Process-level safety net — log and escalate, but don't exit: letting the
// process keep running is safer than dropping every in-flight request because
// a single background promise rejected. Fatal corruption is caught by the
// container orchestrator via /livez.
process.on("unhandledRejection", (reason: unknown) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
  captureException(reason, { kind: "unhandledRejection" });
});
process.on("uncaughtException", (err: Error) => {
  logger.error({ err }, "Uncaught exception");
  captureException(err, { kind: "uncaughtException" });
});

ensureMasterWorkspace()
  .catch((err) => logger.error({ err }, "Failed to ensure master workspace"))
  .then(async () => {
    try {
      await ensurePerformanceIndexes();
    } catch (err) {
      logger.error({ err }, "Failed to ensure performance indexes");
    }

    scheduler.start();

    const isProd = env.NODE_ENV === "production";
    if (isProd && !env.API_KEY) {
      logger.warn("API_KEY not set — all write operations are unprotected");
    }
    if (isProd && !env.CORS_ORIGINS) {
      logger.warn("CORS_ORIGINS not set — requests from any origin are allowed");
    }
    if (isProd && !env.SENTRY_DSN) {
      logger.warn("SENTRY_DSN not set — error tracking is disabled");
    }

    server.listen(port, () => {
      logger.info(
        {
          port,
          nodeEnv: env.NODE_ENV,
          apiKeyConfigured: !!env.API_KEY,
          sentryEnabled: !!env.SENTRY_DSN,
          singleTenant: env.SINGLE_TENANT,
          corsOrigins: env.CORS_ORIGINS || "all (unrestricted)",
        },
        "Server startup complete"
      );
    });
  });
