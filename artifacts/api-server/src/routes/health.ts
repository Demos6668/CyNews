import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { getScheduler } from "./scheduler";

const DB_CHECK_TIMEOUT_MS = 3_000;

async function checkDb(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await Promise.race([
      pool.connect(),
      new Promise<never>((_resolve, reject) =>
        setTimeout(() => reject(new Error("DB connection timed out")), DB_CHECK_TIMEOUT_MS),
      ),
    ]);
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const db = await checkDb();
  if (db.ok) {
    res.json({ status: "healthy", db: "connected" });
  } else {
    res.status(503).json({ status: "degraded", db: "disconnected", error: db.error });
  }
});

router.get("/readyz", async (_req, res) => {
  const checks: Record<string, { ready: boolean; detail?: string }> = {};

  const db = await checkDb();
  checks.db = db.ok ? { ready: true } : { ready: false, detail: db.error };

  const scheduler = getScheduler();
  if (!scheduler) {
    checks.scheduler = { ready: false, detail: "not initialized" };
  } else {
    const status = scheduler.getStatus();
    const hasRun = status.stats.totalRuns > 0;
    checks.scheduler = hasRun
      ? { ready: true, detail: `${status.stats.totalRuns} runs completed` }
      : { ready: false, detail: "no completed runs yet" };
  }

  const allReady = Object.values(checks).every((c) => c.ready);
  res.status(allReady ? 200 : 503).json({ ready: allReady, checks });
});

export default router;
