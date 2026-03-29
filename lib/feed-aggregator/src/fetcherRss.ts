/**
 * RSS Feed Fetcher - Fetches articles from RSS/Atom feeds across security news,
 * threat intelligence, and advisory sources.
 */

import Parser from "rss-parser";
import { logger } from "./logger";
import { db, newsItemsTable, threatIntelTable } from "@workspace/db";
import { gte } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { cyberRelevanceDetector } from "./cyberRelevanceDetector";
import {
  type FeedUpdateResult,
  type OnBroadcast,
  inferSeverity,
  isValidUrl,
  THREAT_CATEGORY_SOURCES,
  FBI_SOURCES,
  IC3_SOURCES,
  CISA_SOURCES,
  NIST_SOURCES,
  CERT_IN_SOURCES,
} from "./feedUtils";

export type RssSource = {
  name: string;
  url: string;
  category?: "NEWS" | "THREAT" | "ADVISORY";
  priority?: number;
  scope?: "local" | "global" | null;
  forceLocal?: boolean;
  defaultScope?: "local" | "global" | null;
};

export const RSS_SOURCES: RssSource[] = [
  // ===== MAJOR SECURITY NEWS =====
  { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", category: "NEWS", priority: 1 },
  { name: "BleepingComputer", url: "https://www.bleepingcomputer.com/feed/", category: "NEWS", priority: 1 },
  { name: "Dark Reading", url: "https://www.darkreading.com/rss.xml", category: "NEWS", priority: 1 },
  { name: "SecurityWeek", url: "https://feeds.feedburner.com/securityweek", category: "NEWS", priority: 1 },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", category: "NEWS", priority: 1 },
  { name: "Threatpost", url: "https://threatpost.com/feed/", category: "NEWS", priority: 2 },
  { name: "SC Magazine", url: "https://www.scmagazine.com/feed", category: "NEWS", priority: 2 },
  { name: "Infosecurity Magazine", url: "https://www.infosecurity-magazine.com/rss/news/", category: "NEWS", priority: 2 },
  { name: "CSO Online", url: "https://www.csoonline.com/feed/", category: "NEWS", priority: 2 },
  { name: "ZDNet Security", url: "https://www.zdnet.com/topic/security/rss.xml", category: "NEWS", priority: 2 },
  { name: "Ars Technica Security", url: "https://feeds.arstechnica.com/arstechnica/security", category: "NEWS", priority: 2 },
  { name: "Wired Security", url: "https://www.wired.com/feed/tag/security/latest/rss", category: "NEWS", priority: 2 },
  { name: "Help Net Security", url: "https://www.helpnetsecurity.com/feed/", category: "NEWS", priority: 2 },
  { name: "Security Affairs", url: "https://securityaffairs.co/feed", category: "NEWS", priority: 1 },
  { name: "Graham Cluley", url: "https://grahamcluley.com/feed/", category: "NEWS", priority: 3 },
  { name: "Naked Security (Sophos)", url: "https://nakedsecurity.sophos.com/feed/", category: "NEWS", priority: 2 },
  { name: "Security Boulevard", url: "https://securityboulevard.com/feed/", category: "NEWS", priority: 2 },
  { name: "CyberScoop", url: "https://www.cyberscoop.com/feed/", category: "NEWS", priority: 2 },
  { name: "The Record", url: "https://therecord.media/feed/", category: "NEWS", priority: 1 },
  { name: "Risky Business News", url: "https://risky.biz/feeds/risky-business/", category: "NEWS", priority: 2 },
  // ===== VENDOR THREAT INTELLIGENCE =====
  { name: "Cisco Talos", url: "https://feeds.feedburner.com/feedburner/Talos", category: "THREAT", priority: 1 },
  { name: "Unit 42", url: "https://unit42.paloaltonetworks.com/feed/", category: "THREAT", priority: 1 },
  { name: "Mandiant", url: "https://www.mandiant.com/resources/blog/rss.xml", category: "THREAT", priority: 1 },
  { name: "Microsoft Security", url: "https://www.microsoft.com/security/blog/feed/", category: "THREAT", priority: 1 },
  { name: "Microsoft Threat Intelligence", url: "https://www.microsoft.com/en-us/security/blog/topic/threat-intelligence/feed/", category: "THREAT", priority: 1 },
  { name: "Google TAG", url: "https://feeds.feedburner.com/threatintelligence/pvexyqv7v0v", category: "THREAT", priority: 1 },
  { name: "Google Project Zero", url: "https://googleprojectzero.blogspot.com/feeds/posts/default", category: "THREAT", priority: 1 },
  { name: "CrowdStrike", url: "https://www.crowdstrike.com/blog/feed/", category: "THREAT", priority: 1 },
  { name: "SentinelOne", url: "https://www.sentinelone.com/blog/feed/", category: "THREAT", priority: 1 },
  { name: "Recorded Future", url: "https://www.recordedfuture.com/feed", category: "THREAT", priority: 1 },
  { name: "Proofpoint", url: "https://www.proofpoint.com/us/threat-insight-blog.xml", category: "THREAT", priority: 1 },
  { name: "Kaspersky SecureList", url: "https://securelist.com/feed/", category: "THREAT", priority: 1 },
  { name: "ESET WeLiveSecurity", url: "https://www.welivesecurity.com/feed/", category: "THREAT", priority: 2 },
  { name: "Check Point Research", url: "https://research.checkpoint.com/feed/", category: "THREAT", priority: 1 },
  { name: "Fortinet", url: "https://feeds.fortinet.com/fortinet/blog/threat-research", category: "THREAT", priority: 1 },
  { name: "Symantec (Broadcom)", url: "https://www.symantec.com/connect/feeds/srblog-external-en", category: "THREAT", priority: 1 },
  { name: "Trend Micro", url: "https://www.trendmicro.com/en_us/research.html/feed", category: "THREAT", priority: 2 },
  { name: "Malwarebytes Labs", url: "https://blog.malwarebytes.com/feed/", category: "THREAT", priority: 2 },
  { name: "Sophos News", url: "https://news.sophos.com/feed/", category: "THREAT", priority: 2 },
  { name: "Bitdefender Labs", url: "https://www.bitdefender.com/blog/api/rss/labs/", category: "THREAT", priority: 2 },
  { name: "McAfee Labs", url: "https://www.mcafee.com/blogs/feed/", category: "THREAT", priority: 2 },
  { name: "F-Secure Labs", url: "https://blog.f-secure.com/feed/", category: "THREAT", priority: 2 },
  { name: "Avast Decoded", url: "https://decoded.avast.io/feed/", category: "THREAT", priority: 2 },
  { name: "Zscaler ThreatLabz", url: "https://www.zscaler.com/blogs/security-research/rss.xml", category: "THREAT", priority: 1 },
  { name: "Elastic Security Labs", url: "https://www.elastic.co/security-labs/rss/feed.xml", category: "THREAT", priority: 2 },
  { name: "Rapid7", url: "https://blog.rapid7.com/rss/", category: "THREAT", priority: 2 },
  { name: "Qualys", url: "https://blog.qualys.com/feed", category: "THREAT", priority: 2 },
  { name: "Tenable", url: "https://www.tenable.com/blog/feed", category: "THREAT", priority: 2 },
  { name: "Huntress", url: "https://www.huntress.com/blog/rss.xml", category: "THREAT", priority: 2 },
  { name: "Binary Defense", url: "https://www.binarydefense.com/feed/", category: "THREAT", priority: 2 },
  { name: "Red Canary", url: "https://redcanary.com/feed/", category: "THREAT", priority: 2 },
  // Dragos: feed returns 404 as of 2025 - removed until restored
  // { name: "Dragos (ICS/OT)", url: "https://www.dragos.com/feed/", category: "THREAT", priority: 1 },
  { name: "Claroty (ICS/OT)", url: "https://claroty.com/blog/rss.xml", category: "THREAT", priority: 2 },
  { name: "Nozomi Networks (ICS/OT)", url: "https://www.nozominetworks.com/blog/feed/", category: "THREAT", priority: 2 },
  { name: "Volexity", url: "https://www.volexity.com/feed/", category: "THREAT", priority: 1 },
  { name: "Secureworks", url: "https://www.secureworks.com/rss?feed=blog", category: "THREAT", priority: 2 },
  { name: "BlackBerry Cylance", url: "https://blogs.blackberry.com/en/feed", category: "THREAT", priority: 2 },
  { name: "Cofense", url: "https://cofense.com/feed/", category: "THREAT", priority: 2 },
  { name: "Flashpoint", url: "https://flashpoint.io/feed/", category: "THREAT", priority: 2 },
  { name: "Intel 471", url: "https://intel471.com/blog/feed/", category: "THREAT", priority: 2 },
  { name: "Group-IB", url: "https://www.group-ib.com/blog/feed/", category: "THREAT", priority: 2 },
  { name: "ReversingLabs", url: "https://blog.reversinglabs.com/feed", category: "THREAT", priority: 2 },
  { name: "Intezer", url: "https://www.intezer.com/feed/", category: "THREAT", priority: 2 },
  { name: "MalwareTech", url: "https://www.malwaretech.com/feed", category: "THREAT", priority: 2 },
  { name: "Objective-See (Mac)", url: "https://objective-see.com/blog/rss.xml", category: "THREAT", priority: 2 },
  { name: "VX Underground", url: "https://vx-underground.org/rss.xml", category: "THREAT", priority: 2 },
  // ===== VULNERABILITY & EXPLOIT FEEDS =====
  { name: "Packet Storm", url: "https://packetstormsecurity.com/feeds/news", category: "THREAT", priority: 2 },
  { name: "Packet Storm Files", url: "https://packetstormsecurity.com/feeds/files", category: "THREAT", priority: 2 },
  { name: "Exploit Database", url: "https://www.exploit-db.com/rss.xml", category: "THREAT", priority: 1 },
  { name: "Full Disclosure", url: "https://seclists.org/fulldisclosure/feed.rss", category: "THREAT", priority: 2 },
  { name: "OSS Security", url: "https://seclists.org/oss-sec/feed.rss", category: "THREAT", priority: 2 },
  { name: "Bugtraq", url: "https://seclists.org/bugtraq/feed.rss", category: "THREAT", priority: 3 },
  { name: "SANS ISC", url: "https://isc.sans.edu/rssfeed.xml", category: "THREAT", priority: 1 },
  { name: "SANS ISC Threat", url: "https://isc.sans.edu/rssfeed_full.xml", category: "THREAT", priority: 1 },
  // ===== GOVERNMENT & CERT ADVISORIES (GLOBAL) =====
  { name: "CISA Alerts", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", category: "ADVISORY", priority: 1, defaultScope: "global" },
  { name: "CISA ICS Advisories", url: "https://www.cisa.gov/cybersecurity-advisories/ics-advisories.xml", category: "ADVISORY", priority: 1, defaultScope: "global" },
  { name: "US-CERT", url: "https://www.cisa.gov/uscert/ncas/alerts.xml", category: "ADVISORY", priority: 1, defaultScope: "global" },
  { name: "FBI Cyber", url: "https://www.fbi.gov/investigate/cyber/news/rss.xml", category: "ADVISORY", priority: 1, defaultScope: "global" },
  { name: "FBI Press Releases", url: "https://www.fbi.gov/news/press-releases/rss.xml", category: "NEWS", priority: 2, defaultScope: "global" },
  { name: "FBI Internet Crime", url: "https://www.ic3.gov/Media/News/rss.xml", category: "ADVISORY", priority: 1, defaultScope: "global" },
  // NSA: returns 403 (blocked) - removed until accessible
  // { name: "NSA Cybersecurity", url: "https://www.nsa.gov/Press-Room/Cybersecurity-Advisories-Guidance/rss.xml", category: "ADVISORY", priority: 1, defaultScope: "global" },
  { name: "NCSC UK", url: "https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml", category: "ADVISORY", priority: 1, defaultScope: "global" },
  { name: "NCSC UK News", url: "https://www.ncsc.gov.uk/api/1/services/v1/news-rss-feed.xml", category: "NEWS", priority: 2, defaultScope: "global" },
  { name: "CERT-EU", url: "https://cert.europa.eu/publications/security-advisories/rss", category: "ADVISORY", priority: 1, defaultScope: "global" },
  { name: "ENISA", url: "https://www.enisa.europa.eu/publications/rss.xml", category: "ADVISORY", priority: 2, defaultScope: "global" },
  { name: "AU Cyber Security Centre", url: "https://www.cyber.gov.au/about-us/view-all-content/alerts-and-advisories/rss.xml", category: "ADVISORY", priority: 2, defaultScope: "global" },
  { name: "Canadian Cyber Centre", url: "https://www.cyber.gc.ca/api/cccs/v1/rss/en/public", category: "ADVISORY", priority: 2, defaultScope: "global" },
  { name: "JPCERT (Japan)", url: "https://www.jpcert.or.jp/rss/jpcert-en.rdf", category: "ADVISORY", priority: 2, defaultScope: "global" },
  { name: "CERT-NZ", url: "https://www.cert.govt.nz/rss/all/", category: "ADVISORY", priority: 3, defaultScope: "global" },
  { name: "CERT-FR", url: "https://www.cert.ssi.gouv.fr/feed/", category: "ADVISORY", priority: 2, defaultScope: "global" },
  { name: "BSI Germany", url: "https://www.bsi.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewsfeed/RSSNewsfeed.xml", category: "ADVISORY", priority: 2, defaultScope: "global" },
  { name: "Cybersecurity Singapore", url: "https://www.csa.gov.sg/News/News-Articles/rss-feed", category: "ADVISORY", priority: 3, defaultScope: "global" },
  { name: "HKCERT", url: "https://www.hkcert.org/rss/security-bulletin", category: "ADVISORY", priority: 3, defaultScope: "global" },
  // ===== INDIA-SPECIFIC SOURCES (LOCAL) =====
  { name: "CERT-In", url: "https://www.cert-in.org.in/s2cMainServlet?pageid=RSSPUBVUL", category: "ADVISORY", priority: 1, forceLocal: true },
  { name: "CERT-In Advisories", url: "https://www.cert-in.org.in/s2cMainServlet?pageid=RSSPUBADV", category: "ADVISORY", priority: 1, forceLocal: true },
  // NCIIPC: rss.xml returns 404 - removed until feed available
  // { name: "NCIIPC", url: "https://nciipc.gov.in/rss.xml", category: "ADVISORY", priority: 1, forceLocal: true },
  { name: "MeitY Alerts", url: "https://www.meity.gov.in/rss-feeds", category: "NEWS", priority: 2, forceLocal: true },
  { name: "DSCI", url: "https://www.dsci.in/feeds/rss.xml", category: "NEWS", priority: 2, forceLocal: true },
  { name: "RBI Notifications", url: "https://www.rbi.org.in/scripts/BS_RSS_ALL.aspx", category: "ADVISORY", priority: 2, forceLocal: true },
  { name: "SEBI Updates", url: "https://www.sebi.gov.in/sebiweb/home/rss.jsp", category: "ADVISORY", priority: 2, forceLocal: true },
  { name: "NPCI Security", url: "https://www.npci.org.in/rss", category: "ADVISORY", priority: 2, forceLocal: true },
  { name: "The Hindu Tech", url: "https://www.thehindu.com/sci-tech/technology/feeder/default.rss", category: "NEWS", priority: 3, forceLocal: true },
  { name: "Economic Times Tech", url: "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms", category: "NEWS", priority: 3, forceLocal: true },
  { name: "Business Standard Tech", url: "https://www.business-standard.com/rss/technology-101.rss", category: "NEWS", priority: 3, forceLocal: true },
  { name: "Mint Tech", url: "https://www.livemint.com/rss/technology", category: "NEWS", priority: 3, forceLocal: true },
  { name: "NDTV Gadgets", url: "https://feeds.feedburner.com/ndtvgadgets-latest", category: "NEWS", priority: 3, forceLocal: true },
  { name: "Medianama", url: "https://www.medianama.com/feed/", category: "NEWS", priority: 2, forceLocal: true },
  { name: "Inc42", url: "https://inc42.com/feed/", category: "NEWS", priority: 3, forceLocal: true },
  { name: "YourStory Tech", url: "https://yourstory.com/feed", category: "NEWS", priority: 3, forceLocal: true },
  // ===== VENDOR SECURITY ADVISORIES =====
  { name: "Microsoft Security Updates", url: "https://api.msrc.microsoft.com/update-guide/rss", category: "ADVISORY", priority: 1 },
  { name: "Adobe Security", url: "https://blogs.adobe.com/security/feed/", category: "ADVISORY", priority: 1 },
  { name: "Cisco Security", url: "https://tools.cisco.com/security/center/psirtrss.aspx", category: "ADVISORY", priority: 1 },
  { name: "VMware Security", url: "https://www.vmware.com/security/advisories.xml", category: "ADVISORY", priority: 1 },
  { name: "Fortinet PSIRT", url: "https://filestore.fortinet.com/fortiguard/rss/ir.xml", category: "ADVISORY", priority: 1 },
  { name: "Palo Alto Security", url: "https://security.paloaltonetworks.com/rss.xml", category: "ADVISORY", priority: 1 },
  { name: "GitLab Security", url: "https://about.gitlab.com/releases/categories/releases/index.xml", category: "ADVISORY", priority: 2 },
  { name: "Zoom Security", url: "https://explore.zoom.us/en/trust/security/security-bulletin/feed/", category: "ADVISORY", priority: 2 },
  { name: "Ivanti Security", url: "https://www.ivanti.com/blog/rss.xml", category: "ADVISORY", priority: 2 },
  { name: "SonicWall Security", url: "https://psirt.global.sonicwall.com/rss.xml", category: "ADVISORY", priority: 2 },
  { name: "Citrix Security", url: "https://support.citrix.com/feed/products/all/security-bulletins.rss", category: "ADVISORY", priority: 1 },
  { name: "WordPress Security", url: "https://wordpress.org/news/category/security/feed/", category: "ADVISORY", priority: 2 },
  { name: "Drupal Security", url: "https://www.drupal.org/security/rss.xml", category: "ADVISORY", priority: 2 },
  { name: "Ubuntu Security", url: "https://ubuntu.com/security/notices/rss.xml", category: "ADVISORY", priority: 2 },
  { name: "Red Hat Security", url: "https://access.redhat.com/blogs/feed", category: "ADVISORY", priority: 2 },
  // ===== RANSOMWARE & BREACH =====
  { name: "Ransomware News", url: "https://www.ransomware.live/rss.xml", category: "THREAT", priority: 1 },
  { name: "No More Ransom", url: "https://www.nomoreransom.org/en/news/rss.xml", category: "NEWS", priority: 2 },
  { name: "Have I Been Pwned", url: "https://feeds.feedburner.com/HaveIBeenPwnedLatestBreaches", category: "NEWS", priority: 1 },
  { name: "DataBreaches.net", url: "https://www.databreaches.net/feed/", category: "NEWS", priority: 2 },
  // ===== CLOUD SECURITY =====
  { name: "AWS Security", url: "https://aws.amazon.com/blogs/security/feed/", category: "ADVISORY", priority: 1 },
  { name: "Google Cloud Security", url: "https://cloud.google.com/feeds/cloudsecurityresources.xml", category: "ADVISORY", priority: 1 },
  { name: "Azure Security", url: "https://azure.microsoft.com/en-us/blog/tag/security/feed/", category: "ADVISORY", priority: 1 },
  { name: "Wiz Security Research", url: "https://www.wiz.io/blog/rss.xml", category: "THREAT", priority: 2 },
  { name: "Orca Security", url: "https://orca.security/resources/blog/rss/", category: "THREAT", priority: 2 },
  // ===== MOBILE SECURITY =====
  { name: "Zimperium", url: "https://www.zimperium.com/blog/feed/", category: "THREAT", priority: 2 },
  { name: "Lookout Security", url: "https://www.lookout.com/blog/rss.xml", category: "THREAT", priority: 2 },
  // ===== IDENTITY =====
  { name: "Okta Security", url: "https://www.okta.com/blog/feed/", category: "ADVISORY", priority: 2 },
  { name: "Auth0 Security", url: "https://auth0.com/blog/rss.xml", category: "ADVISORY", priority: 2 },
];

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "CYFY-News-Board/1.0 (Security Feed Aggregator)" },
  customFields: {
    item: [
      ["content:encoded", "contentEncoded"],
      ["dc:creator", "creator"],
      ["media:content", "media"],
    ],
  },
});

