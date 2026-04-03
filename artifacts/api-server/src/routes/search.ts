import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable, advisoriesTable, threatIntelTable } from "@workspace/db";
import { sql, ilike, or } from "drizzle-orm";

import { SearchQueryParams, SearchResponse } from "@workspace/api-zod";
import { asyncHandler, ValidationError } from "../middlewares/errorHandler";
import { apiCache, CACHE_TTL } from "../lib/cache";

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 200;
const FTS_MIN_LENGTH = 3;

const router: IRouter = Router();

interface SearchResultItem {
  id: number;
  title: string;
  summary: string;
  type: string;
  severity: string;
  source: string;
  publishedAt: string;
  rank?: number;
}

/** Convert a user query into a PostgreSQL tsquery string.
 *  Splits on whitespace, strips non-alphanumeric chars, joins with &. */
function toTsQuery(input: string): string {
  const terms = input
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^\w-]/g, ""))
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return "";
  return terms.map((t) => `${t}:*`).join(" & ");
}

async function ftsSearchSingleType(
  type: "news" | "threat" | "advisory",
  tsQuery: string,
  limit: number,
): Promise<SearchResultItem[]> {
  if (type === "news") {
    const result = await db.execute<{
      id: number; title: string; summary: string; type: string;
      severity: string; source: string; published_at: Date; rank: number;
    }>(sql`
      SELECT id, title, summary, type, severity, source, published_at,
        ts_rank(
          setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(content, '')), 'C'),
          to_tsquery('english', ${tsQuery})
        ) AS rank
      FROM news_items
      WHERE (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(content, '')), 'C')
      ) @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC, published_at DESC
      LIMIT ${limit}
    `);
    return result.rows.map((r) => ({
      id: r.id, title: r.title, summary: r.summary, type: r.type,
      severity: r.severity, source: r.source,
      publishedAt: new Date(r.published_at).toISOString(), rank: r.rank,
    }));
  }

  if (type === "threat") {
    const result = await db.execute<{
      id: number; title: string; summary: string;
      severity: string; source: string; published_at: Date; rank: number;
    }>(sql`
      SELECT id, title, summary, severity, source, published_at,
        ts_rank(
          setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(description, '')), 'C'),
          to_tsquery('english', ${tsQuery})
        ) AS rank
      FROM threat_intel
      WHERE (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
      ) @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC, published_at DESC
      LIMIT ${limit}
    `);
    return result.rows.map((r) => ({
      id: r.id, title: r.title, summary: r.summary, type: "threat",
      severity: r.severity, source: r.source,
      publishedAt: new Date(r.published_at).toISOString(), rank: r.rank,
    }));
  }

  // advisory
  const result = await db.execute<{
    id: number; title: string; description: string;
    severity: string; vendor: string; published_at: Date; rank: number;
  }>(sql`
    SELECT id, title, description, severity, vendor, published_at,
      ts_rank(
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(cve_id, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B'),
        to_tsquery('english', ${tsQuery})
      ) AS rank
    FROM advisories
    WHERE (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(cve_id, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) @@ to_tsquery('english', ${tsQuery})
    ORDER BY rank DESC, published_at DESC
    LIMIT ${limit}
  `);
  return result.rows.map((r) => ({
    id: r.id, title: r.title, summary: r.description, type: "advisory",
    severity: r.severity, source: r.vendor,
    publishedAt: new Date(r.published_at).toISOString(), rank: r.rank,
  }));
}

