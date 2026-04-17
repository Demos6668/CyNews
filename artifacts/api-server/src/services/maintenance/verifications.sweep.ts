import { pool } from "@workspace/db";
import type { Sweep, SweepContext, SweepResult } from "./types";

const BATCH_SIZE = 1000;

export const verificationsSweep: Sweep = {
  name: "verifications",
  schedule: "0 4 * * *",

  async run(_ctx: SweepContext): Promise<SweepResult> {
    const start = Date.now();
    const errors: string[] = [];
    let deleted = 0;

    const client = await pool.connect();
    try {
      let batchDeleted: number;
      do {
        const result = await client.query<never>(
          `DELETE FROM verification
           WHERE id IN (
             SELECT id FROM verification WHERE expires_at < NOW() LIMIT $1
           )`,
          [BATCH_SIZE]
        );
        batchDeleted = result.rowCount ?? 0;
        deleted += batchDeleted;
      } while (batchDeleted === BATCH_SIZE);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    } finally {
      client.release();
    }

    return { sweep: "verifications", scanned: deleted, deleted, archived: 0, durationMs: Date.now() - start, errors };
  },
};