export function isValidArticleUrl(url: string, sourceName: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname || "/";
    if (path === "/" || path === "") return false;
    const badSuffixes = ["/feed", "/rss", "/atom", "/index.html", "/index.php", "/home"];
    if (badSuffixes.some((s) => path.endsWith(s))) return false;
    if (FBI_SOURCES.has(sourceName)) return path.includes("/news/");
    if (IC3_SOURCES.has(sourceName)) return path.includes("/Media/") || path.includes("/News/") || path.length > 1;
    if (CISA_SOURCES.has(sourceName)) {
      return path.includes("/news-events/") || path.includes("/uscert/") ||
        path.includes("/cybersecurity-advisories/") || path.includes("/known-exploited");
    }
    if (NIST_SOURCES.has(sourceName)) return path.includes("/vuln/detail/");
    return path.length > 1;
  } catch {
    return false;
  }
}

export function extractFBIUrl(item: { guid?: string | { _?: string }; title?: string; content?: string; contentEncoded?: string }): string | null {
  const guidStr = typeof item.guid === "string" ? item.guid : (item.guid as { _?: string })?._;
  if (guidStr && guidStr.startsWith("http") && guidStr.includes("/news/")) return guidStr;
  const content = (item.contentEncoded ?? item.content ?? "") as string;
  const m = content.match(/href=["'](https:\/\/www\.fbi\.gov\/news\/[^"']+)["']/);
  if (m) return m[1];
  if (item.title) {
    const slug = item.title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
    return `https://www.fbi.gov/news/press-releases/${slug}`;
  }
  return "https://www.fbi.gov/news/press-releases";
}

