import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const { newsItemsTable, threatIntelTable, advisoriesTable } = actual;
  const p = <T>(v: T) => Promise.resolve(v);

  const selectChain = (items: unknown[]) => ({
    where: () => ({
      orderBy: () => ({
        limit: () => p(items),
      }),
    }),
    orderBy: () => ({
      limit: () => p(items),
    }),
  });

  // FTS result rows (snake_case matching raw SQL column names)
  const ftsRows = [
    [{
      id: 1, title: "Cyber Attack on Infrastructure", summary: "A major attack was reported.",
      type: "news", severity: "high", source: "CyberWire",
      published_at: new Date("2024-06-14T10:00:00Z"), rank: 0.5,
    }],
    [{
      id: 2, title: "APT29 Campaign Detected", summary: "New campaign targeting government.",
      severity: "critical", source: "CISA",
      published_at: new Date("2024-06-14T09:00:00Z"), rank: 0.4,
    }],
    [{
      id: 3, title: "CVE-2024-5678 Buffer Overflow", description: "A critical buffer overflow vulnerability.",
      severity: "critical", vendor: "TestVendor",
      published_at: new Date("2024-06-14T08:00:00Z"), rank: 0.3,
    }],
  ];
  let executeIdx = 0;

  return {
    ...actual,
    db: {
      select: (cols?: unknown) => ({
        from: (table: unknown) => {
          if (table === newsItemsTable) {
            return selectChain([{
              id: 1, title: "Cyber Attack on Infrastructure", summary: "A major attack was reported.",
              type: "news", severity: "high", source: "CyberWire",
              publishedAt: new Date("2024-06-14T10:00:00Z"), content: "Full content.",
            }]);
          }
          if (table === threatIntelTable) {
            return selectChain([{
              id: 2, title: "APT29 Campaign Detected", summary: "New campaign targeting government.",
              severity: "critical", source: "CISA",
              publishedAt: new Date("2024-06-14T09:00:00Z"),
            }]);
          }
          if (table === advisoriesTable) {
            return selectChain([{
              id: 3, title: "CVE-2024-5678 Buffer Overflow", description: "A critical buffer overflow vulnerability.",
              severity: "critical", vendor: "TestVendor", cveId: "CVE-2024-5678",
              publishedAt: new Date("2024-06-14T08:00:00Z"),
            }]);
          }
          return selectChain([]);
        },
      }),
      execute: vi.fn(() => {
        const rows = ftsRows[executeIdx % ftsRows.length];
        executeIdx++;
        return p({ rows });
      }),
    },
  };
});

import app from "../app";

describe("Search routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/search", () => {
    it("returns results when q param is provided", async () => {
      const res = await request(app)
        .get("/api/search?q=test")
        .expect(200);

      expect(res.body).toHaveProperty("results");
      expect(res.body).toHaveProperty("total");
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBeGreaterThan(0);

      const result = res.body.results[0];
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("severity");
      expect(result).toHaveProperty("source");
      expect(result).toHaveProperty("publishedAt");
    });

    it("returns 200 with empty-like results when q is missing (coerced to string)", async () => {
      // SearchQueryParams uses z.coerce.string() which coerces undefined to "undefined"
      // so the route doesn't reject missing q — it treats it as a search term
      const res = await request(app)
        .get("/api/search")
        .expect(200);

      expect(res.body).toHaveProperty("results");
      expect(res.body).toHaveProperty("total");
    });

    it("filters by type=news and only returns news items", async () => {
      const res = await request(app)
        .get("/api/search?q=attack&type=news")
        .expect(200);

      expect(res.body.results.length).toBeGreaterThan(0);
      for (const item of res.body.results) {
        expect(item.type).toBe("news");
      }
    });

    it("filters by type=threat and only returns threat items", async () => {
      const res = await request(app)
        .get("/api/search?q=campaign&type=threat")
        .expect(200);

      expect(res.body.results.length).toBeGreaterThan(0);
      for (const item of res.body.results) {
        expect(item.type).toBe("threat");
      }
    });

    it("filters by type=advisory and only returns advisory items", async () => {
      const res = await request(app)
        .get("/api/search?q=overflow&type=advisory")
        .expect(200);

      expect(res.body.results.length).toBeGreaterThan(0);
      for (const item of res.body.results) {
        expect(item.type).toBe("advisory");
      }
    });

    it("returns all types when no type filter is specified", async () => {
      const res = await request(app)
        .get("/api/search?q=test")
        .expect(200);

      const types = new Set(res.body.results.map((r: { type: string }) => r.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it("results are sorted by publishedAt descending", async () => {
      const res = await request(app)
        .get("/api/search?q=test")
        .expect(200);

      const dates = res.body.results.map((r: { publishedAt: string }) =>
        new Date(r.publishedAt).getTime()
      );

      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });
  });
});
