import type { ThreatIntelItem } from "@workspace/api-client-react";

function normalizeUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

export function normalizeThreatLinks(item: Pick<ThreatIntelItem, "sourceUrl" | "references">) {
  const sourceUrl = normalizeUrl(item.sourceUrl);
  const references = Array.from(
    new Set(
      (item.references ?? [])
        .map((ref) => normalizeUrl(ref))
        .filter(Boolean) as string[]
    )
  ).filter((ref) => ref !== sourceUrl);

  return {
    sourceUrl,
    references,
  };
}
