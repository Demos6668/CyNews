// Zod schemas (runtime values)
export * from "./generated/api";

// TypeScript types (compile-time) — re-export everything except the names
// that collide with Zod schemas. For those, consumers should import the
// Zod schema from "./generated/api" and use `z.infer<typeof X>`.
export type {} from // Add type-only re-exports here as they are introduced. The three names
// that collide with schemas (ExportAdvisoriesBulkBody, GetWorkspaceFeedParams,
// UpdateMatchBody) are intentionally not re-exported as types — use
// z.infer<typeof Name> instead.
"./generated/types";

// Re-export the rest of ./generated/types with a namespace so downstream
// code can still reach the non-colliding types it needs.
export * as Types from "./generated/types";
