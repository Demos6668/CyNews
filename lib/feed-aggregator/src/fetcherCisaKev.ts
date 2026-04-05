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
    const BATCH_SIZE = 50;
    const batch: (typeof advisoriesTable.$inferInsert)[] = [];

    for (const v of vulns) {
      const cveId = v.cveID ?? "";
      if (!cveId.startsWith("CVE-")) continue;
      const existing = await db.select({ id: advisoriesTable.id }).from(advisoriesTable).where(eq(advisoriesTable.cveId, cveId)).limit(1);
      if (existing.length > 0) continue;
      const fullText = `${v.vulnerabilityName ?? ""} ${v.shortDescription ?? ""} ${v.vendorProject ?? ""} ${v.product ?? ""}`;
      const indiaDetails = indiaDetector.getIndiaDetails(fullText);
      // CISA KEV requiredAction often says "Apply patch" or "Update to version X"
      const requiredAction = v.requiredAction ?? "";
      const patchAvailable = /apply|patch|update|upgrade|install|remediat/i.test(requiredAction);
      batch.push({
        cveId,
        title: v.vulnerabilityName ?? cveId,
        description: v.shortDescription ?? `Known Exploited Vulnerability: ${cveId}. See CISA KEV catalog.`,
        cvssScore: 9.0,
        severity: "critical",
        affectedProducts: [`${v.vendorProject ?? ""} ${v.product ?? ""}`.trim() || "Unknown"],
        vendor: v.vendorProject ?? "Unknown",
        patchAvailable,
        patchUrl: `https://nvd.nist.gov/vuln/detail/${cveId}`,
        workarounds: ["Check CISA KEV for mitigation guidance"],
        references: [`https://nvd.nist.gov/vuln/detail/${cveId}`, "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"],
        status: "new",
        publishedAt: v.dateAdded ? new Date(v.dateAdded) : new Date(),
        scope: indiaDetails.isIndia ? "local" : "global",
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
      });

      if (batch.length >= BATCH_SIZE) {
        await db.insert(advisoriesTable).values(batch);
        added += batch.length;
        logger.info(`[CISA KEV] inserted batch of ${batch.length} (total: ${added})`);
        batch.length = 0;
      }
    }

    if (batch.length > 0) {
      await db.insert(advisoriesTable).values(batch);
      added += batch.length;
    }

    result.advisories += added;
    if (added > 0) logger.info(`[CISA KEV] ${added} new advisories`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "CISA KEV", error: msg });
    logger.error(`[CISA KEV] failed: ${msg}`);
  }
}
