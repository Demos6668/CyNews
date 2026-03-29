import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable, advisoriesTable, threatIntelTable } from "@workspace/db";
import { eq, sql, and, gte, isNotNull } from "drizzle-orm";

import { GetDashboardStatsResponse } from "@workspace/api-zod";
import { getTimeframeStartDate } from "../lib/timeframe";
import { logger } from "../lib/logger";
import type { TimeframeValue } from "../lib/timeframe";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as TimeframeValue) ?? "24h";
    const scope = req.query.scope as "local" | "global" | undefined;
    const fromDate = getTimeframeStartDate(timeframe);
    const dateFilter = fromDate ?? new Date(0);

    const newsBase = gte(newsItemsTable.publishedAt, dateFilter);
    const threatBase = gte(threatIntelTable.publishedAt, dateFilter);
    const newsWithScope = scope ? and(newsBase, eq(newsItemsTable.scope, scope)) : newsBase;
    const threatWithScope = scope ? and(threatBase, eq(threatIntelTable.scope, scope)) : threatBase;

    const count = sql<number>`count(*)::int`;

    // Batch all count queries in parallel
    const [
      [newsTotal], [threatsTotal],
      [localNews], [localThreats],
      [globalNews], [globalThreats],
      [activeAdv],
      [criticalNews], [criticalThreats],
      [highNews], [highThreats],
      [resolvedNews], [resolvedThreats],
      recentNewsItems, recentThreats,
    ] = await Promise.all([
      // Total counts
      db.select({ count }).from(newsItemsTable).where(newsWithScope),
      db.select({ count }).from(threatIntelTable).where(threatWithScope),
      // Local counts
      scope
        ? [{ count: scope === "local" ? -1 : 0 }] // placeholder, computed below
        : db.select({ count }).from(newsItemsTable).where(and(newsBase, eq(newsItemsTable.scope, "local"))),
      scope
        ? [{ count: 0 }]
        : db.select({ count }).from(threatIntelTable).where(and(threatBase, eq(threatIntelTable.scope, "local"))),
      // Global counts
      scope
        ? [{ count: scope === "global" ? -1 : 0 }]
        : db.select({ count }).from(newsItemsTable).where(and(newsBase, eq(newsItemsTable.scope, "global"))),
      scope
        ? [{ count: 0 }]
        : db.select({ count }).from(threatIntelTable).where(and(threatBase, eq(threatIntelTable.scope, "global"))),
      // Active advisories
      db.select({ count }).from(advisoriesTable).where(
        scope
          ? and(sql`${advisoriesTable.status} IN ('new', 'under_review')`, gte(advisoriesTable.publishedAt, dateFilter), eq(advisoriesTable.scope, scope))
          : and(sql`${advisoriesTable.status} IN ('new', 'under_review')`, gte(advisoriesTable.publishedAt, dateFilter))
      ),
      // Critical counts
      db.select({ count }).from(newsItemsTable).where(
        scope
          ? and(newsBase, eq(newsItemsTable.scope, scope), eq(newsItemsTable.severity, "critical"), eq(newsItemsTable.status, "active"))
          : and(newsBase, eq(newsItemsTable.severity, "critical"), eq(newsItemsTable.status, "active"))
      ),
      db.select({ count }).from(threatIntelTable).where(
        scope
          ? and(threatBase, eq(threatIntelTable.scope, scope), eq(threatIntelTable.severity, "critical"), eq(threatIntelTable.status, "active"))
          : and(threatBase, eq(threatIntelTable.severity, "critical"), eq(threatIntelTable.status, "active"))
      ),
      // High counts
      db.select({ count }).from(newsItemsTable).where(
        scope
          ? and(newsBase, eq(newsItemsTable.scope, scope), eq(newsItemsTable.severity, "high"), eq(newsItemsTable.status, "active"))
          : and(newsBase, eq(newsItemsTable.severity, "high"), eq(newsItemsTable.status, "active"))
      ),
      db.select({ count }).from(threatIntelTable).where(
        scope
          ? and(threatBase, eq(threatIntelTable.scope, scope), eq(threatIntelTable.severity, "high"), eq(threatIntelTable.status, "active"))
          : and(threatBase, eq(threatIntelTable.severity, "high"), eq(threatIntelTable.status, "active"))
      ),
      // Resolved counts
      db.select({ count }).from(newsItemsTable).where(
        scope
          ? and(newsBase, eq(newsItemsTable.scope, scope), eq(newsItemsTable.status, "resolved"))
          : and(newsBase, eq(newsItemsTable.status, "resolved"))
      ),
      db.select({ count }).from(threatIntelTable).where(
        scope
          ? and(threatBase, eq(threatIntelTable.scope, scope), eq(threatIntelTable.status, "resolved"))
          : and(threatBase, eq(threatIntelTable.status, "resolved"))
      ),
      // Recent items
      db.select({
        id: newsItemsTable.id,
        title: newsItemsTable.title,
        type: newsItemsTable.type,
        severity: newsItemsTable.severity,
        publishedAt: newsItemsTable.publishedAt,
        sourceUrl: newsItemsTable.sourceUrl,
      }).from(newsItemsTable).where(newsWithScope).orderBy(sql`${newsItemsTable.publishedAt} DESC`).limit(5),
      db.select({
        id: threatIntelTable.id,
        title: threatIntelTable.title,
        severity: threatIntelTable.severity,
        publishedAt: threatIntelTable.publishedAt,
        sourceUrl: threatIntelTable.sourceUrl,
      }).from(threatIntelTable).where(threatWithScope).orderBy(sql`${threatIntelTable.publishedAt} DESC`).limit(5),
    ]);

    const totalThreatsToday = (newsTotal?.count ?? 0) + (threatsTotal?.count ?? 0);

    let localThreatsToday: number;
    let globalThreatsToday: number;
    if (scope) {
      localThreatsToday = scope === "local" ? totalThreatsToday : 0;
      globalThreatsToday = scope === "global" ? totalThreatsToday : 0;
    } else {
      localThreatsToday = (localNews?.count ?? 0) + (localThreats?.count ?? 0);
      globalThreatsToday = (globalNews?.count ?? 0) + (globalThreats?.count ?? 0);
    }

    const criticalAlerts = (criticalNews?.count ?? 0) + (criticalThreats?.count ?? 0);
    const highAlerts = (highNews?.count ?? 0) + (highThreats?.count ?? 0);
    const resolvedIncidents = (resolvedNews?.count ?? 0) + (resolvedThreats?.count ?? 0);

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
      const [threatStateRows, newsStateRows, threatSectorRows, newsSectorRows] = await Promise.all([
        db.select({ state: threatIntelTable.indianState, count }).from(threatIntelTable)
          .where(and(threatBase, eq(threatIntelTable.scope, "local"), isNotNull(threatIntelTable.indianState)))
          .groupBy(threatIntelTable.indianState),
        db.select({ state: newsItemsTable.indianState, count }).from(newsItemsTable)
          .where(and(newsBase, eq(newsItemsTable.scope, "local"), isNotNull(newsItemsTable.indianState)))
          .groupBy(newsItemsTable.indianState),
        db.select({ sector: threatIntelTable.indianSector, count }).from(threatIntelTable)
          .where(and(threatBase, eq(threatIntelTable.scope, "local"), isNotNull(threatIntelTable.indianSector)))
          .groupBy(threatIntelTable.indianSector),
        db.select({ sector: newsItemsTable.indianSector, count }).from(newsItemsTable)
          .where(and(newsBase, eq(newsItemsTable.scope, "local"), isNotNull(newsItemsTable.indianSector)))
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

    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Invalid request", details: (error as { errors?: unknown }).errors });
      return;
    }
    logger.error({ err: error }, "Dashboard stats error");
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

export default router;
