import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const countRow = (n: number) => [{ count: n }];
const recentNewsItem = {
  id: 1,
  title: "Test News",
  type: "news",
  severity: "high",
  publishedAt: new Date("2024-06-14T10:00:00Z"),
  sourceUrl: "https://example.org/article",
};
const recentThreatItem = {
  id: 2,
  title: "Test Threat",
  severity: "critical",
  publishedAt: new Date("2024-06-14T09:00:00Z"),
  sourceUrl: "https://cisa.gov/advisory",
};

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const { newsItemsTable, threatIntelTable, advisoriesTable } = actual;
  const p = <T>(v: T) => Promise.resolve(v);

  const countChain = (n: number) => ({
    where: () => p(countRow(n)),
    orderBy: () => ({ limit: () => p(countRow(n)) }),
  });
  const arrayChain = (items: unknown[]) => ({
    where: () => ({ orderBy: () => ({ limit: () => p(items) }) }),
    orderBy: () => ({ limit: () => p(items) }),
  });

  return {
    ...actual,
    db: {
      select: (cols: unknown) => ({
        from: (table: unknown) => {
          if (table === newsItemsTable) {
            const hasCount = cols && typeof cols === "object" && "count" in cols;
            return hasCount ? countChain(5) : arrayChain([recentNewsItem]);
          }
          if (table === threatIntelTable) {
            const hasCount = cols && typeof cols === "object" && "count" in cols;
            return hasCount ? countChain(3) : arrayChain([recentThreatItem]);
          }
          if (table === advisoriesTable) {
            return countChain(2);
          }
          return { where: () => p(countRow(0)), orderBy: () => ({ limit: () => p([]) }) };
        },
      }),
    },
  };
});

import app from "../app";

describe("Dashboard routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/dashboard/stats", () => {
    it("returns 200 with stats and recentActivity including sourceUrl and sourceType", async () => {
      const res = await request(app)
        .get("/api/dashboard/stats")
        .expect(200);

      expect(res.body).toHaveProperty("totalThreatsToday", 8);
      expect(res.body).toHaveProperty("activeAdvisories", 2);
      expect(res.body).toHaveProperty("recentActivity");
      expect(Array.isArray(res.body.recentActivity)).toBe(true);

      const activity = res.body.recentActivity;
      expect(activity.length).toBeGreaterThan(0);
      expect(activity[0]).toHaveProperty("sourceUrl");
      expect(activity[0]).toHaveProperty("sourceType");
      expect(activity[0]).toHaveProperty("id");
      expect(activity[0]).toHaveProperty("title");
      expect(activity[0]).toHaveProperty("timestamp");
    });

    it("accepts timeframe query param", async () => {
      const res = await request(app)
        .get("/api/dashboard/stats?timeframe=7d")
        .expect(200);
      expect(res.body).toHaveProperty("totalThreatsToday");
    });
  });
});
