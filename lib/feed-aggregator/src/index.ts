/**
 * Feed Aggregator - Fetches RSS feeds and APIs, stores in database.
 * Used by scripts (CLI) and api-server (scheduler).
 */

import Parser from "rss-parser";
import { db, newsItemsTable, advisoriesTable, threatIntelTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";

export interface FeedUpdateResult {
  rssNews: number;
  rssThreats: number;
  advisories: number;
  urlhaus: number;
  threatFox: number;
  ransomwareLive: number;
  nvd: number;
  feodo: number;
  errors: Array<{ source: string; error: string }>;
}

export type OnBroadcast = (event: string, data: unknown) => void;

function inferSeverity(title: string, summary: string): "critical" | "high" | "medium" | "low" | "info" {
  const c = `${title} ${summary}`.toLowerCase();
  if (c.includes("critical") || c.includes("zero-day") || c.includes("ransomware") || c.includes("actively exploited")) return "critical";
  if (c.includes("high") || c.includes("vulnerability") || c.includes("breach") || c.includes("exploit")) return "high";
  if (c.includes("medium") || c.includes("phishing") || c.includes("malware")) return "medium";
  if (c.includes("low") || c.includes("advisory")) return "low";
  return "info";
}

const THREAT_CATEGORY_SOURCES = new Set([
  "SANS ISC", "SANS ISC Threat", "Cisco Talos", "Unit 42", "Mandiant", "Microsoft Security", "Microsoft Threat Intelligence",
  "Google TAG", "Google Project Zero", "Recorded Future", "Proofpoint", "CrowdStrike", "SentinelOne", "Kaspersky SecureList",
  "ESET WeLiveSecurity", "Check Point Research", "Fortinet", "Symantec", "Trend Micro", "Malwarebytes Labs", "Sophos News",
  "Bitdefender Labs", "McAfee Labs", "F-Secure Labs", "Avast Decoded", "Zscaler ThreatLabz", "Elastic Security Labs",
  "Rapid7", "Qualys", "Tenable", "Huntress", "Binary Defense", "Red Canary", "Dragos", "Claroty", "Nozomi Networks",
  "Volexity", "Secureworks", "BlackBerry Cylance", "Cofense", "Flashpoint", "Intel 471", "Group-IB", "ReversingLabs",
  "Intezer", "Packet Storm", "Packet Storm Files", "Exploit Database", "Full Disclosure", "OSS Security", "Bugtraq",
  "MalwareTech", "Objective-See", "VX Underground", "Ransomware News", "URLhaus", "ThreatFox", "Ransomware.live",
  "Wiz Security Research", "Orca Security", "Zimperium", "Lookout Security",
]);

const FBI_SOURCES = new Set(["FBI", "FBI Cyber", "FBI Press Releases"]);
const IC3_SOURCES = new Set(["FBI Internet Crime"]);
const CISA_SOURCES = new Set(["CISA Alerts", "CISA ICS Advisories", "US-CERT"]);
const NIST_SOURCES = new Set(["NIST", "NVD"]);

type RssSource = {
  name: string;
  url: string;
  category?: "NEWS" | "THREAT" | "ADVISORY";
  priority?: number;
  scope?: "local" | "global" | null;
  forceLocal?: boolean;
  defaultScope?: "local" | "global" | null;
};

const RSS_SOURCES: RssSource[] = [
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

function isValidUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") return false;
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  const fakePatterns = ["example.com", "placeholder", "localhost", "test.com", "fake", "dummy"];
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".")) return false;
    const hostLower = parsed.hostname.toLowerCase();
    if (fakePatterns.some((p) => hostLower.includes(p))) return false;
    return true;
  } catch {
    return false;
  }
}

