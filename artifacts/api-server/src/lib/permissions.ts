/**
 * RBAC permission matrix.
 *
 * Every action that a user can perform within an org is listed here. Route
 * handlers call `requirePermission(req, "ACTION")` which reads `req.ctx.role`
 * (set by the tenant context middleware in Sub-Phase 4) and checks it against
 * this matrix.
 *
 * Role hierarchy (ascending privilege):
 *   viewer → analyst → admin → owner
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = "owner" | "admin" | "analyst" | "viewer";

/** Ordered list — used for comparisons like "admin or above" */
export const ROLE_ORDER: readonly Role[] = [
  "viewer",
  "analyst",
  "admin",
  "owner",
] as const;

/**
 * All actions that can be gated by role.
 *
 * Naming convention: RESOURCE_VERB
 */
export type Action =
  // Advisory management
  | "advisory:read"
  | "advisory:update_status"
  | "advisory:export"

  // News
  | "news:read"
  | "news:bookmark"

  // Threat intel
  | "threat:read"
  | "threat:export"

  // Workspaces
  | "workspace:read"
  | "workspace:create"
  | "workspace:update"
  | "workspace:delete"

  // Org management
  | "org:read"
  | "org:update"
  | "org:delete"

  // Members
  | "member:read"
  | "member:invite"
  | "member:update_role"
  | "member:remove"

  // Saved views
  | "saved_view:read"
  | "saved_view:create"
  | "saved_view:update"
  | "saved_view:delete"

  // Alert rules
  | "alert_rule:read"
  | "alert_rule:create"
  | "alert_rule:update"
  | "alert_rule:delete"

  // API keys
  | "api_key:read"
  | "api_key:create"
  | "api_key:revoke"

  // Billing
  | "billing:read"
  | "billing:manage"

  // Audit log
  | "audit_log:read";

// ---------------------------------------------------------------------------
// Permission matrix
// ---------------------------------------------------------------------------

/**
 * For each action, the minimum role required to perform it.
 *
 * A user with a role that is >= the required role (per ROLE_ORDER) is allowed.
 */
const PERMISSION_MATRIX: Record<Action, Role> = {
  // Advisory
  "advisory:read":           "viewer",
  "advisory:update_status":  "analyst",
  "advisory:export":         "analyst",

  // News
  "news:read":               "viewer",
  "news:bookmark":           "viewer",

  // Threat intel
  "threat:read":             "viewer",
  "threat:export":           "analyst",

  // Workspaces
  "workspace:read":          "viewer",
  "workspace:create":        "admin",
  "workspace:update":        "admin",
  "workspace:delete":        "admin",

  // Org
  "org:read":                "viewer",
  "org:update":              "admin",
  "org:delete":              "owner",

  // Members
  "member:read":             "viewer",
  "member:invite":           "admin",
  "member:update_role":      "admin",
  "member:remove":           "admin",

  // Saved views
  "saved_view:read":         "viewer",
  "saved_view:create":       "viewer",
  "saved_view:update":       "viewer",
  "saved_view:delete":       "viewer",

  // Alert rules
  "alert_rule:read":         "viewer",
  "alert_rule:create":       "analyst",
  "alert_rule:update":       "analyst",
  "alert_rule:delete":       "admin",

  // API keys
  "api_key:read":            "admin",
  "api_key:create":          "admin",
  "api_key:revoke":          "admin",

  // Billing
  "billing:read":            "admin",
  "billing:manage":          "owner",

  // Audit log
  "audit_log:read":          "admin",
};

// ---------------------------------------------------------------------------
// Core helper
// ---------------------------------------------------------------------------

/**
 * Returns true when `userRole` is allowed to perform `action`.
 *
 * Usage:
 *   if (!can(req.ctx.role, "workspace:delete")) {
 *     res.status(403).json({ error: "Forbidden" });
 *     return;
 *   }
 */
export function can(userRole: Role, action: Action): boolean {
  const required = PERMISSION_MATRIX[action];
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(required);
}

/**
 * Throws a structured 403 error when the role is insufficient.
 * Use this inside asyncHandler blocks; the global error handler will catch it.
 */
export class ForbiddenError extends Error {
  readonly statusCode = 403;
  readonly action: Action;
  readonly role: Role;

  constructor(action: Action, role: Role) {
    super(
      `Role "${role}" is not permitted to perform "${action}" — ` +
        `requires "${PERMISSION_MATRIX[action]}" or above`
    );
    this.name = "ForbiddenError";
    this.action = action;
    this.role = role;
  }
}

/**
 * Assert that a role can perform an action; throw ForbiddenError otherwise.
 *
 * Usage:
 *   assertCan(req.ctx.role, "advisory:update_status");
 */
export function assertCan(userRole: Role, action: Action): void {
  if (!can(userRole, action)) {
    throw new ForbiddenError(action, userRole);
  }
}
