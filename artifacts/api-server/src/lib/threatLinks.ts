import { threatIntelTable } from "@workspace/db";
import { sql } from "drizzle-orm";

type ThreatLinkRecord = {
  source?: string | null;
  sourceUrl?: string | null;
  references?: string[] | null;
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

export function isDisplayableThreat(item: ThreatLinkRecord): boolean {
  return Boolean(normalizeUrl(item.sourceUrl) && item.source?.trim());
}

export function normalizeThreatLinks(item: ThreatLinkRecord) {
  const sourceUrl = normalizeUrl(item.sourceUrl);
  const references = dedupeUrls(item.references ?? []).filter(
    (ref) => ref !== sourceUrl
  );

  return {
    sourceUrl,
    references,
  };
}

export const displayableThreatSql = sql`
  ${threatIntelTable.source} IS NOT NULL
  AND btrim(${threatIntelTable.source}) <> ''
  AND ${threatIntelTable.sourceUrl} IS NOT NULL
  AND btrim(${threatIntelTable.sourceUrl}) <> ''
`;
