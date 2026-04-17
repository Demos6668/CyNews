/**
 * Core types for the repository layer.
 *
 * All database-writing code must go through repository functions in this
 * directory. Every repo function that touches org-owned data requires an
 * `OrgContext` as its first argument so that multi-tenancy is enforced at
 * the call site rather than left to individual route handlers.
 */

export type OrgId = string;
export type UserId = string;

/** Passed as the first argument to every org-scoped repo function. */
export interface OrgContext {
  orgId: OrgId;
  userId?: UserId;
}

/**
 * Minimal interface that every org-scoped repository must satisfy.
 *
 * `TRow`    = the shape returned by SELECT queries (full DB row or formatted DTO)
 * `TInsert` = the shape accepted by INSERT/UPDATE (may omit auto-generated fields)
 *
 * Concrete repos implement only the subset of methods they need; this interface
 * is here as a structural contract, not a mandatory base class.
 */
export interface OrgScopedRepo<
  TRow,
  TInsert extends Record<string, unknown> = Record<string, unknown>,
  TFilters extends Record<string, unknown> = Record<string, unknown>,
> {
  findAll(ctx: OrgContext, filters?: TFilters): Promise<TRow[]>;
  findById(ctx: OrgContext, id: number | string): Promise<TRow | null>;
  create(ctx: OrgContext, data: TInsert): Promise<TRow>;
  update(ctx: OrgContext, id: number | string, data: Partial<TInsert>): Promise<TRow>;
  delete(ctx: OrgContext, id: number | string): Promise<void>;
}
