/**
 * NVD (National Vulnerability Database) Fetcher - Fetches recent CVEs from NIST NVD API.
 */

import { db, advisoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { logger } from "./logger";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { type FeedUpdateResult, cvssToSeverity } from "./feedUtils";

export const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";

export async function fetchNVD(result: FeedUpdateResult): Promise<void> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const pubStart = weekAgo.toISOString();
    const pubEnd = new Date().toISOString();
    const res = await fetchWithTimeout(
      `${NVD_URL}?resultsPerPage=50&pubStartDate=${encodeURIComponent(pubStart)}&pubEndDate=${encodeURIComponent(pubEnd)}`,
      { headers: { "User-Agent": "CYFY-News-Board/1.0" } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      vulnerabilities?: Array<{
        cve: {
          id: string;
          descriptions?: Array<{ lang: string; value: string }>;
          metrics?: { cvssMetricV31?: Array<{ cvssData: { baseScore: number } }>; cvssMetricV30?: Array<{ cvssData: { baseScore: number } }> };
          references?: Array<{ url: string; tags?: string[] }>;
          published?: string;
          vulnStatus?: string;
        };
      }>;
    };
    const vulns = data.vulnerabilities ?? [];
    let added = 0;
    for (const v of vulns) {
      const cve = v.cve;
      const cveId = cve.id ?? "";
      if (!cveId.startsWith("CVE-")) continue;
      if (cve.vulnStatus === "Rejected") continue;
      const existing = await db.select({ id: advisoriesTable.id }).from(advisoriesTable).where(eq(advisoriesTable.cveId, cveId)).limit(1);
      if (existing.length > 0) continue;
      const description = cve.descriptions?.find((d) => d.lang === "en")?.value ?? "";
      const indiaDetails = indiaDetector.getIndiaDetails(description);
      let cvssScore = 0;
      const m31 = cve.metrics?.cvssMetricV31?.[0];
      const m30 = cve.metrics?.cvssMetricV30?.[0];
      if (m31) cvssScore = m31.cvssData.baseScore;
      else if (m30) cvssScore = m30.cvssData.baseScore;
      const severity = cvssToSeverity(cvssScore);
      const refs = cve.references ?? [];
      const patchRef = refs.find((r) => r.tags?.some((t) => /patch|fix|update|vendor advisory/i.test(t)));
      const patchAvailable = patchRef !== undefined;
      const patchUrl = patchRef?.url ?? `https://nvd.nist.gov/vuln/detail/${cveId}`;
      await db.insert(advisoriesTable).values({
        cveId,
        title: description ? `${cveId}: ${description.slice(0, 80).replace(/\n/g, " ")}` : cveId,
        description: description || `Vulnerability ${cveId}. See NVD for details.`,
        cvssScore: cvssScore || 5.0,
        severity,
        affectedProducts: [],
        vendor: "Unknown",
        patchAvailable,
        patchUrl,
        workarounds: [],
        references: [`https://nvd.nist.gov/vuln/detail/${cveId}`, ...refs.map((r) => r.url)].slice(0, 10),
        status: "new",
        publishedAt: cve.published ? new Date(cve.published) : new Date(),
        scope: indiaDetails.isIndia ? "local" : "global",
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
      });
      added++;
    }
    result.nvd += added;
    if (added > 0) logger.info(`[NVD] ${added} new advisories`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "NVD", error: msg });
    logger.error(`[NVD] failed: ${msg}`);
  }
}
