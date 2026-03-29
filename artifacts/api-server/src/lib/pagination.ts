import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Parse comma-separated filter values into an array */
export function parseMultiFilter<T extends string>(value: string | undefined): T[] {
  if (!value) return [];
  return value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) as T[];
}

/** Execute a paginated query with count */
export async function paginatedQuery<TTable extends PgTable>(
  table: TTable,
  options: {
    where?: SQL;
    orderBy: PgColumn;
    page: number;
    limit: number;
  },
): Promise<{ rows: (TTable["$inferSelect"])[]; total: number; page: number; limit: number; totalPages: number }> {
  const offset = (options.page - 1) * options.limit;

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(table).where(options.where),
    db.select().from(table).where(options.where)
      .orderBy(sql`${options.orderBy} DESC`)
      .limit(options.limit)
      .offset(offset),
  ]);

  const total = (countResult[0] as { count: number })?.count ?? 0;
  return {
    rows: rows as (TTable["$inferSelect"])[],
    total,
    page: options.page,
    limit: options.limit,
    totalPages: Math.ceil(total / options.limit),
  };
}
