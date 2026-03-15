import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable, advisoriesTable, threatIntelTable } from "@workspace/db";
import { eq, sql, and, gte, isNotNull } from "drizzle-orm";

import { GetDashboardStatsResponse } from "@workspace/api-zod";
import { getTimeframeStartDate } from "../lib/timeframe";
import type { TimeframeValue } from "../lib/timeframe";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as TimeframeValue) ?? "24h";
    const scope = req.query.scope as "local" | "global" | undefined;
    const fromDate = getTimeframeStartDate(timeframe);
    const dateFilter = fromDate ?? new Date(0); // epoch for "all"

    const newsBase = [gte(newsItemsTable.publishedAt, dateFilter)] as const;
    const threatBase = [gte(threatIntelTable.publishedAt, dateFilter)] as const;
    const newsWithScope = scope ? and(...newsBase, eq(newsItemsTable.scope, scope)) : and(...newsBase);
    const threatWithScope = scope ? and(...threatBase, eq(threatIntelTable.scope, scope)) : and(...threatBase);

    const [newsToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(newsWithScope);

    const [threatsToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatIntelTable)
      .where(threatWithScope);

    const totalThreatsToday = (newsToday?.count ?? 0) + (threatsToday?.count ?? 0);

    let localThreatsToday: number;
    let globalThreatsToday: number;
    if (scope) {
      localThreatsToday = scope === "local" ? totalThreatsToday : 0;
      globalThreatsToday = scope === "global" ? totalThreatsToday : 0;
    } else {
      const [localNews] = await db.select({ count: sql<number>`count(*)::int` }).from(newsItemsTable).where(and(...newsBase, eq(newsItemsTable.scope, "local")));
      const [localThreats] = await db.select({ count: sql<number>`count(*)::int` }).from(threatIntelTable).where(and(...threatBase, eq(threatIntelTable.scope, "local")));
      const [globalNews] = await db.select({ count: sql<number>`count(*)::int` }).from(newsItemsTable).where(and(...newsBase, eq(newsItemsTable.scope, "global")));
      const [globalThreatsDb] = await db.select({ count: sql<number>`count(*)::int` }).from(threatIntelTable).where(and(...threatBase, eq(threatIntelTable.scope, "global")));
      localThreatsToday = (localNews?.count ?? 0) + (localThreats?.count ?? 0);
      globalThreatsToday = (globalNews?.count ?? 0) + (globalThreatsDb?.count ?? 0);
    }

    const activeAdvWhere = scope
      ? and(
          sql`${advisoriesTable.status} IN ('new', 'under_review')`,
          gte(advisoriesTable.publishedAt, dateFilter),
          eq(advisoriesTable.scope, scope),
        )
      : and(
          sql`${advisoriesTable.status} IN ('new', 'under_review')`,
          gte(advisoriesTable.publishedAt, dateFilter),
        );
    const [activeAdv] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(advisoriesTable)
      .where(activeAdvWhere);

    const criticalNewsWhere = scope ? and(...newsBase, eq(newsItemsTable.scope, scope), eq(newsItemsTable.severity, "critical"), eq(newsItemsTable.status, "active")) : and(...newsBase, eq(newsItemsTable.severity, "critical"), eq(newsItemsTable.status, "active"));
    const criticalThreatsWhere = scope ? and(...threatBase, eq(threatIntelTable.scope, scope), eq(threatIntelTable.severity, "critical"), eq(threatIntelTable.status, "active")) : and(...threatBase, eq(threatIntelTable.severity, "critical"), eq(threatIntelTable.status, "active"));
    const [criticalNews] = await db.select({ count: sql<number>`count(*)::int` }).from(newsItemsTable).where(criticalNewsWhere);
    const [criticalThreats] = await db.select({ count: sql<number>`count(*)::int` }).from(threatIntelTable).where(criticalThreatsWhere);
    const criticalAlerts = (criticalNews?.count ?? 0) + (criticalThreats?.count ?? 0);

    const resolvedNewsWhere = scope ? and(...newsBase, eq(newsItemsTable.scope, scope), eq(newsItemsTable.status, "resolved")) : and(...newsBase, eq(newsItemsTable.status, "resolved"));
    const resolvedThreatsWhere = scope ? and(...threatBase, eq(threatIntelTable.scope, scope), eq(threatIntelTable.status, "resolved")) : and(...threatBase, eq(threatIntelTable.status, "resolved"));
    const [resolvedNews] = await db.select({ count: sql<number>`count(*)::int` }).from(newsItemsTable).where(resolvedNewsWhere);
    const [resolvedThreats] = await db.select({ count: sql<number>`count(*)::int` }).from(threatIntelTable).where(resolvedThreatsWhere);
    const resolvedIncidents = (resolvedNews?.count ?? 0) + (resolvedThreats?.count ?? 0);

    const recentNewsItems = await db
      .select({
        id: newsItemsTable.id,
        title: newsItemsTable.title,
        type: newsItemsTable.type,
        severity: newsItemsTable.severity,
        publishedAt: newsItemsTable.publishedAt,
        sourceUrl: newsItemsTable.sourceUrl,
      })
      .from(newsItemsTable)
      .where(newsWithScope)
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
      .limit(5);

    const recentThreats = await db
      .select({
        id: threatIntelTable.id,
        title: threatIntelTable.title,
        severity: threatIntelTable.severity,
        publishedAt: threatIntelTable.publishedAt,
        sourceUrl: threatIntelTable.sourceUrl,
      })
      .from(threatIntelTable)
      .where(threatWithScope)
      .orderBy(sql`${threatIntelTable.publishedAt} DESC`)
      .limit(5);

    const recentItems = [
      ...recentNewsItems.map((item) => ({ ...item, sourceType: "news" as const })),
      ...recentThreats.map((item) => ({ ...item, type: "threat" as const, sourceType: "threat" as const })),
    ].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 10);

    let currentThreatLevel: "low" | "medium" | "high" | "critical" = "low";
    if (criticalAlerts >= 3) currentThreatLevel = "critical";
    else if (criticalAlerts >= 2) currentThreatLevel = "high";
    else if (criticalAlerts >= 1) currentThreatLevel = "medium";

    let indiaStats: { byState: Array<{ state: string; count: number }>; bySector: Array<{ sector: string; count: number }> } | undefined;
    if (scope === "local") {
      const threatStateRows = await db
        .select({ state: threatIntelTable.indianState, count: sql<number>`count(*)::int` })
        .from(threatIntelTable)
        .where(and(...threatBase, eq(threatIntelTable.scope, "local"), isNotNull(threatIntelTable.indianState)))
        .groupBy(threatIntelTable.indianState);
      const newsStateRows = await db
        .select({ state: newsItemsTable.indianState, count: sql<number>`count(*)::int` })
        .from(newsItemsTable)
        .where(and(...newsBase, eq(newsItemsTable.scope, "local"), isNotNull(newsItemsTable.indianState)))
        .groupBy(newsItemsTable.indianState);
      const threatSectorRows = await db
        .select({ sector: threatIntelTable.indianSector, count: sql<number>`count(*)::int` })
        .from(threatIntelTable)
        .where(and(...threatBase, eq(threatIntelTable.scope, "local"), isNotNull(threatIntelTable.indianSector)))
        .groupBy(threatIntelTable.indianSector);
      const newsSectorRows = await db
        .select({ sector: newsItemsTable.indianSector, count: sql<number>`count(*)::int` })
        .from(newsItemsTable)
        .where(and(...newsBase, eq(newsItemsTable.scope, "local"), isNotNull(newsItemsTable.indianSector)))
        .groupBy(newsItemsTable.indianSector);
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
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

export default router;
