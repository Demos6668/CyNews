/**
 * CERT-In (Indian Computer Emergency Response Team) specialized fetcher.
 * Fetches advisories from RSS feeds and optionally enriches with full page content.
 */

import Parser from "rss-parser";
import { load } from "cheerio";
import { logger } from "./logger";
import { fetchWithTimeout } from "./fetchWithTimeout";

const CERT_IN_BASE = "https://www.cert-in.org.in";

const RSS_FEEDS = {
  vulnerabilities: `${CERT_IN_BASE}/s2cMainServlet?pageid=RSSPUBVUL`,
  advisories: `${CERT_IN_BASE}/s2cMainServlet?pageid=RSSPUBADV`,
} as const;

const currentYear = new Date().getFullYear();

const LIST_ROOTS = {
  vulnerability: `${CERT_IN_BASE}/s2cMainServlet?pageid=VLNLIST`,
  advisory: `${CERT_IN_BASE}/s2cMainServlet?pageid=PUBADVLIST`,
} as const;

const LIST_YEAR_PAGE_IDS = {
  vulnerability: "VLNLIST02",
  advisory: "PUBADVLIST02",
} as const;

const DETAIL_PAGE_IDS = {
  vulnerability: "PUBVLNOTES01",
  advisory: "PUBVLNOTES02",
} as const;

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
  patchAvailable?: boolean;
  patchUrl?: string;
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

function normalizeSeverityLabel(value: string | undefined): "critical" | "high" | "medium" | "low" | "info" | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("critical")) return "critical";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium") || normalized.includes("moderate")) return "medium";
  if (normalized.includes("low")) return "low";
  if (normalized.includes("info") || normalized.includes("informational")) return "info";
  return undefined;
}

