/**
 * Organizations — top-level multi-tenancy unit.
 *
 * Every org-scoped resource (workspaces, bookmarks, advisory status) has an
 * `org_id` FK pointing here.
 */
import { pgTable, text, varchar, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const organizationsTable = pgTable(
  "organizations",
  {
    id:               text("id").primaryKey(),
    name:             varchar("name", { length: 255 }).notNull(),
    /** URL-safe slug for vanity URLs and tenant lookup. */
    slug:             varchar("slug", { length: 100 }).notNull(),
    /** Current billing plan tier. */
    plan:             text("plan")
                        .notNull()
                        .$type<"free" | "pro" | "team" | "enterprise">()
                        .default("free"),
    /** Stripe customer ID — null until first checkout session. */
    stripeCustomerId: text("stripe_customer_id"),
    createdAt:        timestamp("created_at").notNull().defaultNow(),
    updatedAt:        timestamp("updated_at").notNull().defaultNow(),
    /** Soft-delete: set when org cancels and schedules closure. */
    deletedAt:        timestamp("deleted_at"),
    /** Hard-purge timestamp — org and all child data deleted after this date. */
    purgeAfter:       timestamp("purge_after"),
  },
  (t) => [
    uniqueIndex("organizations_slug_uq").on(t.slug),
    index("organizations_purge_idx").on(t.purgeAfter),
  ]
);

export type Organization = typeof organizationsTable.$inferSelect;