function extractCISAUrl(item: { guid?: string | { _?: string }; link?: string; content?: string; contentEncoded?: string }): string | null {
  const guidStr = typeof item.guid === "string" ? item.guid : (item.guid as { _?: string })?._;
  if (guidStr && guidStr.startsWith("http")) return guidStr;
  const link = item.link;
  if (link && (link.includes("/news-events/") || link.includes("/uscert/") || link.includes("/cybersecurity-advisories/") || link.includes("/known-exploited")))
    return link;
  const content = (item.contentEncoded ?? item.content ?? "") as string;
  const m = content.match(/href=["'](https:\/\/www\.cisa\.gov\/[^"']+)["']/);
  if (m) return m[1];
  return link ?? "https://www.cisa.gov/news-events/cybersecurity-advisories";
}

function extractNISTUrl(item: { guid?: string | { _?: string }; link?: string }): string | null {
  const guidStr = typeof item.guid === "string" ? item.guid : (item.guid as { _?: string })?._;
  if (guidStr && guidStr.startsWith("http")) return guidStr;
  return item.link ?? null;
}

type RssItem = {
  link?: string;
  guid?: string | { _?: string } | string;
  origLink?: string;
  enclosure?: { url?: string };
  links?: Array<{ href?: string } | string>;
  content?: string;
  contentEncoded?: string;
  title?: string;
};

