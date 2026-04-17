import { pool } from "@workspace/db";
import type { Sweep, SweepContext, SweepResult } from "./types";

const RETENTION_DAYS = 90;

export const maintenanceRunsSweep: Sweep = {
  name: "maintenanceRuns",
  schedule: "0 4 * * *",

  async run(_ctx: SweepContext): Promise<SweepResult> {
    const start = Date.now();
    const errors: string[] = [];
    let deleted = 0;
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
      const result = await client.query<never>(
        `DELETE FROM maintenance_runs WHERE started_at < $1`,
        [cutoff]
      );
      deleted = result.rowCount ?? 0;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    } finally {
      client.release();
    }

    return { sweep: "maintenanceRuns", scanned: deleted, deleted, archived: 0, durationMs: Date.now() - start, errors };
  },
};
