import { pool } from "@workspace/db";
import type { Sweep, SweepContext, SweepResult } from "./types";

const BATCH_SIZE = 2000;
const DEFAULT_RETENTION_DAYS = 365;

/**
 * Audit-log retention is compliance-critical.
 * This sweep is DISABLED by default and must be explicitly enabled via
 * the AUDIT_LOG_RETENTION_ENABLED=true environment variable.
 */
export const auditLogSweep: Sweep = {
  name: "auditLog",
  schedule: "0 4 * * *",

  async run(_ctx: SweepContext): Promise<SweepResult> {
    const start = Date.now();

    if (process.env.AUDIT_LOG_RETENTION_ENABLED !== "true") {
      return { sweep: "auditLog", scanned: 0, deleted: 0, archived: 0, durationMs: Date.now() - start, errors: [] };
    }

    const errors: string[] = [];
    let deleted = 0;
    const retentionDays =
      parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? "", 10) || DEFAULT_RETENTION_DAYS;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
      let batchDeleted: number;
      do {
        const result = await client.query<never>(
          `DELETE FROM audit_log
           WHERE id IN (
             SELECT id FROM audit_log WHERE created_at < $1 LIMIT $2
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

    return { sweep: "auditLog", scanned: deleted, deleted, archived: 0, durationMs: Date.now() - start, errors };
  },
};
