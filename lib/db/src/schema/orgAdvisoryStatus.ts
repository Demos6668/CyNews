/**
 * Per-org advisory status overrides.
 *
 * Instead of mutating the global `advisoriesTable.status` / `patchAvailable`
 * columns (which would affect all tenants), each org stores its own view of
 * an advisory's lifecycle here.
 *
 * When a row is absent, the default status from `advisoriesTable` is used.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { advisoriesTable } from "./advisories";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const orgAdvisoryStatusTable = pgTable(
  "org_advisory_status",
  {
    id:             serial("id").primaryKey(),
    orgId:          text("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    advisoryId:     integer("advisory_id").notNull().references(() => advisoriesTable.id, { onDelete: "cascade" }),
    status:         text("status")
                      .$type<"new" | "under_review" | "patched" | "dismissed">()
                      .default("new"),
    patchAvailable: boolean("patch_available"),
    patchUrl:       text("patch_url"),
    /** The user who last updated this record. */
    updatedBy:      text("updated_by").references(() => usersTable.id, { onDelete: "set null" }),
    updatedAt:      timestamp("updated_at").notNull().defaultNow(),
    createdAt:      timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // One status row per org per advisory
    uniqueIndex("org_advisory_status_org_advisory_uq").on(t.orgId, t.advisoryId),
  ]
);

export type OrgAdvisoryStatus = typeof orgAdvisoryStatusTable.$inferSelect;
