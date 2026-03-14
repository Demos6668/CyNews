import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable } from "@workspace/db";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import {
  GetNewsQueryParams,
  GetNewsResponse,
  GetNewsByIdParams,
  GetNewsByIdResponse,
  ToggleBookmarkParams,
  ToggleBookmarkResponse,
  GetBookmarkedNewsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatNewsItem(item: typeof newsItemsTable.$inferSelect) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    content: item.content,
    type: item.type,
    scope: item.scope,
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

router.get("/news/bookmarked", async (_req: Request, res: Response) => {
  try {
    const items = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.bookmarked, true))
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`);

    const data = GetBookmarkedNewsResponse.parse({
      items: items.map(formatNewsItem),
      total: items.length,
      page: 1,
      limit: items.length,
      totalPages: 1,
    });

    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Invalid request", details: (error as { errors?: unknown }).errors });
      return;
    }
    console.error("Bookmarked news error:", error);
    res.status(500).json({ error: "Failed to fetch bookmarked news" });
  }
});

router.get("/news", async (req: Request, res: Response) => {
  try {
    const rawQuery = { ...req.query } as Record<string, unknown>;
    if (typeof rawQuery.from === "string") rawQuery.from = new Date(rawQuery.from);
    if (typeof rawQuery.to === "string") rawQuery.to = new Date(rawQuery.to);
    const query = GetNewsQueryParams.parse(rawQuery);
    const conditions: SQL[] = [];

    if (query.scope) conditions.push(eq(newsItemsTable.scope, query.scope));
    if (query.severity) conditions.push(eq(newsItemsTable.severity, query.severity));
    if (query.category) conditions.push(eq(newsItemsTable.category, query.category));
    if (query.type) conditions.push(eq(newsItemsTable.type, query.type));
    if (query.status) conditions.push(eq(newsItemsTable.status, query.status));
    if (query.from) conditions.push(gte(newsItemsTable.publishedAt, query.from));
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
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
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

    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Invalid request parameters", details: (error as { errors?: unknown }).errors });
      return;
    }
    console.error("News list error:", error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.get("/news/:id", async (req: Request, res: Response) => {
  try {
    const params = GetNewsByIdParams.parse({ id: Number(req.params.id) });

    const [item] = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.id, params.id));

    if (!item) {
      res.status(404).json({ error: "News item not found" });
      return;
    }

    const data = GetNewsByIdResponse.parse(formatNewsItem(item));
    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Invalid request parameters", details: (error as { errors?: unknown }).errors });
      return;
    }
    console.error("News detail error:", error);
    res.status(500).json({ error: "Failed to fetch news item" });
  }
});

router.post("/news/:id/bookmark", async (req: Request, res: Response) => {
  try {
    const params = ToggleBookmarkParams.parse({ id: Number(req.params.id) });

    const [item] = await db
      .select()
      .from(newsItemsTable)
      .where(eq(newsItemsTable.id, params.id));

    if (!item) {
      res.status(404).json({ error: "News item not found" });
      return;
    }

    const [updated] = await db
      .update(newsItemsTable)
      .set({ bookmarked: !item.bookmarked })
      .where(eq(newsItemsTable.id, params.id))
      .returning();

    const data = ToggleBookmarkResponse.parse({
      id: updated.id,
      bookmarked: updated.bookmarked,
    });

    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Invalid request parameters", details: (error as { errors?: unknown }).errors });
      return;
    }
    console.error("Bookmark error:", error);
    res.status(500).json({ error: "Failed to toggle bookmark" });
  }
});

export default router;