function extractRealUrl(item: RssItem, feedName: string): string | null {
  if (FBI_SOURCES.has(feedName)) {
    const url = extractFBIUrl(item);
    if (url && isValidUrl(url) && isValidArticleUrl(url, feedName)) return url;
  }
  if (CISA_SOURCES.has(feedName)) {
    const url = extractCISAUrl(item);
    if (url && isValidUrl(url) && isValidArticleUrl(url, feedName)) return url;
  }
  if (NIST_SOURCES.has(feedName)) {
    const url = extractNISTUrl(item);
    if (url && isValidUrl(url) && isValidArticleUrl(url, feedName)) return url;
  }
  const guidStr = typeof item.guid === "string" ? item.guid : (item.guid as { _?: string })?._;
  const linksHref = Array.isArray(item.links) && item.links.length > 0
    ? (typeof item.links[0] === "object" && item.links[0] !== null && "href" in item.links[0]
        ? (item.links[0] as { href?: string }).href
        : typeof item.links[0] === "string" ? item.links[0] : null)
    : null;
  const candidates = [item.link, guidStr, item.origLink, item.enclosure?.url, linksHref];
  for (const url of candidates) {
    if (url && isValidUrl(url) && isValidArticleUrl(url, feedName)) return url;
  }
  const content = (item.contentEncoded ?? item.content ?? "") as string;
  const m = content.match(/href=["'](https?:\/\/[^"']+)["']/);
  if (m && isValidUrl(m[1]) && isValidArticleUrl(m[1], feedName)) return m[1];
  if (item.link && isValidUrl(item.link)) return item.link;
  logger.warn(`[RSS] No valid URL for: ${item.title ?? "?"} (${feedName})`);
  return null;
}

