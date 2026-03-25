/**
 * CERT-In (Indian Computer Emergency Response Team) specialized fetcher.
 * Fetches advisories from RSS feeds and optionally enriches with full page content.
 */

import Parser from "rss-parser";
import { load } from "cheerio";

const CERT_IN_BASE = "https://www.cert-in.org.in";

const RSS_FEEDS = {
  vulnerabilities: `${CERT_IN_BASE}/s2cMainServlet?pageid=RSSPUBVUL`,
  advisories: `${CERT_IN_BASE}/s2cMainServlet?pageid=RSSPUBADV`,
} as const;

const currentYear = new Date().getFullYear();
const VLNLIST_PAGES = [
  `${CERT_IN_BASE}/s2cMainServlet?pageid=VLNLIST02&year=${currentYear}`,
  `${CERT_IN_BASE}/s2cMainServlet?pageid=VLNLIST02&year=${currentYear - 1}`,
];

export interface CertInAdvisory {
  advisoryId: string;
  title: string;
  summary: string;
  sourceUrl: string;
  source: string;
  type: "vulnerability" | "advisory";
  category: string;
  publishedAt: Date;
  severity: "critical" | "high" | "medium" | "low" | "info";
  content?: string;
  affectedProducts: string[];
  cveIds: string[];
  recommendations: string[];
  references: string[];
  cvssScore?: number;
}

const parser = new Parser({
  timeout: 30000,
  headers: { "User-Agent": "CYFY-News-Board/1.0 (Security Feed Aggregator)" },
  customFields: {
    item: [
      ["description", "description"],
      ["pubDate", "pubDate"],
      ["link", "link"],
      ["guid", "guid"],
    ],
  },
});

function extractAdvisoryId(url: string, title?: string): string {
  const urlMatch = url.match(/CIVA-\d{4}-\d+|CIAD-\d{4}-\d+|CISA-\d{4}-\d+|CIVN-\d{4}-\d+/i);
  if (urlMatch) return urlMatch[0].toUpperCase();

  const titleMatch = title?.match(/CIVA-\d{4}-\d+|CIAD-\d{4}-\d+|CISA-\d{4}-\d+|CIVN-\d{4}-\d+/i);
  if (titleMatch) return titleMatch[0].toUpperCase();

  return `CERTIN-${Date.now()}`;
}

function categorizeAdvisory(advisoryId: string, title?: string): string {
  if (advisoryId.startsWith("CIVA")) return "Vulnerability Advisory";
  if (advisoryId.startsWith("CIAD")) return "Advisory";
  if (advisoryId.startsWith("CISA")) return "Security Alert";
  if (advisoryId.startsWith("CIVN")) return "Vulnerability Note";
  if (advisoryId.startsWith("CIWR")) return "Weekly Report";

  const lowerTitle = (title ?? "").toLowerCase();
  if (lowerTitle.includes("vulnerability") || lowerTitle.includes("cve")) return "Vulnerability Advisory";
  if (lowerTitle.includes("alert") || lowerTitle.includes("urgent")) return "Security Alert";
  return "Advisory";
}

function detectSeverity(title: string, description: string): "critical" | "high" | "medium" | "low" | "info" {
  const text = `${title} ${description}`.toLowerCase();

  if (text.includes("critical") || text.includes("remote code execution") || text.includes("zero-day") || text.includes("actively exploited")) return "critical";
  if (text.includes("high") || text.includes("important") || text.includes("privilege escalation") || text.includes("authentication bypass")) return "high";
  if (text.includes("medium") || text.includes("moderate") || text.includes("information disclosure")) return "medium";
  if (text.includes("low") || text.includes("minor")) return "low";

  return "high";
}

function extractCVEs(text: string): string[] {
  const matches = text.match(/CVE-\d{4}-\d{4,}/gi) ?? [];
  return [...new Set(matches.map((c) => c.toUpperCase()))];
}

function cvssToSeverity(score: number): "critical" | "high" | "medium" | "low" | "info" {
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  return "low";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseListPageDate(text: string): Date | undefined {
  const cleaned = text.replace(/[()]/g, "").trim();
  if (!cleaned) return undefined;
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function fetchAdvisoryDetails(url: string): Promise<Partial<CertInAdvisory>> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CYFY-SOC/1.0; Security Research)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return {};
    const html = await res.text();
    const $ = load(html);

    const details: Partial<CertInAdvisory> = {
      content: "",
      affectedProducts: [],
      recommendations: [],
      references: [],
    };

    const contentSelectors = [".content-area", ".advisory-content", "#main-content", ".vulnerability-details", "article", ".post-content"];
    for (const sel of contentSelectors) {
      const content = $(sel).text().trim();
      if (content && content.length > 100) {
        details.content = content;
        break;
      }
    }

    if (!details.content) {
      details.content = $("p")
        .map((_i, el) => $(el as Parameters<typeof $>[0]).text().trim())
        .get()
        .filter((t: string) => t)
        .join("\n\n");
    }

    const cvssMatch = $("body").text().match(/CVSS[:\s]+(\d+\.?\d*)/i);
    if (cvssMatch) {
      details.cvssScore = parseFloat(cvssMatch[1]);
    }

    const moreCVEs = extractCVEs($("body").text());
    if (moreCVEs.length > 0) {
      details.cveIds = moreCVEs;
    }

    const productPattern = /(?:Microsoft|Google|Apple|Adobe|Oracle|Cisco|Linux|Android|iOS|Windows|Chrome|Firefox|Safari|Java|PHP|Python|Apache|nginx)[\w\s.]+/gi;
    const products = $("body").text().match(productPattern);
    if (products) {
      details.affectedProducts = [...new Set(products.map((p: string) => p.trim()))].slice(0, 10) as string[];
    }

    $('a[href*="cve"], a[href*="nvd"], a[href*="microsoft"], a[href*="vendor"]').each((_i, el) => {
      const href = $(el as Parameters<typeof $>[0]).attr("href");
      if (href && !details.references!.includes(href)) {
        details.references!.push(href);
      }
    });

    return details;
  } catch {
    return {};
  }
}

