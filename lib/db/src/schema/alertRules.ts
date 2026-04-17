/**
 * Alert Rules — stub table for Phase 2 full feature.
 *
 * When a rule triggers (e.g. new critical advisory matches a workspace
 * product), CyNews sends a notification via the configured channels.
 */
import {
  pgTable,
  serial,
  text,
  varchar,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export interface AlertConditions {
  severity?: string[];
  vendors?: string[];
  keywords?: string[];
  workspaceId?: string;
  types?: ("advisory" | "threat" | "news")[];
}

export interface AlertChannel {
  type: "email" | "webhook" | "slack";
  target: string; // email address, webhook URL, or Slack channel
}

export const alertRulesTable = pgTable("alert_rules", {
  id:          serial("id").primaryKey(),
  orgId:       text("org_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  createdBy:   text("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  name:        varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  conditions:  jsonb("conditions").$type<AlertConditions>().notNull().default({}),
  channels:    jsonb("channels").$type<AlertChannel[]>().notNull().default([]),
  isActive:    boolean("is_active").notNull().default(true),
  lastFiredAt: timestamp("last_fired_at"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
});

export type AlertRule = typeof alertRulesTable.$inferSelect;
