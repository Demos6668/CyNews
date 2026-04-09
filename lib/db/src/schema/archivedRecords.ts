import { pgTable, serial, text, timestamp, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";

export const archivedRecordsTable = pgTable("archived_records", {
  id: serial("id").primaryKey(),
  recordType: text("record_type").notNull().$type<"news" | "threat" | "advisory">(),
  sourceRecordId: integer("source_record_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  severity: text("severity").notNull().$type<"critical" | "high" | "medium" | "low" | "info">(),
  status: text("status").notNull(),
  source: text("source"),
  sourceUrl: text("source_url"),
  publishedAt: timestamp("published_at").notNull(),
  resolvedAt: timestamp("resolved_at"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  archivedAt: timestamp("archived_at").notNull().defaultNow(),
  purgeAfter: timestamp("purge_after").notNull(),
}, (table) => ({
  archivedRecordsUnique: uniqueIndex("archived_records_record_type_source_record_id_idx").on(table.recordType, table.sourceRecordId),
  archivedRecordsPurgeAfterIdx: index("archived_records_purge_after_idx").on(table.purgeAfter),
}));

export type ArchivedRecord = typeof archivedRecordsTable.$inferSelect;
