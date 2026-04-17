import { pool } from "@workspace/db";
import type { Sweep, SweepContext, SweepResult } from "./types";

const BATCH_SIZE = 500;
const DEFAULT_RETENTION_DAYS = 90;

export const stripeEventsSweep: Sweep = {
  name: "stripeEvents",
  schedule: "0 4 * * *",

  async run(_ctx: SweepContext): Promise<SweepResult> {
    const start = Date.now();
    const errors: string[] = [];
    let deleted = 0;

    // Honour env override so retention can be extended for compliance without code changes
    const retentionDays =
      parseInt(process.env.STRIPE_EVENT_RETENTION_DAYS ?? "", 10) || DEFAULT_RETENTION_DAYS;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
      let batchDeleted: number;
      do {
        const result = await client.query<never>(
          `DELETE FROM stripe_events
           WHERE id IN (
             SELECT id FROM stripe_events
             WHERE processed_at IS NOT NULL
               AND processed_at < $1
             LIMIT $2
           )`,
          [cutoff, BATCH_SIZE]
        );
        batchDeleted = result.rowCount ?? 0;
        deleted += batchDeleted;
      } while (batchDeleted === BATCH_SIZE);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    } finally {
      client.release();
    }

    return { sweep: "stripeEvents", scanned: deleted, deleted, archived: 0, durationMs: Date.now() - start, errors };
  },
};
