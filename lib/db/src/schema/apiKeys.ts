/**
 * API Keys — per-org programmatic access tokens (Phase 2 full feature).
 *
 * The key value itself is never stored — only a bcrypt hash is persisted.
 * The raw key is shown once at creation time.
 */
import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const apiKeysTable = pgTable("api_keys", {
  id:          serial("id").primaryKey(),
  orgId:       text("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  createdBy:   text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  /** Human-readable label (e.g. "CI/CD pipeline key"). */
  name:        varchar("name", { length: 255 }).notNull(),
  /** bcrypt hash of the raw key — never the raw key. */
  keyHash:     text("key_hash").notNull(),
  /** First 8 chars of the raw key for display purposes (not sensitive). */
  keyPrefix:   varchar("key_prefix", { length: 8 }).notNull(),
  lastUsedAt:  timestamp("last_used_at"),
  expiresAt:   timestamp("expires_at"),
  revokedAt:   timestamp("revoked_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});

export type ApiKey = typeof apiKeysTable.$inferSelect;
