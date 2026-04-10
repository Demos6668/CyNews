/**
 * Feodo Tracker Fetcher - Fetches banking trojan C2 server data from abuse.ch.
 */

import { db, threatIntelTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { fetchWithTimeout } from "./fetchWithTimeout";
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
    let added = 0;
    for (const e of (data ?? []).slice(0, 30)) {
      const firstSeen = e.first_seen ? new Date(e.first_seen).getTime() : 0;
      if (firstSeen < weekAgo) continue;
      const isIndia = !!(e.country && (e.country.toLowerCase() === "in" || e.country.toLowerCase() === "india"));
      const sourceUrl = `https://feodotracker.abuse.ch/browse/host/${e.ip_address}/`;
      const existing = await db.select({ id: threatIntelTable.id }).from(threatIntelTable).where(eq(threatIntelTable.sourceUrl, sourceUrl)).limit(1);
      if (existing.length > 0) continue;
      await db.insert(threatIntelTable).values({
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
      }).onConflictDoNothing({ target: threatIntelTable.sourceUrl });
      added++;
    }
    result.feodo += added;
    if (added > 0) logger.info(`[Feodo Tracker] ${added} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "Feodo Tracker", error: msg });
    logger.error(`[Feodo Tracker] failed: ${msg}`);
  }
}
