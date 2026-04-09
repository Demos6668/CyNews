import { describe, expect, it } from "vitest";
import {
  extractPageTextContent,
  isRetryableFeedError,
  parseHtmlListingFallback,
  parseFeedDate,
  parseMalformedFeed,
  resolveSourceUrl,
} from "./fetcherRss";

describe("parseMalformedFeed", () => {
  it("extracts items from malformed RSS-like markup", () => {
    const markup = `
      <!DOCTYPE html>
      <rss>
        <channel>
          <item>
            <title>Malformed Feed Entry</title>
            <link href="https://example.com/post-1"></link>
            <description>Broken & unescaped content</description>
            <pubDate>Thu, 02 Apr 2026 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    const parsed = parseMalformedFeed(markup);

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items?.[0]).toMatchObject({
      title: "Malformed Feed Entry",
      link: "https://example.com/post-1",
      contentSnippet: "Broken & unescaped content",
      pubDate: "Thu, 02 Apr 2026 00:00:00 GMT",
    });
  });

  it("returns no items for plain HTML pages that are not feeds", () => {
    const markup = `
      <!DOCTYPE html>
      <html>
        <head><title>Security Advisory</title></head>
        <body><div id="app"></div></body>
      </html>
    `;

    const parsed = parseMalformedFeed(markup);

    expect(parsed.items).toEqual([]);
  });
});

describe("extractPageTextContent", () => {
  it("extracts readable advisory text from article markup", () => {
    const markup = `
      <!DOCTYPE html>
      <html>
        <body>
          <article>
            <h1>Vendor Security Bulletin</h1>
            <p>This advisory addresses a critical remote code execution vulnerability affecting gateway appliances.</p>
            <p>Administrators should apply the fixed version immediately and review exposed internet-facing systems.</p>
            <ul>
              <li>Rotate credentials used on affected systems.</li>
              <li>Collect logs for potential incident response.</li>
            </ul>
          </article>
        </body>
      </html>
    `;

    const text = extractPageTextContent(markup);

    expect(text).toContain("critical remote code execution vulnerability");
    expect(text).toContain("Rotate credentials used on affected systems.");
  });
});

describe("parseHtmlListingFallback", () => {
  it("extracts advisory entries from official listing pages", () => {
    const markup = `
      <html>
        <body>
          <article>
            <time datetime="2026-04-03">April 3, 2026</time>
            <a href="/en/alerts-advisories/al26-006-vulnerability-impacting-citrix-netscaler-adc-netscaler-gateway-cve-2026-3055">
              Vulnerability impacting Citrix NetScaler ADC and NetScaler Gateway
            </a>
            <p>Canadian guidance for recently disclosed NetScaler issues.</p>
          </article>
        </body>
      </html>
    `;

    const parsed = parseHtmlListingFallback(markup, {
      url: "https://www.cyber.gc.ca/en/alerts-advisories",
      linkPatterns: [/\/en\/alerts-advisories\/[a-z0-9-]+$/i],
    });

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items?.[0]).toMatchObject({
      title: "Vulnerability impacting Citrix NetScaler ADC and NetScaler Gateway",
      link: "https://www.cyber.gc.ca/en/alerts-advisories/al26-006-vulnerability-impacting-citrix-netscaler-adc-netscaler-gateway-cve-2026-3055",
      pubDate: "2026-04-03",
    });
  });
});

describe("resolveSourceUrl", () => {
  it("trims advisory links before validating them", () => {
    const url = resolveSourceUrl({
      link: "\n https://cert.europa.eu/publications/security-advisories/2026-004/ \n",
      title: "CERT-EU advisory",
    }, "CERT-EU");

    expect(url).toBe("https://cert.europa.eu/publications/security-advisories/2026-004/");
  });
});

describe("parseFeedDate", () => {
  it("parses named time zones commonly used in advisory feeds", () => {
    const parsed = parseFeedDate("Wed, 25 Mar 2026 08:51:39 CET");

    expect(parsed.toISOString()).toBe("2026-03-25T07:51:39.000Z");
  });
});

describe("isRetryableFeedError", () => {
  it("treats transient network and 5xx failures as retryable", () => {
    expect(isRetryableFeedError("fetch failed")).toBe(true);
    expect(isRetryableFeedError("Fetch timed out after 15000ms for URL: https://example.com/feed")).toBe(true);
    expect(isRetryableFeedError("Status code 503")).toBe(true);
    expect(isRetryableFeedError("Status code 404")).toBe(false);
  });
});
