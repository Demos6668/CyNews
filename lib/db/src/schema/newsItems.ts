import { pgTable, serial, text, timestamp, boolean, jsonb, integer, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const newsItemsTable = pgTable("news_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().$type<"threat" | "news" | "advisory">(),
  scope: text("scope").notNull().$type<"local" | "global">(),
  isIndiaRelated: boolean("is_india_related").default(false),
  indiaConfidence: integer("india_confidence").default(0),
  indianState: varchar("indian_state", { length: 5 }),
  indianStateName: varchar("indian_state_name", { length: 100 }),
  indianCity: varchar("indian_city", { length: 100 }),
  indianSector: varchar("indian_sector", { length: 100 }),
  severity: text("severity").notNull().$type<"critical" | "high" | "medium" | "low" | "info">(),
  category: text("category").notNull(),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  region: jsonb("region").$type<string[]>().notNull().default([]),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  iocs: jsonb("iocs").$type<string[]>().notNull().default([]),
  affectedSystems: jsonb("affected_systems").$type<string[]>().notNull().default([]),
  mitigations: jsonb("mitigations").$type<string[]>().notNull().default([]),
  status: text("status").notNull().$type<"active" | "resolved" | "monitoring">().default("active"),
  bookmarked: boolean("bookmarked").notNull().default(false),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("news_items_source_url_uq")
    .on(t.sourceUrl)
    .where(sql`source_url IS NOT NULL`),
]);

export const insertNewsItemSchema = createInsertSchema(newsItemsTable).omit({ id: true });
export type InsertNewsItem = z.infer<typeof insertNewsItemSchema>;
export type NewsItem = typeof newsItemsTable.$inferSelect;
