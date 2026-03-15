import { describe, it, expect } from "vitest";
import {
  generateAdvisoryHTML,
  generateBulkAdvisoryHTML,
  type AdvisoryForExport,
} from "./exportService";

const sampleAdvisory: AdvisoryForExport = {
  id: 1,
  cveId: "CVE-2024-1234",
  title: "Test Advisory Title",
  description: "A vulnerability in the software allows remote code execution.",
  cvssScore: 9.8,
  severity: "critical",
  affectedProducts: ["Product A 1.0", "Product B 2.0"],
  vendor: "TestVendor",
  patchAvailable: true,
  patchUrl: "https://example.com/patch",
  workarounds: ["Apply the patch", "Disable the feature"],
  references: ["https://nvd.nist.gov/vuln/detail/CVE-2024-1234"],
  status: "new",
  publishedAt: "2024-01-15T00:00:00.000Z",
};

describe("exportService", () => {
  describe("generateAdvisoryHTML", () => {
    it("generates valid HTML with title and CVE ID", () => {
      const html = generateAdvisoryHTML(sampleAdvisory);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("CVE-2024-1234");
      expect(html).toContain("Test Advisory Title");
    });

    it("escapes HTML in user content to prevent XSS", () => {
      const xssAdvisory: AdvisoryForExport = {
        ...sampleAdvisory,
        title: "<script>alert('xss')</script>",
        description: "Test <img src=x onerror=alert(1)>",
      };
      const html = generateAdvisoryHTML(xssAdvisory);
      // Angle brackets must be escaped so browser won't parse as HTML
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).not.toMatch(/<img[^>]*onerror/); // No unescaped <img...onerror
      expect(html).toContain("&lt;img");
    });

    it("includes severity colors for critical", () => {
      const html = generateAdvisoryHTML(sampleAdvisory);
      expect(html).toContain("#F85149"); // critical color
      expect(html).toContain("CRITICAL");
    });

    it("includes affected products and workarounds", () => {
      const html = generateAdvisoryHTML(sampleAdvisory);
      expect(html).toContain("Product A 1.0");
      expect(html).toContain("Product B 2.0");
      expect(html).toContain("Apply the patch");
      expect(html).toContain("Disable the feature");
    });

    it("handles empty affected products and workarounds", () => {
      const minimal: AdvisoryForExport = {
        ...sampleAdvisory,
        affectedProducts: [],
        workarounds: [],
      };
      const html = generateAdvisoryHTML(minimal);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("CVE-2024-1234");
    });

    it("includes NVD link", () => {
      const html = generateAdvisoryHTML(sampleAdvisory);
      expect(html).toContain("nvd.nist.gov/vuln/detail/CVE-2024-1234");
    });

    it("uses info color for unknown severity", () => {
      const unknown: AdvisoryForExport = { ...sampleAdvisory, severity: "unknown" };
      const html = generateAdvisoryHTML(unknown);
      expect(html).toContain("#0095AF"); // info color
    });

    it("omits patch link when patchUrl is null", () => {
      const noPatch: AdvisoryForExport = { ...sampleAdvisory, patchUrl: null };
      const html = generateAdvisoryHTML(noPatch);
      expect(html).not.toContain('href="undefined"');
      expect(html).toContain("NVD Entry");
    });

    it("escapes patchUrl and references", () => {
      const withQuotes: AdvisoryForExport = {
        ...sampleAdvisory,
        patchUrl: 'https://example.com/patch?a="x"',
        references: ['https://evil.com/" onload="alert(1)'],
      };
      const html = generateAdvisoryHTML(withQuotes);
      expect(html).toContain("&quot;");
      expect(html).not.toContain('onload="alert');
    });

    it("includes scope in meta when local", () => {
      const local: AdvisoryForExport = { ...sampleAdvisory, scope: "local" };
      const html = generateAdvisoryHTML(local);
      expect(html).toContain("Scope: India (Local)");
    });

    it("includes scope as Global when global or undefined", () => {
      const global: AdvisoryForExport = { ...sampleAdvisory, scope: "global" };
      const html = generateAdvisoryHTML(global);
      expect(html).toContain("Scope: Global");
    });
  });

  describe("generateBulkAdvisoryHTML", () => {
    it("generates bulk report with table of contents", () => {
      const advisories = [sampleAdvisory, { ...sampleAdvisory, id: 2, cveId: "CVE-2024-5678" }];
      const html = generateBulkAdvisoryHTML(advisories, "Security Report");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Security Report");
      expect(html).toContain("2 advisories");
      expect(html).toContain("CVE-2024-1234");
      expect(html).toContain("CVE-2024-5678");
      expect(html).toContain("advisory-0");
      expect(html).toContain("advisory-1");
    });

    it("escapes HTML in bulk report", () => {
      const xssAdvisory: AdvisoryForExport = {
        ...sampleAdvisory,
        title: "Bad <script>tag</script>",
      };
      const html = generateBulkAdvisoryHTML([xssAdvisory]);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("handles empty advisories array", () => {
      const html = generateBulkAdvisoryHTML([], "Empty Report");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Empty Report");
      expect(html).toContain("0 advisories");
    });

    it("includes scope in advisory sections", () => {
      const local: AdvisoryForExport = { ...sampleAdvisory, scope: "local" };
      const global: AdvisoryForExport = { ...sampleAdvisory, id: 2, scope: "global" };
      const html = generateBulkAdvisoryHTML([local, global]);
      expect(html).toContain("Scope: India (Local)");
      expect(html).toContain("Scope: Global");
    });
  });
});
