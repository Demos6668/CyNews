/**
 * Tenant context middleware.
 *
 * Reads the Bearer token from the Authorization header (or the Better Auth
 * session cookie), validates it against the `session` table, resolves the
 * user's active membership, and attaches `req.ctx` to the request object.
 *
 * On failure:
 *  - 401 if no valid session token
 *  - 403 if the user has no membership in the target org
 *
 * SINGLE_TENANT shortcut:
 *  When process.env.SINGLE_TENANT === "true", the middleware attaches a
 *  synthetic context using the DEFAULT_ORG_ID with owner-level access so
 *  that on-prem installs work without any auth at all.
 *
 * This middleware is applied to all /api routes in Sub-Phase 4 (app.ts).
 * The legacy `writeAuth` (API-key) guard remains only for /api/scheduler.
 */

import type { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { sessionsTable, membershipsTable } from "@workspace/db/schema";
import type { Role } from "../lib/permissions";
import type { PlanTier } from "../lib/plans";

// The synthetic org ID used for on-prem / SINGLE_TENANT mode.
export const DEFAULT_ORG_ID = "org_default_000000000000";

// ---------------------------------------------------------------------------
// Type augmentation — adds req.ctx to the Express Request interface
// ---------------------------------------------------------------------------

export interface TenantContext {
  userId: string;
  orgId: string;
  role: Role;
  plan: PlanTier;
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: TenantContext;
    }
  }
}

// ---------------------------------------------------------------------------
// Helper — extract session token from request
// ---------------------------------------------------------------------------

function extractToken(req: Request): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || null;
  }
  // 2. better-auth session cookie (cookie name is `better-auth.session_token`)
  const cookieHeader = req.headers.cookie ?? "";
  const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
  if (match?.[1]) return decodeURIComponent(match[1]);

  return null;
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Returns an Express middleware that attaches `req.ctx`.
 *
 * @param options.optional  When true, missing / invalid tokens are allowed —
 *                          req.ctx will be undefined but the request continues.
 *                          Use for public endpoints that optionally show
 *                          personalised data when logged in.
 */
export function tenantContext(
  options: { optional?: boolean } = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // ── SINGLE_TENANT shortcut ────────────────────────────────────────────
    if (process.env.SINGLE_TENANT === "true") {
      req.ctx = {
        userId: "system",
        orgId: DEFAULT_ORG_ID,
        role: "owner",
        plan: "enterprise",
        sessionId: "single-tenant",
      };
      next();
      return;
    }

    const token = extractToken(req);

    if (!token) {
      if (options.optional) { next(); return; }
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // ── Validate session ──────────────────────────────────────────────────
    const now = new Date();
    const [session] = await db
      .select({
        id:        sessionsTable.id,
        userId:    sessionsTable.userId,
        expiresAt: sessionsTable.expiresAt,
      })
      .from(sessionsTable)
      .where(eq(sessionsTable.token, token))
      .limit(1);

    if (!session || session.expiresAt < now) {
      if (options.optional) { next(); return; }
      res.status(401).json({ error: "Session expired or invalid" });
      return;
    }

    // ── Resolve org context ───────────────────────────────────────────────
    // For Phase 1 each user belongs to exactly one org.
    // Phase 2 will add an org-switcher; the active org will be passed as a
    // header or query param and looked up from the user's memberships.
    const [membership] = await db
      .select({
        orgId: membershipsTable.orgId,
        role:  membershipsTable.role,
      })
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.userId, session.userId),
          // joinedAt IS NOT NULL filters out pending invitations
        )
      )
      .orderBy(membershipsTable.createdAt) // first membership = primary org
      .limit(1);

    if (!membership) {
      if (options.optional) { next(); return; }
      res.status(403).json({ error: "No organisation membership found" });
      return;
    }

    // ── Resolve plan tier from org ────────────────────────────────────────
    // Import is done here (not at the top) to avoid circular deps while
    // organisations module is being fleshed out.
    const { organizationsTable } = await import("@workspace/db/schema");
    const [org] = await db
      .select({ plan: organizationsTable.plan })
      .from(organizationsTable)
      .where(eq(organizationsTable.id, membership.orgId))
      .limit(1);

    req.ctx = {
      userId:    session.userId,
      orgId:     membership.orgId,
      role:      membership.role as Role,
      plan:      (org?.plan ?? "free") as PlanTier,
      sessionId: session.id,
    };

    next();
  };
}

// ---------------------------------------------------------------------------
// Shorthand middlewares
// ---------------------------------------------------------------------------

/** Require a valid authenticated session (returns 401 otherwise). */
export const requireAuth = tenantContext({ optional: false });

/** Attach context if logged in; continue as anonymous otherwise. */
export const optionalAuth = tenantContext({ optional: true });
