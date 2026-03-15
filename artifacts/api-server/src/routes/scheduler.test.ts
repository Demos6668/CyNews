import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { setScheduler } from "./scheduler";

const mockGetStatus = vi.fn(() => ({
  isRunning: false,
  lastRun: "2024-01-15T12:00:00.000Z",
  nextUpdate: "2024-01-15T12:15:00.000Z",
  stats: { totalRuns: 1, successfulRuns: 1, failedRuns: 0, lastError: null },
}));
const mockTriggerRefresh = vi.fn().mockResolvedValue(undefined);

describe("Scheduler routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setScheduler({
      getStatus: mockGetStatus,
      triggerRefresh: mockTriggerRefresh,
      getNextUpdateTime: () => "2024-01-15T12:15:00.000Z",
      start: vi.fn(),
    });
  });

  describe("GET /api/scheduler/status", () => {
    it("returns scheduler status when initialized", async () => {
      const res = await request(app).get("/api/scheduler/status").expect(200);
      expect(res.body).toHaveProperty("isRunning", false);
      expect(res.body).toHaveProperty("lastRun");
      expect(res.body).toHaveProperty("nextUpdate");
      expect(res.body).toHaveProperty("stats");
      expect(mockGetStatus).toHaveBeenCalled();
    });
  });

  describe("POST /api/scheduler/refresh", () => {
    it("triggers refresh and returns success", async () => {
      const res = await request(app).post("/api/scheduler/refresh").expect(200);
      expect(res.body).toEqual({ success: true, message: "Refresh triggered" });
      expect(mockTriggerRefresh).toHaveBeenCalled();
    });
  });
});
