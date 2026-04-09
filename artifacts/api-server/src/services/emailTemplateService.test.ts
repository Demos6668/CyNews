import { describe, it, expect } from "vitest";
import {
  emailTemplateService,
  type AdvisoryWithCustomizations,
} from "./emailTemplateService";

const baseAdvisory: AdvisoryWithCustomizations = {
  id: 1,
  cveId: "CVE-2024-1234",
  title: "Critical RCE in Affected Product",
  description: "A remote code execution vulnerability.",
  cvssScore: 9.8,
  severity: "critical",
  affectedProducts: ["Product A 1.0", "Product B 2.0"],
  vendor: "TestVendor",
  patchAvailable: true,
  patchUrl: "https://example.com/patch",
  workarounds: ["Apply the patch", "Disable feature X"],
  references: ["https://nvd.nist.gov/vuln/detail/CVE-2024-1234"],
  status: "new",
  publishedAt: "2024-06-14T10:00:00.000Z",
};

const certInAdvisory: AdvisoryWithCustomizations = {
  ...baseAdvisory,
  isCertIn: true,
  certInId: "CIAD-2024-0001",
  certInType: "vulnerability",
  source: "CERT-In",
  sourceUrl: "https://cert-in.org.in/advisory/CIAD-2024-0001",
  cveIds: ["CVE-2024-1234", "CVE-2024-5678"],
  recommendations: ["Update immediately", "Monitor logs"],
};

