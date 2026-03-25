import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { workspacesTable } from "./workspaces";

export const workspaceProductsTable = pgTable("workspace_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspacesTable.id, { onDelete: "cascade" })
    .notNull(),
  productName: varchar("product_name", { length: 255 }).notNull(),
  vendor: varchar("vendor", { length: 255 }),
  version: varchar("version", { length: 100 }),
  category: varchar("category", { length: 100 }),
  keywords: jsonb("keywords").$type<string[]>().default([]),
  enabled: boolean("enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
