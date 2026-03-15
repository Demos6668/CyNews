import { pgTable, uuid, varchar, boolean } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const workspaceSettingsTable = pgTable("workspace_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspacesTable.id, { onDelete: "cascade" })
    .notNull(),
  alertOnCritical: boolean("alert_on_critical").default(true),
  alertOnHigh: boolean("alert_on_high").default(true),
  alertOnMedium: boolean("alert_on_medium").default(false),
  autoMatchThreats: boolean("auto_match_threats").default(true),
});
