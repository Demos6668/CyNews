/**
 * RBAC and feature-gate middleware.
 *
 * Usage in route files:
 *
 *   router.patch(
 *     "/advisories/:id/patch-status",
 *     requirePermission("advisory:update_status"),
 *     requireFeature("ADVISORY_PATCH_STATUS_UPDATE"),
 *     asyncHandler(handler)
 *   );
 */

import type { Request, Response, NextFunction } from "express";
import { can, type Action } from "../lib/permissions";
import {
  tierAtLeast,
  buildUpgradePayload,
  type FeatureKey,
  FEATURE_GATES,
} from "../lib/plans";

// ---------------------------------------------------------------------------
// requirePermission — RBAC gate
// ---------------------------------------------------------------------------

/**
 * Returns a middleware that rejects with 403 when the current user's role
 * is below the minimum required for `action`.
 *
 * Must be placed AFTER `requireAuth` / `tenantContext` in the middleware chain.
 */
export function requirePermission(
  action: Action
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.ctx) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!can(req.ctx.role, action)) {
      res
        .status(403)
        .json({ error: `Role "${req.ctx.role}" cannot perform "${action}"` });
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// requireFeature — billing / plan gate
// ---------------------------------------------------------------------------

/**
 * Returns a middleware that rejects with 402 when the current org's plan
 * does not include `feature`.
 *
 * Must be placed AFTER `requireAuth` / `tenantContext` in the middleware chain.
 */
export function requireFeature(
  feature: FeatureKey
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.ctx) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const required = FEATURE_GATES[feature];

    // null gate = always available
    if (required === null) { next(); return; }

    if (!tierAtLeast(req.ctx.plan, required)) {
      const payload = buildUpgradePayload(
        feature,
        req.ctx.plan,
        process.env.FRONTEND_URL
      );
      res.status(402).json(payload);
      return;
    }

    next();
  };
}
