import { Router, type IRouter, type Request, type Response } from "express";
import { db, newsItemsTable, advisoriesTable, threatIntelTable } from "@workspace/db";
import { sql, ilike, or, and } from "drizzle-orm";

import { SearchQueryParams, SearchResponse } from "@workspace/api-zod";
import { asyncHandler, ValidationError } from "../middlewares/errorHandler";
import { apiCache, CACHE_TTL } from "../lib/cache";
import { displayableAdvisorySql } from "../lib/advisoryLinks";
import { displayableThreatSql } from "../lib/threatLinks";
import { logger } from "../lib/logger";

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 200;
const FTS_MIN_LENGTH = 3;
const FTS_TIMEOUT_MS = 2500;

const router: IRouter = Router();

interface SearchResultItem {
  id: number;
  title: string;
  summary: string;
  type: string;
  severity: string;
  source: string;
  publishedAt: string;
  scope?: string;
  rank?: number;
}

function isStatementTimeoutError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return /statement timeout|canceling statement/i.test(String(error));
  }

  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = "message" in error ? String((error as { message?: unknown }).message) : String(error);
  return code === "57014" || /statement timeout|canceling statement/i.test(message);
}

async function executeWithStatementTimeout<T extends Record<string, unknown>>(
  query: ReturnType<typeof sql>,
  timeoutMs: number = FTS_TIMEOUT_MS,
): Promise<{ rows: T[] }> {
  const transactionalDb = db as typeof db & {
    transaction?: <R>(cb: (tx: { execute: typeof db.execute }) => Promise<R>) => Promise<R>;
  };

  if (typeof transactionalDb.transaction !== "function") {
    return db.execute(query) as Promise<{ rows: T[] }>;
  }

  return transactionalDb.transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL statement_timeout = '${timeoutMs}ms'`));
    return tx.execute(query) as Promise<{ rows: T[] }>;
  });
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
    const result = await executeWithStatementTimeout<{
      id: number; title: string; summary: string; type: string;
      severity: string; source: string; scope: string; published_at: Date; rank: number;
    }>(sql`
      SELECT id, title, summary, type, severity, source, scope, published_at,
        ts_rank(
          setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(summary, '')), 'B'),
          to_tsquery('english', ${tsQuery})
        ) AS rank
      FROM news_items
      WHERE (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(summary, '')), 'B')
      ) @@ to_tsquery('english', ${tsQuery})
      ORDER BY rank DESC, published_at DESC
      LIMIT ${limit}
    `);
    return result.rows.map((r) => ({
      id: r.id, title: r.title, summary: r.summary, type: r.type,
      severity: r.severity, source: r.source, scope: r.scope,
      publishedAt: new Date(r.published_at).toISOString(), rank: r.rank,
    }));
  }

  if (type === "threat") {
    const result = await executeWithStatementTimeout<{
      id: number; title: string; summary: string;
      severity: string; source: string; source_url: string | null; published_at: Date; rank: number;
    }>(sql`
      SELECT id, title, summary, severity, source, source_url, published_at,
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
        AND source IS NOT NULL
        AND btrim(source) <> ''
        AND source_url IS NOT NULL
        AND btrim(source_url) <> ''
      ORDER BY rank DESC, published_at DESC
      LIMIT ${limit}
    `);
    return result.rows
      .filter((r) => Boolean(r.source?.trim() && r.source_url))
      .map((r) => ({
        id: r.id, title: r.title, summary: r.summary, type: "threat",
        severity: r.severity, source: r.source,
        publishedAt: new Date(r.published_at).toISOString(), rank: r.rank,
      }));
  }

  // advisory
  const result = await executeWithStatementTimeout<{
    id: number; title: string; description: string;
    severity: string; vendor: string; source: string | null; source_url: string | null; published_at: Date; rank: number;
  }>(sql`
    SELECT id, title, description, severity, vendor, source, source_url, published_at,
      ts_rank(
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(cve_id, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(vendor, '')), 'B'),
        to_tsquery('english', ${tsQuery})
      ) AS rank
    FROM advisories
    WHERE (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(cve_id, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(vendor, '')), 'B')
    ) @@ to_tsquery('english', ${tsQuery})
      AND source IS NOT NULL
      AND btrim(source) <> ''
      AND source_url IS NOT NULL
      AND btrim(source_url) <> ''
    ORDER BY rank DESC, published_at DESC
    LIMIT ${limit}
  `);
  return result.rows
    .filter((r) => Boolean(r.source?.trim() && r.source_url))
    .map((r) => ({
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
        scope: newsItemsTable.scope,
        publishedAt: newsItemsTable.publishedAt,
      })
      .from(newsItemsTable)
      .where(or(
        ilike(newsItemsTable.title, searchTerm),
        ilike(newsItemsTable.summary, searchTerm),
        ilike(newsItemsTable.source, searchTerm),
      ))
      .orderBy(sql`${newsItemsTable.publishedAt} DESC`)
      .limit(limit);

    return rows.map((item) => ({
      id: item.id, title: item.title, summary: item.summary,
      type: item.type, severity: item.severity, source: item.source,
      scope: item.scope,
      publishedAt: item.publishedAt.toISOString(),
    }));
  }

  if (type === "threat") {
    const rows = await db
      .select({
        id: threatIntelTable.id, title: threatIntelTable.title,
        summary: threatIntelTable.summary, severity: threatIntelTable.severity,
        source: threatIntelTable.source,
        sourceUrl: threatIntelTable.sourceUrl,
        publishedAt: threatIntelTable.publishedAt,
      })
      .from(threatIntelTable)
      .where(and(
        displayableThreatSql,
        or(
          ilike(threatIntelTable.title, searchTerm),
          ilike(threatIntelTable.summary, searchTerm),
          ilike(threatIntelTable.description, searchTerm),
        ),
      ))
      .orderBy(sql`${threatIntelTable.publishedAt} DESC`)
      .limit(limit);

    return rows
      .filter((item) => Boolean(item.source?.trim() && item.sourceUrl))
      .map((item) => ({
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
      vendor: advisoriesTable.vendor,
      source: advisoriesTable.source,
      sourceUrl: advisoriesTable.sourceUrl,
      publishedAt: advisoriesTable.publishedAt,
    })
    .from(advisoriesTable)
    .where(and(
      displayableAdvisorySql,
      or(
        ilike(advisoriesTable.title, searchTerm),
        ilike(advisoriesTable.cveId, searchTerm),
        ilike(advisoriesTable.vendor, searchTerm),
      ),
    ))
    .orderBy(sql`${advisoriesTable.publishedAt} DESC`)
    .limit(limit);

  return rows
    .filter((item) => Boolean(item.source?.trim() && item.sourceUrl))
    .map((item) => ({
      id: item.id, title: item.title, summary: item.description,
      type: "advisory", severity: item.severity, source: item.vendor,
      publishedAt: item.publishedAt.toISOString(),
    }));
}

async function searchSingleType(
  type: "news" | "threat" | "advisory",
  rawQuery: string,
  searchTerm: string,
  limit: number,
): Promise<SearchResultItem[]> {
  const tsQuery = rawQuery.length >= FTS_MIN_LENGTH ? toTsQuery(rawQuery) : "";
  const useFts = tsQuery.length > 0;

  if (!useFts) {
    return ilikeSearchSingleType(type, searchTerm, limit);
  }

  try {
    const results = await ftsSearchSingleType(type, tsQuery, limit);
    if (results.length > 0) {
      return results;
    }
  } catch (error) {
    if (!isStatementTimeoutError(error)) {
      // Full-text search is an optimization. If it fails, keep the endpoint usable
      // by falling back to the cheaper ILIKE search path instead of returning 500.
    }
  }

  return ilikeSearchSingleType(type, searchTerm, limit);
}

/** Deduplicate results by normalized title within each type.
 *  After DB cleanup + ON CONFLICT guards, exact-title dupes shouldn't appear,
 *  but this protects against near-identical entries that slipped through. */
function deduplicateResults(items: SearchResultItem[]): SearchResultItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.type}:${item.title.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchAllTypes(
  rawQuery: string,
  searchTerm: string,
  limit: number,
): Promise<SearchResultItem[]> {
  // Fetch 2× per type so the merge/rank step has enough candidates after dedup
  const typeLimit = limit * 2;
  const [newsResults, threatResults, advisoryResults] = await Promise.all([
    searchSingleType("news", rawQuery, searchTerm, typeLimit),
    searchSingleType("threat", rawQuery, searchTerm, typeLimit),
    searchSingleType("advisory", rawQuery, searchTerm, typeLimit),
  ]);

  const combined = [...newsResults, ...threatResults, ...advisoryResults];
  combined.sort((a, b) => {
    const rankDiff = (b.rank ?? 0) - (a.rank ?? 0);
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
  return combined.slice(0, limit);
}

router.get("/search", asyncHandler(async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const query = SearchQueryParams.parse(req.query);

    const cacheKey = `search:${query.q}:${query.type ?? ""}:${query.limit ?? 20}`;
    const cached = apiCache.get<object>(cacheKey);
    if (cached) {
      logger.debug({ query: query.q, type: query.type ?? "all", durationMs: Date.now() - startedAt }, "search cache hit");
      res.json(cached);
      return;
    }
    if (query.q.length < MIN_SEARCH_LENGTH || query.q.length > MAX_SEARCH_LENGTH) {
      throw new ValidationError(`Search query must be between ${MIN_SEARCH_LENGTH} and ${MAX_SEARCH_LENGTH} characters`);
    }

    const limit = Math.min(query.limit ?? 20, 100);
    // Sanitize LIKE wildcards for ILIKE fallback
    const sanitized = query.q.replace(/[%_\\]/g, "\\$&");
    const searchTerm = `%${sanitized}%`;

    let results: SearchResultItem[];
    if (query.type) {
      const t = query.type as "news" | "threat" | "advisory";
      // Fetch extra to absorb dedup losses within a single type
      results = await searchSingleType(t, query.q, searchTerm, limit * 2);
    } else {
      results = await searchAllTypes(query.q, searchTerm, limit);
    }

    const deduped = deduplicateResults(results).slice(0, limit);
    const data = SearchResponse.parse({
      results: deduped.map(({ rank: _rank, ...r }) => r),
      total: deduped.length,
    });

    apiCache.set(cacheKey, data, CACHE_TTL.SEARCH);
    const durationMs = Date.now() - startedAt;
    if (durationMs > 500) {
      logger.info({ query: query.q, type: query.type ?? "all", durationMs, resultCount: deduped.length }, "search served");
    } else {
      logger.debug({ query: query.q, type: query.type ?? "all", durationMs, resultCount: deduped.length }, "search served");
    }
    res.json(data);
}));

export default router;
