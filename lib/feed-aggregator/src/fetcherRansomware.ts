/**
 * Ransomware.live Fetcher - Fetches recent ransomware victim data.
 */

import { db, threatIntelTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { logger } from "./logger";
import { fetchWithResilience as fetchWithTimeout } from "./resilientFetch";
import { type FeedUpdateResult, detectScopeFromCountry } from "./feedUtils";

export type RansomwareVictim = {
  post_title: string;
  group_name: string;
  country?: string;
  published?: string;
  discovered?: string;
  website?: string;
  post_url?: string;
  description?: string;
};

export async function fetchRansomwareLive(result: FeedUpdateResult): Promise<void> {
  try {
    const res = await fetchWithTimeout("https://api.ransomware.live/recentvictims", {
      headers: { "User-Agent": "CYFY-News-Board/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as RansomwareVictim[];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Filter by date before hitting the DB
    const eligible = (data ?? []).slice(0, 30).filter((v) => {
      const pubDate = v.published ? new Date(v.published) : new Date(v.discovered ?? Date.now());
      return pubDate.getTime() >= weekAgo;
    });

    if (eligible.length === 0) return;

    // Pre-compute sourceUrls so we can batch-lookup in one query
    const eligibleWithUrl = eligible.map((v) => {
      const victimName = v.post_title ?? "Unknown";
      const sourceUrl = v.post_url && v.post_url.startsWith("http")
        ? v.post_url
        : `https://www.ransomware.live/#/group/${encodeURIComponent(v.group_name ?? "unknown")}?v=${encodeURIComponent(victimName)}`;
      return { v, victimName, sourceUrl };
    });

    // Batch-check existing records in a single query instead of N individual SELECTs
    const sourceUrls = eligibleWithUrl.map((e) => e.sourceUrl);
    const existingRows = await db
      .select({ sourceUrl: threatIntelTable.sourceUrl })
      .from(threatIntelTable)
      .where(inArray(threatIntelTable.sourceUrl, sourceUrls));
    const existingSet = new Set(existingRows.map((r) => r.sourceUrl));

    // Build new inserts without any per-item DB queries
    const toInsert: (typeof threatIntelTable.$inferInsert)[] = [];
    for (const { v, victimName, sourceUrl } of eligibleWithUrl) {
      if (existingSet.has(sourceUrl)) continue;
      const pubDate = v.published ? new Date(v.published) : new Date(v.discovered ?? Date.now());
      let scope = detectScopeFromCountry(v.country);
      const fullText = `${victimName} ${v.group_name} ${v.description ?? ""} ${v.country ?? ""}`;
      const indiaDetails = indiaDetector.getIndiaDetails(fullText, { country: v.country });
      if (indiaDetails.isIndia) scope = "local";
      toInsert.push({
        title: `Ransomware: ${victimName} by ${v.group_name}`,
        summary: `${victimName} attacked by ${v.group_name}${v.country ? `. Country: ${v.country}` : ""}`,
        description: (v.description ?? `Victim: ${victimName}\nGroup: ${v.group_name}\nCountry: ${v.country ?? "Unknown"}`).slice(0, 5000),
        scope,
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
        indianState: indiaDetails.state,
        indianStateName: indiaDetails.stateName,
        indianCity: indiaDetails.city,
        indianSector: indiaDetails.sector,
        severity: "critical",
        category: "Ransomware",
        source: "Ransomware.live",
        sourceUrl,
        references: [],
        status: "active",
        publishedAt: pubDate,
      });
    }

    if (toInsert.length > 0) {
      await db.insert(threatIntelTable).values(toInsert).onConflictDoNothing({ target: threatIntelTable.sourceUrl });
    }
    result.ransomwareLive += toInsert.length;
    if (toInsert.length > 0) logger.info(`[Ransomware.live] ${toInsert.length} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "Ransomware.live", error: msg });
  }
}