function isValidArticleUrl(url: string, sourceName: string): boolean {
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

function extractFBIUrl(item: { guid?: string | { _?: string }; title?: string; content?: string; contentEncoded?: string }): string | null {
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
  console.warn(`[RSS] No valid URL for: ${item.title ?? "?"} (${feedName})`);
  return null;
}

async function fetchRssFeeds(
  onBroadcast: OnBroadcast | undefined,
  result: FeedUpdateResult
): Promise<void> {
  const seenUrls = new Set<string>();
  const sorted = [...RSS_SOURCES].sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2));

  for (const source of sorted) {
    try {
      const feed = await parser.parseURL(source.url);
      let addedNews = 0;
      let addedThreats = 0;
      const isThreat = THREAT_CATEGORY_SOURCES.has(source.name) || source.category === "THREAT";

      for (const item of feed.items ?? []) {
        const link = extractRealUrl(item as RssItem, source.name);
        if (!link || seenUrls.has(link)) continue;
        seenUrls.add(link);

        const title = item.title?.trim() ?? "Untitled";
        const summary = item.contentSnippet?.trim().slice(0, 500) ?? (item.content ?? "").replace(/<[^>]+>/g, "").slice(0, 500) ?? title;
        const content = item.content ?? summary;
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const fullText = `${title} ${summary} ${content}`;
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
          const existing = await db.select({ id: threatIntelTable.id }).from(threatIntelTable).where(eq(threatIntelTable.sourceUrl, link)).limit(1);
          if (existing.length > 0) continue;
          await db.insert(threatIntelTable).values({
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
          addedThreats++;
        } else {
          const existing = await db.select({ id: newsItemsTable.id }).from(newsItemsTable).where(eq(newsItemsTable.sourceUrl, link)).limit(1);
          if (existing.length > 0) continue;
          await db.insert(newsItemsTable).values({
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
            ...indiaFields,
          });
          addedNews++;
        }
      }
      result.rssNews += addedNews;
      result.rssThreats += addedThreats;
      if (addedNews + addedThreats > 0) console.log(`[RSS] ${source.name}: +${addedNews} news, +${addedThreats} threats`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push({ source: source.name, error: msg });
      console.error(`[RSS] ${source.name} failed:`, msg);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

const CISA_KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

async function fetchCisaKev(result: FeedUpdateResult): Promise<void> {
  try {
    const res = await fetch(CISA_KEV_URL, { headers: { "User-Agent": "CYFY-News-Board/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { vulnerabilities?: Array<{ cveID: string; vendorProject: string; product: string; vulnerabilityName: string; dateAdded: string; shortDescription?: string }> };
    const vulns = data.vulnerabilities ?? [];
    let added = 0;
    for (const v of vulns.slice(0, 50)) {
      const cveId = v.cveID ?? "";
      if (!cveId.startsWith("CVE-")) continue;
      const existing = await db.select({ id: advisoriesTable.id }).from(advisoriesTable).where(eq(advisoriesTable.cveId, cveId)).limit(1);
      if (existing.length > 0) continue;
      const fullText = `${v.vulnerabilityName ?? ""} ${v.shortDescription ?? ""} ${v.vendorProject ?? ""} ${v.product ?? ""}`;
      const indiaDetails = indiaDetector.getIndiaDetails(fullText);
      await db.insert(advisoriesTable).values({
        cveId,
        title: v.vulnerabilityName ?? cveId,
        description: v.shortDescription ?? `Known Exploited Vulnerability: ${cveId}. See CISA KEV catalog.`,
        cvssScore: 9.0,
        severity: "critical",
        affectedProducts: [`${v.vendorProject ?? ""} ${v.product ?? ""}`.trim() || "Unknown"],
        vendor: v.vendorProject ?? "Unknown",
        patchAvailable: false,
        patchUrl: `https://nvd.nist.gov/vuln/detail/${cveId}`,
        workarounds: ["Check CISA KEV for mitigation guidance"],
        references: [`https://nvd.nist.gov/vuln/detail/${cveId}`, "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"],
        status: "new",
        publishedAt: v.dateAdded ? new Date(v.dateAdded) : new Date(),
        scope: indiaDetails.isIndia ? "local" : "global",
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
      });
      added++;
    }
    result.advisories += added;
    if (added > 0) console.log(`[CISA KEV] ${added} new advisories`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "CISA KEV", error: msg });
    console.error("[CISA KEV] failed:", msg);
  }
}

async function fetchURLhaus(result: FeedUpdateResult): Promise<void> {
  const authKey = process.env.URLHAUS_AUTH_KEY;
  if (!authKey) return;
  try {
    const res = await fetch("https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/", {
      headers: { "Auth-Key": authKey },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { urls?: Array<{ id: string; url: string; threat?: string; date_added?: string; url_info_from_api?: { host?: string } }> };
    const urls = data.urls ?? [];
    let added = 0;
    for (const u of urls) {
      const sourceUrl = `https://urlhaus.abuse.ch/url/${u.id}/`;
      const existing = await db.select({ id: threatIntelTable.id }).from(threatIntelTable).where(eq(threatIntelTable.sourceUrl, sourceUrl)).limit(1);
      if (existing.length > 0) continue;
      const host = u.url_info_from_api?.host ?? new URL(u.url).hostname;
      const title = `Malicious URL: ${u.url.slice(0, 60)}...`;
      const summary = `Threat: ${u.threat ?? "malware"}. Host: ${host}`;
      const description = `URL: ${u.url}\nThreat: ${u.threat ?? "malware"}\nHost: ${host}`;
      const indiaDetails = indiaDetector.getIndiaDetails(`${title} ${summary} ${description}`);
      const isIndiaDomain = host.endsWith(".in") || host.includes(".gov.in") || host.includes(".co.in");
      const isIndia = indiaDetails.isIndia || isIndiaDomain;
      await db.insert(threatIntelTable).values({
        title,
        summary,
        description,
        scope: isIndia ? "local" : "global",
        isIndiaRelated: isIndia,
        indiaConfidence: isIndia ? (isIndiaDomain ? 100 : indiaDetails.confidence) : 0,
        indianState: indiaDetails.state,
        indianStateName: indiaDetails.stateName,
        indianCity: indiaDetails.city,
        indianSector: indiaDetails.sector,
        severity: u.threat === "malware_download" ? "high" : "medium",
        category: "Malware Distribution",
        source: "URLhaus",
        sourceUrl,
        iocs: [u.url],
        references: [sourceUrl],
        status: "active",
        publishedAt: u.date_added ? new Date(u.date_added) : new Date(),
      });
      added++;
    }
    result.urlhaus += added;
    if (added > 0) console.log(`[URLhaus] ${added} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "URLhaus", error: msg });
  }
}

async function fetchThreatFox(result: FeedUpdateResult): Promise<void> {
  const authKey = process.env.THREATFOX_AUTH_KEY;
  if (!authKey) return;
  try {
    const res = await fetch("https://threatfox-api.abuse.ch/api/v1/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Auth-Key": authKey },
      body: JSON.stringify({ query: "get_iocs", days: 1 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ id: number; ioc: string; malware_printable: string; threat_type_desc: string; confidence_level: number; first_seen: string; ioc_type?: string }> };
    const iocs = data.data ?? [];
    let added = 0;
    for (const i of iocs.slice(0, 50)) {
      const sourceUrl = `https://threatfox.abuse.ch/ioc/${i.id}/`;
      const existing = await db.select({ id: threatIntelTable.id }).from(threatIntelTable).where(eq(threatIntelTable.sourceUrl, sourceUrl)).limit(1);
      if (existing.length > 0) continue;
      const title = `IOC: ${i.malware_printable} - ${i.ioc_type ?? "unknown"}`;
      const summary = `${i.threat_type_desc}. Confidence: ${i.confidence_level}%`;
      const description = `IOC: ${i.ioc}\nMalware: ${i.malware_printable}\nType: ${i.threat_type_desc}`;
      const indiaDetails = indiaDetector.getIndiaDetails(`${title} ${summary} ${description}`);
      await db.insert(threatIntelTable).values({
        title,
        summary,
        description,
        scope: indiaDetails.isIndia ? "local" : "global",
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
        indianState: indiaDetails.state,
        indianStateName: indiaDetails.stateName,
        indianCity: indiaDetails.city,
        indianSector: indiaDetails.sector,
        severity: i.confidence_level >= 75 ? "high" : "medium",
        category: "Malware IOC",
        source: "ThreatFox",
        sourceUrl,
        iocs: [i.ioc],
        references: [sourceUrl],
        status: "active",
        publishedAt: i.first_seen ? new Date(i.first_seen) : new Date(),
      });
      added++;
    }
    result.threatFox += added;
    if (added > 0) console.log(`[ThreatFox] ${added} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "ThreatFox", error: msg });
  }
}

function detectScopeFromCountry(country: string | undefined): "local" | "global" {
  if (!country) return "global";
  const india = ["india", "in", "ind"];
  return india.includes(country.toLowerCase()) ? "local" : "global";
}

type RansomwareVictim = { post_title: string; group_name: string; country?: string; published?: string; discovered?: string; website?: string; post_url?: string; description?: string };

async function fetchRansomwareLive(result: FeedUpdateResult): Promise<void> {
  try {
    const res = await fetch("https://api.ransomware.live/recentvictims", {
      headers: { "User-Agent": "CYFY-News-Board/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as RansomwareVictim[];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let added = 0;
    for (const v of (data ?? []).slice(0, 30)) {
      const pubDate = v.published ? new Date(v.published) : new Date(v.discovered ?? Date.now());
      if (pubDate.getTime() < weekAgo) continue;
      const victimName = v.post_title ?? "Unknown";
      const sourceUrl = v.post_url && v.post_url.startsWith("http")
        ? v.post_url
        : `https://www.ransomware.live/#/group/${encodeURIComponent(v.group_name ?? "unknown")}?v=${encodeURIComponent(victimName)}`;
      const existing = await db.select({ id: threatIntelTable.id }).from(threatIntelTable).where(eq(threatIntelTable.sourceUrl, sourceUrl)).limit(1);
      if (existing.length > 0) continue;
      let scope = detectScopeFromCountry(v.country);
      const fullText = `${victimName} ${v.group_name} ${v.description ?? ""} ${v.country ?? ""}`;
      const indiaDetails = indiaDetector.getIndiaDetails(fullText, { country: v.country });
      if (indiaDetails.isIndia) scope = "local";
      await db.insert(threatIntelTable).values({
        title: `Ransomware: ${victimName} by ${v.group_name}`,
        summary: `${victimName} attacked by ${v.group_name}${v.country ? `. Country: ${v.country}` : ""}`,
        description: (v.description ?? `Victim: ${victimName}\nGroup: ${v.group_name}\nCountry: ${v.country ?? "Unknown"}`).slice(0, 5000),
        scope,
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
        indianState: indiaDetails.state,
        indianStateName: indiaDetails.stateName,
        indianCity: indiaDetails.city,
        indianSector: indiaDetails.sector,
        severity: "critical",
        category: "Ransomware",
        source: "Ransomware.live",
        sourceUrl,
        references: [sourceUrl],
        status: "active",
        publishedAt: pubDate,
      });
      added++;
    }
    result.ransomwareLive += added;
    if (added > 0) console.log(`[Ransomware.live] ${added} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "Ransomware.live", error: msg });
  }
}

const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const FEODO_URL = "https://feodotracker.abuse.ch/downloads/ipblocklist.json";

function cvssToSeverity(score: number): "critical" | "high" | "medium" | "low" | "info" {
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  if (score >= 0.1) return "low";
  return "info";
}

async function fetchNVD(result: FeedUpdateResult): Promise<void> {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const pubStart = weekAgo.toISOString();
    const pubEnd = new Date().toISOString();
    const res = await fetch(
      `${NVD_URL}?resultsPerPage=50&pubStartDate=${encodeURIComponent(pubStart)}&pubEndDate=${encodeURIComponent(pubEnd)}`,
      { headers: { "User-Agent": "CYFY-News-Board/1.0" } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      vulnerabilities?: Array<{
        cve: {
          id: string;
          descriptions?: Array<{ lang: string; value: string }>;
          metrics?: { cvssMetricV31?: Array<{ cvssData: { baseScore: number } }>; cvssMetricV30?: Array<{ cvssData: { baseScore: number } }> };
          published?: string;
          vulnStatus?: string;
        };
      }>;
    };
    const vulns = data.vulnerabilities ?? [];
    let added = 0;
    for (const v of vulns) {
      const cve = v.cve;
      const cveId = cve.id ?? "";
      if (!cveId.startsWith("CVE-")) continue;
      if (cve.vulnStatus === "Rejected") continue;
      const existing = await db.select({ id: advisoriesTable.id }).from(advisoriesTable).where(eq(advisoriesTable.cveId, cveId)).limit(1);
      if (existing.length > 0) continue;
      const description = cve.descriptions?.find((d) => d.lang === "en")?.value ?? "";
      const indiaDetails = indiaDetector.getIndiaDetails(description);
      let cvssScore = 0;
      const m31 = cve.metrics?.cvssMetricV31?.[0];
      const m30 = cve.metrics?.cvssMetricV30?.[0];
      if (m31) cvssScore = m31.cvssData.baseScore;
      else if (m30) cvssScore = m30.cvssData.baseScore;
      const severity = cvssToSeverity(cvssScore);
      await db.insert(advisoriesTable).values({
        cveId,
        title: description ? `${cveId}: ${description.slice(0, 80).replace(/\n/g, " ")}` : cveId,
        description: description || `Vulnerability ${cveId}. See NVD for details.`,
        cvssScore: cvssScore || 5.0,
        severity,
        affectedProducts: [],
        vendor: "Unknown",
        patchAvailable: false,
        patchUrl: `https://nvd.nist.gov/vuln/detail/${cveId}`,
        workarounds: [],
        references: [`https://nvd.nist.gov/vuln/detail/${cveId}`],
        status: "new",
        publishedAt: cve.published ? new Date(cve.published) : new Date(),
        scope: indiaDetails.isIndia ? "local" : "global",
        isIndiaRelated: indiaDetails.isIndia,
        indiaConfidence: indiaDetails.confidence,
      });
      added++;
    }
    result.nvd += added;
    if (added > 0) console.log(`[NVD] ${added} new advisories`);
    await new Promise((r) => setTimeout(r, 6000));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "NVD", error: msg });
    console.error("[NVD] failed:", msg);
  }
}

type FeodoEntry = { ip_address: string; port: number; malware: string; country?: string; first_seen?: string };

async function fetchFeodoTracker(result: FeedUpdateResult): Promise<void> {
  try {
    const res = await fetch(FEODO_URL, { headers: { "User-Agent": "CYFY-News-Board/1.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as FeodoEntry[];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let added = 0;
    for (const e of (data ?? []).slice(0, 30)) {
      const firstSeen = e.first_seen ? new Date(e.first_seen).getTime() : 0;
      if (firstSeen < weekAgo) continue;
      const isIndia = !!(e.country && (e.country.toLowerCase() === "in" || e.country.toLowerCase() === "india"));
      const sourceUrl = `https://feodotracker.abuse.ch/browse/host/${e.ip_address}/`;
      const existing = await db.select({ id: threatIntelTable.id }).from(threatIntelTable).where(eq(threatIntelTable.sourceUrl, sourceUrl)).limit(1);
      if (existing.length > 0) continue;
      await db.insert(threatIntelTable).values({
        title: `Banking Trojan C2: ${e.ip_address}`,
        summary: `${e.malware} command and control server. Country: ${e.country ?? "Unknown"}`,
        description: `IP: ${e.ip_address}\nPort: ${e.port}\nMalware: ${e.malware}\nCountry: ${e.country ?? "Unknown"}`,
        scope: isIndia ? "local" : "global",
        isIndiaRelated: isIndia,
        indiaConfidence: isIndia ? 100 : 0,
        indianState: null,
        indianStateName: null,
        indianCity: null,
        indianSector: null,
        severity: "high",
        category: "Banking Trojan",
        source: "Feodo Tracker",
        sourceUrl,
        iocs: [e.ip_address],
        references: [sourceUrl],
        status: "active",
        publishedAt: e.first_seen ? new Date(e.first_seen) : new Date(),
      });
      added++;
    }
    result.feodo += added;
    if (added > 0) console.log(`[Feodo Tracker] ${added} new items`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push({ source: "Feodo Tracker", error: msg });
    console.error("[Feodo Tracker] failed:", msg);
  }
}

export async function runFeedUpdate(onBroadcast?: OnBroadcast): Promise<FeedUpdateResult> {
  const result: FeedUpdateResult = { rssNews: 0, rssThreats: 0, advisories: 0, urlhaus: 0, threatFox: 0, ransomwareLive: 0, nvd: 0, feodo: 0, errors: [] };
  onBroadcast?.("REFRESH_STARTED", { timestamp: new Date().toISOString() });
  console.log("[Feed] Fetching all sources...");

  await fetchRssFeeds(onBroadcast, result);
  await fetchCisaKev(result);
  await fetchNVD(result);
  await fetchURLhaus(result);
  await fetchThreatFox(result);
  await fetchFeodoTracker(result);
  await fetchRansomwareLive(result);

  const total = result.rssNews + result.rssThreats + result.advisories + result.urlhaus + result.threatFox + result.ransomwareLive + result.nvd + result.feodo;
  const { errors: _err, ...rest } = result;
  onBroadcast?.("REFRESH_COMPLETE", {
    timestamp: new Date().toISOString(),
    newItems: total,
    errorCount: result.errors.length,
    ...rest,
  });
  console.log(`[Feed] Done. +${total} items, ${result.errors.length} errors`);
  return result;
}
