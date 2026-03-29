/**
 * URLhaus Fetcher - Fetches malicious URL data from abuse.ch URLhaus API.
 */

import { db, threatIntelTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { logger } from "./logger";
import { type FeedUpdateResult } from "./feedUtils";

export async function fetchURLhaus(result: FeedUpdateResult): Promise<void> {
  const authKey = process.env.URLHAUS_AUTH_KEY;
  if (!authKey) return;
  try {
    const res = await fetch("https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/", {
      headers: { "Auth-Key": authKey },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { urls?: Array<{ id: string; url: string; threat?: string; date_added?: string; url_info_from_api?: { host?: string } }> };
    const urls = data.urls ?? [];
    let added = 0;
    for (const u of urls) {
      const sourceUrl = `https://urlhaus.abuse.ch/url/${u.id}/`;
      const existing = await db.select({ id: threatIntelTable.id }).from(threatIntelTable).where(eq(threatIntelTable.sourceUrl, sourceUrl)).limit(1);
      if (existing.length > 0) continue;
      const host = u.url_info_from_api?.host ?? new URL(u.url).hostname;
      const title = `Malicious URL: ${u.url.slice(0, 60)}...`;
      const summary = `Threat: ${u.threat ?? "malware"}. Host: ${host}`;
      const description = `URL: ${u.url}\nThreat: ${u.threat ?? "malware"}\nHost: ${host}`;
      const indiaDetails = indiaDetector.getIndiaDetails(`${title} ${summary} ${description}`);
      const isIndiaDomain = host.endsWith(".in") || host.includes(".gov.in") || host.includes(".co.in");
      const isIndia = indiaDetails.isIndia || isIndiaDomain;
      await db.insert(threatIntelTable).values({
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
        references: [sourceUrl],
        status: "active",
        publishedAt: u.date_added ? new Date(u.date_added) : new Date(),
      });
      added++;
    }
    result.urlhaus += added;
    if (added > 0) logger.info(`[URLhaus] ${added} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "URLhaus", error: msg });
  }
}
