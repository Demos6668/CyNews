export type TimeframeValue = "1h" | "6h" | "24h" | "7d" | "30d" | "90d" | "all";

/**
 * Compute the start date for a given timeframe.
 * Returns null for "all" (no date filter).
 */
export function getTimeframeStartDate(timeframe: TimeframeValue): Date | null {
  const now = new Date();
  switch (timeframe) {
    case "1h":
      return new Date(now.getTime() - 60 * 60 * 1000);
    case "6h":
      return new Date(now.getTime() - 6 * 60 * 60 * 1000);
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000); // default 24h
  }
}
