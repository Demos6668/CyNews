import { Router, type IRouter } from "express";
import { db, newsItemsTable } from "@workspace/db";
import { eq, sql, and, ilike } from "drizzle-orm";
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

router.get("/news/bookmarked", async (_req, res) => {
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
    console.error("Bookmarked news error:", error);
    res.status(500).json({ error: "Failed to fetch bookmarked news" });
  }
});

router.get("/news", async (req, res) => {
  try {
    const query = GetNewsQueryParams.parse(req.query);
    const conditions: any[] = [];

    if (query.scope) conditions.push(eq(newsItemsTable.scope, query.scope));
    if (query.severity) conditions.push(eq(newsItemsTable.severity, query.severity));
    if (query.category) conditions.push(eq(newsItemsTable.category, query.category));
    if (query.type) conditions.push(eq(newsItemsTable.type, query.type));
    if (query.status) conditions.push(eq(newsItemsTable.status, query.status));

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
    console.error("News list error:", error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.get("/news/:id", async (req, res) => {
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
    console.error("News detail error:", error);
    res.status(500).json({ error: "Failed to fetch news item" });
  }
});

router.post("/news/:id/bookmark", async (req, res) => {
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
    console.error("Bookmark error:", error);
    res.status(500).json({ error: "Failed to toggle bookmark" });
  }
});

function formatNewsItem(item: any) {
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
    region: item.region ?? [],
    tags: item.tags ?? [],
    iocs: item.iocs ?? [],
    affectedSystems: item.affectedSystems ?? [],
    mitigations: item.mitigations ?? [],
    status: item.status,
    bookmarked: item.bookmarked,
    publishedAt: item.publishedAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export default router;
