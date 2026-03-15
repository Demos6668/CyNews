import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const mockAdvisory = {
  id: 1,
  cveId: "CVE-2024-1234",
  title: "Test Advisory",
  description: "A test vulnerability.",
  cvssScore: 9.8,
  severity: "critical",
  affectedProducts: ["Product A"],
  vendor: "TestVendor",
  patchAvailable: true,
  patchUrl: "https://example.com/patch",
  workarounds: ["Apply patch"],
  references: ["https://nvd.nist.gov/vuln/detail/CVE-2024-1234"],
  status: "new" as const,
  publishedAt: new Date("2024-01-15"),
  scope: "global" as const,
  isIndiaRelated: false,
  indiaConfidence: 0,
};

let mockSelectResult: typeof mockAdvisory[] = [];

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const p = () => Promise.resolve(mockSelectResult);
  const withLimit = () =>
    Object.assign(p(), { limit: () => p(), offset: () => p() });
  const withOrderBy = () =>
    Object.assign(p(), { orderBy: () => withLimit() });
  const withWhere = () =>
    Object.assign(p(), {
      orderBy: () => withLimit(),
      where: () => withOrderBy(),
    });
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => withOrderBy(),
          orderBy: () => withLimit(),
        }),
      }),
    },
  };
});

import app from "../app";

describe("Export routes", () => {
  beforeEach(() => {
    mockSelectResult = [];
  });

  describe("GET /api/export/advisory/:id", () => {
    it("returns 400 for invalid advisory ID", async () => {
      const res = await request(app)
        .get("/api/export/advisory/abc")
        .expect(400);
      expect(res.body).toHaveProperty("error", "Invalid advisory ID");
    });

    it("returns 400 for zero or negative ID", async () => {
      await request(app).get("/api/export/advisory/0").expect(400);
      await request(app).get("/api/export/advisory/-1").expect(400);
    });

    it("returns 404 when advisory not found", async () => {
      mockSelectResult = [];
      const res = await request(app)
        .get("/api/export/advisory/999")
        .expect(404);
      expect(res.body).toHaveProperty("error", "Advisory not found");
    });

    it("returns HTML with Content-Disposition when advisory exists", async () => {
      mockSelectResult = [mockAdvisory as never];
      const res = await request(app)
        .get("/api/export/advisory/1")
        .expect(200)
        .expect("Content-Type", /text\/html/);

      expect(res.headers["content-disposition"]).toMatch(/attachment.*CVE-2024-1234/);
      expect(res.text).toContain("<!DOCTYPE html>");
      expect(res.text).toContain("CVE-2024-1234");
      expect(res.text).toContain("Test Advisory");
    });
  });

  describe("POST /api/export/advisories/bulk", () => {
    it("returns 400 when neither ids nor timeframe provided", async () => {
      const res = await request(app)
        .post("/api/export/advisories/bulk")
        .send({})
        .expect(400);
      expect(res.body).toHaveProperty("error");
    });

    it("returns 400 when ids array is empty or invalid", async () => {
      const res = await request(app)
        .post("/api/export/advisories/bulk")
        .send({ ids: [] })
        .expect(400);
      expect(res.body).toHaveProperty("error", "No valid advisory IDs provided");
    });

    it("returns 404 when no advisories found", async () => {
      mockSelectResult = [];
      const res = await request(app)
        .post("/api/export/advisories/bulk")
        .send({ ids: [1, 2, 3] })
        .expect(404);
      expect(res.body).toHaveProperty("error", "No advisories found");
    });

    it("returns HTML when advisories found", async () => {
      mockSelectResult = [mockAdvisory as never];
      const res = await request(app)
        .post("/api/export/advisories/bulk")
        .send({ ids: [1] })
        .expect(200)
        .expect("Content-Type", /text\/html/);

      expect(res.headers["content-disposition"]).toMatch(/attachment/);
      expect(res.text).toContain("<!DOCTYPE html>");
      expect(res.text).toContain("CVE-2024-1234");
    });

    it("accepts scope with timeframe for bulk export", async () => {
      mockSelectResult = [mockAdvisory as never];
      const res = await request(app)
        .post("/api/export/advisories/bulk")
        .send({ timeframe: "24h", scope: "local" })
        .expect(200)
        .expect("Content-Type", /text\/html/);

      expect(res.text).toContain("<!DOCTYPE html>");
      expect(res.text).toContain("CVE-2024-1234");
    });
  });
});
