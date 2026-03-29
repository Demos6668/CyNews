import { Router, type IRouter, type Request, type Response } from "express";
import { db, advisoriesTable } from "@workspace/db";
import { eq, sql, and, gte, inArray, or, isNull } from "drizzle-orm";
import { getTimeframeStartDate } from "../lib/timeframe";
import { asyncHandler } from "../middlewares/errorHandler";
import type { SQL } from "drizzle-orm";

import {
  GetAdvisoriesQueryParams,
  GetAdvisoriesResponse,
  GetAdvisoryByIdParams,
  GetAdvisoryByIdResponse,
  GetCertInAdvisoriesQueryParams,
  GetCertInAdvisoriesResponse,
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
    sourceUrl: item.sourceUrl ?? undefined,
    source: item.source ?? undefined,
    summary: item.summary ?? undefined,
    content: item.content ?? undefined,
    category: item.category ?? undefined,
    isCertIn: item.isCertIn ?? false,
    certInId: item.certInId ?? undefined,
    certInType: item.certInType ?? undefined,
    cveIds: (item.cveIds as string[]) ?? [],
    recommendations: (item.recommendations as string[]) ?? [],
  };
}

router.get("/advisories/cert-in", asyncHandler(async (req: Request, res: Response) => {
    const rawQuery = { ...req.query };
    if (rawQuery.timeframe === "90d") rawQuery.timeframe = "all";
    const query = GetCertInAdvisoriesQueryParams.parse(rawQuery);
    const conditions: SQL[] = [eq(advisoriesTable.isCertIn, true)];

    if (query.severity) {
      const severities = query.severity.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as ("critical" | "high" | "medium" | "low" | "info")[];
      if (severities.length === 1) conditions.push(eq(advisoriesTable.severity, severities[0]));
      else if (severities.length > 1) conditions.push(inArray(advisoriesTable.severity, severities));
    }
    if (query.category) {
      conditions.push(eq(advisoriesTable.certInType, query.category.trim()));
    }
    const fromDate =
      req.query.timeframe === "90d"
        ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        : query.timeframe
          ? getTimeframeStartDate(query.timeframe)
          : undefined;
    if (fromDate) conditions.push(gte(advisoriesTable.publishedAt, fromDate));

    const where = and(...conditions);

    const [totalResult, criticalResult, highResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(advisoriesTable).where(where),
      db.select({ count: sql<number>`count(*)::int` }).from(advisoriesTable).where(and(where, eq(advisoriesTable.severity, "critical"))),
      db.select({ count: sql<number>`count(*)::int` }).from(advisoriesTable).where(and(where, eq(advisoriesTable.severity, "high"))),
    ]);

    const total = totalResult[0]?.count ?? 0;
    const totalCritical = criticalResult[0]?.count ?? 0;
    const totalHigh = highResult[0]?.count ?? 0;
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

    const data = GetCertInAdvisoriesResponse.parse({
      data: items.map(formatAdvisory),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), totalCritical, totalHigh },
    });

    res.json(data);
}));

router.get("/advisories", asyncHandler(async (req: Request, res: Response) => {
    const query = GetAdvisoriesQueryParams.parse(req.query);
    const conditions: SQL[] = [];

    if (query.scope) conditions.push(eq(advisoriesTable.scope, query.scope));
    if (query.severity) {
      const severities = query.severity.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as ("critical" | "high" | "medium" | "low" | "info")[];
      if (severities.length === 1) conditions.push(eq(advisoriesTable.severity, severities[0]));
      else if (severities.length > 1) conditions.push(inArray(advisoriesTable.severity, severities));
    }
    if (query.vendor) {
      const vendors = query.vendor.split(",").map((v) => v.trim()).filter(Boolean);
      if (vendors.length === 1) conditions.push(eq(advisoriesTable.vendor, vendors[0]));
      else if (vendors.length > 1) conditions.push(inArray(advisoriesTable.vendor, vendors));
    }
    if (query.status) {
      const statuses = query.status.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as ("new" | "under_review" | "patched" | "dismissed")[];
      if (statuses.length === 1) conditions.push(eq(advisoriesTable.status, statuses[0]));
      else if (statuses.length > 1) conditions.push(inArray(advisoriesTable.status, statuses));
    }
    if (query.excludeCertIn) {
      conditions.push(or(
        eq(advisoriesTable.isCertIn, false),
        isNull(advisoriesTable.isCertIn)
      ) as SQL);
    }
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
}));

router.get("/advisories/:id", asyncHandler(async (req: Request, res: Response) => {
    const idParam = req.params.id;
    const numericId = Number(idParam);
    const isNumeric = !Number.isNaN(numericId) && String(numericId) === idParam;

    let item: (typeof advisoriesTable.$inferSelect) | undefined;

    if (isNumeric) {
      const params = GetAdvisoryByIdParams.parse({ id: numericId });
      const [row] = await db.select().from(advisoriesTable).where(eq(advisoriesTable.id, params.id));
      item = row;
    } else {
      const [row] = await db.select().from(advisoriesTable).where(eq(advisoriesTable.certInId, String(idParam))).limit(1);
      item = row;
    }

    if (!item) {
      res.status(404).json({ error: "Advisory not found" });
      return;
    }

    const data = GetAdvisoryByIdResponse.parse(formatAdvisory(item));
    res.json(data);
}));

export default router;
