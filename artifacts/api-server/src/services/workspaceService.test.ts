import { describe, it, expect, vi, beforeEach } from "vitest";

// Expose the private pure functions for testing by importing the module
// and testing via the exported functions that use them

const mockInsert = vi.fn();
const mockSelect = vi.fn();

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const p = <T>(v: T) => Promise.resolve(v);

  // Make chainable objects "thenable" so they resolve when awaited
  const chainable = (result: unknown[]): unknown => {
    const obj = {
      where: () => chainable(result),
      limit: () => chainable(result),
      offset: () => chainable(result),
      orderBy: () => chainable(result),
      returning: () => p(result),
      innerJoin: () => chainable(result),
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        p(result).then(resolve, reject),
    };
    return obj;
  };

  return {
    ...actual,
    db: {
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          from: () => chainable([]),
        };
      },
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return {
          values: () => ({
            returning: () => p([{ id: "ws-1", name: "Test", domain: "test.com" }]),
          }),
        };
      },
    },
  };
});

// Import after mock
import { createWorkspace, addProduct } from "./workspaceService";
import type { ProductInput } from "./workspaceService";

describe("workspaceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWorkspace", () => {
    it("inserts workspace and settings", async () => {
      const result = await createWorkspace({
        name: "SOC Team",
        domain: "soc.example.com",
        description: "Security operations",
      });

      expect(result).toHaveProperty("id", "ws-1");
      expect(result).toHaveProperty("name", "Test");
      // Insert should be called: workspace + settings + matchThreats
      expect(mockInsert).toHaveBeenCalled();
    });

    it("creates workspace without products", async () => {
      const result = await createWorkspace({
        name: "Minimal",
        domain: "min.com",
      });

      expect(result).toBeDefined();
    });

    it("creates workspace with products", async () => {
      const products: ProductInput[] = [
        { name: "Apache", vendor: "Apache Foundation", version: "2.4" },
        { name: "nginx" },
      ];

      const result = await createWorkspace({
        name: "Web Infra",
        domain: "web.com",
        products,
      });

      expect(result).toBeDefined();
      // insert called: workspace + settings + product1 + product2 + match calls
      expect(mockInsert.mock.calls.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("addProduct", () => {
    it("inserts product with generated keywords", async () => {
      const result = await addProduct("ws-1", {
        name: "Apache HTTP Server",
        vendor: "Apache Foundation",
        version: "2.4.57",
        category: "Web Server",
      });

      expect(result).toHaveProperty("id");
      expect(mockInsert).toHaveBeenCalled();
    });

    it("inserts product without optional fields", async () => {
      const result = await addProduct("ws-1", { name: "Redis" });

      expect(result).toHaveProperty("id");
    });
  });
});
