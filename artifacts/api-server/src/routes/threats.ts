import { Router, type IRouter, type Request, type Response } from "express";
import { db, threatIntelTable } from "@workspace/db";
import { eq, sql, and, gte, inArray, or } from "drizzle-orm";
import { getTimeframeStartDate } from "../lib/timeframe";
import { asyncHandler, NotFoundError } from "../middlewares/errorHandler";
import { apiCache, CACHE_TTL } from "../lib/cache";
import type { SQL } from "drizzle-orm";
import {
  displayableThreatSql,
  isDisplayableThreat,
  normalizeThreatLinks,
} from "../lib/threatLinks";

import {
  GetThreatsQueryParams,
  GetThreatsResponse,
  GetThreatByIdParams,
  GetThreatByIdResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatThreatIntel(item: typeof threatIntelTable.$inferSelect) {
  const links = normalizeThreatLinks(item);

  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    description: item.description,
    scope: item.scope,
    isIndiaRelated: item.isIndiaRelated ?? null,
    indiaConfidence: item.indiaConfidence ?? null,
    indianState: item.indianState ?? null,
    indianStateName: item.indianStateName ?? null,
    indianCity: item.indianCity ?? null,
    indianSector: item.indianSector ?? null,
    severity: item.severity,
    category: item.category,
    threatActor: item.threatActor,
    threatActorAliases: (item.threatActorAliases as string[]) ?? [],
    targetSectors: (item.targetSectors as string[]) ?? [],
    targetRegions: (item.targetRegions as string[]) ?? [],
    ttps: (item.ttps as string[]) ?? [],
    iocs: (item.iocs as string[]) ?? [],
    malwareFamilies: (item.malwareFamilies as string[]) ?? [],
    affectedSystems: (item.affectedSystems as string[]) ?? [],
    mitigations: (item.mitigations as string[]) ?? [],
    source: item.source,
    sourceUrl: links.sourceUrl,
    references: links.references,
    campaignName: item.campaignName,
    status: item.status,
    confidenceLevel: item.confidenceLevel,
    firstSeen: item.firstSeen?.toISOString() ?? null,
    lastSeen: item.lastSeen?.toISOString() ?? null,
    publishedAt: item.publishedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

router.get("/threats/export", asyncHandler(async (req: Request, res: Response) => {
    const rawQuery = req.query as Record<string, string>;
    const format = rawQuery.format === "json" ? "json" : "csv";
    const query = GetThreatsQueryParams.parse(req.query);
    const conditions: SQL[] = [displayableThreatSql];

    if (query.scope) conditions.push(eq(threatIntelTable.scope, query.scope));
    if (query.severity) {
      const severities = query.severity.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as ("critical" | "high" | "medium" | "low" | "info")[];
      if (severities.length === 1) conditions.push(eq(threatIntelTable.severity, severities[0]));
      else if (severities.length > 1) conditions.push(or(...severities.map((s) => eq(threatIntelTable.severity, s))) as SQL);
    }
    const categoryParam = (query as { category?: string }).category ?? rawQuery.category;
    if (categoryParam) {
      const categories = categoryParam.split(",").map((c: string) => c.trim()).filter(Boolean);
      if (categories.length === 1) conditions.push(eq(threatIntelTable.category, categories[0]));
      else if (categories.length > 1) conditions.push(inArray(threatIntelTable.category, categories));
    }
    if (query.state) conditions.push(eq(threatIntelTable.indianState, query.state.toUpperCase()));
    if (query.sector) conditions.push(eq(threatIntelTable.indianSector, query.sector));
    if (query.status) conditions.push(eq(threatIntelTable.status, query.status));
    const fromDate = query.timeframe ? getTimeframeStartDate(query.timeframe) : undefined;
    if (fromDate) conditions.push(gte(threatIntelTable.publishedAt, fromDate));

    const where = (conditions.length > 0 ? and(...conditions) : sql`true`) ?? sql`true`;

    const MAX_EXPORT_ROWS = 500;
    const items = await db
      .select()
      .from(threatIntelTable)
      .where(where as SQL)
      .orderBy(sql`${threatIntelTable.publishedAt} DESC`)
      .limit(MAX_EXPORT_ROWS);

    if (format === "json") {
      const jsonData = items.filter(isDisplayableThreat).map((item) => formatThreatIntel(item));
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", "attachment; filename=threats-export.json");
      res.json(jsonData);
      return;
    }

    const headers = ["ID", "Title", "Summary", "Severity", "Scope", "Category", "Threat Actor", "Campaign", "Source", "Status", "Confidence", "TTPs", "IOCs", "Malware Families", "Affected Systems", "Mitigations", "Published At"];
    const csvRows = [headers.join(",")];

    const sanitizeCsvField = (val: string): string => {
      let sanitized = val.replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(sanitized)) {
        sanitized = "'" + sanitized;
      }
      return `"${sanitized}"`;
    };

    for (const item of items) {
      const row = [
        item.id,
        sanitizeCsvField(item.title ?? ""),
        sanitizeCsvField(item.summary ?? ""),
        item.severity,
        item.scope,
        item.category,
        sanitizeCsvField(item.threatActor ?? ""),
        sanitizeCsvField(item.campaignName ?? ""),
        sanitizeCsvField(item.source ?? ""),
        item.status,
        item.confidenceLevel,
        sanitizeCsvField(((item.ttps as string[]) ?? []).join("; ")),
        sanitizeCsvField(((item.iocs as string[]) ?? []).join("; ")),
        sanitizeCsvField(((item.malwareFamilies as string[]) ?? []).join("; ")),
        sanitizeCsvField(((item.affectedSystems as string[]) ?? []).join("; ")),
        sanitizeCsvField(((item.mitigations as string[]) ?? []).join("; ")),
        item.publishedAt.toISOString(),
      ];
      csvRows.push(row.join(","));
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=threats-export.csv");
    res.send(csvRows.join("\n"));
}));

router.get("/threats/:id", asyncHandler(async (req: Request, res: Response) => {
    const params = GetThreatByIdParams.parse({ id: Number(req.params.id) });

    const [item] = await db
      .select()
      .from(threatIntelTable)
      .where(eq(threatIntelTable.id, params.id));

    if (!item || !isDisplayableThreat(item)) {
      throw new NotFoundError("Threat not found");
    }

    const data = GetThreatByIdResponse.parse(formatThreatIntel(item));
    res.json(data);
}));

const GROUP_BY_FIELDS = ["category", "severity", "threat_actor", "source"] as const;
type GroupByField = (typeof GROUP_BY_FIELDS)[number];

router.get("/threats", asyncHandler(async (req: Request, res: Response) => {
    const rawQuery = req.query as Record<string, string>;
    const groupBy = GROUP_BY_FIELDS.includes(rawQuery.groupBy as GroupByField)
      ? (rawQuery.groupBy as GroupByField)
      : undefined;

    const query = GetThreatsQueryParams.parse(req.query);

    const cacheKey = `threats:${query.scope ?? ""}:${query.severity ?? ""}:${query.category ?? ""}:${query.state ?? ""}:${query.sector ?? ""}:${query.status ?? ""}:${query.timeframe ?? ""}:${query.page ?? 1}:${query.limit ?? 20}:${groupBy ?? ""}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) { res.json(cached); return; }
    const conditions: SQL[] = [displayableThreatSql];

    if (query.scope) conditions.push(eq(threatIntelTable.scope, query.scope));
    if (query.severity) {
      const severities = query.severity.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as ("critical" | "high" | "medium" | "low" | "info")[];
      if (severities.length === 1) conditions.push(eq(threatIntelTable.severity, severities[0]));
      else if (severities.length > 1) conditions.push(or(...severities.map((s) => eq(threatIntelTable.severity, s))) as SQL);
    }
    if (query.category) {
      const categories = query.category.split(",").map((c: string) => c.trim()).filter(Boolean);
      if (categories.length === 1) conditions.push(eq(threatIntelTable.category, categories[0]));
      else if (categories.length > 1) conditions.push(inArray(threatIntelTable.category, categories));
    }
    if (query.state) conditions.push(eq(threatIntelTable.indianState, query.state.toUpperCase()));
    if (query.sector) conditions.push(eq(threatIntelTable.indianSector, query.sector));
    if (query.status) conditions.push(eq(threatIntelTable.status, query.status));
    const fromDate = query.timeframe ? getTimeframeStartDate(query.timeframe) : undefined;
    if (fromDate) conditions.push(gte(threatIntelTable.publishedAt, fromDate));

    const where = (conditions.length > 0 ? and(...conditions) : sql`true`) ?? sql`true`;

    if (groupBy) {
      const MAX_ITEMS_PER_GROUP = 20;
      // Cap grouped queries: load at most 2 000 rows to prevent OOM on large datasets.
      const GROUP_QUERY_LIMIT = 2000;

      // Fetch matching items once, then group in memory (avoids N+1 queries for small-medium datasets)
      const allItems = await db
        .select()
        .from(threatIntelTable)
        .where(where as SQL)
        .orderBy(sql`${threatIntelTable.publishedAt} DESC`)
        .limit(GROUP_QUERY_LIMIT);

      const groupMap = new Map<string, typeof allItems>();
      for (const item of allItems) {
        let key: string;
        switch (groupBy) {
          case "category":     key = item.category ?? "Uncategorized"; break;
          case "severity":     key = item.severity; break;
          case "threat_actor": key = item.threatActor ?? "Unattributed"; break;
          case "source":       key = item.source ?? "Unknown"; break;
        }
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(item);
      }

      const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];
      const groups = [...groupMap.entries()]
        .sort(([, a], [, b]) => b.length - a.length)
        .map(([key, items]) => ({
          key,
          count: items.length,
          // Sort items within group by severity then date, cap preview at MAX_ITEMS_PER_GROUP
          items: items
            .sort((a, b) => {
              const sa = SEVERITY_ORDER.indexOf(a.severity);
              const sb = SEVERITY_ORDER.indexOf(b.severity);
              return sa !== sb ? sa - sb : b.publishedAt.getTime() - a.publishedAt.getTime();
            })
            .slice(0, MAX_ITEMS_PER_GROUP)
            .map(formatThreatIntel),
        }));

      const data = { groups, total: allItems.length, groupBy };
      apiCache.set(cacheKey, data, CACHE_TTL.LIST);
      res.json(data);
      return;
    }

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatIntelTable)
      .where(where as SQL);

    const total = totalResult?.count ?? 0;
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(threatIntelTable)
      .where(where as SQL)
      .orderBy(sql`${threatIntelTable.publishedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = GetThreatsResponse.parse({
      items: items.filter(isDisplayableThreat).map(formatThreatIntel),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

    apiCache.set(cacheKey, data, CACHE_TTL.LIST);
    res.json(data);
}));

export default router;
