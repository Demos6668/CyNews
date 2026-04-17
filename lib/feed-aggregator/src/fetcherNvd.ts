/**
 * NVD (National Vulnerability Database) Fetcher - Fetches recent CVEs from NIST NVD API.
 */

import { db, advisoriesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { logger } from "./logger";
import { fetchWithResilience as fetchWithTimeout } from "./resilientFetch";
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

    const eligible = vulns.filter((v) => {
      const cveId = v.cve.id ?? "";
      return cveId.startsWith("CVE-") && v.cve.vulnStatus !== "Rejected";
    });

    if (eligible.length === 0) return;

    const cveIds = eligible.map((v) => v.cve.id);

    // Batch-load all existing rows for these CVE IDs (1 query instead of N)
    const existingRows = await db
      .select({
        id: advisoriesTable.id,
        cveId: advisoriesTable.cveId,
        source: advisoriesTable.source,
        sourceUrl: advisoriesTable.sourceUrl,
        summary: advisoriesTable.summary,
        content: advisoriesTable.content,
        category: advisoriesTable.category,
        cveIds: advisoriesTable.cveIds,
      })
      .from(advisoriesTable)
      .where(inArray(advisoriesTable.cveId, cveIds));

    const existingMap = new Map(existingRows.map((r) => [r.cveId, r]));

    let added = 0;
    const newInserts: (typeof advisoriesTable.$inferInsert)[] = [];

    for (const v of eligible) {
      const cve = v.cve;
      const cveId = cve.id;
      const description = cve.descriptions?.find((d) => d.lang === "en")?.value ?? "";
      const indiaDetails = indiaDetector.getIndiaDetails(description);
      let cvssScore = 0;
      const m31 = cve.metrics?.cvssMetricV31?.[0];
      const m30 = cve.metrics?.cvssMetricV30?.[0];
      if (m31) cvssScore = m31.cvssData.baseScore;
      else if (m30) cvssScore = m30.cvssData.baseScore;
      const severity = cvssToSeverity(cvssScore);
      const sourceUrl = `https://nvd.nist.gov/vuln/detail/${cveId}`;
      const summary = description.slice(0, 2000);
      const content = description || `Vulnerability ${cveId}. See NVD for details.`;
      const refs = cve.references ?? [];
      const patchRef = refs.find((r) => r.tags?.some((t) => /patch|fix|update|vendor advisory/i.test(t)));
      const patchAvailable = patchRef !== undefined;
      const patchUrl = patchRef?.url && patchRef.url !== sourceUrl ? patchRef.url : null;

      const existing = existingMap.get(cveId);
      if (existing) {
        const needsBackfill =
          !existing.source ||
          !existing.sourceUrl ||
          !existing.summary ||
          !existing.content ||
          !existing.category ||
          !Array.isArray(existing.cveIds) ||
          existing.cveIds.length === 0;

        if (needsBackfill) {
          await db
            .update(advisoriesTable)
            .set({
              source: existing.source ?? "NVD",
              sourceUrl: existing.sourceUrl ?? sourceUrl,
              summary: existing.summary ?? summary,
              content: existing.content ?? content,
              category: existing.category ?? "Vulnerability",
              cveIds: Array.isArray(existing.cveIds) && existing.cveIds.length > 0 ? existing.cveIds : [cveId],
            })
            .where(inArray(advisoriesTable.id, [existing.id]));
        }
        continue;
      }

      newInserts.push({
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
        references: refs.map((r) => r.url).filter((url) => url && url !== sourceUrl).slice(0, 10),
        status: "new",
        publishedAt: cve.published ? new Date(cve.published) : new Date(),
        scope: indiaDetails.isIndia ? "local" : "global",
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
        source: "NVD",
        sourceUrl,
        summary,
        content,
        category: "Vulnerability",
        cveIds: [cveId],
        recommendations: [],
      });
      added++;
    }

    if (newInserts.length > 0) {
      await db.insert(advisoriesTable).values(newInserts).onConflictDoNothing();
    }

    result.nvd += added;
    if (added > 0) logger.info(`[NVD] ${added} new advisories`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "NVD", error: msg });
    logger.error(`[NVD] failed: ${msg}`);
  }
}
