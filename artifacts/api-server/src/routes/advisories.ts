import { Router, type IRouter, type Request, type Response } from "express";
import { db, advisoriesTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { getTimeframeStartDate } from "../lib/timeframe";
import type { SQL } from "drizzle-orm";

import {
  GetAdvisoriesQueryParams,
  GetAdvisoriesResponse,
  GetAdvisoryByIdParams,
  GetAdvisoryByIdResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatAdvisory(item: typeof advisoriesTable.$inferSelect) {
  return {
    id: item.id,
    cveId: item.cveId,
    title: item.title,
    description: item.description,
    cvssScore: item.cvssScore,
    severity: item.severity,
    affectedProducts: (item.affectedProducts as string[]) ?? [],
    vendor: item.vendor,
    patchAvailable: item.patchAvailable,
    patchUrl: item.patchUrl,
    workarounds: (item.workarounds as string[]) ?? [],
    references: (item.references as string[]) ?? [],
    status: item.status,
    publishedAt: item.publishedAt.toISOString(),
    scope: item.scope ?? "global",
    isIndiaRelated: item.isIndiaRelated ?? false,
    indiaConfidence: item.indiaConfidence ?? 0,
  };
}

router.get("/advisories", async (req: Request, res: Response) => {
  try {
    const query = GetAdvisoriesQueryParams.parse(req.query);
    const conditions: SQL[] = [];

    if (query.scope) conditions.push(eq(advisoriesTable.scope, query.scope));
    if (query.severity) conditions.push(eq(advisoriesTable.severity, query.severity));
    if (query.vendor) conditions.push(eq(advisoriesTable.vendor, query.vendor));
    if (query.status) conditions.push(eq(advisoriesTable.status, query.status));
    const fromDate = query.timeframe ? getTimeframeStartDate(query.timeframe) : undefined;
    if (fromDate) conditions.push(gte(advisoriesTable.publishedAt, fromDate));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(advisoriesTable)
      .where(where);

    const total = totalResult?.count ?? 0;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(advisoriesTable)
      .where(where)
      .orderBy(sql`${advisoriesTable.publishedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = GetAdvisoriesResponse.parse({
      items: items.map(formatAdvisory),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Invalid request parameters", details: (error as { errors?: unknown }).errors });
      return;
    }
    console.error("Advisories list error:", error);
    res.status(500).json({ error: "Failed to fetch advisories" });
  }
});

router.get("/advisories/:id", async (req: Request, res: Response) => {
  try {
    const params = GetAdvisoryByIdParams.parse({ id: Number(req.params.id) });

    const [item] = await db
      .select()
      .from(advisoriesTable)
      .where(eq(advisoriesTable.id, params.id));

    if (!item) {
      res.status(404).json({ error: "Advisory not found" });
      return;
    }

    const data = GetAdvisoryByIdResponse.parse(formatAdvisory(item));
    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Invalid request parameters", details: (error as { errors?: unknown }).errors });
      return;
    }
    console.error("Advisory detail error:", error);
    res.status(500).json({ error: "Failed to fetch advisory" });
  }
});

export default router;
