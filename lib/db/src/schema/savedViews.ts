/**
 * Saved Views — user-pinned filter presets.
 *
 * Lets a user save the current filter state on any list page (e.g. "Critical
 * CERT-In advisories from last 7 days") and restore it with one click.
 *
 * Scoped to (orgId, userId) so team members don't pollute each other's views,
 * but admins can see all within the org.
 */
import {
  pgTable,
  serial,
  text,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export interface SavedViewFilters {
  // Generic key-value filter state — interpreted by the specific page
  [key: string]: unknown;
}

export const savedViewsTable = pgTable(
  "saved_views",
  {
    id:        serial("id").primaryKey(),
    orgId:     text("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId:    text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    /** Which page this view belongs to (e.g. "advisories", "patches", "cert-in"). */
    page:      varchar("page", { length: 100 }).notNull(),
    /** Display name shown in the sidebar / dropdown. */
    name:      varchar("name", { length: 255 }).notNull(),
    /** Serialised filter state (URL-search-param-style or structured). */
    filters:   jsonb("filters").$type<SavedViewFilters>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("saved_views_user_page_idx").on(t.userId, t.page),
  ]
);

export type SavedView = typeof savedViewsTable.$inferSelect;
