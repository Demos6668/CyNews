/**
 * CyNews MCP Server
 *
 * Exposes CyNews threat intelligence data to AI agents via the Model Context
 * Protocol (stdio transport). No network port is opened — this process is
 * spawned by Claude Code / Cursor and communicates over stdin/stdout.
 *
 * Available tools:
 *   search_intel          – Full-text search across news, advisories, and threats
 *   get_advisories        – List CVE advisories with severity/vendor/timeframe filters
 *   get_threats           – List threat intel items with category/scope filters
 *   get_dashboard_stats   – Current threat-level snapshot and severity counts
 *   get_patch_status      – Patch availability for a specific CVE or vendor
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  db,
  newsItemsTable,
  advisoriesTable,
  threatIntelTable,
} from "@workspace/db";
import { sql, and, gte, inArray, ilike, or, eq, ne } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TimeframeValue = "1h" | "6h" | "24h" | "7d" | "30d" | "90d" | "all";

function timeframeToDate(timeframe: TimeframeValue): Date | null {
  const now = new Date();
  const ms: Record<TimeframeValue, number | null> = {
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
    all: null,
  };
  const delta = ms[timeframe];
  return delta === null ? null : new Date(now.getTime() - delta);
}

function severityRank(s: string): number {
  return ({ critical: 4, high: 3, medium: 2, low: 1, info: 0 } as Record<string, number>)[s] ?? -1;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "cynews",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: search_intel
// ---------------------------------------------------------------------------

server.tool(
  "search_intel",
  "Search across all CyNews threat intelligence: news articles, CVE advisories, and threat intel items. Returns the top matches ranked by relevance. Use this to answer questions like 'are there any recent Apache vulnerabilities?' or 'what ransomware campaigns affected India this week?'",
  {
    query: z.string().min(2).max(200).describe("Search terms (keywords, CVE IDs, threat actors, vendors, etc.)"),
    type: z.enum(["all", "news", "advisory", "threat"]).default("all").describe("Filter by result type"),
    scope: z.enum(["local", "global"]).optional().describe("Scope filter: 'local' = India-focused, 'global' = worldwide"),
    limit: z.number().int().min(1).max(30).default(10).describe("Max results to return (default 10)"),
  },
  async ({ query, type, scope, limit }) => {
    const q = query.trim();
    const pattern = `%${q}%`;
    // Fetch 2× per type so the merge-then-slice doesn't systematically starve
    // lower-priority types when a single type dominates the top results.
    const fetchLimit = type === "all" ? limit * 2 : limit;
    const results: Array<{
      id: number; title: string; summary: string;
      type: string; severity: string; publishedAt: string; scope?: string;
    }> = [];

    // Search news
    if (type === "all" || type === "news") {
      const conditions: SQL[] = [
        or(ilike(newsItemsTable.title, pattern), ilike(newsItemsTable.summary, pattern)) as SQL,
      ];
      if (scope) conditions.push(eq(newsItemsTable.scope, scope));
      const rows = await db.select({
        id: newsItemsTable.id,
        title: newsItemsTable.title,
        summary: newsItemsTable.summary,
        severity: newsItemsTable.severity,
        publishedAt: newsItemsTable.publishedAt,
        scope: newsItemsTable.scope,
      }).from(newsItemsTable).where(and(...conditions)).orderBy(sql`${newsItemsTable.publishedAt} DESC`).limit(fetchLimit);
      results.push(...rows.map(r => ({ ...r, type: "news", publishedAt: r.publishedAt.toISOString() })));
    }

    // Search advisories
    if (type === "all" || type === "advisory") {
      const conditions: SQL[] = [
        or(
          ilike(advisoriesTable.title, pattern),
          ilike(advisoriesTable.cveId, pattern),
          ilike(advisoriesTable.vendor, pattern),
          ilike(advisoriesTable.description, pattern),
        ) as SQL,
        sql`${advisoriesTable.source} IS NOT NULL AND btrim(${advisoriesTable.source}) <> ''`,
      ];
      if (scope) conditions.push(eq(advisoriesTable.scope, scope));
      const rows = await db.select({
        id: advisoriesTable.id,
        title: advisoriesTable.title,
        summary: advisoriesTable.description,
        severity: advisoriesTable.severity,
        publishedAt: advisoriesTable.publishedAt,
        scope: advisoriesTable.scope,
      }).from(advisoriesTable).where(and(...conditions)).orderBy(sql`${advisoriesTable.publishedAt} DESC`).limit(fetchLimit);
      results.push(...rows.map(r => ({ ...r, type: "advisory", publishedAt: r.publishedAt.toISOString() })));
    }

    // Search threats
    if (type === "all" || type === "threat") {
      const conditions: SQL[] = [
        or(
          ilike(threatIntelTable.title, pattern),
          ilike(threatIntelTable.summary, pattern),
          ilike(threatIntelTable.threatActor, pattern),
          ilike(threatIntelTable.category, pattern),
        ) as SQL,
      ];
      if (scope) conditions.push(eq(threatIntelTable.scope, scope));
      const rows = await db.select({
        id: threatIntelTable.id,
        title: threatIntelTable.title,
        summary: threatIntelTable.summary,
        severity: threatIntelTable.severity,
        publishedAt: threatIntelTable.publishedAt,
        scope: threatIntelTable.scope,
      }).from(threatIntelTable).where(and(...conditions)).orderBy(sql`${threatIntelTable.publishedAt} DESC`).limit(fetchLimit);
      results.push(...rows.map(r => ({ ...r, type: "threat", publishedAt: r.publishedAt.toISOString() })));
    }

    // Merge, deduplicate by id+type, sort by severity then date
    const sorted = results
      .sort((a, b) => {
        const sevDiff = severityRank(b.severity) - severityRank(a.severity);
        if (sevDiff !== 0) return sevDiff;
        return b.publishedAt.localeCompare(a.publishedAt);
      })
      .slice(0, limit);

    if (sorted.length === 0) {
      return { content: [{ type: "text", text: `No results found for "${q}".` }] };
    }

    const lines = sorted.map((r, i) =>
      `${i + 1}. [${r.type.toUpperCase()}] ${r.severity.toUpperCase()} — ${r.title}\n   Published: ${r.publishedAt.slice(0, 10)}${r.scope ? ` | ${r.scope}` : ""}\n   ${r.summary.slice(0, 160)}${r.summary.length > 160 ? "…" : ""}`
    );

    return {
      content: [{
        type: "text",
        text: `Found ${sorted.length} result(s) for "${q}":\n\n${lines.join("\n\n")}`,
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_advisories
// ---------------------------------------------------------------------------

server.tool(
  "get_advisories",
  "List CVE security advisories from CyNews. Supports filtering by severity, vendor, scope, and timeframe. Returns CVSS scores, patch availability, and affected products. Use this to answer questions like 'what critical Microsoft vulnerabilities are there this month?' or 'are there any unpatched Apache CVEs?'",
  {
    severity: z.array(z.enum(["critical", "high", "medium", "low", "info"])).optional().describe("Filter by one or more severity levels"),
    vendor: z.string().optional().describe("Filter by vendor name (e.g. 'Microsoft', 'Apache', 'Cisco')"),
    scope: z.enum(["local", "global"]).optional().describe("'local' = India-focused advisories, 'global' = worldwide"),
    timeframe: z.enum(["1h", "6h", "24h", "7d", "30d", "90d", "all"]).default("7d").describe("Time window (default: last 7 days)"),
    patch_status: z.enum(["all", "available", "applied", "pending"]).default("all").describe("Filter by patch status"),
    cert_in_only: z.boolean().default(false).describe("Show only CERT-In (India CERT) advisories"),
    limit: z.number().int().min(1).max(50).default(15).describe("Max results (default 15)"),
  },
  async ({ severity, vendor, scope, timeframe, patch_status, cert_in_only, limit }) => {
    const conditions: SQL[] = [
      sql`${advisoriesTable.source} IS NOT NULL AND btrim(${advisoriesTable.source}) <> ''`,
    ];

    const fromDate = timeframeToDate(timeframe);
    if (fromDate) conditions.push(gte(advisoriesTable.publishedAt, fromDate));
    if (severity?.length) {
      conditions.push(severity.length === 1
        ? eq(advisoriesTable.severity, severity[0])
        : inArray(advisoriesTable.severity, severity));
    }
    if (vendor) conditions.push(ilike(advisoriesTable.vendor, `%${vendor}%`));
    if (scope) conditions.push(eq(advisoriesTable.scope, scope));
    if (cert_in_only) conditions.push(eq(advisoriesTable.isCertIn, true));
    if (patch_status === "available") conditions.push(eq(advisoriesTable.patchAvailable, true), eq(advisoriesTable.status, "new"));
    else if (patch_status === "applied") conditions.push(eq(advisoriesTable.status, "patched"));
    else if (patch_status === "pending") conditions.push(eq(advisoriesTable.status, "under_review"));

    const rows = await db.select({
      id: advisoriesTable.id,
      cveId: advisoriesTable.cveId,
      title: advisoriesTable.title,
      severity: advisoriesTable.severity,
      cvssScore: advisoriesTable.cvssScore,
      vendor: advisoriesTable.vendor,
      patchAvailable: advisoriesTable.patchAvailable,
      patchUrl: advisoriesTable.patchUrl,
      status: advisoriesTable.status,
      affectedProducts: advisoriesTable.affectedProducts,
      publishedAt: advisoriesTable.publishedAt,
      isCertIn: advisoriesTable.isCertIn,
    }).from(advisoriesTable)
      .where(and(...conditions))
      .orderBy(sql`
        CASE ${advisoriesTable.severity}
          WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2
          WHEN 'low' THEN 1 ELSE 0 END DESC,
        ${advisoriesTable.publishedAt} DESC
      `)
      .limit(limit);

    if (rows.length === 0) {
      return { content: [{ type: "text", text: "No advisories found matching the given filters." }] };
    }

    const lines = rows.map((r, i) => {
      const patch = r.patchAvailable ? `✓ Patch ${r.status === "patched" ? "applied" : "available"}` : "✗ No patch";
      const products = (r.affectedProducts as string[]).slice(0, 3).join(", ");
      return [
        `${i + 1}. ${r.cveId} — ${r.severity.toUpperCase()} (CVSS ${r.cvssScore != null ? r.cvssScore.toFixed(1) : "N/A"})`,
        `   ${r.title}`,
        `   Vendor: ${r.vendor} | ${patch}${r.patchUrl ? ` → ${r.patchUrl}` : ""}`,
        products ? `   Affects: ${products}` : null,
        `   Published: ${r.publishedAt.toISOString().slice(0, 10)}${r.isCertIn ? " [CERT-In]" : ""}`,
      ].filter(Boolean).join("\n");
    });

    return {
      content: [{
        type: "text",
        text: `${rows.length} advisor${rows.length === 1 ? "y" : "ies"} (timeframe: ${timeframe}):\n\n${lines.join("\n\n")}`,
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_threats
// ---------------------------------------------------------------------------

server.tool(
  "get_threats",
  "List threat intelligence items from CyNews: ransomware campaigns, APT activity, malware, phishing, and more. Includes threat actors, TTPs, IOCs, and affected sectors. Use this to answer questions like 'what APT groups are active this week?' or 'list ransomware campaigns targeting Indian infrastructure'.",
  {
    severity: z.array(z.enum(["critical", "high", "medium", "low", "info"])).optional().describe("Filter by severity"),
    category: z.string().optional().describe("Category filter (e.g. 'Ransomware', 'APT Activity', 'Phishing Campaign', 'Zero-Day')"),
    scope: z.enum(["local", "global"]).optional().describe("'local' = India-focused, 'global' = worldwide"),
    timeframe: z.enum(["1h", "6h", "24h", "7d", "30d", "90d", "all"]).default("7d").describe("Time window (default: last 7 days)"),
    threat_actor: z.string().optional().describe("Filter by threat actor name or alias"),
    status: z.enum(["active", "resolved", "monitoring"]).optional().describe("Filter by campaign status"),
    limit: z.number().int().min(1).max(50).default(15).describe("Max results (default 15)"),
  },
  async ({ severity, category, scope, timeframe, threat_actor, status, limit }) => {
    const conditions: SQL[] = [];

    const fromDate = timeframeToDate(timeframe);
    if (fromDate) conditions.push(gte(threatIntelTable.publishedAt, fromDate));
    if (severity?.length) {
      conditions.push(severity.length === 1
        ? eq(threatIntelTable.severity, severity[0])
        : inArray(threatIntelTable.severity, severity));
    }
    if (category) conditions.push(ilike(threatIntelTable.category, `%${category}%`));
    if (scope) conditions.push(eq(threatIntelTable.scope, scope));
    if (threat_actor) {
      conditions.push(or(
        ilike(threatIntelTable.threatActor, `%${threat_actor}%`),
        sql`${threatIntelTable.threatActorAliases}::text ilike ${`%${threat_actor}%`}`,
      ) as SQL);
    }
    if (status) conditions.push(eq(threatIntelTable.status, status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db.select({
      id: threatIntelTable.id,
      title: threatIntelTable.title,
      summary: threatIntelTable.summary,
      severity: threatIntelTable.severity,
      category: threatIntelTable.category,
      threatActor: threatIntelTable.threatActor,
      targetSectors: threatIntelTable.targetSectors,
      targetRegions: threatIntelTable.targetRegions,
      iocs: threatIntelTable.iocs,
      status: threatIntelTable.status,
      confidenceLevel: threatIntelTable.confidenceLevel,
      publishedAt: threatIntelTable.publishedAt,
      scope: threatIntelTable.scope,
    }).from(threatIntelTable)
      .where(where)
      .orderBy(sql`
        CASE ${threatIntelTable.severity}
          WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2
          WHEN 'low' THEN 1 ELSE 0 END DESC,
        ${threatIntelTable.publishedAt} DESC
      `)
      .limit(limit);

    if (rows.length === 0) {
      return { content: [{ type: "text", text: "No threat intel found matching the given filters." }] };
    }

    const lines = rows.map((r, i) => {
      const sectors = (r.targetSectors as string[]).slice(0, 3).join(", ");
      const iocCount = (r.iocs as string[]).length;
      return [
        `${i + 1}. [${r.category}] ${r.severity.toUpperCase()} — ${r.title}`,
        r.threatActor ? `   Actor: ${r.threatActor}` : null,
        sectors ? `   Targets: ${sectors}` : null,
        `   Status: ${r.status} | Confidence: ${r.confidenceLevel}${iocCount > 0 ? ` | ${iocCount} IOCs` : ""}`,
        `   ${r.summary.slice(0, 160)}${r.summary.length > 160 ? "…" : ""}`,
        `   Published: ${r.publishedAt.toISOString().slice(0, 10)} | ${r.scope}`,
      ].filter(Boolean).join("\n");
    });

    return {
      content: [{
        type: "text",
        text: `${rows.length} threat item${rows.length === 1 ? "" : "s"} (timeframe: ${timeframe}):\n\n${lines.join("\n\n")}`,
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_dashboard_stats
// ---------------------------------------------------------------------------

server.tool(
  "get_dashboard_stats",
  "Get the current threat-level snapshot for CyNews: total threat counts, breakdown by severity (critical/high/medium/low), active advisories, patches available, and current overall threat level. Use this for quick situational awareness: 'what is the current threat level?' or 'how many critical advisories are active right now?'",
  {
    timeframe: z.enum(["1h", "6h", "24h", "7d", "30d", "90d", "all"]).default("24h").describe("Time window for counts (default: last 24 hours)"),
    scope: z.enum(["local", "global", "both"]).default("both").describe("'local', 'global', or 'both' (default)"),
  },
  async ({ timeframe, scope }) => {
    const fromDate = timeframeToDate(timeframe);

    const threatConditions: SQL[] = fromDate ? [gte(threatIntelTable.publishedAt, fromDate)] : [];
    if (scope !== "both") threatConditions.push(eq(threatIntelTable.scope, scope));

    const advisoryConditions: SQL[] = [
      sql`${advisoriesTable.source} IS NOT NULL AND btrim(${advisoriesTable.source}) <> ''`,
      ...(fromDate ? [gte(advisoriesTable.publishedAt, fromDate)] : []),
    ];
    if (scope !== "both") advisoryConditions.push(eq(advisoriesTable.scope, scope));

    const [threatCounts, advisoryCounts, patchCount] = await Promise.all([
      db.select({
        severity: threatIntelTable.severity,
        count: sql<number>`count(*)::int`,
      }).from(threatIntelTable)
        .where(threatConditions.length > 0 ? and(...threatConditions) : undefined)
        .groupBy(threatIntelTable.severity),

      db.select({
        severity: advisoriesTable.severity,
        count: sql<number>`count(*)::int`,
      }).from(advisoriesTable)
        .where(and(...advisoryConditions))
        .groupBy(advisoriesTable.severity),

      db.select({ count: sql<number>`count(*)::int` })
        .from(advisoriesTable)
        .where(and(
          sql`${advisoriesTable.source} IS NOT NULL AND btrim(${advisoriesTable.source}) <> ''`,
          eq(advisoriesTable.patchAvailable, true),
          eq(advisoriesTable.status, "new"),
        )),
    ]);

    const tBySev = Object.fromEntries(threatCounts.map(r => [r.severity, r.count]));
    const aBySev = Object.fromEntries(advisoryCounts.map(r => [r.severity, r.count]));

    const totalThreats = Object.values(tBySev).reduce((s, n) => s + n, 0);
    const totalAdvisories = Object.values(aBySev).reduce((s, n) => s + n, 0);
    const criticalCount = (tBySev.critical ?? 0) + (aBySev.critical ?? 0);
    const highCount = (tBySev.high ?? 0) + (aBySev.high ?? 0);
    const patchesAvailable = patchCount[0]?.count ?? 0;

    // Thresholds: 1+ critical = at least HIGH; 5+ critical = CRITICAL.
    // 1+ high = ELEVATED; 5+ high (with no critical) = HIGH.
    const CRITICAL_THRESHOLD = 5;
    const HIGH_THRESHOLD = 5;
    const threatLevel =
      criticalCount >= CRITICAL_THRESHOLD ? "CRITICAL" :
      criticalCount >= 1 ? "HIGH" :
      highCount >= HIGH_THRESHOLD ? "HIGH" :
      highCount >= 1 ? "ELEVATED" : "NORMAL";

    const lines = [
      `┌─ CyNews Threat Dashboard (${timeframe}${scope !== "both" ? `, ${scope}` : ""}) ─────────`,
      `│ Overall Threat Level: ${threatLevel}`,
      `│`,
      `│ Threats:    ${totalThreats} total — Critical: ${tBySev.critical ?? 0} | High: ${tBySev.high ?? 0} | Medium: ${tBySev.medium ?? 0} | Low: ${tBySev.low ?? 0}`,
      `│ Advisories: ${totalAdvisories} total — Critical: ${aBySev.critical ?? 0} | High: ${aBySev.high ?? 0} | Medium: ${aBySev.medium ?? 0} | Low: ${aBySev.low ?? 0}`,
      `│ Patches available (not yet applied): ${patchesAvailable}`,
      `└─────────────────────────────────────────────`,
    ];

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_patch_status
// ---------------------------------------------------------------------------

server.tool(
  "get_patch_status",
  "Look up patch availability and remediation status for specific CVEs or a vendor. Returns whether patches are released, the patch URL, CVSS score, and current workflow status (new/under_review/patched/dismissed). Use this to answer questions like 'is CVE-2024-1234 patched?' or 'what unpatched Cisco vulnerabilities exist?'",
  {
    cve_id: z.string().optional().describe("Specific CVE ID to look up (e.g. 'CVE-2024-44000')"),
    vendor: z.string().optional().describe("Vendor name to look up (e.g. 'Microsoft', 'Cisco', 'Fortinet')"),
    unpatched_only: z.boolean().default(false).describe("Show only items without an applied patch"),
    limit: z.number().int().min(1).max(30).default(10).describe("Max results (default 10)"),
  },
  async ({ cve_id, vendor, unpatched_only, limit }) => {
    if (!cve_id && !vendor) {
      return { content: [{ type: "text", text: "Provide at least one of: cve_id or vendor." }] };
    }

    const conditions: SQL[] = [
      sql`${advisoriesTable.source} IS NOT NULL AND btrim(${advisoriesTable.source}) <> ''`,
    ];

    if (cve_id) {
      conditions.push(or(
        ilike(advisoriesTable.cveId, `%${cve_id}%`),
        sql`${advisoriesTable.cveIds}::text ilike ${`%${cve_id}%`}`,
      ) as SQL);
    }
    if (vendor) conditions.push(ilike(advisoriesTable.vendor, `%${vendor}%`));
    if (unpatched_only) conditions.push(ne(advisoriesTable.status, "patched"));

    const rows = await db.select({
      id: advisoriesTable.id,
      cveId: advisoriesTable.cveId,
      title: advisoriesTable.title,
      severity: advisoriesTable.severity,
      cvssScore: advisoriesTable.cvssScore,
      vendor: advisoriesTable.vendor,
      patchAvailable: advisoriesTable.patchAvailable,
      patchUrl: advisoriesTable.patchUrl,
      status: advisoriesTable.status,
      affectedProducts: advisoriesTable.affectedProducts,
      publishedAt: advisoriesTable.publishedAt,
    }).from(advisoriesTable)
      .where(and(...conditions))
      .orderBy(sql`${advisoriesTable.cvssScore} DESC NULLS LAST`)
      .limit(limit);

    if (rows.length === 0) {
      const target = cve_id ?? vendor ?? "";
      return { content: [{ type: "text", text: `No advisories found for "${target}".` }] };
    }

    const lines = rows.map((r, i) => {
      const patchLine = r.patchAvailable
        ? `✓ Patch available — Status: ${r.status}${r.patchUrl ? `\n   URL: ${r.patchUrl}` : ""}`
        : `✗ No patch released — Status: ${r.status}`;
      const products = (r.affectedProducts as string[]).slice(0, 4).join(", ");
      return [
        `${i + 1}. ${r.cveId} | CVSS ${r.cvssScore != null ? r.cvssScore.toFixed(1) : "N/A"} | ${r.severity.toUpperCase()}`,
        `   ${r.title}`,
        `   Vendor: ${r.vendor}`,
        `   ${patchLine}`,
        products ? `   Affects: ${products}` : null,
        `   Published: ${r.publishedAt.toISOString().slice(0, 10)}`,
      ].filter(Boolean).join("\n");
    });

    return {
      content: [{
        type: "text",
        text: `${rows.length} result(s):\n\n${lines.join("\n\n")}`,
      }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
