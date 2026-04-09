import { describe, expect, it } from "vitest";
import {
  getPrimaryAdvisoryLinkLabel,
  getPatchAdvisoryLinkLabel,
  isDisplayableAdvisory,
  normalizeAdvisoryLinks,
} from "./advisoryLinks";

describe("advisoryLinks", () => {
  it("requires both source and sourceUrl for display", () => {
    expect(isDisplayableAdvisory({ source: "Vendor Feed", sourceUrl: "https://example.com/advisory" })).toBe(true);
    expect(isDisplayableAdvisory({ source: "", sourceUrl: "https://example.com/advisory" })).toBe(false);
    expect(isDisplayableAdvisory({ source: "Vendor Feed", sourceUrl: null })).toBe(false);
  });

  it("drops duplicate source and misleading patch links from output", () => {
    const links = normalizeAdvisoryLinks({
      source: "CISA KEV",
      sourceUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      patchUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-0001",
      references: [
        "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
        "https://nvd.nist.gov/vuln/detail/CVE-2026-0001",
      ],
    });

    expect(links.patchUrl).toBeNull();
    expect(links.references).toEqual(["https://nvd.nist.gov/vuln/detail/CVE-2026-0001"]);
  });

  it("uses CERT-In specific source labeling only for CERT-In advisories", () => {
    expect(getPrimaryAdvisoryLinkLabel({ source: "CERT-In", isCertIn: true })).toBe("View on CERT-In");
    expect(getPrimaryAdvisoryLinkLabel({ source: "Vendor Feed", isCertIn: false })).toBe("Source Advisory");
    expect(getPatchAdvisoryLinkLabel()).toBe("Vendor Update");
  });
});
