import { Router, type IRouter } from "express";
import { db, newsItemsTable, advisoriesTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { GetDashboardStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalThreats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(gte(newsItemsTable.publishedAt, today));

    const [localThreats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(and(gte(newsItemsTable.publishedAt, today), eq(newsItemsTable.scope, "local")));

    const [globalThreats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(and(gte(newsItemsTable.publishedAt, today), eq(newsItemsTable.scope, "global")));

    const [activeAdv] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(advisoriesTable)
      .where(sql`${advisoriesTable.status} IN ('new', 'under_review')`);

    const [criticalAlerts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(and(eq(newsItemsTable.severity, "critical"), eq(newsItemsTable.status, "active")));

    const [resolvedIncidents] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(eq(newsItemsTable.status, "resolved"));

    const recentItems = await db
      .select({
        id: newsItemsTable.id,
        title: newsItemsTable.title,
        type: newsItemsTable.type,
        severity: newsItemsTable.severity,
        publishedAt: newsItemsTable.publishedAt,
      })
      .from(newsItemsTable)
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
      .limit(10);

    const critCount = criticalAlerts?.count ?? 0;
    let currentThreatLevel: "low" | "medium" | "high" | "critical" = "low";
    if (critCount >= 3) currentThreatLevel = "critical";
    else if (critCount >= 2) currentThreatLevel = "high";
    else if (critCount >= 1) currentThreatLevel = "medium";

    const data = GetDashboardStatsResponse.parse({
      totalThreatsToday: totalThreats?.count ?? 0,
      localThreatsToday: localThreats?.count ?? 0,
      globalThreatsToday: globalThreats?.count ?? 0,
      activeAdvisories: activeAdv?.count ?? 0,
      criticalAlerts: criticalAlerts?.count ?? 0,
      resolvedIncidents: resolvedIncidents?.count ?? 0,
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
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

export default router;
