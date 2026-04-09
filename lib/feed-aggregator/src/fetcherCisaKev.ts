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
    const data = (await res.json()) as { vulnerabilities?: Array<{ cveID: string; vendorProject: string; product: string; vulnerabilityName: string; dateAdded: string; shortDescription?: string; requiredAction?: string }> };
    const vulns = data.vulnerabilities ?? [];
    let added = 0;
    for (const v of vulns.slice(0, 50)) {
      const cveId = v.cveID ?? "";
      if (!cveId.startsWith("CVE-")) continue;
      const fullText = `${v.vulnerabilityName ?? ""} ${v.shortDescription ?? ""} ${v.vendorProject ?? ""} ${v.product ?? ""}`;
      const indiaDetails = indiaDetector.getIndiaDetails(fullText);
      const sourceUrl = "https://www.cisa.gov/known-exploited-vulnerabilities-catalog";
      const description = v.shortDescription ?? `Known Exploited Vulnerability: ${cveId}. See CISA KEV catalog.`;
      const affectedProducts = [`${v.vendorProject ?? ""} ${v.product ?? ""}`.trim() || "Unknown"];
      const requiredAction = v.requiredAction ?? "";
      const patchAvailable = /apply|patch|update|upgrade|install|remediat/i.test(requiredAction);
      const recommendations = [requiredAction || "Review CISA KEV remediation guidance and prioritize patching or mitigation."];
      const existing = await db
        .select({
          id: advisoriesTable.id,
          source: advisoriesTable.source,
          sourceUrl: advisoriesTable.sourceUrl,
          summary: advisoriesTable.summary,
          content: advisoriesTable.content,
          category: advisoriesTable.category,
          cveIds: advisoriesTable.cveIds,
        })
        .from(advisoriesTable)
        .where(eq(advisoriesTable.cveId, cveId))
        .limit(1);
      if (existing.length > 0) {
        const current = existing[0];
        const needsBackfill =
          !current.source ||
          !current.sourceUrl ||
          !current.summary ||
          !current.content ||
          !current.category ||
          !Array.isArray(current.cveIds) ||
          current.cveIds.length === 0;

        if (needsBackfill) {
          await db
            .update(advisoriesTable)
            .set({
              source: current.source ?? "CISA KEV",
              sourceUrl: current.sourceUrl ?? sourceUrl,
              summary: current.summary ?? description,
              content: current.content ?? description,
              category: current.category ?? "Known Exploited Vulnerability",
              cveIds: Array.isArray(current.cveIds) && current.cveIds.length > 0 ? current.cveIds : [cveId],
            })
            .where(eq(advisoriesTable.id, current.id));
        }
        continue;
      }
      await db.insert(advisoriesTable).values({
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
    result.advisories += added;
    if (added > 0) logger.info(`[CISA KEV] ${added} new advisories`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "CISA KEV", error: msg });
    logger.error(`[CISA KEV] failed: ${msg}`);
  }
}
