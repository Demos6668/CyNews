/**
 * Better Auth — session table.
 *
 * Column names must match Better Auth's Drizzle adapter expectations exactly.
 */
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const sessionsTable = pgTable("session", {
  id:        text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token:     text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId:    text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
});

export type Session = typeof sessionsTable.$inferSelect;
