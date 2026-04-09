import { Router, type IRouter, type Request, type Response } from "express";
import { db, advisoriesTable } from "@workspace/db";
import { eq, sql, and, gte, inArray, or, isNull } from "drizzle-orm";
import { getTimeframeStartDate } from "../lib/timeframe";
import { asyncHandler, NotFoundError } from "../middlewares/errorHandler";
import { apiCache, CACHE_TTL } from "../lib/cache";
import type { SQL } from "drizzle-orm";
import {
  displayableAdvisorySql,
  isDisplayableAdvisory,
  normalizeAdvisoryLinks,
} from "../lib/advisoryLinks";

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
  const links = normalizeAdvisoryLinks(item);

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
    patchUrl: links.patchUrl,
    workarounds: (item.workarounds as string[]) ?? [],
    references: links.references,
    status: item.status,
    publishedAt: item.publishedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    scope: item.scope ?? "global",
    isIndiaRelated: item.isIndiaRelated ?? false,
    indiaConfidence: item.indiaConfidence ?? 0,
    sourceUrl: links.sourceUrl ?? undefined,
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
    const rawTimeframe = (req.query.timeframe as string) ?? "";
    const parsableQuery = { ...req.query };
    if (rawTimeframe === "90d") parsableQuery.timeframe = "all";
    const query = GetCertInAdvisoriesQueryParams.parse(parsableQuery);

    const cacheKey = `certin:${query.severity ?? ""}:${query.category ?? ""}:${rawTimeframe}:${query.page ?? 1}:${query.limit ?? 20}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) { res.json(cached); return; }
    const conditions: SQL[] = [eq(advisoriesTable.isCertIn, true), displayableAdvisorySql];

    if (query.severity) {
      const severities = query.severity.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as ("critical" | "high" | "medium" | "low" | "info")[];
      if (severities.length === 1) conditions.push(eq(advisoriesTable.severity, severities[0]));
      else if (severities.length > 1) conditions.push(inArray(advisoriesTable.severity, severities));
    }
    if (query.category) {
      conditions.push(eq(advisoriesTable.certInType, query.category.trim()));
    }
    const fromDate =
      rawTimeframe === "90d"
        ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        : rawTimeframe && rawTimeframe !== "all"
          ? getTimeframeStartDate(rawTimeframe as Parameters<typeof getTimeframeStartDate>[0])
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
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(advisoriesTable)
      .where(where)
      .orderBy(sql`${advisoriesTable.publishedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = GetCertInAdvisoriesResponse.parse({
      data: items.filter(isDisplayableAdvisory).map(formatAdvisory),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), totalCritical, totalHigh },
    });

    apiCache.set(cacheKey, data, CACHE_TTL.LIST);
    res.json(data);
}));

