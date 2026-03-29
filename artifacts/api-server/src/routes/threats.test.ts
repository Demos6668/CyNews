import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const sampleThreat = {
  id: 1,
  title: "APT29 Phishing Campaign",
  summary: "Sophisticated phishing targeting government agencies.",
  description: "Full description of the APT29 campaign.",
  scope: "global" as const,
  isIndiaRelated: false,
  indiaConfidence: 0,
  indianState: null,
  indianStateName: null,
  indianCity: null,
  indianSector: null,
  severity: "critical" as const,
  category: "apt",
  threatActor: "APT29",
  threatActorAliases: ["Cozy Bear", "The Dukes"],
  targetSectors: ["Government", "Defense"],
  targetRegions: ["North America", "Europe"],
  ttps: ["T1566.001", "T1059.001"],
  iocs: ["malicious-domain.com", "192.168.1.100"],
  malwareFamilies: ["WellMess"],
  affectedSystems: ["Windows Server 2019"],
  mitigations: ["Enable MFA", "Update email filters"],
  source: "CISA",
  sourceUrl: "https://cisa.gov/advisory/apt29",
  references: ["https://attack.mitre.org/groups/G0016/"],
  campaignName: "SolarWinds",
  status: "active" as const,
  confidenceLevel: "confirmed" as const,
  firstSeen: new Date("2024-01-01T00:00:00Z"),
  lastSeen: new Date("2024-06-14T00:00:00Z"),
  publishedAt: new Date("2024-06-14T10:00:00Z"),
  updatedAt: new Date("2024-06-14T10:00:00Z"),
};

const countRow = (n: number) => [{ count: n }];

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const { threatIntelTable } = actual;
  const p = <T>(v: T) => Promise.resolve(v);

  // Helper: a promise that also exposes drizzle-like chained methods
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
          if (table === threatIntelTable) {
            const hasCount =
              cols && typeof cols === "object" && "count" in cols;
            if (hasCount) {
              return chainable(countRow(1));
            }
            return chainable([sampleThreat]);
          }
          return chainable(countRow(0));
        },
      }),
    },
  };
});

import app from "../app";

describe("Threats routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/threats", () => {
    it("returns paginated list with items, total, page, limit, totalPages", async () => {
      const res = await request(app)
        .get("/api/threats")
        .expect(200);

      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("page");
      expect(res.body).toHaveProperty("limit");
      expect(res.body).toHaveProperty("totalPages");
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThan(0);
    });

    it("each item has expected threat fields", async () => {
      const res = await request(app)
        .get("/api/threats")
        .expect(200);

      const item = res.body.items[0];
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("title");
      expect(item).toHaveProperty("summary");
      expect(item).toHaveProperty("severity");
      expect(item).toHaveProperty("category");
      expect(item).toHaveProperty("source");
      expect(item).toHaveProperty("status");
      expect(item).toHaveProperty("publishedAt");
      expect(item).toHaveProperty("ttps");
      expect(item).toHaveProperty("iocs");
    });

    it("accepts severity filter", async () => {
      const res = await request(app)
        .get("/api/threats?severity=critical")
        .expect(200);

      expect(res.body).toHaveProperty("items");
    });

    it("accepts timeframe filter", async () => {
      const res = await request(app)
        .get("/api/threats?timeframe=7d")
        .expect(200);

      expect(res.body).toHaveProperty("items");
    });
  });

  describe("GET /api/threats/:id", () => {
    it("returns a single threat by numeric ID", async () => {
      const res = await request(app)
        .get("/api/threats/1")
        .expect(200);

      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("title");
      expect(res.body).toHaveProperty("summary");
      expect(res.body).toHaveProperty("severity");
      expect(res.body).toHaveProperty("publishedAt");
      expect(res.body).toHaveProperty("ttps");
      expect(res.body).toHaveProperty("iocs");
    });

    it("returns 400 for non-numeric ID", async () => {
      const res = await request(app)
        .get("/api/threats/abc")
        .expect(400);

      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /api/threats/export", () => {
    it("returns CSV with correct headers when format=csv", async () => {
      const res = await request(app)
        .get("/api/threats/export?format=csv")
        .expect(200)
        .expect("Content-Type", /text\/csv/);

      expect(res.headers["content-disposition"]).toMatch(/attachment.*threats-export\.csv/);
      expect(res.text).toContain("ID,Title,Summary,Severity");
      expect(res.text).toContain("APT29 Phishing Campaign");
    });

    it("returns JSON array when format=json", async () => {
      const res = await request(app)
        .get("/api/threats/export?format=json")
        .expect(200)
        .expect("Content-Type", /application\/json/);

      expect(res.headers["content-disposition"]).toMatch(/attachment.*threats-export\.json/);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("title");
      expect(res.body[0]).toHaveProperty("severity");
    });

    it("defaults to CSV when no format is specified", async () => {
      const res = await request(app)
        .get("/api/threats/export")
        .expect(200)
        .expect("Content-Type", /text\/csv/);

      expect(res.text).toContain("ID,Title");
    });

    it("accepts scope filter for export", async () => {
      const res = await request(app)
        .get("/api/threats/export?format=json&scope=global")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
