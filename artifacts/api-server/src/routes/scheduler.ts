import { Router, type IRouter, type Request, type Response } from "express";
import type { createFeedScheduler } from "../services/feedScheduler";

let schedulerInstance: ReturnType<typeof createFeedScheduler> | null = null;

export function setScheduler(scheduler: ReturnType<typeof createFeedScheduler>): void {
  schedulerInstance = scheduler;
}

const router: IRouter = Router();

router.get("/scheduler/status", (req: Request, res: Response) => {
  if (!schedulerInstance) {
    res.status(503).json({ error: "Scheduler not initialized" });
    return;
  }
  res.json(schedulerInstance.getStatus());
});

router.post("/scheduler/refresh", async (req: Request, res: Response) => {
  if (!schedulerInstance) {
    res.status(503).json({ error: "Scheduler not initialized" });
    return;
  }
  try {
    await schedulerInstance.triggerRefresh();
    res.json({ success: true, message: "Refresh triggered" });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Refresh failed" });
  }
});

export default router;
