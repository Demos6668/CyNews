/**
 * Plan tier definitions and feature gate constants.
 *
 * Every billable or gated feature is listed here so product decisions live in
 * one file.  Routes call `requireFeature(req, "FEATURE_KEY")` which reads
 * from this file to decide whether to allow or return 402.
 *
 * Tiers (ascending): free → pro → team → enterprise
 */

// ---------------------------------------------------------------------------
// Tier type
// ---------------------------------------------------------------------------

export type PlanTier = "free" | "pro" | "team" | "enterprise";

/** Ordered list — used for comparisons like "pro or above" */
export const TIER_ORDER: readonly PlanTier[] = [
  "free",
  "pro",
  "team",
  "enterprise",
] as const;

/** Returns true when `actual` meets or exceeds `required`. */
export function tierAtLeast(actual: PlanTier, required: PlanTier): boolean {
  return TIER_ORDER.indexOf(actual) >= TIER_ORDER.indexOf(required);
}

// ---------------------------------------------------------------------------
// Feature gates
// ---------------------------------------------------------------------------

/**
 * For each feature key, the minimum plan tier that grants access.
 *
 * "null" means the feature is always available (no gate).
 */
export const FEATURE_GATES = {
  // Advisories
  ADVISORY_PATCH_STATUS_UPDATE: "free",   // anyone can update patch status within their org
  ADVISORY_EXPORT_CSV: "pro",

  // Workspaces
  WORKSPACE_CREATE: "free",
  WORKSPACE_LIMIT_EXCEEDED: "pro",        // checked at creation; free → 1, pro → 10

  // Users & org
  INVITE_MEMBER: "free",
  SEAT_LIMIT_EXCEEDED: "pro",             // free → 3 seats, pro → 10, team → unlimited

  // Saved views
  SAVED_VIEWS: "pro",

  // Alert rules
  ALERT_RULES_CREATE: "pro",
  ALERT_RULES_LIMIT_EXCEEDED: "team",

  // API access
  API_KEY_CREATE: "pro",

  // Billing portal
  BILLING_PORTAL: "pro",

  // Audit log access
  AUDIT_LOG_READ: "team",

  // CERT-In — always available
  CERT_IN_READ: null,
} as const satisfies Record<string, PlanTier | null>;

export type FeatureKey = keyof typeof FEATURE_GATES;

// ---------------------------------------------------------------------------
// Per-tier limits
// ---------------------------------------------------------------------------

export interface PlanLimits {
  seats: number;               // max members per org
  workspaces: number;          // max active workspaces per org
  alertRules: number;          // max alert rules per org
  apiKeys: number;             // max API keys per org
  savedViews: number;          // max saved views per org
  dataRetentionDays: number;   // how long raw feed data is kept
  searchResultsMax: number;    // max rows returned by /api/search
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    seats: 3,
    workspaces: 1,
    alertRules: 0,
    apiKeys: 0,
    savedViews: 0,
    dataRetentionDays: 30,
    searchResultsMax: 20,
  },
  pro: {
    seats: 10,
    workspaces: 10,
    alertRules: 10,
    apiKeys: 3,
    savedViews: 10,
    dataRetentionDays: 90,
    searchResultsMax: 100,
  },
  team: {
    seats: Infinity,
    workspaces: Infinity,
    alertRules: 50,
    apiKeys: 20,
    savedViews: Infinity,
    dataRetentionDays: 365,
    searchResultsMax: 500,
  },
  enterprise: {
    seats: Infinity,
    workspaces: Infinity,
    alertRules: Infinity,
    apiKeys: Infinity,
    savedViews: Infinity,
    dataRetentionDays: Infinity,
    searchResultsMax: 1000,
  },
};

// ---------------------------------------------------------------------------
// Stripe Price IDs (injected from env at runtime)
// ---------------------------------------------------------------------------

/** Returns Stripe monthly price IDs from env, or undefined if not configured. */
export function getStripePrices(): {
  pro: string | undefined;
  team: string | undefined;
} {
  return {
    pro: process.env.STRIPE_PRICE_PRO_MONTHLY,
    team: process.env.STRIPE_PRICE_TEAM_MONTHLY,
  };
}

// ---------------------------------------------------------------------------
// Upgrade payload (returned in 402 responses)
// ---------------------------------------------------------------------------

export interface UpgradeRequired {
  code: "UPGRADE_REQUIRED";
  feature: FeatureKey;
  currentPlan: PlanTier;
  requiredPlan: PlanTier;
  upgradeUrl: string;
}

export function buildUpgradePayload(
  feature: FeatureKey,
  currentPlan: PlanTier,
  frontendUrl = ""
): UpgradeRequired {
  const required = FEATURE_GATES[feature];
  if (!required) {
    throw new Error(`Feature "${feature}" has no gate — should never 402`);
  }
  return {
    code: "UPGRADE_REQUIRED",
    feature,
    currentPlan,
    requiredPlan: required,
    upgradeUrl: `${frontendUrl}/settings/billing`,
  };
}
