/**
 * Feed Scheduler - Runs feed aggregator every 15 minutes, broadcasts via WebSocket.
 */

import cron from "node-cron";
import { runFeedUpdate, type OnBroadcast } from "@workspace/feed-aggregator";
import { logger } from "../lib/logger";
import { apiCache } from "../lib/cache";

export interface SchedulerStatus {
  isRunning: boolean;
  lastRun: string | null;
  nextUpdate: string;
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
      logger.warn("Previous update still running, skipping");
      return;
    }
    isRunning = true;
    stats.totalRuns++;
    const start = Date.now();
    logger.info("Feed update started");

    try {
      await runFeedUpdate(onBroadcast);
      lastRun = new Date();
      stats.successfulRuns++;
      stats.lastError = null;
      apiCache.invalidate();
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      logger.info({ duration }, "Feed update complete");
    } catch (err) {
      stats.failedRuns++;
      stats.lastError = err instanceof Error ? err.message : String(err);
      logger.error({ error: stats.lastError }, "Feed update failed");
      broadcast("REFRESH_ERROR", {
        timestamp: new Date().toISOString(),
        error: stats.lastError,
      });
    } finally {
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
    return {
      isRunning,
      lastRun: lastRun?.toISOString() ?? null,
      nextUpdate: getNextUpdateTime(),
      stats: { ...stats },
    };
  }

  let cronTask: cron.ScheduledTask | null = null;

  function start(): void {
    logger.info("Scheduler starting - updates every 15 minutes");
    runFeedUpdateTask().catch((err) => logger.error({ err }, "Feed update task failed"));
    cronTask = cron.schedule("*/15 * * * *", () => runFeedUpdateTask().catch((err) => logger.error({ err }, "Feed update task failed")));
    logger.info("Scheduler started");
  }

  function stop(): void {
    cronTask?.stop();
    cronTask = null;
    logger.info("Scheduler stopped");
  }

  function triggerRefresh(): Promise<void> {
    return runFeedUpdateTask();
  }

  return { start, stop, getStatus, getNextUpdateTime, triggerRefresh };
}
