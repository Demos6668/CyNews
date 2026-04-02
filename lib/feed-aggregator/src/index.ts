/**
 * Feed Aggregator - Fetches RSS feeds and APIs, stores in database.
 * Used by scripts (CLI) and api-server (scheduler).
 */

import { logger } from "./logger";
import { db, advisoriesTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { fetchCertInAdvisories } from "./certInFetcher";
import { fetchRssFeeds } from "./fetcherRss";
import { fetchCisaKev } from "./fetcherCisaKev";
import { fetchURLhaus } from "./fetcherUrlhaus";
import { fetchThreatFox } from "./fetcherThreatFox";
import { fetchRansomwareLive } from "./fetcherRansomware";
import { fetchNVD } from "./fetcherNvd";
import { fetchFeodoTracker } from "./fetcherFeodo";
import {
  type FeedUpdateResult,
  type OnBroadcast,
  createEmptyResult,
} from "./feedUtils";

export { cyberRelevanceDetector } from "./cyberRelevanceDetector";
export type { FeedUpdateResult, OnBroadcast } from "./feedUtils";
export { createEmptyResult } from "./feedUtils";

async function fetchCertIn(result: FeedUpdateResult): Promise<void> {
  try {
    const advisories = await fetchCertInAdvisories();
    let added = 0;
    for (const a of advisories) {
      const existing = await db
        .select({ id: advisoriesTable.id, content: advisoriesTable.content })
        .from(advisoriesTable)
        .where(or(eq(advisoriesTable.certInId, a.advisoryId), eq(advisoriesTable.sourceUrl, a.sourceUrl)))
        .limit(1);
      const cveId = a.cveIds?.[0] ?? a.advisoryId;
      const description = a.summary || (a.content ?? "").slice(0, 500) || a.title;
      const cvssScore = a.cvssScore ?? 0;

      if (existing.length > 0) {
        const ex = existing[0];
        if (a.content && a.content !== ex.content) {
          await db
            .update(advisoriesTable)
            .set({
              content: a.content,
              affectedProducts: a.affectedProducts ?? [],
              recommendations: a.recommendations ?? [],
              references: a.references ?? [],
              cvssScore,
            })
            .where(eq(advisoriesTable.id, ex.id));
          added++;
        }
        continue;
      }

      await db.insert(advisoriesTable).values({
        cveId,
        title: a.title,
        description,
        cvssScore,
        severity: a.severity,
        affectedProducts: a.affectedProducts ?? [],
        vendor: "CERT-In",
        patchAvailable: false,
        patchUrl: a.sourceUrl,
        workarounds: a.recommendations ?? [],
        references: a.references?.length ? a.references : [a.sourceUrl],
        status: "new",
        publishedAt: a.publishedAt,
        scope: "local",
        isIndiaRelated: true,
        indiaConfidence: 100,
        sourceUrl: a.sourceUrl,
        source: a.source,
        summary: a.summary,
        content: a.content,
        category: a.category,
        isCertIn: true,
        certInId: a.advisoryId,
        certInType: a.type,
        cveIds: a.cveIds ?? [],
        recommendations: a.recommendations ?? [],
      });
      added++;
    }
    result.certIn = added;
    if (added > 0) logger.info(`[CERT-In] ${added} advisories`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "CERT-In", error: msg });
    logger.error(`[CERT-In] failed: ${msg}`);
  }
}


export async function runFeedUpdate(onBroadcast?: OnBroadcast): Promise<FeedUpdateResult> {
  const result = createEmptyResult();
  onBroadcast?.("REFRESH_STARTED", { timestamp: new Date().toISOString() });
  logger.info("[Feed] Fetching all sources...");

  await fetchCertIn(result);
  await fetchRssFeeds(onBroadcast, result);
  await fetchCisaKev(result);
  await fetchNVD(result);
  await fetchURLhaus(result);
  await fetchThreatFox(result);
  await fetchFeodoTracker(result);
  await fetchRansomwareLive(result);

  const total = result.rssNews + result.rssThreats + result.advisories + result.certIn + result.urlhaus + result.threatFox + result.ransomwareLive + result.nvd + result.feodo;
  const { errors: _err, ...rest } = result;
  onBroadcast?.("REFRESH_COMPLETE", {
    timestamp: new Date().toISOString(),
    newItems: total,
    errorCount: result.errors.length,
    ...rest,
  });
  logger.info(`[Feed] Done. +${total} items, ${result.errors.length} errors`);
  return result;
}
