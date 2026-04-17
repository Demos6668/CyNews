/**
 * Memberships — user ↔ organisation relationship with a role.
 *
 * A user can belong to multiple orgs with different roles.
 * Pending invitations are stored here too (inviteToken != null, userId null).
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const membershipsTable = pgTable(
  "memberships",
  {
    id:           text("id").primaryKey(),
    userId:       text("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
    orgId:        text("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    role:         text("role")
                    .notNull()
                    .$type<"owner" | "admin" | "analyst" | "viewer">()
                    .default("viewer"),
    /** Populated for pending invitations (userId is null until accepted). */
    inviteEmail:  varchar("invite_email", { length: 320 }),
    inviteToken:  text("invite_token"),
    inviteExpires: timestamp("invite_expires"),
    joinedAt:     timestamp("joined_at"),
    createdAt:    timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    // A user can only have one active membership per org
    uniqueIndex("memberships_user_org_uq")
      .on(t.userId, t.orgId)
      .where(sql`user_id IS NOT NULL`),
  ]
);

export type Membership = typeof membershipsTable.$inferSelect;
