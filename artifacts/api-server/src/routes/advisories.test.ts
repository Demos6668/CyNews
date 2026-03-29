import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const sampleAdvisory = {
  id: 1,
  cveId: "CVE-2024-1234",
  title: "Critical RCE Vulnerability",
  description: "Remote code execution in affected products.",
  cvssScore: 9.8,
  severity: "critical" as const,
  affectedProducts: ["Product A", "Product B"],
  vendor: "TestVendor",
  patchAvailable: true,
  patchUrl: "https://example.com/patch",
  workarounds: ["Disable feature X"],
  references: ["https://nvd.nist.gov/vuln/detail/CVE-2024-1234"],
  status: "new" as const,
  publishedAt: new Date("2024-06-14T10:00:00Z"),
  scope: "global" as const,
  isIndiaRelated: false,
  indiaConfidence: 0,
  sourceUrl: "https://example.com/advisory",
  source: "NVD",
  summary: "A critical vulnerability.",
  content: "Full advisory content.",
  category: "vulnerability",
  isCertIn: false,
  certInId: null,
  certInType: null,
  cveIds: ["CVE-2024-1234"],
  recommendations: ["Apply patch immediately"],
};

const certInAdvisory = {
  ...sampleAdvisory,
  id: 2,
  isCertIn: true,
  certInId: "CIAD-2024-0001",
  certInType: "vulnerability",
  source: "CERT-In",
};

const countRow = (n: number) => [{ count: n }];

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const { advisoriesTable } = actual;
  const p = <T>(v: T) => Promise.resolve(v);

  // Helper: a promise that also has chained drizzle methods
  const chainable = <T>(items: T[]) => {
    const promise = p(items);
    return Object.assign(promise, {
      orderBy: () => chainable(items),
      limit: (n?: number) => chainable(n === 1 ? items.slice(0, 1) : items),
      offset: () => p(items),
      where: () => chainable(items),
    });
  };

  return {
    ...actual,
    db: {
      select: (cols?: unknown) => ({
        from: (table: unknown) => {
          if (table === advisoriesTable) {
            const hasCount =
              cols && typeof cols === "object" && "count" in cols;
            if (hasCount) {
              return {
                where: () => p(countRow(2)),
              };
            }
            return chainable([sampleAdvisory, certInAdvisory]);
          }
          return {
            where: () => p(countRow(0)),
          };
        },
      }),
    },
  };
});

import app from "../app";

describe("Advisories routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/advisories", () => {
    it("returns paginated list with items, total, page, limit, totalPages", async () => {
      const res = await request(app)
        .get("/api/advisories")
        .expect(200);

      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("page");
      expect(res.body).toHaveProperty("limit");
      expect(res.body).toHaveProperty("totalPages");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it("each item has expected advisory fields", async () => {
      const res = await request(app)
        .get("/api/advisories")
        .expect(200);

      const item = res.body.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("cveId");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("severity");
      expect(item).toHaveProperty("vendor");
      expect(item).toHaveProperty("publishedAt");
      expect(item).toHaveProperty("scope");
    });

    it("accepts severity filter", async () => {
      const res = await request(app)
        .get("/api/advisories?severity=critical")
        .expect(200);

      expect(res.body).toHaveProperty("items");
    });

    it("accepts timeframe filter", async () => {
      const res = await request(app)
        .get("/api/advisories?timeframe=7d")
        .expect(200);

      expect(res.body).toHaveProperty("items");
    });
  });

  describe("GET /api/advisories/:id (numeric)", () => {
    it("returns a single advisory for a numeric ID", async () => {
      const res = await request(app)
        .get("/api/advisories/1")
        .expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("cveId");
      expect(res.body).toHaveProperty("title");
      expect(res.body).toHaveProperty("severity");
      expect(res.body).toHaveProperty("publishedAt");
    });
  });

  describe("GET /api/advisories/:id (certInId string)", () => {
    it("returns a single advisory when queried by certInId", async () => {
      const res = await request(app)
        .get("/api/advisories/CIAD-2024-0001")
        .expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title");
      expect(res.body).toHaveProperty("publishedAt");
    });
  });

  describe("GET /api/advisories/cert-in", () => {
    it("returns CERT-In filtered list with pagination metadata", async () => {
      const res = await request(app)
        .get("/api/advisories/cert-in")
        .expect(200);

      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("pagination");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty("page");
      expect(res.body.pagination).toHaveProperty("limit");
      expect(res.body.pagination).toHaveProperty("total");
      expect(res.body.pagination).toHaveProperty("totalPages");
      expect(res.body.pagination).toHaveProperty("totalCritical");
      expect(res.body.pagination).toHaveProperty("totalHigh");
    });

    it("accepts severity filter for cert-in", async () => {
      const res = await request(app)
        .get("/api/advisories/cert-in?severity=critical")
        .expect(200);

      expect(res.body).toHaveProperty("data");
    });

    it("accepts timeframe filter for cert-in", async () => {
      const res = await request(app)
        .get("/api/advisories/cert-in?timeframe=7d")
        .expect(200);

      expect(res.body).toHaveProperty("data");
    });
  });
});