function extractCVEs(text: string): string[] {
  const matches = text.match(/CVE-\d{4}-\d{4,}/gi) ?? [];
  return [...new Set(matches.map((c) => c.toUpperCase()))];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function parseListPageDate(text: string): Date | undefined {
  const cleaned = normalizeWhitespace(text.replace(/[()]/g, ""));
  if (!cleaned) return undefined;
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function isXmlDocument(text: string): boolean {
  const trimmed = text.trim();
  return /^<\?xml\b/i.test(trimmed) || /^<rss\b/i.test(trimmed) || /^<rdf:RDF\b/i.test(trimmed) || /^<feed\b/i.test(trimmed);
}

export async function parseCertInRssXml(xml: string, type: "vulnerability" | "advisory"): Promise<CertInAdvisory[]> {
  const trimmed = xml.trim();
  if (!trimmed || !isXmlDocument(trimmed)) {
    return [];
  }

  const feed = await parser.parseString(trimmed);
  const items: CertInAdvisory[] = [];

  for (const item of feed.items ?? []) {
    const link = (item.link ?? (item as { guid?: string }).guid ?? "").toString().trim();
    if (!link) continue;

    const advisoryId = extractAdvisoryId(link, item.title);
    const summary = normalizeWhitespace(item.description ?? (item as { contentSnippet?: string }).contentSnippet ?? "");
    const severity = detectSeverity(item.title ?? "", summary);

    items.push({
      advisoryId,
      title: normalizeWhitespace(item.title ?? ""),
      summary,
      sourceUrl: link,
      source: "CERT-In",
      type,
      category: categorizeAdvisory(advisoryId, item.title),
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      severity,
      affectedProducts: [],
      cveIds: extractCVEs(`${item.title ?? ""} ${summary}`),
      recommendations: [],
      references: [],
    });
  }

  return items;
}

export function parseCertInListingPage(html: string, type: "vulnerability" | "advisory"): CertInAdvisory[] {
  const $ = load(html);
  const detailPageId = DETAIL_PAGE_IDS[type];
  const items: CertInAdvisory[] = [];

  $(`a[href*="${detailPageId}"][href*="VLCODE="]`).each((_i, el) => {
    const $el = $(el as Parameters<typeof $>[0]);
    const href = $el.attr("href");
    if (!href) return;

    const linkText = normalizeWhitespace($el.text());
    if (!linkText) return;

    const fullUrl = href.startsWith("http") ? href : `${CERT_IN_BASE}${href.startsWith("/") ? "" : "/"}${href}`;
    const advisoryId = extractAdvisoryId(fullUrl, linkText);
    const $table = $el.closest("table");
    const dateText = normalizeWhitespace($table.find(".DateContent, [class*='DateContent']").first().text());
    const detailTitle = normalizeWhitespace($table.find("div").first().text());
    const title = detailTitle || linkText;

    items.push({
      advisoryId,
      title,
      summary: title,
      sourceUrl: fullUrl,
      source: "CERT-In",
      type,
      category: categorizeAdvisory(advisoryId, title),
      publishedAt: parseListPageDate(dateText) ?? new Date(),
      severity: detectSeverity(title, linkText),
      affectedProducts: [],
      cveIds: extractCVEs(`${linkText} ${title}`),
      recommendations: [],
      references: [],
    });
  });

  return items;
}

export function parseCertInDetailHtml(html: string): Partial<CertInAdvisory> {
  const $ = load(html);
  const bodyText = normalizeWhitespace($("body").text());

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
      details.content = normalizeWhitespace(content);
      break;
    }
  }

  if (!details.content) {
    details.content = normalizeWhitespace($("p")
      .map((_i, el) => $(el as Parameters<typeof $>[0]).text().trim())
      .get()
      .filter((t: string) => t)
      .join("\n\n"));
  }

  const severityMatch = bodyText.match(/Severity Rating:\s*(Critical|High|Medium|Moderate|Low|Info(?:rmational)?)/i);
  if (severityMatch) {
    details.severity = normalizeSeverityLabel(severityMatch[1]);
  }

  const cvssMatch = bodyText.match(/CVSS(?:\s+v\d(?:\.\d+)?)?(?:\s+Base)?(?:\s+Score)?[:\s]+(\d+(?:\.\d+)?)/i);
  if (cvssMatch) {
    details.cvssScore = parseFloat(cvssMatch[1]);
  }

  const moreCVEs = extractCVEs(bodyText);
  if (moreCVEs.length > 0) {
    details.cveIds = moreCVEs;
  }

  const patchSignals = [
    /patch(?:es)?\s+(?:available|released|issued)/i,
    /update\s+available/i,
    /fixed\s+in\s+version/i,
    /upgrade\s+to/i,
    /apply\s+(?:the\s+)?(?:patch|update|fix)/i,
    /security\s+(?:patch|update|fix)\s+(?:has\s+been\s+)?released/i,
    /(?:vendor|microsoft|google|apple|adobe|oracle|cisco)\s+has\s+released/i,
  ];
  if (patchSignals.some((re) => re.test(bodyText))) {
    details.patchAvailable = true;
    const patchLink = $('a[href*="download"], a[href*="patch"], a[href*="update"], a[href*="security"]').first().attr("href");
    if (patchLink) {
      details.patchUrl = patchLink;
    }
  }

  const productPattern = /(?:Microsoft|Google|Apple|Adobe|Oracle|Cisco|Linux|Android|iOS|Windows|Chrome|Firefox|Safari|Java|PHP|Python|Apache|nginx)[\w\s.]+/gi;
  const products = bodyText.match(productPattern);
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
}

async function fetchListingYearPages(type: "vulnerability" | "advisory"): Promise<string[]> {
  const rootUrl = LIST_ROOTS[type];
  const pageId = LIST_YEAR_PAGE_IDS[type];

  try {
    const res = await fetchWithTimeout(rootUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CYFY-SOC/1.0; Security Research)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      return [
        `${CERT_IN_BASE}/s2cMainServlet?pageid=${pageId}&year=${currentYear}`,
        `${CERT_IN_BASE}/s2cMainServlet?pageid=${pageId}&year=${currentYear - 1}`,
      ];
    }

    const html = await res.text();
    const $ = load(html);
    const pages = new Set<string>();

    $(`a[href*="pageid=${pageId}"][href*="year="]`).each((_i, el) => {
      const href = $(el as Parameters<typeof $>[0]).attr("href");
      if (!href) return;
      const fullUrl = href.startsWith("http") ? href : `${CERT_IN_BASE}${href.startsWith("/") ? "" : "/"}${href}`;
      pages.add(fullUrl);
    });

    const discovered = Array.from(pages).slice(0, 2);
    if (discovered.length > 0) {
      return discovered;
    }
  } catch (err) {
    logger.warn(`[CERT-In] failed to discover ${type} year pages: ${err instanceof Error ? err.message : String(err)}`);
  }

  return [
    `${CERT_IN_BASE}/s2cMainServlet?pageid=${pageId}&year=${currentYear}`,
    `${CERT_IN_BASE}/s2cMainServlet?pageid=${pageId}&year=${currentYear - 1}`,
  ];
}

