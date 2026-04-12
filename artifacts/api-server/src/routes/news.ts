import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable } from "@workspace/db";
import { insertNewsItemSchema } from "@workspace/db/schema";
import { eq, sql, and, gte, lte, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import { getTimeframeStartDate } from "../lib/timeframe";
import { validate } from "../middlewares/validate";
import { asyncHandler, NotFoundError } from "../middlewares/errorHandler";
import { apiCache, CACHE_TTL } from "../lib/cache";

import {
  GetNewsQueryParams,
  GetNewsResponse,
  GetNewsByIdParams,
  GetNewsByIdResponse,
  ToggleBookmarkParams,
  ToggleBookmarkResponse,
  GetBookmarkedNewsResponse,
} from "@workspace/api-zod";

const RssQueryParams = z.object({ scope: z.enum(["local", "global"]).optional() });

const router: IRouter = Router();

function formatNewsItem(item: typeof newsItemsTable.$inferSelect) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    content: item.content,
    type: item.type,
    scope: item.scope,
    isIndiaRelated: item.isIndiaRelated ?? null,
    indiaConfidence: item.indiaConfidence ?? null,
    indianState: item.indianState ?? null,
    indianStateName: item.indianStateName ?? null,
    indianCity: item.indianCity ?? null,
    indianSector: item.indianSector ?? null,
    severity: item.severity,
    category: item.category,
    source: item.source,
    sourceUrl: item.sourceUrl,
    region: (item.region as string[]) ?? [],
    tags: (item.tags as string[]) ?? [],
    iocs: (item.iocs as string[]) ?? [],
    affectedSystems: (item.affectedSystems as string[]) ?? [],
    mitigations: (item.mitigations as string[]) ?? [],
    status: item.status,
    bookmarked: item.bookmarked,
    publishedAt: item.publishedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

router.get("/news/rss", validate({ query: RssQueryParams }), asyncHandler(async (req: Request, res: Response) => {
    const scope = req.query.scope as string | undefined;
    const conditions: SQL[] = [];
    if (scope) conditions.push(eq(newsItemsTable.scope, scope as "local" | "global"));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(newsItemsTable)
      .where(where)
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
      .limit(50);

    const rssItems = items
      .map(
        (item) =>
          `  <item>
    <title>${escapeXml(item.title)}</title>
    <description>${escapeXml(item.summary)}</description>
    <link>${item.sourceUrl ? escapeXml(item.sourceUrl) : ""}</link>
    <pubDate>${item.publishedAt.toUTCString()}</pubDate>
    <guid isPermaLink="false">news-${item.id}</guid>
  </item>`
      )
      .join("\n");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>CYFY News Board - ${scope ?? "All"} Threats &amp; News</title>
    <link>${req.protocol}://${req.get("host")}${req.baseUrl}/news</link>
    <description>Cybersecurity threat intelligence and news aggregation</description>
    <language>en-us</language>
${rssItems}
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.send(rss);
}));

router.get("/news/bookmarked", asyncHandler(async (_req: Request, res: Response) => {
    const items = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.bookmarked, true))
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
      .limit(100);

    const data = GetBookmarkedNewsResponse.parse({
      items: items.map(formatNewsItem),
      total: items.length,
      page: 1,
      limit: 100,
      totalPages: 1,
    });

    res.json(data);
}));

