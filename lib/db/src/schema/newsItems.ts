import { pgTable, serial, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const newsItemsTable = pgTable("news_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().$type<"threat" | "news" | "advisory">(),
  scope: text("scope").notNull().$type<"local" | "global">(),
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
});

export const insertNewsItemSchema = createInsertSchema(newsItemsTable).omit({ id: true });
export type InsertNewsItem = z.infer<typeof insertNewsItemSchema>;
export type NewsItem = typeof newsItemsTable.$inferSelect;
