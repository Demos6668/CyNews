import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export type DeleteSubjectType = "user" | "org" | "workspace";
export type DeleteRequestState = "pending" | "confirmed" | "cancelled" | "purged";

export const deleteRequestsTable = pgTable("delete_requests", {
  id:           text("id").primaryKey(),
  subjectType:  text("subject_type").$type<DeleteSubjectType>().notNull(),
  subjectId:    text("subject_id").notNull(),
  requestedBy:  text("requested_by").notNull(),
  requestedAt:  timestamp("requested_at").notNull().defaultNow(),
  /** Earliest timestamp the deletion can be acted on (grace period start). */
  confirmAfter: timestamp("confirm_after").notNull(),
  /** Timestamp after which the sweep hard-deletes the subject. */
  purgeAfter:   timestamp("purge_after").notNull(),
  state:        text("state").$type<DeleteRequestState>().notNull().default("pending"),
  reason:       text("reason"),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("delete_requests_subject_idx").on(t.subjectType, t.subjectId),
  index("delete_requests_purge_idx").on(t.purgeAfter),
  index("delete_requests_state_idx").on(t.state),
]);

export type DeleteRequest = typeof deleteRequestsTable.$inferSelect;
