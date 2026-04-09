import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRunFeedUpdate = vi.fn();
const mockRunRetentionMaintenance = vi.fn();
const mockHydrateRetentionMaintenanceStatus = vi.fn();
const mockGetRetentionMaintenanceStatus = vi.fn(() => ({
  lastArchiveRun: null,
  lastPurgeRun: null,
  archivedRows: 0,
  purgedRows: 0,
  maintenanceState: "idle",
  lastMaintenanceError: null,
}));
const mockSchedule = vi.fn();
const mockStop = vi.fn();

vi.mock("@workspace/feed-aggregator", () => ({
  runFeedUpdate: (...args: unknown[]) => mockRunFeedUpdate(...args),
}));

vi.mock("./dataRetention", () => ({
  runRetentionMaintenance: (...args: unknown[]) => mockRunRetentionMaintenance(...args),
  hydrateRetentionMaintenanceStatus: (...args: unknown[]) => mockHydrateRetentionMaintenanceStatus(...args),
  getRetentionMaintenanceStatus: () => mockGetRetentionMaintenanceStatus(),
}));

vi.mock("node-cron", () => ({
  default: {
    schedule: (...args: unknown[]) => {
      mockSchedule(...args);
      return { stop: mockStop };
    },
  },
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../lib/cache", () => ({
  apiCache: {
    invalidate: vi.fn(),
  },
}));

import { createFeedScheduler } from "./feedScheduler";

