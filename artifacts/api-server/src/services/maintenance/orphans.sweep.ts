import { pool } from "@workspace/db";
import type { Sweep, SweepContext, SweepResult } from "./types";

const STALE_DAYS = 30;

export const orphansSweep: Sweep = {
  name: "orphans",
  schedule: "0 4 * * *",

  async run(_ctx: SweepContext): Promise<SweepResult> {
    const start = Date.now();
    const errors: string[] = [];
    let deleted = 0;
    const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
      // Orphaned bookmarks: news item no longer exists
      const bookmarks = await client.query<never>(
        `DELETE FROM bookmarks
         WHERE news_item_id NOT IN (SELECT id FROM news_items)
           AND created_at < $1`,
        [staleCutoff]
      );
      deleted += bookmarks.rowCount ?? 0;

      // Orphaned threat matches: workspace no longer exists
      const matches = await client.query<never>(
        `DELETE FROM workspace_threat_matches
         WHERE workspace_id NOT IN (SELECT id FROM workspaces)
           AND updated_at < $1`,
        [staleCutoff]
      );
      deleted += matches.rowCount ?? 0;

      // Orphaned workspace products: workspace no longer exists
      const products = await client.query<never>(
        `DELETE FROM workspace_products
         WHERE workspace_id NOT IN (SELECT id FROM workspaces)
           AND updated_at < $1`,
        [staleCutoff]
      );
      deleted += products.rowCount ?? 0;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    } finally {
      client.release();
    }

    return { sweep: "orphans", scanned: deleted, deleted, archived: 0, durationMs: Date.now() - start, errors };
  },
};
