/**
 * Audit Log — immutable record of security-relevant actions.
 *
 * Write-only: rows are never updated or deleted (retention is handled by
 * partitioning / archiving in a future migration).
 *
 * Actions follow the pattern:  RESOURCE.VERB
 * e.g. advisory.status_updated, member.invited, api_key.created
 */
import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const auditLogTable = pgTable(
  "audit_log",
  {
    id:           serial("id").primaryKey(),
    orgId:        text("org_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
    userId:       text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    action:       text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId:   text("resource_id"),
    /** Arbitrary key-value context (before/after values, IP, etc.). */
    metadata:     jsonb("metadata").$type<Record<string, unknown>>(),
    /** ISO IP address of the request origin (for security investigations). */
    ipAddress:    text("ip_address"),
    createdAt:    timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_org_created_idx").on(t.orgId, t.createdAt),
    index("audit_log_user_idx").on(t.userId),
  ]
);

export type AuditLogEntry = typeof auditLogTable.$inferSelect;