describe("emailTemplateService", () => {
  describe("getTemplates", () => {
    it("returns all templates when type is 'all'", () => {
      const templates = emailTemplateService.getTemplates("all");
      expect(templates.length).toBeGreaterThanOrEqual(7);
      expect(templates.every((t) => t.id && t.name && t.type)).toBe(true);
    });

    it("returns all templates when no type is provided", () => {
      const templates = emailTemplateService.getTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(7);
    });

    it("filters templates by cert-in type", () => {
      const templates = emailTemplateService.getTemplates("cert-in");
      expect(templates.length).toBeGreaterThanOrEqual(2);
      templates.forEach((t) => {
        expect(t.type === "cert-in" || t.type === "all").toBe(true);
      });
    });

    it("filters templates by general type", () => {
      const templates = emailTemplateService.getTemplates("general");
      expect(templates.length).toBeGreaterThanOrEqual(2);
      templates.forEach((t) => {
        expect(t.type === "general" || t.type === "all").toBe(true);
      });
    });

    it("filters templates by threat type", () => {
      const templates = emailTemplateService.getTemplates("threat");
      expect(templates.length).toBeGreaterThanOrEqual(2);
      templates.forEach((t) => {
        expect(t.type === "threat" || t.type === "all").toBe(true);
      });
    });
  });

  describe("getTemplate", () => {
    it("returns template by known ID", () => {
      const t = emailTemplateService.getTemplate("cert-in-professional");
      expect(t).not.toBeNull();
      expect(t!.id).toBe("cert-in-professional");
      expect(t!.type).toBe("cert-in");
    });

    it("returns null for unknown template ID", () => {
      const t = emailTemplateService.getTemplate("nonexistent-template");
      expect(t).toBeNull();
    });
  });

  describe("getDefaultTemplate", () => {
    it("returns default cert-in template", () => {
      const t = emailTemplateService.getDefaultTemplate("cert-in");
      expect(t).not.toBeNull();
      expect(t!.isDefault).toBe(true);
    });

    it("returns default general template", () => {
      const t = emailTemplateService.getDefaultTemplate("general");
      expect(t).not.toBeNull();
      expect(t!.isDefault).toBe(true);
    });
  });

  describe("processTemplate", () => {
    it("generates subject and body for cert-in-professional", () => {
      const template = emailTemplateService.getTemplate("cert-in-professional")!;
      const result = emailTemplateService.processTemplate(template, certInAdvisory);

      expect(result).toHaveProperty("subject");
      expect(result).toHaveProperty("body");
      expect(result.subject).toContain("Security Advisory");
      expect(result.subject).toContain("Critical");
      expect(result.body.length).toBeGreaterThan(100);
    });

    it("generates subject and body for advisory-professional", () => {
      const template = emailTemplateService.getTemplate("advisory-professional")!;
      const result = emailTemplateService.processTemplate(template, baseAdvisory);

      expect(result.subject).toContain("Security Update");
      expect(result.body).toContain("CVE-2024-1234");
    });

    it("generates subject and body for plain-text", () => {
      const template = emailTemplateService.getTemplate("plain-text")!;
      const result = emailTemplateService.processTemplate(template, baseAdvisory);

      expect(result.subject).toContain("Critical");
      // Plain text body should not contain HTML tags like <div>
      expect(result.body).not.toContain("<div");
    });

    it("generates threat-alert template", () => {
      const template = emailTemplateService.getTemplate("threat-alert")!;
      const result = emailTemplateService.processTemplate(template, baseAdvisory);

      expect(result.subject).toContain("Threat Alert");
      expect(result.body.length).toBeGreaterThan(100);
    });

    it("generates threat-detailed template", () => {
      const template = emailTemplateService.getTemplate("threat-detailed")!;
      const result = emailTemplateService.processTemplate(template, baseAdvisory);

      expect(result.subject).toContain("Threat Intelligence Report");
      expect(result.body.length).toBeGreaterThan(100);
    });

    it("generates executive brief for cert-in", () => {
      const template = emailTemplateService.getTemplate("cert-in-executive")!;
      const result = emailTemplateService.processTemplate(template, certInAdvisory);

      expect(result.subject).toContain("Action Required");
      expect(result.body.length).toBeGreaterThan(100);
    });

    it("generates executive brief for general advisory", () => {
      const template = emailTemplateService.getTemplate("advisory-executive")!;
      const result = emailTemplateService.processTemplate(template, baseAdvisory);

      expect(result.subject).toContain("Security Brief");
      expect(result.body).toContain("Source Advisory");
      expect(result.body).not.toContain("View Full Advisory");
      expect(result.body).not.toContain("View on CERT-In");
    });

    it("handles advisory with minimal fields", () => {
      const minimal: AdvisoryWithCustomizations = {
        id: 99,
        cveId: "CVE-2024-9999",
        title: "Minimal Advisory",
        description: "",
        cvssScore: 0,
        severity: "low",
        affectedProducts: [],
        vendor: "Unknown",
        patchAvailable: false,
        patchUrl: null,
        workarounds: [],
        references: [],
        status: "new",
        publishedAt: "2024-01-01T00:00:00.000Z",
      };

      const template = emailTemplateService.getTemplate("advisory-professional")!;
      const result = emailTemplateService.processTemplate(template, minimal);

      expect(result.subject).toBeDefined();
      expect(result.body.length).toBeGreaterThan(50);
    });

    it("includes business impact when provided (advisory-professional)", () => {
      const withImpact: AdvisoryWithCustomizations = {
        ...baseAdvisory,
        businessImpact: "Production systems at risk of data exfiltration",
      };

      const template = emailTemplateService.getTemplate("advisory-professional")!;
      const result = emailTemplateService.processTemplate(template, withImpact);

      expect(result.body).toContain("data exfiltration");
    });

    it("includes IOCs when provided as array (threat-alert)", () => {
      const withIocs: AdvisoryWithCustomizations = {
        ...baseAdvisory,
        iocs: ["192.168.1.1", "evil.com", "abc123hash"],
      };

      const template = emailTemplateService.getTemplate("threat-alert")!;
      const result = emailTemplateService.processTemplate(template, withIocs);

      expect(result.body).toContain("192.168.1.1");
    });

    it("includes IOCs when provided as structured object (threat-detailed)", () => {
      const withIocs: AdvisoryWithCustomizations = {
        ...baseAdvisory,
        iocs: {
          ips: ["10.0.0.1"],
          domains: ["malware.example.com"],
          hashes: [],
          urls: [],
        },
      };

      const template = emailTemplateService.getTemplate("threat-detailed")!;
      const result = emailTemplateService.processTemplate(template, withIocs);

      expect(result.body).toContain("10.0.0.1");
      expect(result.body).toContain("malware.example.com");
    });
  });

  describe("prepareData", () => {
    it("returns prepared data with all expected fields", () => {
      const data = emailTemplateService.prepareData(certInAdvisory);

      expect(data.advisoryId).toBe("CIAD-2024-0001");
      expect(data.title).toBe("Critical RCE in Affected Product");
      expect(data.severity).toBe("CRITICAL");
      expect(data.severityLabel).toBe("Critical");
      expect(data.cvssScore).toBe("9.8");
      expect(data.isCertIn).toBe(true);
      expect(data.hasCves).toBe(true);
      expect(data.hasProducts).toBe(true);
      expect(data.cveIds).toEqual(["CVE-2024-1234", "CVE-2024-5678"]);
    });

    it("keeps CERT-In source labeling for CERT-In advisories", () => {
      const template = emailTemplateService.getTemplate("cert-in-executive")!;
      const result = emailTemplateService.processTemplate(template, certInAdvisory);
      expect(result.body).toContain("View on CERT-In");
    });

    it("falls back to cveId when certInId is absent", () => {
      const data = emailTemplateService.prepareData(baseAdvisory);
      expect(data.advisoryId).toBe("CVE-2024-1234");
      expect(data.isCertIn).toBe(false);
    });

    it("truncates long titles", () => {
      const longTitle: AdvisoryWithCustomizations = {
        ...baseAdvisory,
        title: "A".repeat(100),
      };
      const data = emailTemplateService.prepareData(longTitle);
      expect(data.titleShort.length).toBeLessThanOrEqual(60);
    });

    it("respects priority override", () => {
      const overridden: AdvisoryWithCustomizations = {
        ...baseAdvisory,
        severity: "low",
        priorityOverride: "critical",
      };
      const data = emailTemplateService.prepareData(overridden);
      expect(data.severity).toBe("CRITICAL");
      expect(data.severityLabel).toBe("Critical");
    });

    it("detects India scope from advisory scope field", () => {
      const localAdvisory: AdvisoryWithCustomizations = {
        ...baseAdvisory,
        scope: "local",
      };
      const data = emailTemplateService.prepareData(localAdvisory);
      expect(data.scope).toBe("local");
      expect(data.isIndiaRelated).toBe(true);
    });
  });
});
