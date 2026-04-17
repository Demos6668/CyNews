/**
 * Bookmarks — per-user, per-org news item bookmarks.
 *
 * Replaces the global `bookmarked` boolean on `newsItemsTable` so that each
 * user sees only their own bookmarks, scoped to an organisation.
 */
import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { newsItemsTable } from "./newsItems";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const bookmarksTable = pgTable(
  "bookmarks",
  {
    id:         serial("id").primaryKey(),
    userId:     text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    orgId:      text("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    newsItemId: integer("news_item_id").notNull().references(() => newsItemsTable.id, { onDelete: "cascade" }),
    createdAt:  timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // One bookmark per user per news item (within an org)
    uniqueIndex("bookmarks_user_news_uq").on(t.userId, t.newsItemId),
  ]
);

export type Bookmark = typeof bookmarksTable.$inferSelect;
