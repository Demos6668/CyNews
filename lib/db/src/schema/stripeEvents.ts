/**
 * Stripe Events — idempotent webhook event log.
 *
 * Every incoming Stripe webhook is stored here before processing so that
 * duplicate deliveries are deduplicated by `stripe_event_id`.
 */
import {
  pgTable,
  serial,
  text,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const stripeEventsTable = pgTable(
  "stripe_events",
  {
    id:            serial("id").primaryKey(),
    /** Stripe's event ID — used for idempotency (e.g. `evt_1ABC...`). */
    stripeEventId: text("stripe_event_id").notNull(),
    type:          text("type").notNull(),
    /** Org this event belongs to — null for events before checkout is linked. */
    orgId:         text("org_id").references(() => organizationsTable.id, { onDelete: "set null" }),
    /** Full Stripe event payload as JSON for replay capability. */
    data:          jsonb("data").$type<Record<string, unknown>>().notNull(),
    processedAt:   timestamp("processed_at"),
    createdAt:     timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stripe_events_event_id_uq").on(t.stripeEventId),
    index("stripe_events_org_idx").on(t.orgId),
  ]
);

export type StripeEvent = typeof stripeEventsTable.$inferSelect;
