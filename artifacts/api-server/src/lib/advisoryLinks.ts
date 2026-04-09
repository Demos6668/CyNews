import { advisoriesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

type AdvisoryLinkRecord = {
  source?: string | null;
  sourceUrl?: string | null;
  patchUrl?: string | null;
  references?: string[] | null;
  isCertIn?: boolean | null;
};

function normalizeUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function sameUrl(left: string | null, right: string | null): boolean {
  return Boolean(left && right && left === right);
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

function dedupeUrls(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(normalized);
  }

  return deduped;
}

export function isDisplayableAdvisory(item: AdvisoryLinkRecord): boolean {
  return Boolean(normalizeUrl(item.sourceUrl) && item.source?.trim());
}

export function normalizeAdvisoryLinks(item: AdvisoryLinkRecord) {
  const sourceUrl = normalizeUrl(item.sourceUrl);
  let patchUrl = normalizeUrl(item.patchUrl);

  if (sameUrl(sourceUrl, patchUrl)) {
    patchUrl = null;
  }

  if ((item.source ?? "").trim() === "CISA KEV" && isNvdDetailUrl(patchUrl)) {
    patchUrl = null;
  }

  if ((item.source ?? "").trim() === "NVD" && isNvdDetailUrl(patchUrl)) {
    patchUrl = null;
  }

  const references = dedupeUrls(item.references ?? []).filter(
    (ref) => ref !== sourceUrl && ref !== patchUrl
  );

  return {
    sourceUrl,
    patchUrl,
    references,
  };
}

export function getPrimaryAdvisoryLinkLabel(item: AdvisoryLinkRecord): string {
  return item.isCertIn || (item.source ?? "").trim() === "CERT-In"
    ? "View on CERT-In"
    : "Source Advisory";
}

export function getPatchAdvisoryLinkLabel(): string {
  return "Vendor Update";
}

export const displayableAdvisorySql = sql`
  ${advisoriesTable.source} IS NOT NULL
  AND btrim(${advisoriesTable.source}) <> ''
  AND ${advisoriesTable.sourceUrl} IS NOT NULL
  AND btrim(${advisoriesTable.sourceUrl}) <> ''
`;