router.get("/advisories/patches", asyncHandler(async (req: Request, res: Response) => {
    const rawQuery = req.query as Record<string, string>;
    const patchStatus = rawQuery.patchStatus; // "available" | "applied" | "pending"
    const vendor = rawQuery.vendor;
    const severity = rawQuery.severity;
    const timeframe = rawQuery.timeframe;
    const page = Math.max(1, parseInt(rawQuery.page ?? "1", 10));
    const limit = Math.min(parseInt(rawQuery.limit ?? "20", 10), 100);

    const cacheKey = `patches:${patchStatus ?? ""}:${vendor ?? ""}:${severity ?? ""}:${timeframe ?? ""}:${page}:${limit}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) { res.json(cached); return; }

    const conditions: SQL[] = [
      or(eq(advisoriesTable.patchAvailable, true), eq(advisoriesTable.status, "patched")) as SQL,
    ];

    if (patchStatus === "available") conditions.push(eq(advisoriesTable.patchAvailable, true), sql`${advisoriesTable.status} != 'patched'`);
    else if (patchStatus === "applied") conditions.push(eq(advisoriesTable.status, "patched"));
    else if (patchStatus === "pending") conditions.push(eq(advisoriesTable.patchAvailable, false), sql`${advisoriesTable.status} != 'patched'`);

    if (vendor) conditions.push(eq(advisoriesTable.vendor, vendor));
    if (severity) {
      const severities = severity.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as ("critical" | "high" | "medium" | "low" | "info")[];
      if (severities.length === 1) conditions.push(eq(advisoriesTable.severity, severities[0]));
      else if (severities.length > 1) conditions.push(inArray(advisoriesTable.severity, severities));
    }
    if (timeframe) {
      const fromDate = getTimeframeStartDate(timeframe as Parameters<typeof getTimeframeStartDate>[0]);
      if (fromDate) conditions.push(gte(advisoriesTable.publishedAt, fromDate));
    }

    const where = and(...conditions) as SQL;
    const [totalResult] = await db.select({ count: sql<number>`count(*)::int` }).from(advisoriesTable).where(where);
    const total = totalResult?.count ?? 0;
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(advisoriesTable)
      .where(where)
      .orderBy(sql`${advisoriesTable.publishedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = {
      items: items.map(formatAdvisory),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
    apiCache.set(cacheKey, data, CACHE_TTL.LIST);
    res.json(data);
}));

router.patch("/advisories/:id/patch-status", asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id) || !Number.isInteger(id)) { res.status(400).json({ error: "Invalid advisory ID" }); return; }

    const { patchAvailable, patchUrl, status } = req.body as { patchAvailable?: boolean; patchUrl?: string; status?: string };
    const validStatuses = ["new", "under_review", "patched", "dismissed"];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      return;
    }

    const updateFields: Partial<typeof advisoriesTable.$inferInsert> = {};
    if (patchAvailable !== undefined) updateFields.patchAvailable = patchAvailable;
    if (patchUrl !== undefined) updateFields.patchUrl = patchUrl;
    if (status) updateFields.status = status as "new" | "under_review" | "patched" | "dismissed";

    const [updated] = await db
      .update(advisoriesTable)
      .set(updateFields)
      .where(eq(advisoriesTable.id, id))
      .returning({ id: advisoriesTable.id, status: advisoriesTable.status, patchAvailable: advisoriesTable.patchAvailable });

    if (!updated) { res.status(404).json({ error: "Advisory not found" }); return; }

    // Invalidate related caches
    apiCache.invalidate();
    res.json({ success: true, advisory: updated });
}));

router.get("/advisories/vendors", asyncHandler(async (req: Request, res: Response) => {
    const cached = apiCache.get<object>("advisories:vendors");
    if (cached) { res.json(cached); return; }

    const rows = await db
      .selectDistinct({ vendor: advisoriesTable.vendor })
      .from(advisoriesTable)
      .where(and(
        displayableAdvisorySql,
        sql`${advisoriesTable.vendor} IS NOT NULL`,
        sql`${advisoriesTable.vendor} != 'Unknown'`,
      ))
      .orderBy(advisoriesTable.vendor);

    const data = { vendors: rows.map((r) => r.vendor).filter(Boolean) };
    apiCache.set("advisories:vendors", data, CACHE_TTL.LIST);
    res.json(data);
}));

router.get("/advisories", asyncHandler(async (req: Request, res: Response) => {
    const query = GetAdvisoriesQueryParams.parse(req.query);

    const cacheKey = `advisories:${query.scope ?? ""}:${query.severity ?? ""}:${query.vendor ?? ""}:${query.status ?? ""}:${query.excludeCertIn ?? ""}:${query.timeframe ?? ""}:${query.page ?? 1}:${query.limit ?? 20}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) { res.json(cached); return; }
    const conditions: SQL[] = [displayableAdvisorySql];

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
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(advisoriesTable)
      .where(where)
      .orderBy(sql`${advisoriesTable.publishedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = GetAdvisoriesResponse.parse({
      items: items.filter(isDisplayableAdvisory).map(formatAdvisory),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

    apiCache.set(cacheKey, data, CACHE_TTL.LIST);
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

    if (!item || !isDisplayableAdvisory(item)) {
      throw new NotFoundError("Advisory not found");
    }

    const data = GetAdvisoryByIdResponse.parse(formatAdvisory(item));
    res.json(data);
}));

export default router;
