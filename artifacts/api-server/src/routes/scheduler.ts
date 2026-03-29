import { Router, type IRouter, type Request, type Response } from "express";
import type { createFeedScheduler } from "../services/feedScheduler";
import { asyncHandler } from "../middlewares/errorHandler";

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

router.post("/scheduler/refresh", asyncHandler(async (req: Request, res: Response) => {
  if (!schedulerInstance) {
    res.status(503).json({ error: "Scheduler not initialized" });
    return;
  }
  await schedulerInstance.triggerRefresh();
  res.json({ success: true, message: "Refresh triggered" });
}));

export default router;
