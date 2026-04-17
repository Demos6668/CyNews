/**
 * Feodo Tracker Fetcher - Fetches banking trojan C2 server data from abuse.ch.
 */

import { db, threatIntelTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";
import { fetchWithResilience as fetchWithTimeout } from "./resilientFetch";
import { type FeedUpdateResult } from "./feedUtils";

const FEODO_URL = "https://feodotracker.abuse.ch/downloads/ipblocklist.json";

type FeodoEntry = {
  ip_address: string;
  port: number;
  malware: string;
  country?: string;
  first_seen?: string;
};

export async function fetchFeodoTracker(result: FeedUpdateResult): Promise<void> {
  try {
    const res = await fetchWithTimeout(FEODO_URL, { headers: { "User-Agent": "CYFY-News-Board/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as FeodoEntry[];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Filter by date before hitting the DB
    const eligible = (data ?? []).slice(0, 30).filter((e) => {
      const firstSeen = e.first_seen ? new Date(e.first_seen).getTime() : 0;
      return firstSeen >= weekAgo;
    });

    if (eligible.length === 0) return;

    // Batch-check existing records in a single query instead of N individual SELECTs
    const sourceUrls = eligible.map((e) => `https://feodotracker.abuse.ch/browse/host/${e.ip_address}/`);
    const existingRows = await db
      .select({ sourceUrl: threatIntelTable.sourceUrl })
      .from(threatIntelTable)
      .where(inArray(threatIntelTable.sourceUrl, sourceUrls));
    const existingSet = new Set(existingRows.map((r) => r.sourceUrl));

    // Build new inserts without any per-item DB queries
    const toInsert: (typeof threatIntelTable.$inferInsert)[] = [];
    for (const e of eligible) {
      const sourceUrl = `https://feodotracker.abuse.ch/browse/host/${e.ip_address}/`;
      if (existingSet.has(sourceUrl)) continue;
      const isIndia = !!(e.country && (e.country.toLowerCase() === "in" || e.country.toLowerCase() === "india"));
      toInsert.push({
        title: `Banking Trojan C2: ${e.ip_address}`,
        summary: `${e.malware} command and control server. Country: ${e.country ?? "Unknown"}`,
        description: `IP: ${e.ip_address}\nPort: ${e.port}\nMalware: ${e.malware}\nCountry: ${e.country ?? "Unknown"}`,
        scope: isIndia ? "local" : "global",
        isIndiaRelated: isIndia,
        indiaConfidence: isIndia ? 100 : 0,
        indianState: null,
        indianStateName: null,
        indianCity: null,
        indianSector: null,
        severity: "high",
        category: "Banking Trojan",
        source: "Feodo Tracker",
        sourceUrl,
        iocs: [e.ip_address],
        references: [],
        status: "active",
        publishedAt: e.first_seen ? new Date(e.first_seen) : new Date(),
      });
    }

    if (toInsert.length > 0) {
      await db.insert(threatIntelTable).values(toInsert).onConflictDoNothing({ target: threatIntelTable.sourceUrl });
    }
    result.feodo += toInsert.length;
    if (toInsert.length > 0) logger.info(`[Feodo Tracker] ${toInsert.length} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "Feodo Tracker", error: msg });
    logger.error(`[Feodo Tracker] failed: ${msg}`);
  }
}
