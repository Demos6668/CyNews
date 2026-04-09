import { describe, it, expect } from "vitest";
import {
  createEmptyResult,
  extractItemContent,
  inferSeverity,
  cvssToSeverity,
  severityToCvss,
  isValidUrl,
  detectScopeFromCountry,
  THREAT_CATEGORY_SOURCES,
  FBI_SOURCES,
  CISA_SOURCES,
} from "./feedUtils";

describe("createEmptyResult", () => {
  it("returns zeroed counters and empty errors", () => {
    const result = createEmptyResult();
    expect(result.rssNews).toBe(0);
    expect(result.rssThreats).toBe(0);
    expect(result.advisories).toBe(0);
    expect(result.certIn).toBe(0);
    expect(result.urlhaus).toBe(0);
    expect(result.threatFox).toBe(0);
    expect(result.ransomwareLive).toBe(0);
    expect(result.nvd).toBe(0);
    expect(result.feodo).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it("returns independent instances", () => {
    const a = createEmptyResult();
    const b = createEmptyResult();
    a.rssNews = 5;
    expect(b.rssNews).toBe(0);
  });
});

describe("inferSeverity", () => {
  it("returns critical for zero-day", () => {
    expect(inferSeverity("Zero-Day exploit found", "")).toBe("critical");
  });

  it("returns critical for ransomware", () => {
    expect(inferSeverity("New Ransomware Strain", "actively spreading")).toBe("critical");
  });

  it("returns critical for actively exploited", () => {
    expect(inferSeverity("CVE-2024-1234", "actively exploited in the wild")).toBe("critical");
  });

  it("returns high for vulnerability", () => {
    expect(inferSeverity("New vulnerability disclosed", "")).toBe("high");
  });

  it("returns high for breach", () => {
    expect(inferSeverity("Data Breach", "company hacked")).toBe("high");
  });

  it("returns medium for phishing", () => {
    expect(inferSeverity("Phishing campaign", "targets users")).toBe("medium");
  });

  it("returns medium for malware", () => {
    expect(inferSeverity("", "new malware detected")).toBe("medium");
  });

  it("returns low for advisory", () => {
    expect(inferSeverity("Security Advisory", "minor update")).toBe("low");
  });

  it("returns info for unrelated content", () => {
    expect(inferSeverity("Tech news", "new product launch")).toBe("info");
  });
});

describe("cvssToSeverity", () => {
  it("returns critical for 9.0+", () => {
    expect(cvssToSeverity(9.0)).toBe("critical");
    expect(cvssToSeverity(10.0)).toBe("critical");
  });

  it("returns high for 7.0-8.9", () => {
    expect(cvssToSeverity(7.0)).toBe("high");
    expect(cvssToSeverity(8.9)).toBe("high");
  });

  it("returns medium for 4.0-6.9", () => {
    expect(cvssToSeverity(4.0)).toBe("medium");
    expect(cvssToSeverity(6.9)).toBe("medium");
  });

  it("returns low for 0.1-3.9", () => {
    expect(cvssToSeverity(0.1)).toBe("low");
    expect(cvssToSeverity(3.9)).toBe("low");
  });

  it("returns info for 0", () => {
    expect(cvssToSeverity(0)).toBe("info");
  });
});

describe("severityToCvss", () => {
  it("returns 9.0 for critical", () => expect(severityToCvss("critical")).toBe(9.0));
  it("returns 7.5 for high", () => expect(severityToCvss("high")).toBe(7.5));
  it("returns 5.0 for medium", () => expect(severityToCvss("medium")).toBe(5.0));
  it("returns 2.5 for low", () => expect(severityToCvss("low")).toBe(2.5));
  it("returns 0.0 for info", () => expect(severityToCvss("info")).toBe(0.0));
  it("returns 0.0 for undefined", () => expect(severityToCvss(undefined)).toBe(0.0));
  it("returns 0.0 for null", () => expect(severityToCvss(null)).toBe(0.0));
  it("is case-insensitive", () => {
    expect(severityToCvss("CRITICAL")).toBe(9.0);
    expect(severityToCvss("High")).toBe(7.5);
  });
  it("is inverse of cvssToSeverity for representative scores", () => {
    expect(cvssToSeverity(severityToCvss("critical"))).toBe("critical");
    expect(cvssToSeverity(severityToCvss("high"))).toBe("high");
    expect(cvssToSeverity(severityToCvss("medium"))).toBe("medium");
  });
});

describe("isValidUrl", () => {
  it("rejects null/undefined/empty", () => {
    expect(isValidUrl(null)).toBe(false);
    expect(isValidUrl(undefined)).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });

  it("rejects non-http URLs", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects fake/placeholder URLs", () => {
    expect(isValidUrl("https://example.com/article")).toBe(false);
    expect(isValidUrl("https://localhost:3000/api")).toBe(false);
    expect(isValidUrl("https://test.com/page")).toBe(false);
    expect(isValidUrl("https://fake-news.com/story")).toBe(false);
  });

  it("rejects hostnames without dots", () => {
    expect(isValidUrl("http://localhost/path")).toBe(false);
  });

  it("accepts valid URLs", () => {
    expect(isValidUrl("https://www.bleepingcomputer.com/news/article-1")).toBe(true);
    expect(isValidUrl("https://krebsonsecurity.com/2024/01/post")).toBe(true);
    expect(isValidUrl("http://securityweek.com/story")).toBe(true);
  });
});

describe("detectScopeFromCountry", () => {
  it("returns local for India variants", () => {
    expect(detectScopeFromCountry("India")).toBe("local");
    expect(detectScopeFromCountry("IN")).toBe("local");
    expect(detectScopeFromCountry("ind")).toBe("local");
  });

  it("returns global for other countries", () => {
    expect(detectScopeFromCountry("US")).toBe("global");
    expect(detectScopeFromCountry("Germany")).toBe("global");
  });

  it("returns global for undefined", () => {
    expect(detectScopeFromCountry(undefined)).toBe("global");
  });
});

describe("source constant sets", () => {
  it("THREAT_CATEGORY_SOURCES contains expected entries", () => {
    expect(THREAT_CATEGORY_SOURCES.has("Cisco Talos")).toBe(true);
    expect(THREAT_CATEGORY_SOURCES.has("URLhaus")).toBe(true);
    expect(THREAT_CATEGORY_SOURCES.has("Not A Source")).toBe(false);
  });

  it("FBI_SOURCES contains expected entries", () => {
    expect(FBI_SOURCES.has("FBI")).toBe(true);
    expect(FBI_SOURCES.has("FBI Cyber")).toBe(true);
  });

  it("CISA_SOURCES contains expected entries", () => {
    expect(CISA_SOURCES.has("CISA Alerts")).toBe(true);
    expect(CISA_SOURCES.has("US-CERT")).toBe(true);
  });
});

describe("extractItemContent", () => {
  it("picks contentSnippet when content is empty", () => {
    const result = extractItemContent("My Title", "A short snippet", undefined);
    expect(result.summary).toBe("A short snippet");
    expect(result.content).toBe("A short snippet");
  });

  it("picks stripped HTML content when longer than snippet", () => {
    const result = extractItemContent(
      "My Title",
      "Short",
      "<p>This is a much longer HTML content body with details</p>",
    );
    expect(result.summary).toBe("This is a much longer HTML content body with details");
    expect(result.content).toBe("This is a much longer HTML content body with details");
  });

  it("picks snippet when longer than stripped content", () => {
    const result = extractItemContent(
      "My Title",
      "A longer plain text snippet with more detail",
      "<b>Short</b>",
    );
    expect(result.summary).toBe("A longer plain text snippet with more detail");
    expect(result.content).toBe("A longer plain text snippet with more detail");
  });

  it("falls back to title when both snippet and content are empty", () => {
    const result = extractItemContent("Fallback Title", undefined, undefined);
    expect(result.summary).toBe("Fallback Title");
    expect(result.content).toBe("Fallback Title");
  });

  it("falls back to title when both snippet and content are whitespace", () => {
    const result = extractItemContent("Fallback Title", "   ", "  <br/>  ");
    expect(result.summary).toBe("Fallback Title");
    expect(result.content).toBe("Fallback Title");
  });

  it("caps summary at 2000 characters", () => {
    const longContent = "x".repeat(3000);
    const result = extractItemContent("Title", longContent, undefined);
    expect(result.summary.length).toBe(2000);
    expect(result.content.length).toBe(3000);
  });

  it("strips HTML tags from content and preserves word boundaries", () => {
    const result = extractItemContent(
      "Title",
      undefined,
      "<div><p>Clean <strong>text</strong> here</p></div>",
    );
    expect(result.content).toBe("Clean text here");
  });

  it("inserts spaces between block-level elements", () => {
    const result = extractItemContent(
      "Title",
      undefined,
      "<p>First paragraph</p><p>Second paragraph</p>",
    );
    expect(result.content).toBe("First paragraph Second paragraph");
  });
});
