/**
 * Better Auth — account table (credentials + OAuth providers).
 *
 * For email/password auth, `password` stores the bcrypt hash.
 * For OAuth, `accessToken`/`refreshToken` are populated instead.
 *
 * Column names must match Better Auth's Drizzle adapter expectations exactly.
 */
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const accountsTable = pgTable("account", {
  id:                     text("id").primaryKey(),
  accountId:              text("account_id").notNull(),
  providerId:             text("provider_id").notNull(),
  userId:                 text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  accessToken:            text("access_token"),
  refreshToken:           text("refresh_token"),
  idToken:                text("id_token"),
  accessTokenExpiresAt:   timestamp("access_token_expires_at"),
  refreshTokenExpiresAt:  timestamp("refresh_token_expires_at"),
  scope:                  text("scope"),
  password:               text("password"),
  createdAt:              timestamp("created_at").notNull().defaultNow(),
  updatedAt:              timestamp("updated_at").notNull().defaultNow(),
});

export type Account = typeof accountsTable.$inferSelect;