router.get("/news", asyncHandler(async (req: Request, res: Response) => {
    const rawQuery = { ...req.query } as Record<string, unknown>;
    if (typeof rawQuery.from === "string") rawQuery.from = new Date(rawQuery.from);
    if (typeof rawQuery.to === "string") rawQuery.to = new Date(rawQuery.to);
    const query = GetNewsQueryParams.parse(rawQuery);

    const cacheKey = `news:${query.scope ?? ""}:${query.severity ?? ""}:${query.category ?? ""}:${query.type ?? ""}:${query.status ?? ""}:${query.timeframe ?? ""}:${query.page ?? 1}:${query.limit ?? 20}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) { res.json(cached); return; }
    const conditions: SQL[] = [];

    if (query.scope) conditions.push(eq(newsItemsTable.scope, query.scope));
    if (query.severity) {
      const severities = query.severity.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as ("critical" | "high" | "medium" | "low" | "info")[];
      if (severities.length === 1) conditions.push(eq(newsItemsTable.severity, severities[0]));
      else if (severities.length > 1) conditions.push(inArray(newsItemsTable.severity, severities));
    }
    if (query.category) {
      const categories = query.category.split(",").map((c) => c.trim()).filter(Boolean);
      if (categories.length === 1) conditions.push(eq(newsItemsTable.category, categories[0]));
      else if (categories.length > 1) conditions.push(inArray(newsItemsTable.category, categories));
    }
    if (query.type) conditions.push(eq(newsItemsTable.type, query.type));
    if (query.status) conditions.push(eq(newsItemsTable.status, query.status));
    const fromDate = query.from ?? (query.timeframe ? getTimeframeStartDate(query.timeframe) : undefined);
    if (fromDate) conditions.push(gte(newsItemsTable.publishedAt, fromDate));
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(lte(newsItemsTable.publishedAt, toDate));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(newsItemsTable)
      .where(where);

    const total = totalResult?.count ?? 0;
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(query.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const items = await db
      .select()
      .from(newsItemsTable)
      .where(where)
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
      .limit(limit)
      .offset(offset);

    const data = GetNewsResponse.parse({
      items: items.map(formatNewsItem),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });

    apiCache.set(cacheKey, data, CACHE_TTL.LIST);
    res.json(data);
}));

router.get("/news/:id", asyncHandler(async (req: Request, res: Response) => {
    const params = GetNewsByIdParams.parse({ id: Number(req.params.id) });

    const [item] = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.id, params.id));

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    const data = GetNewsByIdResponse.parse(formatNewsItem(item));
    res.json(data);
}));

router.post("/news", asyncHandler(async (req: Request, res: Response) => {
    const body = insertNewsItemSchema.parse(req.body);
    const [inserted] = await db
      .insert(newsItemsTable)
      .values({
        title: body.title,
        summary: body.summary,
        content: body.content,
        type: body.type as "threat" | "news" | "advisory",
        scope: body.scope as "local" | "global",
        severity: body.severity as "critical" | "high" | "medium" | "low" | "info",
        category: body.category,
        source: body.source,
        sourceUrl: body.sourceUrl ?? null,
        region: body.region ?? [],
        tags: body.tags ?? [],
        iocs: body.iocs ?? [],
        affectedSystems: body.affectedSystems ?? [],
        mitigations: body.mitigations ?? [],
        status: (body.status ?? "active") as "active" | "resolved" | "monitoring",
      })
      .returning();

    apiCache.invalidate("news:");
    apiCache.invalidate("dashboard:");
    const data = GetNewsByIdResponse.parse(formatNewsItem(inserted));
    res.status(201).json(data);
}));

router.put("/news/:id", asyncHandler(async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const body = insertNewsItemSchema.partial().parse(req.body);

    const [existing] = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.id, id));

    if (!existing) {
      throw new NotFoundError("News item not found");
    }

    type NewsType = "threat" | "news" | "advisory";
    type NewsScope = "local" | "global";
    type NewsSeverity = "critical" | "high" | "medium" | "low" | "info";
    type NewsStatus = "active" | "resolved" | "monitoring";

    const [updated] = await db
      .update(newsItemsTable)
      .set({
        ...(body.title !== undefined && { title: body.title }),
        ...(body.summary !== undefined && { summary: body.summary }),
        ...(body.content !== undefined && { content: body.content }),
        ...(body.type !== undefined && { type: body.type as NewsType }),
        ...(body.scope !== undefined && { scope: body.scope as NewsScope }),
        ...(body.severity !== undefined && { severity: body.severity as NewsSeverity }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.source !== undefined && { source: body.source }),
        ...(body.sourceUrl !== undefined && { sourceUrl: body.sourceUrl }),
        ...(body.region !== undefined && { region: body.region }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.iocs !== undefined && { iocs: body.iocs }),
        ...(body.affectedSystems !== undefined && { affectedSystems: body.affectedSystems }),
        ...(body.mitigations !== undefined && { mitigations: body.mitigations }),
        ...(body.status !== undefined && { status: body.status as NewsStatus }),
        updatedAt: new Date(),
      })
      .where(eq(newsItemsTable.id, id))
      .returning();

    apiCache.invalidate("news:");
    apiCache.invalidate("dashboard:");
    const data = GetNewsByIdResponse.parse(formatNewsItem(updated));
    res.json(data);
}));

router.delete("/news/:id", asyncHandler(async (req: Request, res: Response) => {
    const params = GetNewsByIdParams.parse({ id: Number(req.params.id) });

    const [item] = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.id, params.id));

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    await db.delete(newsItemsTable).where(eq(newsItemsTable.id, params.id));
    apiCache.invalidate("news:");
    apiCache.invalidate("dashboard:");
    res.status(204).send();
}));

router.post("/news/:id/bookmark", asyncHandler(async (req: Request, res: Response) => {
    const params = ToggleBookmarkParams.parse({ id: Number(req.params.id) });

    const [item] = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.id, params.id));

    if (!item) {
      throw new NotFoundError("News item not found");
    }

    const [updated] = await db
      .update(newsItemsTable)
      .set({ bookmarked: !item.bookmarked })
      .where(eq(newsItemsTable.id, params.id))
      .returning();

    apiCache.invalidate("news:");
    const data = ToggleBookmarkResponse.parse({
      id: updated.id,
      bookmarked: updated.bookmarked,
    });

    res.json(data);
}));

export default router;
