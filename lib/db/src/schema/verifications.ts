/**
 * Better Auth — verification table (email verify & password reset tokens).
 *
 * Column names must match Better Auth's Drizzle adapter expectations exactly.
 */
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const verificationsTable = pgTable("verification", {
  id:         text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value:      text("value").notNull(),
  expiresAt:  timestamp("expires_at").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
});

export type Verification = typeof verificationsTable.$inferSelect;
