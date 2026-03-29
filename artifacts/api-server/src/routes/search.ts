import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable, advisoriesTable, threatIntelTable } from "@workspace/db";
import { sql, ilike, or } from "drizzle-orm";

import { SearchQueryParams, SearchResponse } from "@workspace/api-zod";
import { asyncHandler, ValidationError } from "../middlewares/errorHandler";
import { apiCache, CACHE_TTL } from "../lib/cache";

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 200;

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

router.get("/search", asyncHandler(async (req: Request, res: Response) => {
    const query = SearchQueryParams.parse(req.query);

    const cacheKey = `search:${query.q}:${query.type ?? ""}:${query.limit ?? 20}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) { res.json(cached); return; }
    if (query.q.length < MIN_SEARCH_LENGTH || query.q.length > MAX_SEARCH_LENGTH) {
      throw new ValidationError(`Search query must be between ${MIN_SEARCH_LENGTH} and ${MAX_SEARCH_LENGTH} characters`);
    }
    // Sanitize LIKE wildcards to prevent pattern injection
    const sanitized = query.q.replace(/[%_\\]/g, "\\$&");
    const searchTerm = `%${sanitized}%`;
    const limit = Math.min(query.limit ?? 20, 100);
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

    apiCache.set(cacheKey, data, CACHE_TTL.SEARCH);
    res.json(data);
}));

export default router;
