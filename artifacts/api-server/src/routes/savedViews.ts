/**
 * Saved Views routes — user-pinned filter presets.
 *
 * Routes:
 *   GET    /api/saved-views         — list views for current user + page
 *   POST   /api/saved-views         — create a new saved view
 *   DELETE /api/saved-views/:id     — delete a saved view
 *
 * Requires authentication + pro plan (SAVED_VIEWS feature gate).
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { savedViewsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { asyncHandler } from "../middlewares/errorHandler";
import { requireAuth } from "../middlewares/tenantContext";
import { requireFeature } from "../middlewares/rbac";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/saved-views
// ---------------------------------------------------------------------------

router.get(
  "/saved-views",
  requireAuth,
  requireFeature("SAVED_VIEWS"),
  asyncHandler(async (req: Request, res: Response) => {
    const { page } = req.query as { page?: string };
    const ctx = req.ctx!;

    const views = await db
      .select()
      .from(savedViewsTable)
      .where(
        and(
          eq(savedViewsTable.orgId, ctx.orgId),
          eq(savedViewsTable.userId, ctx.userId),
          ...(page ? [eq(savedViewsTable.page, page)] : [])
        )
      )
      .orderBy(savedViewsTable.createdAt);

    res.json({ views });
  })
);

// ---------------------------------------------------------------------------
// POST /api/saved-views
// ---------------------------------------------------------------------------

const CreateBody = z.object({
  page: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  filters: z.record(z.unknown()).default({}),
});

router.post(
  "/saved-views",
  requireAuth,
  requireFeature("SAVED_VIEWS"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid body" });
      return;
    }

    const ctx = req.ctx!;
    const { page, name, filters } = parsed.data;

    const [view] = await db
      .insert(savedViewsTable)
      .values({ orgId: ctx.orgId, userId: ctx.userId, page, name, filters })
      .returning();

    res.status(201).json({ view });
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/saved-views/:id
// ---------------------------------------------------------------------------

router.delete(
  "/saved-views/:id",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const ctx = req.ctx!;

    const result = await db
      .delete(savedViewsTable)
      .where(
        and(
          eq(savedViewsTable.id, id),
          eq(savedViewsTable.orgId, ctx.orgId),
          eq(savedViewsTable.userId, ctx.userId)
        )
      )
      .returning({ id: savedViewsTable.id });

    if (result.length === 0) {
      res.status(404).json({ error: "Saved view not found" });
      return;
    }

    res.json({ success: true });
  })
);

export default router;