describe("feedScheduler", () => {
  let broadcast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:07:00Z"));
    broadcast = vi.fn();
    mockRunFeedUpdate.mockResolvedValue(undefined);
    mockRunRetentionMaintenance.mockResolvedValue({
      archivedRows: 0,
      purgedRows: 0,
      mode: "archival",
      skipped: false,
    });
    mockHydrateRetentionMaintenanceStatus.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createFeedScheduler", () => {
    it("returns an object with all expected methods", () => {
      const scheduler = createFeedScheduler(broadcast);

      expect(scheduler).toHaveProperty("start");
      expect(scheduler).toHaveProperty("stop");
      expect(scheduler).toHaveProperty("getStatus");
      expect(scheduler).toHaveProperty("getNextUpdateTime");
      expect(scheduler).toHaveProperty("triggerRefresh");
      expect(typeof scheduler.start).toBe("function");
      expect(typeof scheduler.stop).toBe("function");
      expect(typeof scheduler.getStatus).toBe("function");
      expect(typeof scheduler.getNextUpdateTime).toBe("function");
      expect(typeof scheduler.triggerRefresh).toBe("function");
    });
  });

  describe("getStatus", () => {
    it("returns initial status with zero stats", () => {
      const scheduler = createFeedScheduler(broadcast);
      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: false,
        lastRun: null,
        nextUpdate: expect.any(String),
        lastArchiveRun: null,
        lastPurgeRun: null,
        archivedRows: 0,
        purgedRows: 0,
        maintenanceState: "idle",
        stats: {
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          lastError: null,
        },
      });
    });

    it("returns a copy of stats (not a reference)", () => {
      const scheduler = createFeedScheduler(broadcast);
      const status1 = scheduler.getStatus();
      const status2 = scheduler.getStatus();

      expect(status1.stats).not.toBe(status2.stats);
      expect(status1.stats).toEqual(status2.stats);
    });
  });

  describe("getNextUpdateTime", () => {
    it("returns a valid ISO string", () => {
      const scheduler = createFeedScheduler(broadcast);
      const next = scheduler.getNextUpdateTime();

      expect(() => new Date(next)).not.toThrow();
      expect(new Date(next).toISOString()).toBe(next);
    });

    it("returns a time on a 15-minute boundary", () => {
      const scheduler = createFeedScheduler(broadcast);
      const next = scheduler.getNextUpdateTime();
      const minutes = new Date(next).getMinutes();

      expect(minutes % 15).toBe(0);
    });

    it("returns a future time", () => {
      const scheduler = createFeedScheduler(broadcast);
      const next = scheduler.getNextUpdateTime();
      const now = new Date("2025-06-15T12:07:00Z");

      expect(new Date(next).getTime()).toBeGreaterThan(now.getTime());
    });

    it("returns a time within the next 15 minutes", () => {
      const scheduler = createFeedScheduler(broadcast);
      const next = scheduler.getNextUpdateTime();
      const now = new Date("2025-06-15T12:07:00Z");
      const diff = new Date(next).getTime() - now.getTime();

      // Should be within 0-15 minutes from now
      expect(diff).toBeGreaterThan(0);
      expect(diff).toBeLessThanOrEqual(15 * 60 * 1000);
    });
  });

  describe("triggerRefresh", () => {
    it("calls runFeedUpdate and resolves on success", async () => {
      const scheduler = createFeedScheduler(broadcast);

      await scheduler.triggerRefresh();

      expect(mockRunFeedUpdate).toHaveBeenCalledTimes(1);
    });

    it("passes broadcast callback to runFeedUpdate", async () => {
      const scheduler = createFeedScheduler(broadcast);

      await scheduler.triggerRefresh();

      // The onBroadcast function wraps the broadcast callback
      const onBroadcast = mockRunFeedUpdate.mock.calls[0][0];
      expect(typeof onBroadcast).toBe("function");

      // Verify the wrapper forwards to the original broadcast
      onBroadcast("TEST_EVENT", { data: 1 });
      expect(broadcast).toHaveBeenCalledWith("TEST_EVENT", { data: 1 });
    });

    it("updates stats on success", async () => {
      const scheduler = createFeedScheduler(broadcast);

      await scheduler.triggerRefresh();

      const status = scheduler.getStatus();
      expect(status.stats.totalRuns).toBe(1);
      expect(status.stats.successfulRuns).toBe(1);
      expect(status.stats.failedRuns).toBe(0);
      expect(status.stats.lastError).toBeNull();
      expect(status.lastRun).not.toBeNull();
    });

    it("updates stats on failure", async () => {
      mockRunFeedUpdate.mockRejectedValueOnce(new Error("network failure"));
      const scheduler = createFeedScheduler(broadcast);

      await scheduler.triggerRefresh();

      const status = scheduler.getStatus();
      expect(status.stats.totalRuns).toBe(1);
      expect(status.stats.successfulRuns).toBe(0);
      expect(status.stats.failedRuns).toBe(1);
      expect(status.stats.lastError).toBe("network failure");
      expect(status.lastRun).toBeNull();
    });

    it("broadcasts REFRESH_ERROR on failure", async () => {
      mockRunFeedUpdate.mockRejectedValueOnce(new Error("timeout"));
      const scheduler = createFeedScheduler(broadcast);

      await scheduler.triggerRefresh();

      expect(broadcast).toHaveBeenCalledWith("REFRESH_ERROR", {
        timestamp: expect.any(String),
        error: "timeout",
      });
    });

    it("clears lastError on subsequent success", async () => {
      mockRunFeedUpdate.mockRejectedValueOnce(new Error("fail"));
      const scheduler = createFeedScheduler(broadcast);

      await scheduler.triggerRefresh(); // fails
      expect(scheduler.getStatus().stats.lastError).toBe("fail");

      mockRunFeedUpdate.mockResolvedValueOnce(undefined);
      await scheduler.triggerRefresh(); // succeeds
      expect(scheduler.getStatus().stats.lastError).toBeNull();
      expect(scheduler.getStatus().stats.successfulRuns).toBe(1);
      expect(scheduler.getStatus().stats.failedRuns).toBe(1);
      expect(scheduler.getStatus().stats.totalRuns).toBe(2);
    });

    it("skips if already running (overlap prevention)", async () => {
      // Make runFeedUpdate hang until we resolve it
      let resolveUpdate!: () => void;
      mockRunFeedUpdate.mockImplementationOnce(
        () => new Promise<void>((resolve) => { resolveUpdate = resolve; }),
      );

      const scheduler = createFeedScheduler(broadcast);

      // Start first refresh (will hang)
      const first = scheduler.triggerRefresh();
      expect(scheduler.getStatus().isRunning).toBe(true);

      // Start second refresh (should be skipped)
      await scheduler.triggerRefresh();
      expect(mockRunFeedUpdate).toHaveBeenCalledTimes(1);

      // Resolve the first one
      resolveUpdate();
      await first;
      expect(scheduler.getStatus().isRunning).toBe(false);
    });

    it("handles non-Error throw gracefully", async () => {
      mockRunFeedUpdate.mockRejectedValueOnce("string error");
      const scheduler = createFeedScheduler(broadcast);

      await scheduler.triggerRefresh();

      expect(scheduler.getStatus().stats.lastError).toBe("string error");
    });
  });

  describe("start", () => {
    it("schedules feed cron every 15 minutes", () => {
      const scheduler = createFeedScheduler(broadcast);
      scheduler.start();

      expect(mockSchedule).toHaveBeenCalledWith(
        "*/15 * * * *",
        expect.any(Function),
      );
    });

    it("schedules retention cron daily at 03:00", () => {
      const scheduler = createFeedScheduler(broadcast);
      scheduler.start();

      expect(mockSchedule).toHaveBeenCalledWith(
        "0 3 * * *",
        expect.any(Function),
      );
    });

    it("retention cron calls the maintenance runner", async () => {
      const scheduler = createFeedScheduler(broadcast);
      scheduler.start();

      const retentionCall = mockSchedule.mock.calls.find((call) => call[0] === "0 3 * * *");
      expect(retentionCall).toBeTruthy();

      const retentionHandler = retentionCall?.[1];
      await retentionHandler();

      expect(mockRunRetentionMaintenance).toHaveBeenCalledWith({ feedUpdateRunning: true });
    });

    it("triggers an immediate feed update on start", () => {
      const scheduler = createFeedScheduler(broadcast);
      scheduler.start();

      // runFeedUpdate is called immediately (not just scheduled)
      expect(mockRunFeedUpdate).toHaveBeenCalledTimes(1);
    });

    it("hydrates maintenance status on start", () => {
      const scheduler = createFeedScheduler(broadcast);
      scheduler.start();

      expect(mockHydrateRetentionMaintenanceStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe("stop", () => {
    it("stops both cron tasks", () => {
      const scheduler = createFeedScheduler(broadcast);
      scheduler.start();
      scheduler.stop();

      // Two crons were created, both should be stopped
      expect(mockStop).toHaveBeenCalledTimes(2);
    });

    it("is safe to call without start", () => {
      const scheduler = createFeedScheduler(broadcast);

      expect(() => scheduler.stop()).not.toThrow();
    });
  });
});
