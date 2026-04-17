import { pool } from "@workspace/db";
import type { Sweep, SweepContext, SweepResult } from "./types";

/**
 * Hard-deletes rows that have passed their purge_after timestamp.
 * Deletion order: workspaces first (child data cascades), then memberships/orgs,
 * then users. Each subject is wrapped in its own transaction so one failure
 * doesn't abort the others.
 *
 * DRY_RUN mode: set SOFT_DELETE_PURGE_DRY_RUN=true to log what would be deleted
 * without actually deleting anything. Recommended for first deployment.
 */
export const softDeletePurgeSweep: Sweep = {
  name: "softDeletePurge",
  schedule: "0 4 * * *",

  async run(_ctx: SweepContext): Promise<SweepResult> {
    const start = Date.now();
    const errors: string[] = [];
    let deleted = 0;
    const dryRun = process.env.SOFT_DELETE_PURGE_DRY_RUN === "true";

    const client = await pool.connect();
    try {
      const now = new Date();

      // 1. Workspaces past their purge date (cascade handles child rows)
      const workspacePurges = await client.query<{ id: string }>(
        `SELECT id FROM workspaces WHERE deleted_at IS NOT NULL AND purge_after < $1`,
        [now]
      );
      for (const { id } of workspacePurges.rows) {
        if (dryRun) {
          errors.push(`[dry-run] would purge workspace ${id}`);
          continue;
        }
        try {
          await client.query("BEGIN");
          await client.query(`DELETE FROM workspaces WHERE id = $1`, [id]);
          await client.query(
            `UPDATE delete_requests SET state = 'purged', updated_at = NOW()
             WHERE subject_type = 'workspace' AND subject_id = $1 AND state = 'pending'`,
            [id]
          );
          await client.query("COMMIT");
          deleted++;
        } catch (err) {
          await client.query("ROLLBACK");
          errors.push(`workspace ${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 2. Organizations past their purge date (cascade handles memberships, workspaces)
      const orgPurges = await client.query<{ id: string }>(
        `SELECT id FROM organizations WHERE deleted_at IS NOT NULL AND purge_after < $1`,
        [now]
      );
      for (const { id } of orgPurges.rows) {
        if (dryRun) {
          errors.push(`[dry-run] would purge org ${id}`);
          continue;
        }
        try {
          await client.query("BEGIN");
          await client.query(`DELETE FROM organizations WHERE id = $1`, [id]);
          await client.query(
            `UPDATE delete_requests SET state = 'purged', updated_at = NOW()
             WHERE subject_type = 'org' AND subject_id = $1 AND state = 'pending'`,
            [id]
          );
          await client.query("COMMIT");
          deleted++;
        } catch (err) {
          await client.query("ROLLBACK");
          errors.push(`org ${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // 3. Users past their purge date
      const userPurges = await client.query<{ id: string }>(
        `SELECT id FROM "user" WHERE deleted_at IS NOT NULL AND purge_after < $1`,
        [now]
      );
      for (const { id } of userPurges.rows) {
        if (dryRun) {
          errors.push(`[dry-run] would purge user ${id}`);
          continue;
        }
        try {
          await client.query("BEGIN");
          await client.query(`DELETE FROM "user" WHERE id = $1`, [id]);
          await client.query(
            `UPDATE delete_requests SET state = 'purged', updated_at = NOW()
             WHERE subject_type = 'user' AND subject_id = $1 AND state = 'pending'`,
            [id]
          );
          await client.query("COMMIT");
          deleted++;
        } catch (err) {
          await client.query("ROLLBACK");
          errors.push(`user ${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    } finally {
      client.release();
    }

    return { sweep: "softDeletePurge", scanned: deleted, deleted, archived: 0, durationMs: Date.now() - start, errors };
  },
};
