/**
 * Feed Aggregator - Fetches RSS feeds and APIs, stores in database.
 * Used by scripts (CLI) and api-server (scheduler).
 */

import { logger } from "./logger";
import { db, advisoriesTable } from "@workspace/db";
import { eq, or, inArray, type SQL } from "drizzle-orm";
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

async function runTimedSource(
  name: string,
  task: () => Promise<void>,
): Promise<void> {
  const startedAt = Date.now();
  await task();
  const durationMs = Date.now() - startedAt;
  logger.info({ source: name, durationMs }, "feed source complete");
}

async function fetchCertIn(result: FeedUpdateResult): Promise<void> {
  try {
    const advisories = await fetchCertInAdvisories();
    const advisoryIds = advisories
      .map((advisory) => advisory.advisoryId)
      .filter((value): value is string => Boolean(value));
    const sourceUrls = advisories
      .map((advisory) => advisory.sourceUrl)
      .filter((value): value is string => Boolean(value));
    const existingConditions: SQL[] = [];
    if (advisoryIds.length > 0) {
      existingConditions.push(inArray(advisoriesTable.certInId, advisoryIds));
    }
    if (sourceUrls.length > 0) {
      existingConditions.push(inArray(advisoriesTable.sourceUrl, sourceUrls));
    }

    const existingRows = existingConditions.length > 0
      ? await db
          .select({
            id: advisoriesTable.id,
            certInId: advisoriesTable.certInId,
            sourceUrl: advisoriesTable.sourceUrl,
            content: advisoriesTable.content,
            summary: advisoriesTable.summary,
            description: advisoriesTable.description,
            cvssScore: advisoriesTable.cvssScore,
            severity: advisoriesTable.severity,
          })
          .from(advisoriesTable)
          .where(or(...existingConditions))
      : [];
    const existingByCertInId = new Map(
      existingRows
        .filter((row) => Boolean(row.certInId))
        .map((row) => [row.certInId!, row]),
    );
    const existingBySourceUrl = new Map(
      existingRows
        .filter((row) => Boolean(row.sourceUrl))
        .map((row) => [row.sourceUrl!, row]),
    );
    let added = 0;
    const inserts: Array<typeof advisoriesTable.$inferInsert> = [];
    for (const a of advisories) {
      const summary = a.summary?.trim() || (a.content ?? "").trim().slice(0, 2000) || a.title;
      const content = a.content?.trim() || summary;
      const description = summary.slice(0, 500) || a.title;
      const existing = existingByCertInId.get(a.advisoryId) ?? existingBySourceUrl.get(a.sourceUrl);
      const cveId = a.cveIds?.[0] ?? a.advisoryId;
      const cvssScore = a.cvssScore ?? 0;

      if (existing) {
        const needsUpdate =
          content !== existing.content ||
          !existing.summary ||
          existing.summary.trim().length === 0 ||
          !existing.description ||
          existing.description.trim().length === 0 ||
          existing.cvssScore !== cvssScore ||
          existing.severity !== a.severity;

        if (needsUpdate) {
          await db
            .update(advisoriesTable)
            .set({
              summary,
              description,
              content,
              severity: a.severity,
              affectedProducts: a.affectedProducts ?? [],
              recommendations: a.recommendations ?? [],
              references: a.references ?? [],
              category: a.category,
              cveIds: a.cveIds ?? [],
              cvssScore,
              patchAvailable: a.patchAvailable ?? false,
              patchUrl: a.patchUrl ?? null,
            })
            .where(eq(advisoriesTable.id, existing.id));
          added++;
        }
        continue;
      }

      inserts.push({
        cveId,
        title: a.title,
        description,
        cvssScore,
        severity: a.severity,
        affectedProducts: a.affectedProducts ?? [],
        vendor: "CERT-In",
        patchAvailable: a.patchAvailable ?? false,
        patchUrl: a.patchUrl ?? null,
        workarounds: a.recommendations ?? [],
        references: a.references ?? [],
        status: "new",
        publishedAt: a.publishedAt,
        scope: "local",
        isIndiaRelated: true,
        indiaConfidence: 100,
        sourceUrl: a.sourceUrl,
        source: a.source,
        summary,
        content,
        category: a.category,
        isCertIn: true,
        certInId: a.advisoryId,
        certInType: a.type,
        cveIds: a.cveIds ?? [],
        recommendations: a.recommendations ?? [],
      });
    }

    if (inserts.length > 0) {
      await db.insert(advisoriesTable).values(inserts);
      added += inserts.length;
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
  await Promise.all([
    runTimedSource("CERT-In", () => fetchCertIn(result)),
    runTimedSource("RSS", () => fetchRssFeeds(onBroadcast, result)),
    runTimedSource("CISA KEV", () => fetchCisaKev(result)),
    runTimedSource("NVD", () => fetchNVD(result)),
    runTimedSource("URLhaus", () => fetchURLhaus(result)),
    runTimedSource("ThreatFox", () => fetchThreatFox(result)),
    runTimedSource("Feodo", () => fetchFeodoTracker(result)),
    runTimedSource("Ransomware.live", () => fetchRansomwareLive(result)),
  ]);

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
