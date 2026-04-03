/**
 * Data retention service — purges old resolved/dismissed items to prevent unbounded DB growth.
 */

import { db, newsItemsTable, threatIntelTable, advisoriesTable } from "@workspace/db";
import { lt, and, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

const DEFAULT_RETENTION_DAYS = 90;

export async function purgeOldRecords(retentionDays = DEFAULT_RETENTION_DAYS): Promise<{
  newsDeleted: number;
  threatsDeleted: number;
  advisoriesDeleted: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  logger.info({ retentionDays, cutoff: cutoff.toISOString() }, "Data retention: starting cleanup");

  const [newsResult, threatsResult, advisoriesResult] = await Promise.all([
    db
      .delete(newsItemsTable)
      .where(
        and(
          lt(newsItemsTable.publishedAt, cutoff),
          inArray(newsItemsTable.status, ["resolved"]),
        ),
      )
      .returning({ id: newsItemsTable.id }),

    db
      .delete(threatIntelTable)
      .where(
        and(
          lt(threatIntelTable.publishedAt, cutoff),
          inArray(threatIntelTable.status, ["resolved"]),
        ),
      )
      .returning({ id: threatIntelTable.id }),

    db
      .delete(advisoriesTable)
      .where(
        and(
          lt(advisoriesTable.publishedAt, cutoff),
          inArray(advisoriesTable.status, ["patched", "dismissed"]),
        ),
      )
      .returning({ id: advisoriesTable.id }),
  ]);

  const summary = {
    newsDeleted: newsResult.length,
    threatsDeleted: threatsResult.length,
    advisoriesDeleted: advisoriesResult.length,
  };

  logger.info(summary, "Data retention: cleanup complete");
  return summary;
}
