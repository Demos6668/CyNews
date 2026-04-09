import { describe, expect, it } from "vitest";
import { parseCertInDetailHtml, parseCertInListingPage, parseCertInRssXml } from "./certInFetcher";

describe("parseCertInRssXml", () => {
  it("returns no items for empty XML responses", async () => {
    await expect(parseCertInRssXml("", "advisory")).resolves.toEqual([]);
  });

  it("parses valid CERT-In RSS items", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0">
        <channel>
          <item>
            <title>CERT-In Advisory CIAD-2026-0015</title>
            <link>https://www.cert-in.org.in/s2cMainServlet?pageid=PUBVLNOTES02&amp;VLCODE=CIAD-2026-0015</link>
            <description>Multiple Vulnerabilities in Apple Products</description>
            <pubDate>Thu, 26 Mar 2026 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;

    const items = await parseCertInRssXml(xml, "advisory");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      advisoryId: "CIAD-2026-0015",
      title: "CERT-In Advisory CIAD-2026-0015",
      summary: "Multiple Vulnerabilities in Apple Products",
      source: "CERT-In",
      type: "advisory",
    });
  });
});

describe("parseCertInListingPage", () => {
  it("parses advisory year pages using the current CERT-In markup", () => {
    const html = `
      <table class="content" width="639">
        <tr>
          <td align="left" valign="middle">
            <li><a href="/s2cMainServlet?pageid=PUBVLNOTES02&VLCODE=CIAD-2026-0015">
              <span class="contentTD"><b><span class="verblue2">CERT-In Advisory CIAD-2026-0015</span></b></span>
            </a></li>
          </td>
        </tr>
        <tr>
          <td align="left" valign="middle"><span class="contentTD,DateContent">&nbsp;&nbsp;&nbsp; (March     26, 2026)</span></td>
        </tr>
        <tr>
          <td align="left" valign="middle" class="content">
            <div style="height: 30px; overflow: hidden"><span style="padding-left: 20px">Multiple Vulnerabilities in Apple Products</span></div>
          </td>
        </tr>
      </table>
    `;

    const items = parseCertInListingPage(html, "advisory");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      advisoryId: "CIAD-2026-0015",
      title: "Multiple Vulnerabilities in Apple Products",
      summary: "Multiple Vulnerabilities in Apple Products",
      sourceUrl: "https://www.cert-in.org.in/s2cMainServlet?pageid=PUBVLNOTES02&VLCODE=CIAD-2026-0015",
      type: "advisory",
      category: "Advisory",
      severity: "high",
    });
    expect(items[0].publishedAt.toISOString()).toContain("2026-03-26");
  });

  it("parses vulnerability note year pages using the current CERT-In markup", () => {
    const html = `
      <table class="content" width="639">
        <tr><td align="left" valign="middle" class="contentTD"><li><a href="/s2cMainServlet?pageid=PUBVLNOTES01&VLCODE=CIVN-2026-0170"><span class="verblue2">CERT-In Vulnerability Note CIVN-2026-0170</span></a></li></td></tr>
        <tr><td align="left" valign="middle" class="contentTD"><span class="DateContent"> &nbsp;&nbsp;&nbsp;&nbsp;(April     02, 2026) </span></td></tr>
        <tr><td align="left" valign="middle" class="contentTD"><div style="height:30px; overflow: hidden"><span style="padding-left:15px">Multiple Vulnerabilities in Google Chrome for Desktop</span></div></td></tr>
      </table>
    `;

    const items = parseCertInListingPage(html, "vulnerability");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      advisoryId: "CIVN-2026-0170",
      title: "Multiple Vulnerabilities in Google Chrome for Desktop",
      sourceUrl: "https://www.cert-in.org.in/s2cMainServlet?pageid=PUBVLNOTES01&VLCODE=CIVN-2026-0170",
      type: "vulnerability",
      category: "Vulnerability Note",
      severity: "high",
    });
    expect(items[0].publishedAt.toISOString()).toContain("2026-04-02");
  });
});

describe("fetchAdvisoryDetails severity parsing behavior", () => {
  it("extracts the official CERT-In severity rating and leaves cvss empty when absent", () => {
    const html = `
      <html><body>
        <div>CERT-In Vulnerability Note CIVN-2026-0175</div>
        <div>Severity Rating: CRITICAL</div>
        <div>Overview</div>
        <p>Multiple vulnerabilities have been reported in Microsoft Azure and Bing.</p>
        <a href="https://msrc.microsoft.com/update-guide/vulnerability/CVE-2026-32186">Vendor advisory</a>
      </body></html>
    `;

    const details = parseCertInDetailHtml(html);

    expect(details.severity).toBe("critical");
    expect(details.cvssScore).toBeUndefined();
    expect(details.references).toContain("https://msrc.microsoft.com/update-guide/vulnerability/CVE-2026-32186");
  });
});