async function ilikeSearchSingleType(
  type: "news" | "threat" | "advisory",
  searchTerm: string,
  limit: number,
): Promise<SearchResultItem[]> {
  if (type === "news") {
    const rows = await db
      .select({
        id: newsItemsTable.id, title: newsItemsTable.title,
        summary: newsItemsTable.summary, type: newsItemsTable.type,
        severity: newsItemsTable.severity, source: newsItemsTable.source,
        publishedAt: newsItemsTable.publishedAt,
      })
      .from(newsItemsTable)
      .where(or(
        ilike(newsItemsTable.title, searchTerm),
        ilike(newsItemsTable.summary, searchTerm),
        ilike(newsItemsTable.content, searchTerm),
      ))
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
      .limit(limit);

    return rows.map((item) => ({
      id: item.id, title: item.title, summary: item.summary,
      type: item.type, severity: item.severity, source: item.source,
      publishedAt: item.publishedAt.toISOString(),
    }));
  }

  if (type === "threat") {
    const rows = await db
      .select({
        id: threatIntelTable.id, title: threatIntelTable.title,
        summary: threatIntelTable.summary, severity: threatIntelTable.severity,
        source: threatIntelTable.source, publishedAt: threatIntelTable.publishedAt,
      })
      .from(threatIntelTable)
      .where(or(
        ilike(threatIntelTable.title, searchTerm),
        ilike(threatIntelTable.summary, searchTerm),
        ilike(threatIntelTable.description, searchTerm),
      ))
      .orderBy(sql`${threatIntelTable.publishedAt} DESC`)
      .limit(limit);

    return rows.map((item) => ({
      id: item.id, title: item.title, summary: item.summary,
      type: "threat", severity: item.severity, source: item.source,
      publishedAt: item.publishedAt.toISOString(),
    }));
  }

  // advisory
  const rows = await db
    .select({
      id: advisoriesTable.id, title: advisoriesTable.title,
      description: advisoriesTable.description, severity: advisoriesTable.severity,
      vendor: advisoriesTable.vendor, publishedAt: advisoriesTable.publishedAt,
    })
    .from(advisoriesTable)
    .where(or(
      ilike(advisoriesTable.title, searchTerm),
      ilike(advisoriesTable.description, searchTerm),
      ilike(advisoriesTable.cveId, searchTerm),
    ))
    .orderBy(sql`${advisoriesTable.publishedAt} DESC`)
    .limit(limit);

  return rows.map((item) => ({
    id: item.id, title: item.title, summary: item.description,
    type: "advisory", severity: item.severity, source: item.vendor,
    publishedAt: item.publishedAt.toISOString(),
  }));
}

async function searchAllTypes(
  rawQuery: string,
  searchTerm: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const tsQuery = rawQuery.length >= FTS_MIN_LENGTH ? toTsQuery(rawQuery) : "";
  const useFts = tsQuery.length > 0;

  const searcher = useFts
    ? (t: "news" | "threat" | "advisory") => ftsSearchSingleType(t, tsQuery, limit)
    : (t: "news" | "threat" | "advisory") => ilikeSearchSingleType(t, searchTerm, limit);

  const [newsResults, threatResults, advisoryResults] = await Promise.all([
    searcher("news"),
    searcher("threat"),
    searcher("advisory"),
  ]);

  const combined = [...newsResults, ...threatResults, ...advisoryResults];

  if (useFts) {
    combined.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
  } else {
    combined.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }
  return combined.slice(0, limit);
}

router.get("/search", asyncHandler(async (req: Request, res: Response) => {
    const query = SearchQueryParams.parse(req.query);

    const cacheKey = `search:${query.q}:${query.type ?? ""}:${query.limit ?? 20}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) { res.json(cached); return; }
    if (query.q.length < MIN_SEARCH_LENGTH || query.q.length > MAX_SEARCH_LENGTH) {
      throw new ValidationError(`Search query must be between ${MIN_SEARCH_LENGTH} and ${MAX_SEARCH_LENGTH} characters`);
    }

    const limit = Math.min(query.limit ?? 20, 100);
    const tsQuery = query.q.length >= FTS_MIN_LENGTH ? toTsQuery(query.q) : "";
    const useFts = tsQuery.length > 0;

    // Sanitize LIKE wildcards for ILIKE fallback
    const sanitized = query.q.replace(/[%_\\]/g, "\\$&");
    const searchTerm = `%${sanitized}%`;

    let results: SearchResultItem[];
    if (query.type) {
      const t = query.type as "news" | "threat" | "advisory";
      results = useFts
        ? await ftsSearchSingleType(t, tsQuery, limit)
        : await ilikeSearchSingleType(t, searchTerm, limit);
    } else {
      results = await searchAllTypes(query.q, searchTerm, limit);
    }

    const data = SearchResponse.parse({
      results: results.map(({ rank: _rank, ...r }) => r),
      total: results.length,
    });

    apiCache.set(cacheKey, data, CACHE_TTL.SEARCH);
    res.json(data);
}));

export default router;
