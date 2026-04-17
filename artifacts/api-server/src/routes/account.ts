/**
 * Account self-service routes.
 *
 * DELETE /api/account          — Schedule GDPR erasure (30-day grace period)
 * POST   /api/account/delete/cancel — Cancel a pending deletion request
 * GET    /api/account/export    — GDPR Art. 20 data portability (rate-limited)
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import {
  deleteRequestsTable,
  bookmarksTable,
  savedViewsTable,
  auditLogTable,
} from "@workspace/db/schema";
import { requireAuth } from "../middlewares/tenantContext";
import { asyncHandler } from "../middlewares/errorHandler";
import { scheduleSoftDelete, cancelSoftDelete } from "../services/softDelete";
import { z } from "zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CancelBody = z.object({ requestId: z.string() });

/**
 * DELETE /api/account
 *
 * Schedules a soft-delete of the calling user's account.
 * - Sets user.deletedAt and user.purgeAfter (30 days).
 * - Creates a delete_requests row in "pending" state.
 * - Revokes all active sessions for the user (forces sign-out everywhere).
 *
 * Requires: authenticated session.
 * Rate limit: 5 requests/hour (configured in app.ts).
 */
router.delete(
  "/account",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.ctx!;

    const result = await scheduleSoftDelete({
      subjectType: "user",
      subjectId: userId,
      requestedBy: userId,
      graceDays: 30,
      reason: "user-initiated deletion",
    });

    // Revoke all sessions — force sign-out on all devices
    const client = await pool.connect();
    try {
      await client.query(`DELETE FROM session WHERE user_id = $1`, [userId]);
    } finally {
      client.release();
    }

    logger.info({ userId, requestId: result.requestId }, "Account deletion scheduled");

    res.json({
      requestId: result.requestId,
      confirmAfter: result.confirmAfter.toISOString(),
      purgeAfter: result.purgeAfter.toISOString(),
      message: "Account deletion scheduled. You have 30 days to cancel.",
    });
  })
);

/**
 * POST /api/account/delete/cancel
 *
 * Cancels a pending account deletion request during the grace period.
 */
router.post(
  "/account/delete/cancel",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CancelBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "requestId is required" });
      return;
    }

    const { userId } = req.ctx!;

    // Verify the request belongs to this user before cancelling
    const [deletionReq] = await db
      .select({ requestedBy: deleteRequestsTable.requestedBy })
      .from(deleteRequestsTable)
      .where(eq(deleteRequestsTable.id, parsed.data.requestId))
      .limit(1);

    if (!deletionReq || deletionReq.requestedBy !== userId) {
      res.status(404).json({ error: "Deletion request not found" });
      return;
    }

    await cancelSoftDelete(parsed.data.requestId, userId);

    res.json({ cancelled: true });
  })
);

/**
 * GET /api/account/export
 *
 * Returns a JSON package of all user-owned data for GDPR Art. 20 portability.
 * Includes: bookmarks, saved views, audit log entries.
 */
router.get(
  "/account/export",
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, orgId } = req.ctx!;

    const [bookmarks, savedViews, auditEntries] = await Promise.all([
      db.select().from(bookmarksTable).where(
        and(eq(bookmarksTable.userId, userId), eq(bookmarksTable.orgId, orgId))
      ),
      db.select().from(savedViewsTable).where(
        and(eq(savedViewsTable.userId, userId), eq(savedViewsTable.orgId, orgId))
      ),
      db.select({
        action: auditLogTable.action,
        createdAt: auditLogTable.createdAt,
      }).from(auditLogTable).where(
        and(eq(auditLogTable.userId, userId), eq(auditLogTable.orgId, orgId))
      ),
    ]);

    res.setHeader("Content-Disposition", `attachment; filename="cyfy-data-export.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
      userId,
      bookmarks: bookmarks.map((b) => ({ newsItemId: b.newsItemId, createdAt: b.createdAt })),
      savedViews: savedViews.map((sv) => ({ page: sv.page, name: sv.name, filters: sv.filters, createdAt: sv.createdAt })),
      auditLog: auditEntries.map((e) => ({ action: e.action, at: e.createdAt })),
    });
  })
);

export default router;
