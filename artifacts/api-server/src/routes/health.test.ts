import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { setScheduler } from "./scheduler";

vi.mock("@workspace/db", () => {
  const mockQuery = vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] });
  const mockRelease = vi.fn();
  const mockConnect = vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease });
  return {
    pool: { connect: mockConnect },
    db: {},
    __mockConnect: mockConnect,
  };
});

const { __mockConnect: mockConnect } = await import("@workspace/db") as unknown as {
  __mockConnect: ReturnType<typeof vi.fn>;
};

function installScheduler(totalRuns = 1) {
  setScheduler({
    getStatus: vi.fn(() => ({
      isRunning: false,
      lastRun: "2024-01-15T12:00:00.000Z",
      nextUpdate: "2024-01-15T12:15:00.000Z",
      stats: { totalRuns, successfulRuns: totalRuns, failedRuns: 0, lastError: null },
    })),
    triggerRefresh: vi.fn().mockResolvedValue(undefined),
    getNextUpdateTime: () => "2024-01-15T12:15:00.000Z",
    start: vi.fn(),
    stop: vi.fn(),
  });
}

describe("Health routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installScheduler();
  });

  describe("GET /api/healthz", () => {
    it("returns healthy when DB is connected", async () => {
      const res = await request(app).get("/api/healthz").expect(200);
      expect(res.body).toEqual({ status: "healthy", db: "connected" });
    });

    it("returns 503 when DB is down", async () => {
      mockConnect.mockRejectedValueOnce(new Error("connection refused"));
      const res = await request(app).get("/api/healthz").expect(503);
      expect(res.body.status).toBe("degraded");
      expect(res.body.db).toBe("disconnected");
      expect(res.body.error).toBe("connection refused");
    });
  });

  describe("GET /api/readyz", () => {
    it("returns ready when DB + scheduler are healthy", async () => {
      const res = await request(app).get("/api/readyz").expect(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.checks.db.ready).toBe(true);
      expect(res.body.checks.scheduler.ready).toBe(true);
    });

    it("returns 503 when DB is down", async () => {
      mockConnect.mockRejectedValueOnce(new Error("timeout"));
      const res = await request(app).get("/api/readyz").expect(503);
      expect(res.body.ready).toBe(false);
      expect(res.body.checks.db.ready).toBe(false);
    });

    it("returns 503 when scheduler has not completed any runs", async () => {
      installScheduler(0);
      const res = await request(app).get("/api/readyz").expect(503);
      expect(res.body.ready).toBe(false);
      expect(res.body.checks.scheduler.ready).toBe(false);
      expect(res.body.checks.scheduler.detail).toBe("no completed runs yet");
    });

    it("returns 503 when scheduler is not initialized", async () => {
      setScheduler(null as never);
      const res = await request(app).get("/api/readyz").expect(503);
      expect(res.body.ready).toBe(false);
      expect(res.body.checks.scheduler.ready).toBe(false);
    });
  });
});
