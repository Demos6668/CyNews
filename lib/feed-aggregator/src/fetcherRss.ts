/**
 * RSS Feed Fetcher - Fetches articles from RSS/Atom feeds across security news,
 * threat intelligence, and advisory sources.
 */

import Parser from "rss-parser";
import { load } from "cheerio";
import { logger } from "./logger";
import { db, advisoriesTable, newsItemsTable, threatIntelTable } from "@workspace/db";
import { gte } from "drizzle-orm";
import { indiaDetector } from "@workspace/india-detector";
import { cyberRelevanceDetector } from "./cyberRelevanceDetector";
import { fetchWithTimeout } from "./fetchWithTimeout";
import {
  type FeedUpdateResult,
  type OnBroadcast,
  extractItemContent,
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
  timeoutMs?: number;
  htmlFallback?: HtmlListingFallback;
  advisoryAllowPatterns?: RegExp[];
  scope?: "local" | "global" | null;
  forceLocal?: boolean;
  defaultScope?: "local" | "global" | null;
};

type AdvisoryInsert = typeof advisoriesTable.$inferInsert;
type ThreatInsert = typeof threatIntelTable.$inferInsert;
type HtmlListingFallback = {
  url: string;
  linkPatterns: RegExp[];
  excludePatterns?: RegExp[];
  maxItems?: number;
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
  { name: "CERT-EU", url: "https://www.cert.europa.eu/publications/security-advisories-rss", category: "ADVISORY", priority: 1, defaultScope: "global" },
  { name: "ENISA", url: "https://www.enisa.europa.eu/publications/rss.xml", category: "ADVISORY", priority: 2, defaultScope: "global" },
  {
    name: "AU Cyber Security Centre",
    url: "https://www.cyber.gov.au/rss/advisories",
    category: "ADVISORY",
    priority: 2,
    defaultScope: "global",
    timeoutMs: 30000,
    htmlFallback: {
      url: "https://www.cyber.gov.au/about-us/view-all-content/alerts-and-advisories",
      linkPatterns: [/\/about-us\/view-all-content\/alerts-and-advisories\/[a-z0-9-]+$/i],
      excludePatterns: [/\/archive$/i],
      maxItems: 30,
    },
  },
  {
    name: "Canadian Cyber Centre",
    url: "https://www.cyber.gc.ca/api/cccs/v1/rss/en/public",
    category: "ADVISORY",
    priority: 2,
    defaultScope: "global",
    htmlFallback: {
      url: "https://www.cyber.gc.ca/en/alerts-advisories",
      linkPatterns: [/\/en\/alerts-advisories\/[a-z0-9-]+$/i],
      maxItems: 30,
    },
  },
  { name: "JPCERT (Japan)", url: "https://www.jpcert.or.jp/rss/jpcert.rdf", category: "ADVISORY", priority: 2, defaultScope: "global" },
  {
    name: "CERT-NZ",
    url: "https://www.cert.govt.nz/rss/all/",
    category: "ADVISORY",
    priority: 3,
    defaultScope: "global",
    htmlFallback: {
      url: "https://www.ncsc.govt.nz/alerts/",
      linkPatterns: [/\/alerts\/[a-z0-9-]+\/$/i],
      excludePatterns: [/\/alerts\/?$/i],
      maxItems: 30,
    },
  },
  { name: "CERT-FR", url: "https://www.cert.ssi.gouv.fr/feed/", category: "ADVISORY", priority: 2, defaultScope: "global" },
  { name: "BSI Germany", url: "https://wid.cert-bund.de/content/public/securityAdvisory/rss", category: "ADVISORY", priority: 2, defaultScope: "global" },
  {
    name: "Cybersecurity Singapore",
    url: "https://www.csa.gov.sg/News/News-Articles/rss-feed",
    category: "ADVISORY",
    priority: 3,
    defaultScope: "global",
    htmlFallback: {
      url: "https://www.csa.gov.sg/alerts-and-advisories/",
      linkPatterns: [/\/alerts-and-advisories\/(?:alerts|advisories|bulletins)\/[a-z0-9-]+\/?$/i],
      excludePatterns: [/\/alerts-and-advisories\/(?:alerts|advisories|bulletins)\/?$/i],
      maxItems: 30,
    },
  },
  { name: "HKCERT", url: "https://www.hkcert.org/getrss/security-bulletin", category: "ADVISORY", priority: 3, defaultScope: "global" },
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
  {
    name: "Adobe Security",
    url: "https://blogs.adobe.com/security/feed/",
    category: "ADVISORY",
    priority: 1,
    timeoutMs: 30000,
    htmlFallback: {
      url: "https://helpx.adobe.com/security/security-bulletin.html",
      linkPatterns: [
        /\/security\/products\/[^/]+\/apsb\d{2}-\d+\.html$/i,
        /\/support\/security\/bulletins\/apsb\d{2}-\d+\.html$/i,
      ],
      maxItems: 40,
    },
  },
  { name: "Cisco Security", url: "https://tools.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml", category: "ADVISORY", priority: 1 },
  { name: "VMware Security", url: "https://www.vmware.com/security/advisories.xml", category: "ADVISORY", priority: 1 },
  { name: "Fortinet PSIRT", url: "https://filestore.fortinet.com/fortiguard/rss/ir.xml", category: "ADVISORY", priority: 1 },
  { name: "Palo Alto Security", url: "https://security.paloaltonetworks.com/rss.xml", category: "ADVISORY", priority: 1 },
  { name: "GitLab Security", url: "https://about.gitlab.com/security-releases.xml", category: "ADVISORY", priority: 2 },
  { name: "Zoom Security", url: "https://explore.zoom.us/en/trust/security/security-bulletin/feed/", category: "ADVISORY", priority: 2 },
  {
    name: "Ivanti Security",
    url: "https://www.ivanti.com/blog/rss",
    category: "ADVISORY",
    priority: 2,
    advisoryAllowPatterns: [
      /\bsecurity update\b/i,
      /\bsecurity advisory\b/i,
      /\bpatch tuesday\b/i,
      /\bcve-\d{4}-\d+/i,
    ],
  },
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
  { name: "Okta Security", url: "https://trust.okta.com/security-advisories.xml", category: "ADVISORY", priority: 2 },
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

const ADVISORY_CATEGORY_GOVERNMENT_PATTERNS = [
  /\bCERT\b/i,
  /\bCISA\b/i,
  /\bUS-CERT\b/i,
  /\bFBI\b/i,
  /\bNCSC\b/i,
  /\bENISA\b/i,
  /\bJPCERT\b/i,
  /\bHKCERT\b/i,
  /\bBSI\b/i,
  /\bCyber Centre\b/i,
  /\bCyber Security Centre\b/i,
  /\bRBI\b/i,
  /\bSEBI\b/i,
  /\bNPCI\b/i,
];

const ADVISORY_SEVERITY_TO_CVSS: Record<AdvisoryInsert["severity"], number> = {
  critical: 9.0,
  high: 7.5,
  medium: 5.5,
  low: 3.0,
  info: 0,
};

type ParsedFeed = {
  items?: Array<{
    title?: string;
    link?: string;
    guid?: string | { _?: string };
    pubDate?: string;
    content?: string;
    contentSnippet?: string;
  }>;
};

const HTML_PAGE_CONTENT_SELECTORS = [
  "article",
  "main article",
  "main",
  ".article-content",
  ".entry-content",
  ".post-content",
  ".post-body",
  ".node__content",
  ".field--name-body",
  ".content-body",
  ".content",
  "#content",
];

const FEED_TIMEZONE_REPLACEMENTS: Record<string, string> = {
  CET: "+0100",
  CEST: "+0200",
  IST: "+0530",
  PST: "-0800",
  PDT: "-0700",
  MST: "-0700",
  MDT: "-0600",
  CST: "-0600",
  CDT: "-0500",
  EST: "-0500",
  EDT: "-0400",
};

function sanitizeFeedMarkup(markup: string): string {
  return markup
    .replaceAll("\u0000", "")
    .replace(/&(?!#\d+;|#x[\da-f]+;|[a-z][\w.-]*;)/gi, "&amp;");
}

function looksLikeFeedMarkup(markup: string): boolean {
  return /<(rss|rdf:RDF|feed)\b/i.test(markup) || /<item\b/i.test(markup) || /<entry\b/i.test(markup);
}

function looksLikeHtmlDocument(markup: string): boolean {
  return /<!doctype html/i.test(markup) || /<html\b/i.test(markup);
}

function firstText($root: ReturnType<typeof load>, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = $root(selector).first().text().replace(/\s+/g, " ").trim();
    if (value) return value;
  }
  return undefined;
}

function firstHtml($root: ReturnType<typeof load>, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = $root(selector).first().html()?.trim();
    if (value) return value;
  }
  return undefined;
}

function firstLink($entry: ReturnType<typeof load>): string | undefined {
  const href = $entry("link[href]").first().attr("href");
  if (href?.trim()) return href.trim();

  const selectorCandidates = [
    "link",
    "guid",
  ];
  for (const selector of selectorCandidates) {
    const value = $entry(selector).first().text().trim();
    if (value.startsWith("http")) return value;
  }

  const attrCandidates = [
    "a[href]",
  ];
  for (const selector of attrCandidates) {
    const value = $entry(selector).first().attr("href");
    if (value?.trim()) return value.trim();
  }

  return undefined;
}

function normalizeCandidateUrl(url: string | undefined | null): string | null {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}

function normalizeExpandedText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function parseFeedDate(pubDate: string | undefined): Date {
  if (!pubDate?.trim()) {
    return new Date();
  }

  const direct = new Date(pubDate);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const normalized = pubDate.replace(
    /\b(CET|CEST|IST|PST|PDT|MST|MDT|CST|CDT|EST|EDT)\b/,
    (timezone) => FEED_TIMEZONE_REPLACEMENTS[timezone] ?? timezone,
  );
  const retried = new Date(normalized);

  if (!Number.isNaN(retried.getTime())) {
    return retried;
  }

  return new Date();
}

function resolveUrl(url: string, baseUrl: string): string | null {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractDateCandidate(text: string): string | undefined {
  const patterns = [
    /\b\d{4}-\d{2}-\d{2}\b/,
    /\b(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{1,2},\s+\d{4}\b/i,
    /\b\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{4}\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

function extractFallbackSummary(text: string, title: string): string {
  const normalized = normalizeExpandedText(text);
  if (!normalized) {
    return title;
  }

  const withoutTitle = normalized.startsWith(title)
    ? normalized.slice(title.length).trim()
    : normalized.replace(title, "").trim();

  return (withoutTitle || normalized || title).slice(0, 2000);
}

export function parseHtmlListingFallback(markup: string, fallback: HtmlListingFallback): ParsedFeed {
  const $ = load(markup);
  const items: NonNullable<ParsedFeed["items"]> = [];
  const seen = new Set<string>();

  $("script, style, noscript, svg, iframe").remove();

  $("a[href]").each((_index, element) => {
    if (items.length >= (fallback.maxItems ?? 25)) {
      return;
    }

    const anchor = $(element as Parameters<typeof $>[0]);
    const href = anchor.attr("href");
    const resolvedLink = href ? resolveUrl(href, fallback.url) : null;
    if (!resolvedLink || seen.has(resolvedLink)) {
      return;
    }

    if (!fallback.linkPatterns.some((pattern) => pattern.test(resolvedLink))) {
      return;
    }

    if (fallback.excludePatterns?.some((pattern) => pattern.test(resolvedLink))) {
      return;
    }

    const title = normalizeExpandedText(
      anchor.text()
      || anchor.attr("title")
      || anchor.attr("aria-label")
      || "",
    );
    if (title.length < 8) {
      return;
    }

    const container = anchor.closest("article, li, tr, .grid, .card, section, div").first();
    const containerText = normalizeExpandedText(container.text() || title);
    const summary = extractFallbackSummary(containerText, title);
    const timeElement = container.find("time").first();
    const dateText = normalizeExpandedText(
      timeElement.attr("datetime")
      || timeElement.attr("title")
      || timeElement.text()
      || extractDateCandidate(containerText)
      || "",
    );

    seen.add(resolvedLink);
    items.push({
      title,
      link: resolvedLink,
      guid: resolvedLink,
      pubDate: dateText || undefined,
      contentSnippet: summary,
      content: summary,
    });
  });

  return { items };
}

function extractReadableText($root: ReturnType<typeof load>, selector: string): string {
  const container = $root(selector).first();
  if (container.length === 0) return "";

  const lines = container
    .find("h1, h2, h3, h4, p, li, dd, dt, td")
    .map((_index, element) => $root(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((line) => line.length >= 20);

  if (lines.length > 0) {
    return normalizeExpandedText(lines.join("\n"));
  }

  return normalizeExpandedText(container.text().replace(/\s+/g, " "));
}

export function extractPageTextContent(markup: string): string {
  const $ = load(markup);
  $("script, style, noscript, svg, iframe, nav, header, footer, form, button").remove();

  for (const selector of HTML_PAGE_CONTENT_SELECTORS) {
    const text = extractReadableText($, selector);
    if (text.length >= 160) {
      return text;
    }
  }

  const metaDescription = $("meta[name='description']").attr("content")
    || $("meta[property='og:description']").attr("content")
    || $("meta[name='twitter:description']").attr("content");

  const bodyText = normalizeExpandedText($("body").text().replace(/\s+/g, " "));

  return normalizeExpandedText([metaDescription, bodyText].filter(Boolean).join("\n\n"));
}

function mergeExpandedContent(...blocks: string[]): string {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const normalized = normalizeExpandedText(block);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    if (merged.some((existing) => existing.includes(normalized) || normalized.includes(existing))) {
      continue;
    }

    seen.add(key);
    merged.push(normalized);
  }

  return merged.join("\n\n");
}

async function maybeExpandAdvisoryContent(
  source: RssSource,
  link: string,
  summary: string,
  content: string,
): Promise<{ summary: string; content: string }> {
  if (source.category !== "ADVISORY") {
    return { summary, content };
  }

  if (content.length >= 280 && summary.length >= 120) {
    return { summary, content };
  }

  if (!/^https?:\/\//i.test(link) || /\.(pdf|docx?|xlsx?|zip)$/i.test(link)) {
    return { summary, content };
  }

  try {
    const response = await fetchWithTimeout(link, {
      timeout: 8000,
      headers: {
        "User-Agent": "CYFY-News-Board/1.0 (Security Feed Aggregator)",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
      },
    });

    if (!response.ok) {
      return { summary, content };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/html|xhtml/i.test(contentType)) {
      return { summary, content };
    }

    const pageText = extractPageTextContent(await response.text());
    if (pageText.length < Math.max(content.length + 80, 180)) {
      return { summary, content };
    }

    const expandedContent = mergeExpandedContent(content, pageText).slice(0, 10000);
    const expandedSummary = mergeExpandedContent(summary, pageText).slice(0, 2000);

    return {
      summary: expandedSummary || summary,
      content: expandedContent || content,
    };
  } catch {
    return { summary, content };
  }
}

export function parseMalformedFeed(markup: string): ParsedFeed {
  const $ = load(markup);
  const items: NonNullable<ParsedFeed["items"]> = [];

  $("item, entry").each((_i, node) => {
    const entryHtml = $.html(node);
    const $entry = load(entryHtml);
    const title = firstText($entry, ["title"]);
    const link = firstLink($entry) ?? entryHtml.match(/<link>\s*(https?:\/\/[^<\s]+)\s*<\/link>/i)?.[1];
    const content = firstHtml($entry, ["description", "content\\:encoded", "content", "summary"]);
    const contentSnippet = firstText($entry, ["description", "summary", "content"]);
    const pubDate = firstText($entry, ["pubDate", "published", "updated", "dc\\:date"]);

    if (!title && !link) return;

    items.push({
      title,
      link,
      guid: link,
      pubDate,
      content,
      contentSnippet,
    });
  });

  return { items };
}

export function extractCveIds(text: string): string[] {
  return Array.from(
    new Set((text.match(/\bCVE-\d{4}-\d{4,7}\b/gi) ?? []).map((cve) => cve.toUpperCase()))
  );
}

export function deriveAdvisoryVendor(sourceName: string): string {
  const cleaned = sourceName
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\b(PSIRT|Updates|Update Guide|Security|Advisories|Advisory|Alerts|Alert|News)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned) {
    return cleaned;
  }

  return sourceName.trim();
}

export function deriveAdvisoryCategory(sourceName: string): string {
  if (sourceName.includes("KEV")) {
    return "Known Exploited Vulnerability";
  }

  if (ADVISORY_CATEGORY_GOVERNMENT_PATTERNS.some((pattern) => pattern.test(sourceName))) {
    return "Government Advisory";
  }

  return "Vendor Advisory";
}

export function buildThreatInsert(
  source: RssSource,
  title: string,
  summary: string,
  content: string,
  link: string,
  publishedAt: Date,
  scope: "local" | "global",
  severity: ThreatInsert["severity"],
  indiaFields: {
    isIndiaRelated: boolean;
    indiaConfidence: number;
    indianState?: string | null;
    indianStateName?: string | null;
    indianCity?: string | null;
    indianSector?: string | null;
  },
): ThreatInsert {
  return {
    title,
    summary,
    description: content.slice(0, 5000),
    scope,
    severity,
    category: "Threat Intelligence",
    source: source.name,
    sourceUrl: link,
    references: [],
    status: "active",
    publishedAt,
    ...indiaFields,
  };
}

function matchesAdvisorySourcePatterns(source: RssSource, title: string, summary: string, content: string): boolean {
  if (!source.advisoryAllowPatterns || source.advisoryAllowPatterns.length === 0) {
    return true;
  }

  const combined = `${title}\n${summary}\n${content}`;
  return source.advisoryAllowPatterns.some((pattern) => pattern.test(combined));
}

export function buildAdvisoryInsert(
  source: RssSource,
  title: string,
  summary: string,
  content: string,
  link: string,
  publishedAt: Date,
  scope: "local" | "global",
  severity: AdvisoryInsert["severity"],
  indiaFields: {
    isIndiaRelated: boolean;
    indiaConfidence: number;
  },
): AdvisoryInsert {
  const cveIds = extractCveIds(`${title} ${summary} ${content}`);
  const sourceUrl = link;
  const sourceName = source.name;

  return {
    cveId: cveIds[0] ?? `${sourceName}:${sourceUrl}`,
    title,
    description: summary.slice(0, 500) || title,
    cvssScore: ADVISORY_SEVERITY_TO_CVSS[severity],
    severity,
    affectedProducts: [],
    vendor: deriveAdvisoryVendor(sourceName),
    patchAvailable: false,
    patchUrl: null,
    workarounds: [],
    references: [],
    status: "new",
    publishedAt,
    scope,
    isIndiaRelated: indiaFields.isIndiaRelated,
    indiaConfidence: indiaFields.indiaConfidence,
    sourceUrl,
    source: sourceName,
    summary: summary.slice(0, 2000) || title,
    content: content.slice(0, 10000) || summary || title,
    category: deriveAdvisoryCategory(sourceName),
    cveIds,
    recommendations: [],
  };
}

async function parseFeedMarkup(markup: string, sourceName: string): Promise<ParsedFeed> {
  const trimmed = markup.trim();
  if (!trimmed) {
    return { items: [] };
  }

  if (looksLikeHtmlDocument(trimmed) && !looksLikeFeedMarkup(trimmed)) {
    logger.warn(`[RSS] ${sourceName} returned HTML instead of a feed`);
    return { items: [] };
  }

  try {
    return await parser.parseString(sanitizeFeedMarkup(trimmed));
  } catch (error) {
    const fallback = parseMalformedFeed(trimmed);
    if ((fallback.items?.length ?? 0) > 0) {
      logger.warn(`[RSS] ${sourceName} used malformed-feed fallback`);
      return fallback;
    }
    throw error;
  }
}

async function fetchFeed(source: RssSource): Promise<ParsedFeed> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetchWithTimeout(source.url, {
        timeout: source.timeoutMs ?? 15000,
        headers: {
          "User-Agent": "CYFY-News-Board/1.0 (Security Feed Aggregator)",
          Accept: "application/rss+xml, application/xml, text/xml;q=0.9, application/atom+xml;q=0.9, text/html;q=0.5, */*;q=0.1",
        },
      });

      if (!response.ok) {
        throw new Error(`Status code ${response.status}`);
      }

      const markup = await response.text();
      return parseFeedMarkup(markup, source.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = error instanceof Error ? error : new Error(message);

      if (attempt >= 2 || !isRetryableFeedError(message)) {
        throw lastError;
      }

      logger.warn(`[RSS] ${source.name} retrying after transient error: ${message}`);
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }

  throw lastError ?? new Error(`Failed to fetch feed: ${source.name}`);
}

async function fetchHtmlFallback(source: RssSource): Promise<ParsedFeed> {
  const fallback = source.htmlFallback;
  if (!fallback) {
    return { items: [] };
  }

  const response = await fetchWithTimeout(fallback.url, {
    timeout: source.timeoutMs ?? 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CYFY-News-Board/1.0; Security Feed Aggregator)",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Status code ${response.status}`);
  }

  return parseHtmlListingFallback(await response.text(), fallback);
}

function isSkippableFeedError(message: string): boolean {
  return (
    message.startsWith("Status code 400") ||
    message.startsWith("Status code 403") ||
    message.startsWith("Status code 404") ||
    message.includes("returned HTML instead of a feed") ||
    message.includes("Feed not recognized as RSS") ||
    message.includes("Invalid character in entity name") ||
    message.includes("Attribute without value") ||
    message.includes("Unexpected close tag") ||
    message.includes("Unquoted attribute value") ||
    message.includes("Unencoded <")
  );
}

export function isRetryableFeedError(message: string): boolean {
  return (
    message.includes("fetch failed") ||
    message.includes("timed out") ||
    /Status code (408|425|429|500|502|503|504|520|521|522|524)\b/.test(message)
  );
}

export function isValidArticleUrl(url: string, sourceName: string): boolean {
  try {
    const parsed = new URL(url.trim());
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
  const candidates = [item.link, guidStr, item.origLink, item.enclosure?.url, linksHref]
    .map((candidate) => normalizeCandidateUrl(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));
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
    db.select({ sourceUrl: threatIntelTable.sourceUrl }).from(threatIntelTable),
  ]);
  const existingAdvisories = await db
    .select({ sourceUrl: advisoriesTable.sourceUrl, cveId: advisoriesTable.cveId })
    .from(advisoriesTable)
    .where(gte(advisoriesTable.publishedAt, dedupCutoff));
  const knownUrls = new Set([
    ...existingNews.map((r) => r.sourceUrl).filter(Boolean),
    ...existingThreats.map((r) => r.sourceUrl).filter(Boolean),
  ] as string[]);
  const knownAdvisoryUrls = new Set(existingAdvisories.map((r) => r.sourceUrl).filter(Boolean) as string[]);
  const knownAdvisoryIds = new Set(existingAdvisories.map((r) => r.cveId).filter(Boolean));

  const BATCH_SIZE = 5;
  const BATCH_DELAY_MS = 500;
  const sources = sorted.filter((s) => !CERT_IN_SOURCES.has(s.name));

  async function processSource(source: RssSource): Promise<void> {
    let feed: ParsedFeed = { items: [] };
    let primaryError: string | null = null;

    try {
      feed = await fetchFeed(source);
    } catch (err) {
      primaryError = err instanceof Error ? err.message : String(err);
    }

    if ((feed.items?.length ?? 0) === 0 && source.htmlFallback) {
      try {
        const fallbackFeed = await fetchHtmlFallback(source);
        if ((fallbackFeed.items?.length ?? 0) > 0) {
          feed = fallbackFeed;
          logger.info(`[RSS] ${source.name} using HTML listing fallback`);
          primaryError = null;
        }
      } catch (fallbackError) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        if (primaryError) {
          primaryError = `${primaryError}; fallback failed: ${fallbackMessage}`;
        } else {
          primaryError = fallbackMessage;
        }
      }
    }

    try {
      if ((feed.items?.length ?? 0) === 0 && primaryError) {
        throw new Error(primaryError);
      }

      const isThreat = THREAT_CATEGORY_SOURCES.has(source.name) || source.category === "THREAT";
      const newsBatch: (typeof newsItemsTable.$inferInsert)[] = [];
      const threatBatch: (typeof threatIntelTable.$inferInsert)[] = [];
      const advisoryBatch: AdvisoryInsert[] = [];

      for (const item of feed.items ?? []) {
        const link = extractRealUrl(item as RssItem, source.name);
        if (!link || seenUrls.has(link) || knownUrls.has(link)) continue;
        seenUrls.add(link);

        const title = item.title?.trim() ?? "Untitled";
        const baseContent = extractItemContent(title, item.contentSnippet, item.content);
        const pubDate = parseFeedDate(item.pubDate);
        const expandedContent = await maybeExpandAdvisoryContent(
          source,
          link,
          baseContent.summary,
          baseContent.content,
        );
        const summary = expandedContent.summary;
        const content = expandedContent.content;
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

        if (source.category === "ADVISORY") {
          if (!matchesAdvisorySourcePatterns(source, title, summary, content)) {
            continue;
          }

          const advisory = buildAdvisoryInsert(
            source,
            title,
            summary,
            content,
            link,
            pubDate,
            scope,
            severity,
            {
              isIndiaRelated: indiaFields.isIndiaRelated,
              indiaConfidence: indiaFields.indiaConfidence,
            },
          );

          if (knownAdvisoryUrls.has(advisory.sourceUrl ?? "") || knownAdvisoryIds.has(advisory.cveId)) {
            continue;
          }

          advisoryBatch.push(advisory);
          if (advisory.sourceUrl) {
            knownAdvisoryUrls.add(advisory.sourceUrl);
          }
          knownAdvisoryIds.add(advisory.cveId);
        } else if (isThreat) {
          threatBatch.push(
            buildThreatInsert(
              source,
              title,
              summary,
              content,
              link,
              pubDate,
              scope,
              severity,
              indiaFields,
            )
          );
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

      // Batch insert all items for this source in one query each.
      // onConflictDoNothing is the DB-level guard against duplicates; the
      // in-memory knownUrls Set above is a fast-path to avoid unnecessary round-trips.
      if (newsBatch.length > 0)
        await db.insert(newsItemsTable).values(newsBatch)
          .onConflictDoNothing({ target: newsItemsTable.sourceUrl });
      if (threatBatch.length > 0)
        await db.insert(threatIntelTable).values(threatBatch)
          .onConflictDoNothing({ target: threatIntelTable.sourceUrl });
      if (advisoryBatch.length > 0) await db.insert(advisoriesTable).values(advisoryBatch);

      result.rssNews += newsBatch.length;
      result.rssThreats += threatBatch.length;
      result.advisories += advisoryBatch.length;
      if (newsBatch.length + threatBatch.length + advisoryBatch.length > 0) {
        logger.info(`[RSS] ${source.name}: +${newsBatch.length} news, +${threatBatch.length} threats, +${advisoryBatch.length} advisories`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isSkippableFeedError(msg)) {
        logger.warn(`[RSS] ${source.name} skipped: ${msg}`);
        return;
      }
      result.errors.push({ source: source.name, error: msg });
      logger.error(`[RSS] ${source.name} failed: ${msg}`);
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
