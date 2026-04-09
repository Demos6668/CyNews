import { pgTable, serial, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

export const maintenanceRunsTable = pgTable("maintenance_runs", {
  id: serial("id").primaryKey(),
  jobType: text("job_type").notNull(),
  state: text("state").notNull().$type<"running" | "succeeded" | "failed" | "skipped">(),
  rowsArchived: integer("rows_archived").notNull().default(0),
  rowsPurged: integer("rows_purged").notNull().default(0),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  lastError: text("last_error"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
}, (table) => ({
  maintenanceRunsJobTypeIdx: index("maintenance_runs_job_type_idx").on(table.jobType),
  maintenanceRunsStartedAtIdx: index("maintenance_runs_started_at_idx").on(table.startedAt),
}));

export type MaintenanceRun = typeof maintenanceRunsTable.$inferSelect;