export function resolveSourceUrl(item: RssItem, feedName: string): string | null {
  return extractRealUrl(item, feedName);
}

export async function fetchRssFeeds(
  onBroadcast: OnBroadcast | undefined,
  result: FeedUpdateResult
): Promise<void> {
  const seenUrls = new Set<string>();
  const sorted = [...RSS_SOURCES].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));

  // Batch-load existing source URLs from last 90 days to avoid N+1 per-item SELECT queries
  const dedupCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [existingNews, existingThreats] = await Promise.all([
    db.select({ sourceUrl: newsItemsTable.sourceUrl }).from(newsItemsTable).where(gte(newsItemsTable.publishedAt, dedupCutoff)),
    db.select({ sourceUrl: threatIntelTable.sourceUrl }).from(threatIntelTable).where(gte(threatIntelTable.publishedAt, dedupCutoff)),
  ]);
  const knownUrls = new Set([
    ...existingNews.map((r) => r.sourceUrl).filter(Boolean),
    ...existingThreats.map((r) => r.sourceUrl).filter(Boolean),
  ] as string[]);

  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 500;
  const sources = sorted.filter((s) => !CERT_IN_SOURCES.has(s.name));

  async function processSource(source: RssSource): Promise<void> {
    try {
      const feed = await parser.parseURL(source.url);
      const isThreat = THREAT_CATEGORY_SOURCES.has(source.name) || source.category === "THREAT";
      const newsBatch: (typeof newsItemsTable.$inferInsert)[] = [];
      const threatBatch: (typeof threatIntelTable.$inferInsert)[] = [];

      for (const item of feed.items ?? []) {
        const link = extractRealUrl(item as RssItem, source.name);
        if (!link || seenUrls.has(link) || knownUrls.has(link)) continue;
        seenUrls.add(link);

        const title = item.title?.trim() ?? "Untitled";
        const summary = item.contentSnippet?.trim().slice(0, 500) ?? (item.content ?? "").replace(/<[^>]+>/g, "").slice(0, 500) ?? title;
        const content = item.content ?? summary;
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const fullText = `${title} ${summary} ${content}`;

        const relevance = cyberRelevanceDetector.isRelevant(fullText, { source: source.name });
        if (!relevance.isRelevant) continue;

        let indiaDetails = indiaDetector.getIndiaDetails(fullText, { source: source.name });
        let scope: "local" | "global";
        if (source.forceLocal) {
          scope = "local";
          indiaDetails = { ...indiaDetails, isIndia: true, confidence: 100 };
        } else if (source.defaultScope === "global") {
          scope = indiaDetails.confidence >= 40 ? "local" : "global";
        } else if (source.defaultScope === "local" || indiaDetector.isIndianSource(source.name)) {
          scope = "local";
        } else {
          scope = indiaDetails.isIndia ? "local" : "global";
        }
        const severity = inferSeverity(title, summary);

        const indiaFields = {
          isIndiaRelated: indiaDetails.isIndia,
          indiaConfidence: indiaDetails.confidence,
          indianState: indiaDetails.state,
          indianStateName: indiaDetails.stateName,
          indianCity: indiaDetails.city,
          indianSector: indiaDetails.sector,
        };

        if (isThreat) {
          threatBatch.push({
            title,
            summary,
            description: content.slice(0, 5000),
            scope,
            severity,
            category: "Threat Intelligence",
            source: source.name,
            sourceUrl: link,
            references: [link],
            status: "active",
            publishedAt: pubDate,
            ...indiaFields,
          });
        } else {
          newsBatch.push({
            title,
            summary,
            content: content.slice(0, 10000),
            type: "news",
            scope,
            severity,
            category: "Security News",
            source: source.name,
            sourceUrl: link,
            region: scope === "local" ? ["India"] : ["Global"],
            tags: [],
            iocs: [],
            affectedSystems: [],
            mitigations: [],
            status: "active",
            publishedAt: pubDate,
            ...indiaFields,
          });
        }
        knownUrls.add(link);
      }

      // Batch insert all items for this source in one query each
      if (newsBatch.length > 0) await db.insert(newsItemsTable).values(newsBatch);
      if (threatBatch.length > 0) await db.insert(threatIntelTable).values(threatBatch);

      result.rssNews += newsBatch.length;
      result.rssThreats += threatBatch.length;
      if (newsBatch.length + threatBatch.length > 0) {
        logger.info(`[RSS] ${source.name}: +${newsBatch.length} news, +${threatBatch.length} threats`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push({ source: source.name, error: msg });
      logger.error(`[RSS] ${source.name} failed:`, msg);
    }
  }

  // Process sources in batches of BATCH_SIZE for controlled concurrency
  for (let i = 0; i < sources.length; i += BATCH_SIZE) {
    const batch = sources.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map((s) => processSource(s)));
    if (i + BATCH_SIZE < sources.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
}
