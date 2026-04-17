/**
 * Bookmarks repository.
 *
 * All bookmark reads and writes go through this module so that org scoping
 * is enforced in one place.
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "..";
import { bookmarksTable, type Bookmark } from "../schema";
import type { OrgContext } from "./_baseTypes";

export const bookmarksRepo = {
  /**
   * Returns all news item IDs bookmarked by `ctx.userId` within the org.
   */
  async listNewsItemIds(ctx: OrgContext): Promise<number[]> {
    if (!ctx.userId) return [];
    const rows = await db
      .select({ newsItemId: bookmarksTable.newsItemId })
      .from(bookmarksTable)
      .where(
        and(
          eq(bookmarksTable.userId, ctx.userId),
          eq(bookmarksTable.orgId, ctx.orgId)
        )
      );
    return rows.map((r) => r.newsItemId);
  },

  /** Returns the full bookmark row for a specific news item, or null. */
  async find(ctx: OrgContext, newsItemId: number): Promise<Bookmark | null> {
    if (!ctx.userId) return null;
    const [row] = await db
      .select()
      .from(bookmarksTable)
      .where(
        and(
          eq(bookmarksTable.userId, ctx.userId),
          eq(bookmarksTable.orgId, ctx.orgId),
          eq(bookmarksTable.newsItemId, newsItemId)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Returns true when `newsItemId` is bookmarked by the current user. */
  async isBookmarked(ctx: OrgContext, newsItemId: number): Promise<boolean> {
    return (await bookmarksRepo.find(ctx, newsItemId)) !== null;
  },

  /**
   * Returns a Set of news item IDs that are bookmarked from a given list.
   * Efficient single-query alternative to calling `isBookmarked` in a loop.
   */
  async bookmarkedSet(ctx: OrgContext, newsItemIds: number[]): Promise<Set<number>> {
    if (!ctx.userId || newsItemIds.length === 0) return new Set();
    const rows = await db
      .select({ newsItemId: bookmarksTable.newsItemId })
      .from(bookmarksTable)
      .where(
        and(
          eq(bookmarksTable.userId, ctx.userId),
          eq(bookmarksTable.orgId, ctx.orgId),
          inArray(bookmarksTable.newsItemId, newsItemIds)
        )
      );
    return new Set(rows.map((r) => r.newsItemId));
  },

  /** Add a bookmark. Silently no-ops if already bookmarked (upsert). */
  async add(ctx: OrgContext, newsItemId: number): Promise<Bookmark> {
    if (!ctx.userId) throw new Error("userId required to bookmark");
    const [row] = await db
      .insert(bookmarksTable)
      .values({ userId: ctx.userId, orgId: ctx.orgId, newsItemId })
      .onConflictDoNothing()
      .returning();
    // If the row already existed, onConflictDoNothing returns nothing — fetch it
    return row ?? (await bookmarksRepo.find(ctx, newsItemId))!;
  },

  /** Remove a bookmark. Silently no-ops if not bookmarked. */
  async remove(ctx: OrgContext, newsItemId: number): Promise<void> {
    if (!ctx.userId) return;
    await db
      .delete(bookmarksTable)
      .where(
        and(
          eq(bookmarksTable.userId, ctx.userId),
          eq(bookmarksTable.orgId, ctx.orgId),
          eq(bookmarksTable.newsItemId, newsItemId)
        )
      );
  },
};
