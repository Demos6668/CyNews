/**
 * Feed Aggregator - Shared utilities, types, and constants.
 */

import { indiaDetector } from "@workspace/india-detector";

export interface FeedUpdateResult {
  rssNews: number;
  rssThreats: number;
  advisories: number;
  certIn: number;
  urlhaus: number;
  threatFox: number;
  ransomwareLive: number;
  nvd: number;
  feodo: number;
  errors: Array<{ source: string; error: string }>;
}

export type OnBroadcast = (event: string, data: unknown) => void;

export function createEmptyResult(): FeedUpdateResult {
  return { rssNews: 0, rssThreats: 0, advisories: 0, certIn: 0, urlhaus: 0, threatFox: 0, ransomwareLive: 0, nvd: 0, feodo: 0, errors: [] };
}

export function inferSeverity(title: string, summary: string): "critical" | "high" | "medium" | "low" | "info" {
  const c = `${title} ${summary}`.toLowerCase();
  if (c.includes("critical") || c.includes("zero-day") || c.includes("ransomware") || c.includes("actively exploited")) return "critical";
  if (c.includes("high") || c.includes("vulnerability") || c.includes("breach") || c.includes("exploit")) return "high";
  if (c.includes("medium") || c.includes("phishing") || c.includes("malware")) return "medium";
  if (c.includes("low") || c.includes("advisory")) return "low";
  return "info";
}

export function cvssToSeverity(score: number): "critical" | "high" | "medium" | "low" | "info" {
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  if (score >= 0.1) return "low";
  return "info";
}

export function isValidUrl(url: string | undefined | null): boolean {
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

export function detectScopeFromCountry(country: string | undefined): "local" | "global" {
  if (!country) return "global";
  const india = ["india", "in", "ind"];
  return india.includes(country.toLowerCase()) ? "local" : "global";
}

export interface IndiaFields {
  isIndiaRelated: boolean;
  indiaConfidence: number;
  indianState: string | null;
  indianStateName: string | null;
  indianCity: string | null;
  indianSector: string | null;
}

export function getIndiaFields(fullText: string, options?: { source?: string; country?: string }): IndiaFields {
  const details = indiaDetector.getIndiaDetails(fullText, options);
  return {
    isIndiaRelated: details.isIndia,
    indiaConfidence: details.confidence,
    indianState: details.state,
    indianStateName: details.stateName,
    indianCity: details.city,
    indianSector: details.sector,
  };
}

export const THREAT_CATEGORY_SOURCES = new Set([
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

export const FBI_SOURCES = new Set(["FBI", "FBI Cyber", "FBI Press Releases"]);
export const IC3_SOURCES = new Set(["FBI Internet Crime"]);
export const CISA_SOURCES = new Set(["CISA Alerts", "CISA ICS Advisories", "US-CERT"]);
export const NIST_SOURCES = new Set(["NIST", "NVD"]);
export const CERT_IN_SOURCES = new Set(["CERT-In", "CERT-In Advisories"]);
