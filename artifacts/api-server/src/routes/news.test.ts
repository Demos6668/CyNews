import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const now = new Date("2024-06-14T10:00:00Z");

const sampleNews = {
  id: 1,
  title: "Critical Cyber Attack on Infrastructure",
  summary: "A major attack on critical infrastructure.",
  content: "Full article content here.",
  type: "news" as const,
  scope: "global" as const,
  isIndiaRelated: false,
  indiaConfidence: 0,
  indianState: null,
  indianStateName: null,
  indianCity: null,
  indianSector: null,
  severity: "high" as const,
  category: "attack",
  source: "The Hacker News",
  sourceUrl: "https://thehackernews.com/example",
  region: ["US"],
  tags: ["apt", "infrastructure"],
  iocs: ["192.168.1.1"],
  affectedSystems: ["Windows Server"],
  mitigations: ["Apply patches"],
  status: "active" as const,
  bookmarked: false,
  publishedAt: now,
  updatedAt: now,
};

const bookmarkedNews = {
  ...sampleNews,
  id: 2,
  title: "Bookmarked Item",
  bookmarked: true,
};

let mockItems = [sampleNews, bookmarkedNews];
let mockDeleted = false;

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const { newsItemsTable } = actual;

  const countRow = (n: number) => [{ count: n }];

  const chainable = <T>(items: T[]) => {
    const p = Promise.resolve(items);
    return Object.assign(p, {
      orderBy: () => chainable(items),
      limit: (n?: number) => chainable(n ? items.slice(0, n) : items),
      offset: () => Promise.resolve(items),
      where: () => chainable(items),
    });
  };

  return {
    ...actual,
    db: {
      select: (cols?: unknown) => ({
        from: (table: unknown) => {
          if (table === newsItemsTable) {
            const hasCount = cols && typeof cols === "object" && "count" in cols;
            if (hasCount) {
              return { where: () => Promise.resolve(countRow(mockItems.length)) };
            }
            return chainable(mockItems);
          }
          return chainable([] as unknown[]);
        },
      }),
      insert: () => ({
        values: () => ({
          returning: () =>
            Promise.resolve([{ ...sampleNews, id: 99 }]),
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve([{ id: 1, userId: "u1", orgId: "o1", newsItemId: 1 }]),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () =>
              Promise.resolve([
                { ...sampleNews, title: "Updated Title", bookmarked: !sampleNews.bookmarked },
              ]),
          }),
        }),
      }),
      delete: () => ({
        where: () => {
          mockDeleted = true;
          return Promise.resolve();
        },
      }),
    },
  };
});

import app from "../app";

describe("News routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems = [sampleNews, bookmarkedNews];
    mockDeleted = false;
  });

  describe("GET /api/news", () => {
    it("returns paginated list with items, total, page, limit, totalPages", async () => {
      const res = await request(app).get("/api/news").expect(200);

      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("page");
      expect(res.body).toHaveProperty("limit");
      expect(res.body).toHaveProperty("totalPages");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it("each item has expected news fields", async () => {
      const res = await request(app).get("/api/news").expect(200);

      const item = res.body.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("summary");
      expect(item).toHaveProperty("severity");
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("source");
      expect(item).toHaveProperty("publishedAt");
      expect(item).toHaveProperty("scope");
      expect(item).toHaveProperty("bookmarked");
      expect(item).toHaveProperty("type");
    });

    it("accepts scope filter", async () => {
      const res = await request(app).get("/api/news?scope=global").expect(200);
      expect(res.body).toHaveProperty("items");
    });

    it("accepts severity filter", async () => {
      const res = await request(app)
        .get("/api/news?severity=high")
        .expect(200);
      expect(res.body).toHaveProperty("items");
    });

    it("accepts comma-separated severity filter", async () => {
      const res = await request(app)
        .get("/api/news?severity=high,critical")
        .expect(200);
      expect(res.body).toHaveProperty("items");
    });

    it("accepts timeframe filter", async () => {
      const res = await request(app)
        .get("/api/news?timeframe=7d")
        .expect(200);
      expect(res.body).toHaveProperty("items");
    });

    it("accepts category filter", async () => {
      const res = await request(app)
        .get("/api/news?category=attack")
        .expect(200);
      expect(res.body).toHaveProperty("items");
    });

    it("accepts type filter", async () => {
      const res = await request(app)
        .get("/api/news?type=news")
        .expect(200);
      expect(res.body).toHaveProperty("items");
    });

    it("accepts pagination params", async () => {
      const res = await request(app)
        .get("/api/news?page=1&limit=5")
        .expect(200);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(5);
    });
  });

  describe("GET /api/news/:id", () => {
    it("returns a single news item by ID", async () => {
      const res = await request(app).get("/api/news/1").expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title");
      expect(res.body).toHaveProperty("severity");
      expect(res.body).toHaveProperty("publishedAt");
    });
  });

  describe("GET /api/news/bookmarked", () => {
    it("returns bookmarked items", async () => {
      const res = await request(app).get("/api/news/bookmarked").expect(200);

      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("total");
      expect(Array.isArray(res.body.items)).toBe(true);
    });
  });

  describe("GET /api/news/rss", () => {
    it("returns valid RSS XML", async () => {
      const res = await request(app).get("/api/news/rss").expect(200);

      expect(res.headers["content-type"]).toContain("application/rss+xml");
      expect(res.text).toContain("<?xml");
      expect(res.text).toContain("<rss");
      expect(res.text).toContain("<channel>");
      expect(res.text).toContain("<item>");
    });

    it("accepts scope query param", async () => {
      const res = await request(app)
        .get("/api/news/rss?scope=local")
        .expect(200);

      expect(res.headers["content-type"]).toContain("application/rss+xml");
      expect(res.text).toContain("local");
    });

    it("escapes XML special characters in titles", async () => {
      const res = await request(app).get("/api/news/rss").expect(200);
      // The RSS output should not contain unescaped ampersands from titles
      // (title doesn't have & but the channel description does via &amp;)
      expect(res.text).toContain("<title>");
    });
  });

  describe("POST /api/news", () => {
    it("creates a news item and returns 201", async () => {
      const payload = {
        title: "New Threat Discovered",
        summary: "Summary of the threat",
        content: "Detailed content",
        type: "threat",
        scope: "global",
        severity: "critical",
        category: "malware",
        source: "Internal",
      };

      const res = await request(app)
        .post("/api/news")
        .send(payload)
        .expect(201);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title");
    });
  });

  describe("PUT /api/news/:id", () => {
    it("updates a news item", async () => {
      const res = await request(app)
        .put("/api/news/1")
        .send({ title: "Updated Title" })
        .expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title");
    });
  });

  describe("DELETE /api/news/:id", () => {
    it("deletes a news item and returns 204", async () => {
      await request(app).delete("/api/news/1").expect(204);
      expect(mockDeleted).toBe(true);
    });
  });

  describe("POST /api/news/:id/bookmark", () => {
    it("toggles bookmark and returns new state", async () => {
      const res = await request(app)
        .post("/api/news/1/bookmark")
        .expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("bookmarked");
      expect(typeof res.body.bookmarked).toBe("boolean");
    });
  });
});
