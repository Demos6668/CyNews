import { pgTable, serial, text, timestamp, jsonb, boolean, integer, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const threatIntelTable = pgTable("threat_intel", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  description: text("description").notNull(),
  scope: text("scope").notNull().$type<"local" | "global">(),
  isIndiaRelated: boolean("is_india_related").default(false),
  indiaConfidence: integer("india_confidence").default(0),
  indianState: varchar("indian_state", { length: 5 }),
  indianStateName: varchar("indian_state_name", { length: 100 }),
  indianCity: varchar("indian_city", { length: 100 }),
  indianSector: varchar("indian_sector", { length: 100 }),
  severity: text("severity").notNull().$type<"critical" | "high" | "medium" | "low" | "info">(),
  category: text("category").notNull(),
  threatActor: text("threat_actor"),
  threatActorAliases: jsonb("threat_actor_aliases").$type<string[]>().notNull().default([]),
  targetSectors: jsonb("target_sectors").$type<string[]>().notNull().default([]),
  targetRegions: jsonb("target_regions").$type<string[]>().notNull().default([]),
  ttps: jsonb("ttps").$type<string[]>().notNull().default([]),
  iocs: jsonb("iocs").$type<string[]>().notNull().default([]),
  malwareFamilies: jsonb("malware_families").$type<string[]>().notNull().default([]),
  affectedSystems: jsonb("affected_systems").$type<string[]>().notNull().default([]),
  mitigations: jsonb("mitigations").$type<string[]>().notNull().default([]),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  references: jsonb("references").$type<string[]>().notNull().default([]),
  campaignName: text("campaign_name"),
  status: text("status").notNull().$type<"active" | "resolved" | "monitoring">().default("active"),
  confidenceLevel: text("confidence_level").notNull().$type<"confirmed" | "high" | "medium" | "low">().default("medium"),
  firstSeen: timestamp("first_seen"),
  lastSeen: timestamp("last_seen"),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("threat_intel_source_url_uq")
    .on(t.sourceUrl)
    .where(sql`source_url IS NOT NULL`),
]);

export const insertThreatIntelSchema = createInsertSchema(threatIntelTable).omit({ id: true });
export type InsertThreatIntel = z.infer<typeof insertThreatIntelSchema>;
export type ThreatIntel = typeof threatIntelTable.$inferSelect;
