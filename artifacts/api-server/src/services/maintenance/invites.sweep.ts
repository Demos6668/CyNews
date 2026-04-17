import { pool } from "@workspace/db";
import type { Sweep, SweepContext, SweepResult } from "./types";

const BATCH_SIZE = 500;
const GRACE_AFTER_EXPIRY_DAYS = 30;

export const invitesSweep: Sweep = {
  name: "invites",
  schedule: "0 4 * * *",

  async run(_ctx: SweepContext): Promise<SweepResult> {
    const start = Date.now();
    const errors: string[] = [];
    let deleted = 0;

    const client = await pool.connect();
    try {
      const cutoff = new Date(Date.now() - GRACE_AFTER_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      let batchDeleted: number;
      do {
        // Pending invitations: user_id IS NULL means never accepted
        const result = await client.query<never>(
          `DELETE FROM memberships
           WHERE id IN (
             SELECT id FROM memberships
             WHERE user_id IS NULL
               AND invite_expires < $1
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

    return { sweep: "invites", scanned: deleted, deleted, archived: 0, durationMs: Date.now() - start, errors };
  },
};
