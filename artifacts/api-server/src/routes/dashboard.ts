import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable, advisoriesTable, threatIntelTable } from "@workspace/db";
import { eq, sql, and, gte, isNotNull, ne } from "drizzle-orm";

import { GetDashboardStatsResponse, GetDashboardStatsQueryParams } from "@workspace/api-zod";
import { validate } from "../middlewares/validate";
import { asyncHandler } from "../middlewares/errorHandler";
import { getTimeframeStartDate } from "../lib/timeframe";
import { apiCache, CACHE_TTL } from "../lib/cache";
import { logger } from "../lib/logger";
import type { TimeframeValue } from "../lib/timeframe";

const router: IRouter = Router();

router.get("/dashboard/stats", validate({ query: GetDashboardStatsQueryParams }), asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const timeframe = (req.query.timeframe ?? "24h") as TimeframeValue;
    const scope = req.query.scope as string | undefined;

    const cacheKey = `dashboard:${timeframe}:${scope ?? "all"}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) {
      logger.debug({ timeframe, scope, durationMs: Date.now() - startedAt }, "dashboard stats cache hit");
      res.json(cached);
      return;
    }
    const fromDate = getTimeframeStartDate(timeframe);
    const dateFilter = fromDate ?? new Date(0);

    // Consolidated count queries using COUNT FILTER — 3 queries instead of 14
    const scopeFilter = scope ? sql`AND scope = ${scope}` : sql``;

    const [newsStats, threatStats, [activeAdv], [patchesAvailableResult], recentNewsItems, recentThreats] = await Promise.all([
      db.execute<{
        total: number; local_count: number; global_count: number;
        critical_active: number; high_active: number; resolved: number;
      }>(sql`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE scope = 'local')::int AS local_count,
          count(*) FILTER (WHERE scope = 'global')::int AS global_count,
          count(*) FILTER (WHERE severity = 'critical' AND status = 'active')::int AS critical_active,
          count(*) FILTER (WHERE severity = 'high' AND status = 'active')::int AS high_active,
          count(*) FILTER (WHERE status = 'resolved')::int AS resolved
        FROM news_items
        WHERE published_at >= ${dateFilter} ${scopeFilter}
      `),
      db.execute<{
        total: number; local_count: number; global_count: number;
        critical_active: number; high_active: number; resolved: number;
      }>(sql`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE scope = 'local')::int AS local_count,
          count(*) FILTER (WHERE scope = 'global')::int AS global_count,
          count(*) FILTER (WHERE severity = 'critical' AND status = 'active')::int AS critical_active,
          count(*) FILTER (WHERE severity = 'high' AND status = 'active')::int AS high_active,
          count(*) FILTER (WHERE status = 'resolved')::int AS resolved
        FROM threat_intel
        WHERE published_at >= ${dateFilter} ${scopeFilter}
      `),
      db.select({ count: sql<number>`count(*)::int` }).from(advisoriesTable).where(
        scope
          ? and(sql`${advisoriesTable.status} IN ('new', 'under_review')`, gte(advisoriesTable.publishedAt, dateFilter), eq(advisoriesTable.scope, scope as "local" | "global"))
          : and(sql`${advisoriesTable.status} IN ('new', 'under_review')`, gte(advisoriesTable.publishedAt, dateFilter))
      ),
      db.select({ count: sql<number>`count(*)::int` })
        .from(advisoriesTable)
        .where(and(eq(advisoriesTable.patchAvailable, true), ne(advisoriesTable.status, "patched"))),
      db.select({
        id: newsItemsTable.id,
        title: newsItemsTable.title,
        type: newsItemsTable.type,
        severity: newsItemsTable.severity,
        publishedAt: newsItemsTable.publishedAt,
        sourceUrl: newsItemsTable.sourceUrl,
      }).from(newsItemsTable).where(
        scope ? and(gte(newsItemsTable.publishedAt, dateFilter), eq(newsItemsTable.scope, scope as "local" | "global")) : gte(newsItemsTable.publishedAt, dateFilter)
      ).orderBy(sql`${newsItemsTable.publishedAt} DESC`).limit(5),
      db.select({
        id: threatIntelTable.id,
        title: threatIntelTable.title,
        severity: threatIntelTable.severity,
        publishedAt: threatIntelTable.publishedAt,
        sourceUrl: threatIntelTable.sourceUrl,
      }).from(threatIntelTable).where(
        scope ? and(gte(threatIntelTable.publishedAt, dateFilter), eq(threatIntelTable.scope, scope as "local" | "global")) : gte(threatIntelTable.publishedAt, dateFilter)
      ).orderBy(sql`${threatIntelTable.publishedAt} DESC`).limit(5),
    ]);

    const ns = newsStats.rows[0] ?? { total: 0, local_count: 0, global_count: 0, critical_active: 0, high_active: 0, resolved: 0 };
    const ts = threatStats.rows[0] ?? { total: 0, local_count: 0, global_count: 0, critical_active: 0, high_active: 0, resolved: 0 };

    const totalThreatsToday = ns.total + ts.total;

    let localThreatsToday: number;
    let globalThreatsToday: number;
    if (scope) {
      localThreatsToday = scope === "local" ? totalThreatsToday : 0;
      globalThreatsToday = scope === "global" ? totalThreatsToday : 0;
    } else {
      localThreatsToday = ns.local_count + ts.local_count;
      globalThreatsToday = ns.global_count + ts.global_count;
    }

    const criticalAlerts = ns.critical_active + ts.critical_active;
    const highAlerts = ns.high_active + ts.high_active;
    const resolvedIncidents = ns.resolved + ts.resolved;

    const recentItems = [
      ...recentNewsItems.map((item) => ({ ...item, sourceType: "news" as const })),
      ...recentThreats.map((item) => ({ ...item, type: "threat" as const, sourceType: "threat" as const })),
    ].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 10);

    const weighted = criticalAlerts * 10 + highAlerts * 5;
    let currentThreatLevel: "low" | "medium" | "high" | "critical" = "low";
    if (criticalAlerts >= 10 || weighted >= 100) currentThreatLevel = "critical";
    else if (criticalAlerts >= 5 || weighted >= 50) currentThreatLevel = "high";
    else if (criticalAlerts >= 2 || highAlerts >= 10) currentThreatLevel = "medium";
    else if (criticalAlerts >= 1 || highAlerts >= 5) currentThreatLevel = "medium";

    // India stats - only fetch when scope=local
    let indiaStats: { byState: Array<{ state: string; count: number }>; bySector: Array<{ sector: string; count: number }> } | undefined;
    if (scope === "local") {
      const cnt = sql<number>`count(*)::int`;
      const dateGte = gte(newsItemsTable.publishedAt, dateFilter);
      const threatDateGte = gte(threatIntelTable.publishedAt, dateFilter);
      const [threatStateRows, newsStateRows, threatSectorRows, newsSectorRows] = await Promise.all([
        db.select({ state: threatIntelTable.indianState, count: cnt }).from(threatIntelTable)
          .where(and(threatDateGte, eq(threatIntelTable.scope, "local"), isNotNull(threatIntelTable.indianState)))
          .groupBy(threatIntelTable.indianState),
        db.select({ state: newsItemsTable.indianState, count: cnt }).from(newsItemsTable)
          .where(and(dateGte, eq(newsItemsTable.scope, "local"), isNotNull(newsItemsTable.indianState)))
          .groupBy(newsItemsTable.indianState),
        db.select({ sector: threatIntelTable.indianSector, count: cnt }).from(threatIntelTable)
          .where(and(threatDateGte, eq(threatIntelTable.scope, "local"), isNotNull(threatIntelTable.indianSector)))
          .groupBy(threatIntelTable.indianSector),
        db.select({ sector: newsItemsTable.indianSector, count: cnt }).from(newsItemsTable)
          .where(and(dateGte, eq(newsItemsTable.scope, "local"), isNotNull(newsItemsTable.indianSector)))
          .groupBy(newsItemsTable.indianSector),
      ]);

      const byState = [...threatStateRows, ...newsStateRows].filter((r) => r.state != null).reduce((acc, r) => {
        const s = r.state!;
        acc[s] = (acc[s] ?? 0) + (r.count ?? 0);
        return acc;
      }, {} as Record<string, number>);
      const bySector = [...threatSectorRows, ...newsSectorRows].filter((r) => r.sector != null).reduce((acc, r) => {
        const s = r.sector!;
        acc[s] = (acc[s] ?? 0) + (r.count ?? 0);
        return acc;
      }, {} as Record<string, number>);
      indiaStats = {
        byState: Object.entries(byState).map(([state, count]) => ({ state, count })),
        bySector: Object.entries(bySector).map(([sector, count]) => ({ sector, count })),
      };
    }

    const data = GetDashboardStatsResponse.parse({
      totalThreatsToday,
      localThreatsToday,
      globalThreatsToday,
      activeAdvisories: activeAdv?.count ?? 0,
      patchesAvailable: patchesAvailableResult?.count ?? 0,
      criticalAlerts,
      highAlerts,
      resolvedIncidents,
      currentThreatLevel,
      recentActivity: recentItems.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        severity: item.severity,
        timestamp: item.publishedAt.toISOString(),
        sourceUrl: item.sourceUrl ?? null,
        sourceType: item.sourceType,
      })),
      indiaStats: indiaStats ?? undefined,
    });

    apiCache.set(cacheKey, data, CACHE_TTL.DASHBOARD);
    const durationMs = Date.now() - startedAt;
    if (durationMs > 500) {
      logger.info({ timeframe, scope, durationMs }, "dashboard stats served");
    } else {
      logger.debug({ timeframe, scope, durationMs }, "dashboard stats served");
    }
    res.json(data);
}));

/**
 * GET /api/dashboard/severity-trend
 * Returns daily critical/high/medium/low counts for the last 7 days.
 * Lightweight endpoint — no Zod validation, 5-minute cache.
 */
router.get("/dashboard/severity-trend", asyncHandler(async (_req: Request, res: Response) => {
  const cacheKey = "dashboard:severity-trend:7d";
  const cached = apiCache.get<object>(cacheKey);
  if (cached) { res.json(cached); return; }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [newsRows, threatRows] = await Promise.all([
    db.execute<{ day: string; severity: string; cnt: number }>(sql`
      SELECT date_trunc('day', published_at)::date::text AS day,
             severity,
             count(*)::int AS cnt
      FROM news_items
      WHERE published_at >= ${sevenDaysAgo}
      GROUP BY 1, 2
    `),
    db.execute<{ day: string; severity: string; cnt: number }>(sql`
      SELECT date_trunc('day', published_at)::date::text AS day,
             severity,
             count(*)::int AS cnt
      FROM threat_intel
      WHERE published_at >= ${sevenDaysAgo}
      GROUP BY 1, 2
    `),
  ]);

  // Merge rows from both tables
  const byDay: Record<string, Record<string, number>> = {};
  for (const row of [...newsRows.rows, ...threatRows.rows]) {
    if (!byDay[row.day]) byDay[row.day] = {};
    byDay[row.day][row.severity] = (byDay[row.day][row.severity] ?? 0) + (row.cnt ?? 0);
  }

  // Build last 7 days array (fill missing days with zeros)
  const days: Array<{ date: string; critical: number; high: number; medium: number; low: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const counts = byDay[key] ?? {};
    days.push({ date: key, critical: counts.critical ?? 0, high: counts.high ?? 0, medium: counts.medium ?? 0, low: counts.low ?? 0 });
  }

  const result = { days };
  apiCache.set(cacheKey, result, 5 * 60_000); // 5 min cache
  res.json(result);
}));

export default router;
