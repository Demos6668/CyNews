/**
 * Audit and normalize advisory source/patch link semantics.
 * Run: pnpm --filter @workspace/scripts run audit-advisory-links
 */

import { db, advisoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function normalizeUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function dedupeUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    results.push(normalized);
  }

  return results;
}

function isNvdDetailUrl(url: string | null): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "nvd.nist.gov" &&
      parsed.pathname.startsWith("/vuln/detail/")
    );
  } catch {
    return false;
  }
}

function looksGenericUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, "") || "/";

    if (path === "/") return true;
    if (/^\/(security|security\/advisories|alerts-advisories|update-guide|psirt|releases)$/i.test(path)) {
      return true;
    }
    if (parsed.hostname === "wordpress.org" && /^\/plugins\/[^/]+$/i.test(path)) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

function looksCanonicalAdvisoryUrl(url: string | null): boolean {
  if (!url) return false;
  if (looksGenericUrl(url)) return false;
  if (isNvdDetailUrl(url)) return true;

  try {
    const parsed = new URL(url);
    const lower = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();

    return (
      /cve-\d{4}-\d{4,7}/i.test(lower) ||
      /advis(or|ory)|bulletin|alert|vulnerab|security-?update|psirt|kev|msrc|fg-ir|ciscosecurityadvisory/i.test(lower)
    );
  } catch {
    return false;
  }
}

function deriveSourceName(sourceUrl: string, vendor: string | null | undefined): string {
  if (vendor && vendor !== "Unknown") {
    if (sourceUrl.includes("fortiguard.com/psirt/")) return "Fortinet PSIRT";
    return vendor;
  }

  try {
    const parsed = new URL(sourceUrl);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Security Advisory";
  }
}

async function auditAdvisoryLinks() {
  console.log("Auditing advisory link integrity...\n");

  const advisories = await db.select().from(advisoriesTable);
  console.log(`Found ${advisories.length} advisories to inspect`);

  let updated = 0;
  let clearedPatch = 0;
  let dedupedReferences = 0;
  let repairedCanonicalSource = 0;
  let hidWeakRows = 0;

  for (const advisory of advisories) {
    const originalSourceUrl = advisory.sourceUrl;
    const originalPatchUrl = advisory.patchUrl;
    const originalReferences = (advisory.references as string[]) ?? [];
    const originalSource = advisory.source;

    let source = advisory.source?.trim() || null;
    let sourceUrl = normalizeUrl(advisory.sourceUrl);
    let patchUrl = normalizeUrl(advisory.patchUrl);

    if (patchUrl && sourceUrl && patchUrl === sourceUrl) {
      patchUrl = null;
    }

    if (source === "CISA KEV" && isNvdDetailUrl(patchUrl)) {
      patchUrl = null;
    }

    if (source === "NVD" && isNvdDetailUrl(patchUrl)) {
      patchUrl = null;
    }

    let references = dedupeUrls(originalReferences);

    if ((!sourceUrl || !source) && patchUrl && looksCanonicalAdvisoryUrl(patchUrl)) {
      sourceUrl = patchUrl;
      source = source ?? deriveSourceName(sourceUrl, advisory.vendor);
      patchUrl = null;
      repairedCanonicalSource++;
    }

    if (!sourceUrl || !source) {
      const referenceSource = references.find((ref) => looksCanonicalAdvisoryUrl(ref) && !isNvdDetailUrl(ref));
      if (referenceSource) {
        sourceUrl = referenceSource;
        source = source ?? deriveSourceName(sourceUrl, advisory.vendor);
        repairedCanonicalSource++;
      }
    }

    if (!sourceUrl || !source) {
      if (!sourceUrl && advisory.sourceUrl) {
        console.log(`  hiding weak advisory ${advisory.id}: invalid source URL`);
      }
      source = null;
      sourceUrl = null;
      patchUrl = null;
      hidWeakRows++;
    }

    references = references.filter((ref) => ref !== sourceUrl && ref !== patchUrl);

    const changed =
      source !== originalSource ||
      sourceUrl !== originalSourceUrl ||
      patchUrl !== originalPatchUrl ||
      JSON.stringify(references) !== JSON.stringify(originalReferences);

    if (!changed) continue;

    if (patchUrl !== originalPatchUrl) clearedPatch++;
    if (JSON.stringify(references) !== JSON.stringify(originalReferences)) dedupedReferences++;

    await db
      .update(advisoriesTable)
      .set({
        source,
        sourceUrl,
        patchUrl,
        references,
      })
      .where(eq(advisoriesTable.id, advisory.id));

    updated++;
  }

  console.log(`\nUpdated ${updated} advisories`);
  console.log(`  Cleared misleading patch links: ${clearedPatch}`);
  console.log(`  Deduped references: ${dedupedReferences}`);
  console.log(`  Repaired canonical sources: ${repairedCanonicalSource}`);
  console.log(`  Hid weak legacy rows: ${hidWeakRows}`);
}

auditAdvisoryLinks().catch((error) => {
  console.error(error);
  process.exit(1);
});
