import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const DB_CHECK_TIMEOUT_MS = 3_000;

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
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

    res.json({ status: "healthy", db: "connected" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(503).json({ status: "degraded", db: "disconnected", error: message });
  }
});

export default router;
