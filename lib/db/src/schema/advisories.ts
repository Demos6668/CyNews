import { pgTable, serial, text, timestamp, boolean, jsonb, doublePrecision, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const advisoriesTable = pgTable("advisories", {
  id: serial("id").primaryKey(),
  cveId: text("cve_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  cvssScore: doublePrecision("cvss_score").notNull(),
  severity: text("severity").notNull().$type<"critical" | "high" | "medium" | "low" | "info">(),
  affectedProducts: jsonb("affected_products").$type<string[]>().notNull().default([]),
  vendor: text("vendor").notNull(),
  patchAvailable: boolean("patch_available").notNull().default(false),
  patchUrl: text("patch_url"),
  workarounds: jsonb("workarounds").$type<string[]>().notNull().default([]),
  references: jsonb("references").$type<string[]>().notNull().default([]),
  status: text("status").notNull().$type<"new" | "under_review" | "patched" | "dismissed">().default("new"),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  scope: text("scope").notNull().$type<"local" | "global">().default("global"),
  isIndiaRelated: boolean("is_india_related").default(false),
  indiaConfidence: integer("india_confidence").default(0),
  // CERT-In specific fields
  sourceUrl: text("source_url"),
  source: varchar("source", { length: 100 }),
  summary: text("summary"),
  content: text("content"),
  category: varchar("category", { length: 100 }),
  isCertIn: boolean("is_cert_in").default(false),
  certInId: varchar("cert_in_id", { length: 50 }),
  certInType: varchar("cert_in_type", { length: 50 }),
  cveIds: jsonb("cve_ids").$type<string[]>().default([]),
  recommendations: jsonb("recommendations").$type<string[]>().default([]),
});

export const insertAdvisorySchema = createInsertSchema(advisoriesTable).omit({ id: true });
export type InsertAdvisory = z.infer<typeof insertAdvisorySchema>;
export type Advisory = typeof advisoriesTable.$inferSelect;
