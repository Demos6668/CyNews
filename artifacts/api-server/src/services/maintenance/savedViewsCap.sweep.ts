import { pool } from "@workspace/db";
import { PLAN_LIMITS, type PlanTier } from "../../lib/plans";
import type { Sweep, SweepContext, SweepResult } from "./types";

export const savedViewsCapSweep: Sweep = {
  name: "savedViewsCap",
  schedule: "0 4 * * *",

  async run(_ctx: SweepContext): Promise<SweepResult> {
    const start = Date.now();
    const errors: string[] = [];
    let deleted = 0;

    const client = await pool.connect();
    try {
      // Find (org_id, user_id, page_key) groups that exceed their plan limit
      // by joining saved_views with organizations to get the plan tier.
      const overage = await client.query<{
        org_id: string;
        user_id: string;
        page_key: string;
        plan: string;
        row_count: number;
      }>(
        `SELECT sv.org_id, sv.user_id, sv.page_key, o.plan, COUNT(*) AS row_count
         FROM saved_views sv
         JOIN organizations o ON o.id = sv.org_id
         GROUP BY sv.org_id, sv.user_id, sv.page_key, o.plan
         HAVING COUNT(*) > 0`
      );

      for (const row of overage.rows) {
        const plan = (row.plan ?? "free") as PlanTier;
        const limit = PLAN_LIMITS[plan]?.savedViews ?? 0;
        if (!isFinite(limit) || row.row_count <= limit) continue;

        const excess = row.row_count - limit;
        const result = await client.query<never>(
          `DELETE FROM saved_views
           WHERE id IN (
             SELECT id FROM saved_views
             WHERE org_id = $1 AND user_id = $2 AND page_key = $3
             ORDER BY created_at ASC
             LIMIT $4
           )`,
          [row.org_id, row.user_id, row.page_key, excess]
        );
        deleted += result.rowCount ?? 0;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    } finally {
      client.release();
    }

    return { sweep: "savedViewsCap", scanned: 0, deleted, archived: 0, durationMs: Date.now() - start, errors };
  },
};
