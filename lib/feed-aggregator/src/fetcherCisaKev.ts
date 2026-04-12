/**
 * CISA Known Exploited Vulnerabilities (KEV) Fetcher.
 */

import { db, advisoriesTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { logger } from "./logger";
import { fetchWithTimeout } from "./fetchWithTimeout";
import { type FeedUpdateResult } from "./feedUtils";

const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

export async function fetchCisaKev(result: FeedUpdateResult): Promise<void> {
  try {
    const res = await fetchWithTimeout(CISA_KEV_URL, { headers: { "User-Agent": "CYFY-News-Board/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { vulnerabilities?: Array<{ cveID: string; vendorProject: string; product: string; vulnerabilityName: string; dateAdded: string; shortDescription?: string; requiredAction?: string }> };
    const vulns = data.vulnerabilities ?? [];
    const batch = vulns.slice(0, 50).filter((v) => (v.cveID ?? "").startsWith("CVE-"));

    if (batch.length === 0) return;

    const cveIds = batch.map((v) => v.cveID);
    const sourceUrl = "https://www.cisa.gov/known-exploited-vulnerabilities-catalog";

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

    for (const v of batch) {
      const cveId = v.cveID;
      const fullText = `${v.vulnerabilityName ?? ""} ${v.shortDescription ?? ""} ${v.vendorProject ?? ""} ${v.product ?? ""}`;
      const indiaDetails = indiaDetector.getIndiaDetails(fullText);
      const description = v.shortDescription ?? `Known Exploited Vulnerability: ${cveId}. See CISA KEV catalog.`;
      const affectedProducts = [`${v.vendorProject ?? ""} ${v.product ?? ""}`.trim() || "Unknown"];
      const requiredAction = v.requiredAction ?? "";
      const patchAvailable = /apply|patch|update|upgrade|install|remediat/i.test(requiredAction);
      const recommendations = [requiredAction || "Review CISA KEV remediation guidance and prioritize patching or mitigation."];

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
          // Update is rare — keep individual UPDATE per row
          await db
            .update(advisoriesTable)
            .set({
              source: existing.source ?? "CISA KEV",
              sourceUrl: existing.sourceUrl ?? sourceUrl,
              summary: existing.summary ?? description,
              content: existing.content ?? description,
              category: existing.category ?? "Known Exploited Vulnerability",
              cveIds: Array.isArray(existing.cveIds) && existing.cveIds.length > 0 ? existing.cveIds : [cveId],
            })
            .where(inArray(advisoriesTable.id, [existing.id]));
        }
        continue;
      }

      newInserts.push({
        cveId,
        title: v.vulnerabilityName ?? cveId,
        description,
        cvssScore: 9.0,
        severity: "critical",
        affectedProducts,
        vendor: v.vendorProject ?? "Unknown",
        patchAvailable,
        patchUrl: null,
        workarounds: ["Check CISA KEV for mitigation guidance"],
        references: [`https://nvd.nist.gov/vuln/detail/${cveId}`, sourceUrl],
        status: "new",
        publishedAt: v.dateAdded ? new Date(v.dateAdded) : new Date(),
        scope: indiaDetails.isIndia ? "local" : "global",
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
        source: "CISA KEV",
        sourceUrl,
        summary: description,
        content: description,
        category: "Known Exploited Vulnerability",
        cveIds: [cveId],
        recommendations,
      });
      added++;
    }

    if (newInserts.length > 0) {
      await db.insert(advisoriesTable).values(newInserts).onConflictDoNothing();
    }

    result.advisories += added;
    if (added > 0) logger.info(`[CISA KEV] ${added} new advisories`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "CISA KEV", error: msg });
    logger.error(`[CISA KEV] failed: ${msg}`);
  }
}
