import { pool } from "@workspace/db";
import type { Sweep, SweepContext, SweepResult } from "./types";

const BATCH_SIZE = 1000;
const EXPIRED_GRACE_DAYS = 7;

export const sessionsSweep: Sweep = {
  name: "sessions",
  schedule: "0 4 * * *",

  async run(_ctx: SweepContext): Promise<SweepResult> {
    const start = Date.now();
    const errors: string[] = [];
    let deleted = 0;

    const client = await pool.connect();
    try {
      const cutoff = new Date(Date.now() - EXPIRED_GRACE_DAYS * 24 * 60 * 60 * 1000);

      // Batch-delete expired sessions; loop until a batch comes back empty
      let batchDeleted: number;
      do {
        const result = await client.query<never>(
          `DELETE FROM session
           WHERE id IN (
             SELECT id FROM session WHERE expires_at < $1 LIMIT $2
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

    return { sweep: "sessions", scanned: deleted, deleted, archived: 0, durationMs: Date.now() - start, errors };
  },
};