async function fetchRSSFeed(url: string, type: "vulnerability" | "advisory"): Promise<CertInAdvisory[]> {
  try {
    const feed = await parser.parseURL(url);
    const items: CertInAdvisory[] = [];

    for (const item of feed.items ?? []) {
      const link = (item.link ?? (item as { guid?: string }).guid ?? "").toString().trim();
      if (!link) continue;

      const advisoryId = extractAdvisoryId(link, item.title);
      const summary = (item.description ?? (item as { contentSnippet?: string }).contentSnippet ?? "").trim();
      const severity = detectSeverity(item.title ?? "", summary);

      items.push({
        advisoryId,
        title: (item.title ?? "").trim(),
        summary,
        sourceUrl: link,
        source: "CERT-In",
        type,
        category: categorizeAdvisory(advisoryId, item.title),
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        severity,
        affectedProducts: [],
        cveIds: extractCVEs(item.title + " " + summary),
        recommendations: [],
        references: [],
      });
    }

    return items;
  } catch (err) {
    console.error(`[CERT-In] RSS error (${type}):`, err instanceof Error ? err.message : String(err));
    return [];
  }
}

async function scrapeAdvisoriesPage(): Promise<CertInAdvisory[]> {
  const advisories: CertInAdvisory[] = [];
  const fetchOpts = { headers: { "User-Agent": "Mozilla/5.0 (compatible; CYFY-SOC/1.0; Security Research)" } };

  for (const pageUrl of VLNLIST_PAGES) {
    try {
      const res = await fetch(pageUrl, fetchOpts);
      if (!res.ok) continue;
      const html = await res.text();
      const $ = load(html);

      $('a[href*="VLCODE"]').each((_i, el) => {
        const $el = $(el as Parameters<typeof $>[0]);
        const href = $el.attr("href");
        const linkText = $el.text().trim();
        if (href && linkText) {
          const fullUrl = href.startsWith("http") ? href : `${CERT_IN_BASE}${href.startsWith("/") ? "" : "/"}${href}`;
          const $tr = $el.closest("tr");
          const dateText = $tr.next("tr").find(".DateContent").text().trim();
          const humanTitle = $tr.next("tr").next("tr").find("span").first().text().trim();
          const title = humanTitle && humanTitle.length > 3 ? humanTitle : linkText;
          const publishedAt = parseListPageDate(dateText) ?? new Date();
          advisories.push({
            advisoryId: extractAdvisoryId(href, linkText),
            title,
            summary: "",
            sourceUrl: fullUrl,
            source: "CERT-In",
            type: "vulnerability",
            category: categorizeAdvisory(extractAdvisoryId(href, linkText), title),
            publishedAt,
            severity: detectSeverity(title, ""),
            affectedProducts: [],
            cveIds: [],
            recommendations: [],
            references: [],
          });
        }
      });
    } catch (err) {
      console.error(`[CERT-In] Scraping error (${pageUrl}):`, err instanceof Error ? err.message : String(err));
    }
  }

  return advisories;
}

async function enrichAdvisories(advisories: CertInAdvisory[]): Promise<CertInAdvisory[]> {
  const enriched: CertInAdvisory[] = [];

  for (const advisory of advisories) {
    try {
      if (advisory.sourceUrl && advisory.sourceUrl.includes("cert-in.org.in")) {
        const details = await fetchAdvisoryDetails(advisory.sourceUrl);
        enriched.push({
          ...advisory,
          ...details,
          content: details.content ?? advisory.summary,
        });
      } else {
        enriched.push(advisory);
      }
      await delay(500);
    } catch {
      enriched.push(advisory);
    }
  }

  return enriched;
}

export async function fetchCertInAdvisories(): Promise<CertInAdvisory[]> {
  console.log("[CERT-In] Fetching advisories...");

  const [vulnItems, advItems] = await Promise.allSettled([
    fetchRSSFeed(RSS_FEEDS.vulnerabilities, "vulnerability"),
    fetchRSSFeed(RSS_FEEDS.advisories, "advisory"),
  ]);

  let allItems: CertInAdvisory[] = [];
  if (vulnItems.status === "fulfilled") allItems.push(...vulnItems.value);
  if (advItems.status === "fulfilled") allItems.push(...advItems.value);

  if (allItems.length === 0) {
    console.log("[CERT-In] RSS empty, trying page scraping...");
    allItems = await scrapeAdvisoriesPage();
  }

  const seen = new Map<string, CertInAdvisory>();
  for (const item of allItems) {
    const key = item.advisoryId || item.sourceUrl;
    if (!seen.has(key) || (item.publishedAt > (seen.get(key)!.publishedAt ?? new Date(0)))) {
      seen.set(key, item);
    }
  }
  allItems = Array.from(seen.values());

  const enriched = await enrichAdvisories(allItems);
  console.log(`[CERT-In] Fetched ${enriched.length} advisories`);
  return enriched;
}
