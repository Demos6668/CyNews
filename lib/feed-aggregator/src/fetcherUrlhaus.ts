/**
 * URLhaus Fetcher - Fetches malicious URL data from abuse.ch URLhaus API.
 */

import { db, threatIntelTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { logger } from "./logger";
import { fetchWithResilience as fetchWithTimeout } from "./resilientFetch";
import { type FeedUpdateResult } from "./feedUtils";

export async function fetchURLhaus(result: FeedUpdateResult): Promise<void> {
  const authKey = process.env.URLHAUS_AUTH_KEY;
  if (!authKey) return;
  try {
    const res = await fetchWithTimeout("https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/", {
      headers: { "Auth-Key": authKey },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { urls?: Array<{ id: string; url: string; threat?: string; date_added?: string; url_info_from_api?: { host?: string } }> };
    const urls = data.urls ?? [];

    if (urls.length === 0) return;

    // Batch-check existing records in a single query instead of N individual SELECTs
    const sourceUrls = urls.map((u) => `https://urlhaus.abuse.ch/url/${u.id}/`);
    const existingRows = await db
      .select({ sourceUrl: threatIntelTable.sourceUrl })
      .from(threatIntelTable)
      .where(inArray(threatIntelTable.sourceUrl, sourceUrls));
    const existingSet = new Set(existingRows.map((r) => r.sourceUrl));

    // Build new inserts without any per-item DB queries
    const toInsert: (typeof threatIntelTable.$inferInsert)[] = [];
    for (const u of urls) {
      const sourceUrl = `https://urlhaus.abuse.ch/url/${u.id}/`;
      if (existingSet.has(sourceUrl)) continue;
      const host = u.url_info_from_api?.host ?? new URL(u.url).hostname;
      const title = `Malicious URL: ${u.url.slice(0, 60)}...`;
      const summary = `Threat: ${u.threat ?? "malware"}. Host: ${host}`;
      const description = `URL: ${u.url}\nThreat: ${u.threat ?? "malware"}\nHost: ${host}`;
      const indiaDetails = indiaDetector.getIndiaDetails(`${title} ${summary} ${description}`);
      const isIndiaDomain = host.endsWith(".in") || host.includes(".gov.in") || host.includes(".co.in");
      const isIndia = indiaDetails.isIndia || isIndiaDomain;
      toInsert.push({
        title,
        summary,
        description,
        scope: isIndia ? "local" : "global",
        isIndiaRelated: isIndia,
        indiaConfidence: isIndia ? (isIndiaDomain ? 100 : indiaDetails.confidence) : 0,
        indianState: indiaDetails.state,
        indianStateName: indiaDetails.stateName,
        indianCity: indiaDetails.city,
        indianSector: indiaDetails.sector,
        severity: u.threat === "malware_download" ? "high" : "medium",
        category: "Malware Distribution",
        source: "URLhaus",
        sourceUrl,
        iocs: [u.url],
        references: [],
        status: "active",
        publishedAt: u.date_added ? new Date(u.date_added) : new Date(),
      });
    }

    if (toInsert.length > 0) {
      await db.insert(threatIntelTable).values(toInsert).onConflictDoNothing({ target: threatIntelTable.sourceUrl });
    }
    result.urlhaus += toInsert.length;
    if (toInsert.length > 0) logger.info(`[URLhaus] ${toInsert.length} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "URLhaus", error: msg });
  }
}