async function fetchAdvisoryDetails(url: string): Promise<Partial<CertInAdvisory>> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CYFY-SOC/1.0; Security Research)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return {};
    const html = await res.text();
    return parseCertInDetailHtml(html);
  } catch (err) {
    logger.warn({ url, error: err instanceof Error ? err.message : String(err) }, "[CERT-In] Failed to enrich advisory");
    return {};
  }
}

async function fetchRSSFeed(url: string, type: "vulnerability" | "advisory"): Promise<CertInAdvisory[]> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "CYFY-News-Board/1.0 (Security Feed Aggregator)",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
      },
    });

    if (!res.ok) {
      logger.warn(`[CERT-In] RSS unavailable (${type}): HTTP ${res.status}`);
      return [];
    }

    const xml = await res.text();
    if (!xml.trim()) {
      logger.info(`[CERT-In] RSS empty (${type})`);
      return [];
    }

    if (!isXmlDocument(xml)) {
      logger.warn(`[CERT-In] RSS returned non-XML content (${type})`);
      return [];
    }

    return await parseCertInRssXml(xml, type);
  } catch (err) {
    logger.error(`[CERT-In] RSS error (${type}): ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

async function scrapeAdvisoriesPage(): Promise<CertInAdvisory[]> {
  const advisories: CertInAdvisory[] = [];
  const fetchOpts = { headers: { "User-Agent": "Mozilla/5.0 (compatible; CYFY-SOC/1.0; Security Research)" } };
  const pageUrls = [
    ...(await fetchListingYearPages("vulnerability")),
    ...(await fetchListingYearPages("advisory")),
  ];

  for (const pageUrl of pageUrls) {
    try {
      const res = await fetchWithTimeout(pageUrl, fetchOpts);
      if (!res.ok) continue;
      const html = await res.text();
      const type = pageUrl.includes("PUBADVLIST02") ? "advisory" : "vulnerability";
      advisories.push(...parseCertInListingPage(html, type));
    } catch (err) {
      logger.error(`[CERT-In] Scraping error (${pageUrl}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return advisories;
}

async function enrichAdvisories(advisories: CertInAdvisory[], limit = 20): Promise<CertInAdvisory[]> {
  const enriched: CertInAdvisory[] = [];

  for (const [index, advisory] of advisories.entries()) {
    try {
      if (index < limit && advisory.sourceUrl && advisory.sourceUrl.includes("cert-in.org.in")) {
        const details = await fetchAdvisoryDetails(advisory.sourceUrl);
        enriched.push({
          ...advisory,
          ...details,
          content: details.content ?? advisory.content ?? advisory.summary,
        });
      } else {
        enriched.push({
          ...advisory,
          content: advisory.content ?? advisory.summary,
        });
      }
      await delay(100);
    } catch {
      enriched.push(advisory);
    }
  }

  return enriched;
}

export async function fetchCertInAdvisories(): Promise<CertInAdvisory[]> {
  logger.info("[CERT-In] Fetching advisories...");

  const [vulnItems, advItems] = await Promise.allSettled([
    fetchRSSFeed(RSS_FEEDS.vulnerabilities, "vulnerability"),
    fetchRSSFeed(RSS_FEEDS.advisories, "advisory"),
  ]);

  let allItems: CertInAdvisory[] = [];
  if (vulnItems.status === "fulfilled") allItems.push(...vulnItems.value);
  if (advItems.status === "fulfilled") allItems.push(...advItems.value);

  if (allItems.length === 0) {
    logger.info("[CERT-In] RSS empty, trying page scraping...");
    allItems = await scrapeAdvisoriesPage();
  }

  const seen = new Map<string, CertInAdvisory>();
  for (const item of allItems) {
    const key = item.advisoryId || item.sourceUrl;
    if (!seen.has(key) || (item.publishedAt > (seen.get(key)!.publishedAt ?? new Date(0)))) {
      seen.set(key, item);
    }
  }
  allItems = Array.from(seen.values()).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  const enriched = await enrichAdvisories(allItems);
  logger.info(`[CERT-In] Fetched ${enriched.length} advisories`);
  return enriched;
}
