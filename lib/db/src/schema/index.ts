// ── Existing domain tables ────────────────────────────────────────────────
export * from "./newsItems";
export * from "./advisories";
export * from "./threatIntel";
export * from "./archivedRecords";
export * from "./maintenanceRuns";
export * from "./workspaces";
export * from "./workspaceProducts";
export * from "./workspaceThreatMatches";
export * from "./workspaceSettings";

// ── Better Auth core tables ───────────────────────────────────────────────
export * from "./users";
export * from "./sessions";
export * from "./accounts";
export * from "./verifications";

// ── Multi-tenancy & org management ───────────────────────────────────────
export * from "./organizations";
export * from "./memberships";

// ── Per-user / per-org data ───────────────────────────────────────────────
export * from "./bookmarks";
export * from "./orgAdvisoryStatus";
export * from "./savedViews";

// ── Platform features (stub — full feature in Phase 2) ───────────────────
export * from "./apiKeys";
export * from "./alertRules";

// ── Observability & billing ───────────────────────────────────────────────
export * from "./auditLog";
export * from "./stripeEvents";
export * from "./usageDaily";
