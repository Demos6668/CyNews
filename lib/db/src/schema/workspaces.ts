import { pgTable, uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const workspacesTable = pgTable("workspaces", {
  id:          uuid("id").primaryKey().defaultRandom(),
  name:        varchar("name", { length: 255 }).notNull(),
  domain:      varchar("domain", { length: 255 }).notNull(),
  description: text("description"),
  isDefault:   boolean("is_default").default(false),
  /**
   * Organisation this workspace belongs to.
   * Nullable during the transition period (pre-backfill).
   * After migration 014 backfill, every row will have an orgId.
   * A NOT NULL constraint will be added in a follow-up cleanup migration.
   */
  orgId:       text("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
  /** Soft-delete: set when workspace deletion is scheduled. */
  deletedAt:   timestamp("deleted_at"),
  /** Hard-purge timestamp — row physically deleted after this date. */
  purgeAfter:  timestamp("purge_after"),
}, (t) => [
  index("workspaces_org_idx").on(t.orgId),
  index("workspaces_purge_idx").on(t.purgeAfter),
]);
