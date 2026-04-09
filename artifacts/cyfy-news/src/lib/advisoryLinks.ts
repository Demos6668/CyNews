import type { Advisory } from "@workspace/api-client-react";

function normalizeUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
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

export function normalizeAdvisoryLinks(
  item: Pick<Advisory, "source" | "sourceUrl" | "patchUrl" | "references" | "isCertIn">
) {
  const sourceUrl = normalizeUrl(item.sourceUrl);
  let patchUrl = normalizeUrl(item.patchUrl);

  if (patchUrl && sourceUrl && patchUrl === sourceUrl) {
    patchUrl = null;
  }

  if (item.source === "CISA KEV" && isNvdDetailUrl(patchUrl)) {
    patchUrl = null;
  }

  if (item.source === "NVD" && isNvdDetailUrl(patchUrl)) {
    patchUrl = null;
  }

  const references = Array.from(
    new Set(
      (item.references ?? [])
        .map((ref) => normalizeUrl(ref))
        .filter(Boolean) as string[]
    )
  ).filter((ref) => ref !== sourceUrl && ref !== patchUrl);

  return { sourceUrl, patchUrl, references };
}

export function getPrimaryAdvisoryLinkLabel(
  item: Pick<Advisory, "source" | "isCertIn">
) {
  return item.isCertIn || item.source === "CERT-In"
    ? "View on CERT-In"
    : "Source Advisory";
}

export function getPatchAdvisoryLinkLabel() {
  return "Vendor Update";
}
