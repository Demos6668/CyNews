import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable, advisoriesTable, threatIntelTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";

import { GetDashboardStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [newsToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(gte(newsItemsTable.publishedAt, today));

    const [threatsToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatIntelTable)
      .where(gte(threatIntelTable.publishedAt, today));

    const totalThreatsToday = (newsToday?.count ?? 0) + (threatsToday?.count ?? 0);

    const [localNews] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(and(gte(newsItemsTable.publishedAt, today), eq(newsItemsTable.scope, "local")));

    const [localThreats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatIntelTable)
      .where(and(gte(threatIntelTable.publishedAt, today), eq(threatIntelTable.scope, "local")));

    const localThreatsToday = (localNews?.count ?? 0) + (localThreats?.count ?? 0);

    const [globalNews] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(and(gte(newsItemsTable.publishedAt, today), eq(newsItemsTable.scope, "global")));

    const [globalThreatsDb] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatIntelTable)
      .where(and(gte(threatIntelTable.publishedAt, today), eq(threatIntelTable.scope, "global")));

    const globalThreatsToday = (globalNews?.count ?? 0) + (globalThreatsDb?.count ?? 0);

    const [activeAdv] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(advisoriesTable)
      .where(sql`${advisoriesTable.status} IN ('new', 'under_review')`);

    const [criticalNews] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(and(eq(newsItemsTable.severity, "critical"), eq(newsItemsTable.status, "active")));

    const [criticalThreats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatIntelTable)
      .where(and(eq(threatIntelTable.severity, "critical"), eq(threatIntelTable.status, "active")));

    const criticalAlerts = (criticalNews?.count ?? 0) + (criticalThreats?.count ?? 0);

    const [resolvedNews] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(eq(newsItemsTable.status, "resolved"));

    const [resolvedThreats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatIntelTable)
      .where(eq(threatIntelTable.status, "resolved"));

    const resolvedIncidents = (resolvedNews?.count ?? 0) + (resolvedThreats?.count ?? 0);

    const recentNewsItems = await db
      .select({
        id: newsItemsTable.id,
        title: newsItemsTable.title,
        type: newsItemsTable.type,
        severity: newsItemsTable.severity,
        publishedAt: newsItemsTable.publishedAt,
      })
      .from(newsItemsTable)
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
      .limit(5);

    const recentThreats = await db
      .select({
        id: threatIntelTable.id,
        title: threatIntelTable.title,
        severity: threatIntelTable.severity,
        publishedAt: threatIntelTable.publishedAt,
      })
      .from(threatIntelTable)
      .orderBy(sql`${threatIntelTable.publishedAt} DESC`)
      .limit(5);

    const recentItems = [
      ...recentNewsItems.map((item) => ({ ...item })),
      ...recentThreats.map((item) => ({ ...item, type: "threat" as const })),
    ].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 10);

    let currentThreatLevel: "low" | "medium" | "high" | "critical" = "low";
    if (criticalAlerts >= 3) currentThreatLevel = "critical";
    else if (criticalAlerts >= 2) currentThreatLevel = "high";
    else if (criticalAlerts >= 1) currentThreatLevel = "medium";

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
      })),
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
