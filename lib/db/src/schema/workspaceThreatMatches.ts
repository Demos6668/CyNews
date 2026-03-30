import { pgTable, uuid, varchar, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";
import { threatIntelTable } from "./threatIntel";

export const workspaceThreatMatchesTable = pgTable("workspace_threat_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspacesTable.id, { onDelete: "cascade" })
    .notNull(),
  threatId: integer("threat_id")
    .references(() => threatIntelTable.id, { onDelete: "cascade" })
    .notNull(),
  matchedProduct: varchar("matched_product", { length: 255 }),
  matchedKeyword: varchar("matched_keyword", { length: 255 }),
  relevanceScore: real("relevance_score"),
  reviewed: boolean("reviewed").default(false),
  dismissed: boolean("dismissed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
