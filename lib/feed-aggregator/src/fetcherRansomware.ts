/**
 * Ransomware.live Fetcher - Fetches recent ransomware victim data.
 */

import { db, threatIntelTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { logger } from "./logger";
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
    const res = await fetch("https://api.ransomware.live/recentvictims", {
      headers: { "User-Agent": "CYFY-News-Board/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as RansomwareVictim[];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let added = 0;
    for (const v of (data ?? []).slice(0, 30)) {
      const pubDate = v.published ? new Date(v.published) : new Date(v.discovered ?? Date.now());
      if (pubDate.getTime() < weekAgo) continue;
      const victimName = v.post_title ?? "Unknown";
      const sourceUrl = v.post_url && v.post_url.startsWith("http")
        ? v.post_url
        : `https://www.ransomware.live/#/group/${encodeURIComponent(v.group_name ?? "unknown")}?v=${encodeURIComponent(victimName)}`;
      const existing = await db.select({ id: threatIntelTable.id }).from(threatIntelTable).where(eq(threatIntelTable.sourceUrl, sourceUrl)).limit(1);
      if (existing.length > 0) continue;
      let scope = detectScopeFromCountry(v.country);
      const fullText = `${victimName} ${v.group_name} ${v.description ?? ""} ${v.country ?? ""}`;
      const indiaDetails = indiaDetector.getIndiaDetails(fullText, { country: v.country });
      if (indiaDetails.isIndia) scope = "local";
      await db.insert(threatIntelTable).values({
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
        references: [sourceUrl],
        status: "active",
        publishedAt: pubDate,
      });
      added++;
    }
    result.ransomwareLive += added;
    if (added > 0) logger.info(`[Ransomware.live] ${added} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "Ransomware.live", error: msg });
  }
}
