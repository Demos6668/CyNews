/**
 * CISA Known Exploited Vulnerabilities (KEV) Fetcher.
 */

import { db, advisoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { logger } from "./logger";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { type FeedUpdateResult } from "./feedUtils";

const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

export async function fetchCisaKev(result: FeedUpdateResult): Promise<void> {
  try {
    const res = await fetchWithTimeout(CISA_KEV_URL, { headers: { "User-Agent": "CYFY-News-Board/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { vulnerabilities?: Array<{ cveID: string; vendorProject: string; product: string; vulnerabilityName: string; dateAdded: string; shortDescription?: string }> };
    const vulns = data.vulnerabilities ?? [];
    let added = 0;
    for (const v of vulns.slice(0, 50)) {
      const cveId = v.cveID ?? "";
      if (!cveId.startsWith("CVE-")) continue;
      const existing = await db.select({ id: advisoriesTable.id }).from(advisoriesTable).where(eq(advisoriesTable.cveId, cveId)).limit(1);
      if (existing.length > 0) continue;
      const fullText = `${v.vulnerabilityName ?? ""} ${v.shortDescription ?? ""} ${v.vendorProject ?? ""} ${v.product ?? ""}`;
      const indiaDetails = indiaDetector.getIndiaDetails(fullText);
      await db.insert(advisoriesTable).values({
        cveId,
        title: v.vulnerabilityName ?? cveId,
        description: v.shortDescription ?? `Known Exploited Vulnerability: ${cveId}. See CISA KEV catalog.`,
        cvssScore: 9.0,
        severity: "critical",
        affectedProducts: [`${v.vendorProject ?? ""} ${v.product ?? ""}`.trim() || "Unknown"],
        vendor: v.vendorProject ?? "Unknown",
        patchAvailable: false,
        patchUrl: `https://nvd.nist.gov/vuln/detail/${cveId}`,
        workarounds: ["Check CISA KEV for mitigation guidance"],
        references: [`https://nvd.nist.gov/vuln/detail/${cveId}`, "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"],
        status: "new",
        publishedAt: v.dateAdded ? new Date(v.dateAdded) : new Date(),
        scope: indiaDetails.isIndia ? "local" : "global",
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
      });
      added++;
    }
    result.advisories += added;
    if (added > 0) logger.info(`[CISA KEV] ${added} new advisories`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "CISA KEV", error: msg });
    logger.error("[CISA KEV] failed:", msg);
  }
}
