/**
 * Better Auth — user table.
 *
 * Column names must match Better Auth's Drizzle adapter expectations exactly.
 * Do NOT add arbitrary columns here; extend the schema in Sub-Phase 3 when
 * the Better Auth configuration is finalised.
 */
import { pgTable, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const usersTable = pgTable("user", {
  id:            text("id").primaryKey(),
  name:          text("name").notNull(),
  email:         text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image:         text("image"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
  /** Soft-delete: set when a GDPR erasure request is scheduled. */
  deletedAt:     timestamp("deleted_at"),
  /** Hard-purge timestamp — row is physically deleted after this date by the sweep. */
  purgeAfter:    timestamp("purge_after"),
}, (t) => [
  index("user_purge_idx").on(t.purgeAfter),
]);

export type User = typeof usersTable.$inferSelect;
