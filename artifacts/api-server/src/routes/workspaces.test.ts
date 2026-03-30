import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const mockWorkspace = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  name: "Test Workspace",
  domain: "example.com",
  description: "A test workspace",
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let mockDbWorkspaces: typeof mockWorkspace[] = [];
let mockDbProducts: { id: string; productName: string; vendor: string | null }[] = [];
let mockFeedItems: unknown[] = [];

vi.mock("../services/workspaceService", () => ({
  ensureMasterWorkspace: vi.fn(),
  createWorkspace: vi.fn().mockImplementation(() => Promise.resolve(mockWorkspace)),
  addProduct: vi.fn().mockResolvedValue({ id: "product-uuid" }),
  matchThreatsToWorkspace: vi.fn().mockResolvedValue([]),
  getWorkspaceFeed: vi.fn().mockImplementation(() =>
    Promise.resolve({ items: mockFeedItems, total: mockFeedItems.length })
  ),
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const { workspacesTable, workspaceProductsTable } = actual;
  const p = <T>(v: T) => Promise.resolve(v);
  return {
    ...actual,
    db: {
      select: (cols?: unknown) => ({
        from: (table: unknown) => {
          if (table === workspacesTable) {
            return {
              where: () => ({
                limit: () => p(mockDbWorkspaces.slice(0, 1)),
              }),
              orderBy: () => p(mockDbWorkspaces),
            };
          }
          if (table === workspaceProductsTable) {
            return {
              where: () => p(mockDbProducts),
              limit: () => p(mockDbProducts.slice(0, 1)),
            };
          }
          return { where: () => p([]), orderBy: () => p([]), limit: () => p([]) };
        },
      }),
      insert: () => ({
        values: () => ({ returning: () => p([mockWorkspace]) }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({ returning: () => p([mockWorkspace]) }),
        }),
      }),
      delete: () => ({
        where: () => p(undefined),
      }),
    },
  };
});

import app from "../app";

describe("Workspace routes", () => {
  beforeEach(() => {
    mockDbWorkspaces = [];
    mockDbProducts = [];
    mockFeedItems = [];
    vi.clearAllMocks();
  });

  describe("GET /api/workspaces", () => {
    it("returns list of workspaces", async () => {
      mockDbWorkspaces = [mockWorkspace as never];
      const res = await request(app).get("/api/workspaces").expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("name", "Test Workspace");
    });
  });

  describe("GET /api/workspaces/:id", () => {
    it("returns 400 for invalid UUID", async () => {
      const res = await request(app)
        .get("/api/workspaces/not-a-uuid")
        .expect(400);
      expect(res.body).toHaveProperty("error", "Validation failed");
    });

    it("returns 404 when workspace not found", async () => {
      mockDbWorkspaces = [];
      const res = await request(app)
        .get(`/api/workspaces/${mockWorkspace.id}`)
        .expect(404);
      expect(res.body).toHaveProperty("error", "Workspace not found");
    });

    it("returns workspace with products when found", async () => {
      mockDbWorkspaces = [mockWorkspace as never];
      mockDbProducts = [{ id: "p1", productName: "Product A", vendor: "Vendor" }];
      const res = await request(app)
        .get(`/api/workspaces/${mockWorkspace.id}`)
        .expect(200);
      expect(res.body).toHaveProperty("id", mockWorkspace.id);
      expect(res.body).toHaveProperty("products");
      expect(res.body.products).toHaveLength(1);
    });
  });

  describe("POST /api/workspaces", () => {
    it("returns 400 when name is missing", async () => {
      await request(app)
        .post("/api/workspaces")
        .send({ domain: "example.com" })
        .expect(400);
    });

    it("returns 400 when domain is missing", async () => {
      await request(app)
        .post("/api/workspaces")
        .send({ name: "Test" })
        .expect(400);
    });

    it("returns 201 when name and domain provided", async () => {
      const res = await request(app)
        .post("/api/workspaces")
        .send({ name: "New Workspace", domain: "new.com" })
        .expect(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body).toHaveProperty("name");
      expect(res.body).toHaveProperty("domain");
    });
  });

  describe("GET /api/workspaces/:id/feed", () => {
    it("returns 400 for invalid UUID", async () => {
      await request(app)
        .get("/api/workspaces/invalid/feed")
        .expect(400);
    });

    it("returns feed when workspace exists", async () => {
      mockFeedItems = [{ id: 1, title: "Threat 1", publishedAt: new Date(), updatedAt: new Date() }];
      const res = await request(app)
        .get(`/api/workspaces/${mockWorkspace.id}/feed`)
        .expect(200);
      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("page");
      expect(res.body).toHaveProperty("limit");
    });
  });

  describe("POST /api/workspaces/:id/match", () => {
    it("returns 400 for invalid UUID", async () => {
      await request(app)
        .post("/api/workspaces/invalid/match")
        .expect(400);
    });

    it("returns matched count", async () => {
      const { matchThreatsToWorkspace } = await import("../services/workspaceService");
      vi.mocked(matchThreatsToWorkspace).mockResolvedValue([{ id: 1 }] as never);
      const res = await request(app)
        .post(`/api/workspaces/${mockWorkspace.id}/match`)
        .expect(200);
      expect(res.body).toHaveProperty("matchedCount", 1);
    });
  });
});
