import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";

export interface FilterParams {
  severities: string[];
  categories: string[];
  statuses?: string[];
  vendors?: string[];
  dateFrom?: string;
  dateTo?: string;
  timeframe?: string;
  scope?: string;
  page?: number;
  limit?: number;
}

const DEFAULT_TIMEFRAME = "24h";

const DEFAULT_LIMIT = 20;

function parseSearchParams(searchString: string): FilterParams {
  const params = new URLSearchParams(searchString);
  const pageParam = params.get("page");
  const limitParam = params.get("limit");
  return {
    severities: params.get("severity")?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) ?? [],
    categories: params.get("category")?.split(",").map((c) => c.trim()).filter(Boolean) ?? [],
    statuses: params.get("status")?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean) ?? [],
    vendors: params.get("vendor")?.split(",").map((v) => v.trim()).filter(Boolean) ?? [],
    dateFrom: params.get("dateFrom") ?? undefined,
    dateTo: params.get("dateTo") ?? undefined,
    timeframe: params.get("timeframe") ?? undefined,
    scope: params.get("scope") ?? undefined,
    page: pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : undefined,
    limit: limitParam ? Math.max(1, Math.min(96, parseInt(limitParam, 10) || DEFAULT_LIMIT)) : undefined,
  };
}

function buildSearchParams(filters: Partial<FilterParams>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.severities?.length) params.set("severity", filters.severities.join(","));
  if (filters.categories?.length) params.set("category", filters.categories.join(","));
  if (filters.statuses?.length) params.set("status", filters.statuses.join(","));
  if (filters.vendors?.length) params.set("vendor", filters.vendors.join(","));
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.timeframe && filters.timeframe !== DEFAULT_TIMEFRAME) params.set("timeframe", filters.timeframe);
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.limit && filters.limit !== DEFAULT_LIMIT) params.set("limit", String(filters.limit));
  return params;
}

/**
 * Sync filter state to URL when filters change.
 * Only runs when current path matches basePath.
 * Uses replace to avoid polluting history.
 * Skips the first run to allow initial URL→state hydration to complete.
 */
export function useFilterParamsSync(
  basePath: string,
  filters: Partial<FilterParams>,
  options?: { skipInitialSync?: boolean }
) {
  const [location, setLocation] = useLocation();
  const currentPath = location.split("?")[0];
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (currentPath !== basePath) return;
    if (options?.skipInitialSync && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      return;
    }
    const params = buildSearchParams(filters);
    const query = params.toString();
    const newPath = query ? `${basePath}?${query}` : basePath;
    const [curBase, curQuery] = location.split("?");
    const curPath = curQuery ? `${curBase}?${curQuery}` : curBase;
    if (curPath !== newPath) {
      setLocation(newPath, { replace: true });
    }
  }, [
    basePath,
    currentPath,
    location,
    filters.severities?.join(","),
    filters.categories?.join(","),
    filters.statuses?.join(","),
    filters.vendors?.join(","),
    filters.dateFrom,
    filters.dateTo,
    filters.timeframe,
    filters.scope,
    filters.page,
    filters.limit,
    setLocation,
  ]);
}

/**
 * Parse filter params from current URL.
 */
export function useFilterParamsFromUrl(): FilterParams {
  const searchString = useSearch();
  return parseSearchParams(searchString);
}

/**
 * Get initial filter state from URL. Use on mount to hydrate state from shareable link.
 */
export function getInitialFiltersFromUrl(searchString: string): FilterParams {
  return parseSearchParams(searchString);
}
