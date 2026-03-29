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
