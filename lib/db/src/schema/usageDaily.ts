/**
 * Usage metrics — daily per-org counters for billing and analytics.
 *
 * Incremented by the API server; aggregated by a nightly cron job in Phase 2.
 * Values are approximate (best-effort) and reset at UTC midnight.
 */
import {
  pgTable,
  serial,
  text,
  integer,
  date,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const usageDailyTable = pgTable(
  "usage_daily",
  {
    id:              serial("id").primaryKey(),
    orgId:           text("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    /** UTC date of the counts (DATE, not TIMESTAMP). */
    date:            date("date").notNull(),
    searches:        integer("searches").notNull().default(0),
    advisoryExports: integer("advisory_exports").notNull().default(0),
    apiCalls:        integer("api_calls").notNull().default(0),
    createdAt:       timestamp("created_at").notNull().defaultNow(),
    updatedAt:       timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("usage_daily_org_date_uq").on(t.orgId, t.date),
    index("usage_daily_date_idx").on(t.date),
  ]
);

export type UsageDaily = typeof usageDailyTable.$inferSelect;
