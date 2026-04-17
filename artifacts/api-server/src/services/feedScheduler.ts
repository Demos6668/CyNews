/**
 * Feed Scheduler - Runs feed aggregator every 15 minutes, broadcasts via WebSocket.
 */

import cron from "node-cron";
import { runFeedUpdate, type OnBroadcast } from "@workspace/feed-aggregator";
import { logger } from "../lib/logger";
import { apiCache } from "../lib/cache";
import {
  getRetentionMaintenanceStatus,
  hydrateRetentionMaintenanceStatus,
  runRetentionMaintenance,
} from "./dataRetention";
import { runMaintenanceSweeps } from "./maintenance";
import { jobDuration, jobRunsTotal } from "../lib/metrics";
import { captureException } from "../lib/sentry";

export interface SchedulerStatus {
  isRunning: boolean;
  lastRun: string | null;
  nextUpdate: string;
  lastArchiveRun?: string | null;
  lastPurgeRun?: string | null;
  archivedRows?: number;
  purgedRows?: number;
  maintenanceState?: "idle" | "running" | "skipped" | "failed";
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastError: string | null;
  };
}

export type BroadcastFn = (event: string, data: unknown) => void;

export function createFeedScheduler(broadcast: BroadcastFn) {
  let isRunning = false;
  let lastRun: Date | null = null;
  const stats = { totalRuns: 0, successfulRuns: 0, failedRuns: 0, lastError: null as string | null };

  const onBroadcast: OnBroadcast = (event, data) => {
    broadcast(event, data);
  };

  async function runFeedUpdateTask(): Promise<void> {
    if (isRunning) {
      jobRunsTotal.inc({ job: "feed-update", outcome: "skipped" });
      logger.warn("Previous update still running, skipping");
      return;
    }
    isRunning = true;
    stats.totalRuns++;
    const start = Date.now();
    const endTimer = jobDuration.startTimer({ job: "feed-update" });
    logger.info("Feed update started");

    try {
      await runFeedUpdate(onBroadcast);
      lastRun = new Date();
      stats.successfulRuns++;
      stats.lastError = null;
      apiCache.invalidate("news:");
      apiCache.invalidate("threats:");
      apiCache.invalidate("dashboard:");
      apiCache.invalidate("search:");
      apiCache.invalidate("advisories:");
      apiCache.invalidate("certin:");
      apiCache.invalidate("patches:");
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      jobRunsTotal.inc({ job: "feed-update", outcome: "success" });
      logger.info({ duration }, "Feed update complete");
    } catch (err) {
      stats.failedRuns++;
      stats.lastError = err instanceof Error ? err.message : String(err);
      jobRunsTotal.inc({ job: "feed-update", outcome: "failure" });
      logger.error({ error: stats.lastError }, "Feed update failed");
      captureException(err, { job: "feed-update" });
      broadcast("REFRESH_ERROR", {
        timestamp: new Date().toISOString(),
        error: stats.lastError,
      });
    } finally {
      endTimer();
      isRunning = false;
    }
  }

  function getNextUpdateTime(): string {
    const now = new Date();
    const min = now.getMinutes();
    const nextQuarter = Math.ceil((min + 1) / 15) * 15;
    const next = new Date(now);
    next.setMinutes(nextQuarter, 0, 0);
    if (next <= now) next.setMinutes(next.getMinutes() + 15);
    return next.toISOString();
  }

  function getStatus(): SchedulerStatus {
    const maintenance = getRetentionMaintenanceStatus();
    return {
      isRunning,
      lastRun: lastRun?.toISOString() ?? null,
      nextUpdate: getNextUpdateTime(),
      lastArchiveRun: maintenance.lastArchiveRun,
      lastPurgeRun: maintenance.lastPurgeRun,
      archivedRows: maintenance.archivedRows,
      purgedRows: maintenance.purgedRows,
      maintenanceState: maintenance.maintenanceState,
      stats: { ...stats },
    };
  }

  let feedCron: cron.ScheduledTask | null = null;
  let retentionCron: cron.ScheduledTask | null = null;
  let maintenanceCron: cron.ScheduledTask | null = null;

  function start(): void {
    logger.info("Scheduler starting - feed updates every 15 minutes, retention daily at 03:00, GC sweeps daily at 04:00");
    hydrateRetentionMaintenanceStatus().catch((err) =>
      logger.warn({ err }, "Unable to hydrate retention maintenance status"),
    );
    runFeedUpdateTask().catch((err) => logger.error({ err }, "Feed update task failed"));
    feedCron = cron.schedule("*/15 * * * *", () => runFeedUpdateTask().catch((err) => logger.error({ err }, "Feed update task failed")));
    retentionCron = cron.schedule("0 3 * * *", () =>
      runRetentionMaintenance({ feedUpdateRunning: isRunning }).catch((err) =>
        logger.error({ err }, "Data retention task failed"),
      ),
    );
    maintenanceCron = cron.schedule("0 4 * * *", () =>
      runMaintenanceSweeps({ feedUpdateRunning: isRunning }).catch((err) =>
        logger.error({ err }, "Maintenance sweeps failed"),
      ),
    );
    logger.info("Scheduler started");
  }

  function stop(): void {
    feedCron?.stop();
    feedCron = null;
    retentionCron?.stop();
    retentionCron = null;
    maintenanceCron?.stop();
    maintenanceCron = null;
    logger.info("Scheduler stopped");
  }

  function triggerRefresh(): Promise<void> {
    return runFeedUpdateTask();
  }

  return { start, stop, getStatus, getNextUpdateTime, triggerRefresh };
}
