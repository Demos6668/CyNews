import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable, advisoriesTable, threatIntelTable } from "@workspace/db";
import { sql, ilike, or } from "drizzle-orm";

import { SearchQueryParams, SearchResponse } from "@workspace/api-zod";

const router: IRouter = Router();

interface SearchResultItem {
  id: number;
  title: string;
  summary: string;
  type: string;
  severity: string;
  source: string;
  publishedAt: string;
}

router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = SearchQueryParams.parse(req.query);
    // Sanitize LIKE wildcards to prevent pattern injection
    const sanitized = query.q.replace(/[%_\\]/g, "\\$&");
    const searchTerm = `%${sanitized}%`;
    const limit = query.limit ?? 20;
    const results: SearchResultItem[] = [];

    if (!query.type || query.type === "news") {
      const newsResults = await db
        .select({
          id: newsItemsTable.id,
          title: newsItemsTable.title,
          summary: newsItemsTable.summary,
          type: newsItemsTable.type,
          severity: newsItemsTable.severity,
          source: newsItemsTable.source,
          publishedAt: newsItemsTable.publishedAt,
        })
        .from(newsItemsTable)
        .where(
          or(
            ilike(newsItemsTable.title, searchTerm),
            ilike(newsItemsTable.summary, searchTerm),
            ilike(newsItemsTable.content, searchTerm)
          )
        )
        .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
        .limit(limit);

      results.push(
        ...newsResults.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          type: item.type,
          severity: item.severity,
          source: item.source,
          publishedAt: item.publishedAt.toISOString(),
        }))
      );
    }

    if (!query.type || query.type === "threat") {
      const threatResults = await db
        .select({
          id: threatIntelTable.id,
          title: threatIntelTable.title,
          summary: threatIntelTable.summary,
          severity: threatIntelTable.severity,
          source: threatIntelTable.source,
          publishedAt: threatIntelTable.publishedAt,
        })
        .from(threatIntelTable)
        .where(
          or(
            ilike(threatIntelTable.title, searchTerm),
            ilike(threatIntelTable.summary, searchTerm),
            ilike(threatIntelTable.description, searchTerm)
          )
        )
        .orderBy(sql`${threatIntelTable.publishedAt} DESC`)
        .limit(limit);

      results.push(
        ...threatResults.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          type: "threat",
          severity: item.severity,
          source: item.source,
          publishedAt: item.publishedAt.toISOString(),
        }))
      );
    }

    if (!query.type || query.type === "advisory") {
      const advisoryResults = await db
        .select({
          id: advisoriesTable.id,
          title: advisoriesTable.title,
          description: advisoriesTable.description,
          severity: advisoriesTable.severity,
          vendor: advisoriesTable.vendor,
          publishedAt: advisoriesTable.publishedAt,
        })
        .from(advisoriesTable)
        .where(
          or(
            ilike(advisoriesTable.title, searchTerm),
            ilike(advisoriesTable.description, searchTerm),
            ilike(advisoriesTable.cveId, searchTerm)
          )
        )
        .orderBy(sql`${advisoriesTable.publishedAt} DESC`)
        .limit(limit);

      results.push(
        ...advisoryResults.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.description,
          type: "advisory",
          severity: item.severity,
          source: item.vendor,
          publishedAt: item.publishedAt.toISOString(),
        }))
      );
    }

    results.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const limitedResults = results.slice(0, limit);

    const data = SearchResponse.parse({
      results: limitedResults,
      total: limitedResults.length,
    });

    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({ error: "Invalid search parameters", details: (error as { errors?: unknown }).errors });
      return;
    }
    console.error("Search error:", error);
    res.status(500).json({ error: "Failed to search" });
  }
});

export default router;
