/**
 * Per-org advisory status repository.
 *
 * Instead of mutating the global advisoriesTable row, each org stores its own
 * status view here. When no row exists the caller should fall back to the
 * global default from advisoriesTable.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "..";
import { orgAdvisoryStatusTable, type OrgAdvisoryStatus } from "../schema";
import type { OrgContext } from "./_baseTypes";

export interface UpsertAdvisoryStatus {
  status?: "new" | "under_review" | "patched" | "dismissed";
  patchAvailable?: boolean;
  patchUrl?: string | null;
}

export const orgAdvisoryStatusRepo = {
  /** Get org-specific status for one advisory, or null if not overridden. */
  async find(ctx: OrgContext, advisoryId: number): Promise<OrgAdvisoryStatus | null> {
    const [row] = await db
      .select()
      .from(orgAdvisoryStatusTable)
      .where(
        and(
          eq(orgAdvisoryStatusTable.orgId, ctx.orgId),
          eq(orgAdvisoryStatusTable.advisoryId, advisoryId)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /**
   * Returns a Map of advisoryId → status row for a batch of advisory IDs.
   * Efficient for list pages — single query instead of N fetches.
   */
  async findBatch(
    ctx: OrgContext,
    advisoryIds: number[]
  ): Promise<Map<number, OrgAdvisoryStatus>> {
    if (advisoryIds.length === 0) return new Map();
    const rows = await db
      .select()
      .from(orgAdvisoryStatusTable)
      .where(
        and(
          eq(orgAdvisoryStatusTable.orgId, ctx.orgId),
          inArray(orgAdvisoryStatusTable.advisoryId, advisoryIds)
        )
      );
    return new Map(rows.map((r) => [r.advisoryId, r]));
  },

  /**
   * Upsert an org-specific status override for an advisory.
   * Returns the updated (or newly created) row.
   */
  async upsert(
    ctx: OrgContext,
    advisoryId: number,
    data: UpsertAdvisoryStatus
  ): Promise<OrgAdvisoryStatus> {
    const now = new Date();

    const [row] = await db
      .insert(orgAdvisoryStatusTable)
      .values({
        orgId: ctx.orgId,
        advisoryId,
        status: data.status,
        patchAvailable: data.patchAvailable,
        patchUrl: data.patchUrl ?? null,
        updatedBy: ctx.userId ?? null,
        updatedAt: now,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [orgAdvisoryStatusTable.orgId, orgAdvisoryStatusTable.advisoryId],
        set: {
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.patchAvailable !== undefined ? { patchAvailable: data.patchAvailable } : {}),
          ...(data.patchUrl !== undefined ? { patchUrl: data.patchUrl ?? null } : {}),
          updatedBy: ctx.userId ?? null,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return row!;
  },
};
