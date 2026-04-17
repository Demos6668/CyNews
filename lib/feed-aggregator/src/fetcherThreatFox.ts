/**
 * ThreatFox Fetcher - Fetches IOC data from abuse.ch ThreatFox API.
 */

import { db, threatIntelTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { logger } from "./logger";
import { fetchWithResilience as fetchWithTimeout } from "./resilientFetch";
import { type FeedUpdateResult } from "./feedUtils";

export async function fetchThreatFox(result: FeedUpdateResult): Promise<void> {
  const authKey = process.env.THREATFOX_AUTH_KEY;
  if (!authKey) return;
  try {
    const res = await fetchWithTimeout("https://threatfox-api.abuse.ch/api/v1/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Auth-Key": authKey },
      body: JSON.stringify({ query: "get_iocs", days: 1 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ id: number; ioc: string; malware_printable: string; threat_type_desc: string; confidence_level: number; first_seen: string; ioc_type?: string }> };
    const iocsBatch = (data.data ?? []).slice(0, 50);

    if (iocsBatch.length === 0) return;

    // Batch-check existing records in a single query instead of N individual SELECTs
    const sourceUrls = iocsBatch.map((i) => `https://threatfox.abuse.ch/ioc/${i.id}/`);
    const existingRows = await db
      .select({ sourceUrl: threatIntelTable.sourceUrl })
      .from(threatIntelTable)
      .where(inArray(threatIntelTable.sourceUrl, sourceUrls));
    const existingSet = new Set(existingRows.map((r) => r.sourceUrl));

    // Build new inserts without any per-item DB queries
    const toInsert: (typeof threatIntelTable.$inferInsert)[] = [];
    for (const i of iocsBatch) {
      const sourceUrl = `https://threatfox.abuse.ch/ioc/${i.id}/`;
      if (existingSet.has(sourceUrl)) continue;
      const title = `IOC: ${i.malware_printable} - ${i.ioc_type ?? "unknown"}`;
      const summary = `${i.threat_type_desc}. Confidence: ${i.confidence_level}%`;
      const description = `IOC: ${i.ioc}\nMalware: ${i.malware_printable}\nType: ${i.threat_type_desc}`;
      const indiaDetails = indiaDetector.getIndiaDetails(`${title} ${summary} ${description}`);
      toInsert.push({
        title,
        summary,
        description,
        scope: indiaDetails.isIndia ? "local" : "global",
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
        indianState: indiaDetails.state,
        indianStateName: indiaDetails.stateName,
        indianCity: indiaDetails.city,
        indianSector: indiaDetails.sector,
        severity: i.confidence_level >= 75 ? "high" : "medium",
        category: "Malware IOC",
        source: "ThreatFox",
        sourceUrl,
        iocs: [i.ioc],
        references: [],
        status: "active",
        publishedAt: i.first_seen ? new Date(i.first_seen) : new Date(),
      });
    }

    if (toInsert.length > 0) {
      await db.insert(threatIntelTable).values(toInsert).onConflictDoNothing({ target: threatIntelTable.sourceUrl });
    }
    result.threatFox += toInsert.length;
    if (toInsert.length > 0) logger.info(`[ThreatFox] ${toInsert.length} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "ThreatFox", error: msg });
  }
}
