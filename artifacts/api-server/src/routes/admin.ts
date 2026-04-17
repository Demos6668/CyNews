/**
 * Admin-only routes — accessible only to workspace owners.
 *
 * GET /api/admin/maintenance  — Last 20 maintenance runs per job type.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { maintenanceRunsTable } from "@workspace/db/schema";
import { desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/tenantContext";
import { requirePermission } from "../middlewares/rbac";
import { asyncHandler } from "../middlewares/errorHandler";

const router: IRouter = Router();

router.get(
  "/admin/maintenance",
  requireAuth,
  requirePermission("audit_log:read"),
  asyncHandler(async (_req: Request, res: Response) => {
    const runs = await db
      .select()
      .from(maintenanceRunsTable)
      .orderBy(desc(maintenanceRunsTable.startedAt))
      .limit(40);

    res.json({ runs });
  })
);

export default router;
