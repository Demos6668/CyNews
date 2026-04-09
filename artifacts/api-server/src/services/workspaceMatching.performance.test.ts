import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockInsert,
  mockSelect,
  insertedBatches,
  nextSelectCall,
  resetSelectCall,
} = vi.hoisted(() => {
  let selectCall = 0;
  return {
    mockInsert: vi.fn(),
    mockSelect: vi.fn(),
    insertedBatches: [] as unknown[],
    resetSelectCall: () => {
      selectCall = 0;
    },
    nextSelectCall: () => {
      selectCall += 1;
      return selectCall;
    },
  };
});

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();

  const products = [
    {
      id: "product-1",
      workspaceId: "ws-1",
      productName: "Microsoft 365",
      vendor: "Microsoft",
      version: null,
      category: null,
      keywords: ["microsoft 365", "microsoft"],
      enabled: true,
    },
  ];
  const threats = [
    {
      id: 101,
      title: "Microsoft 365 phishing campaign",
      summary: "Targeting Microsoft 365 tenants",
      description: "Campaign against Microsoft 365 accounts",
      severity: "high",
      publishedAt: new Date("2026-04-09T00:00:00.000Z"),
    },
    {
      id: 102,
      title: "Critical Microsoft Exchange issue",
      summary: "Related to Microsoft cloud identity",
      description: "Follow-on issue affecting Microsoft 365 integrations",
      severity: "critical",
      publishedAt: new Date("2026-04-08T00:00:00.000Z"),
    },
  ];
  const existingMatches: Array<{ threatId: number }> = [];

  const chainable = (result: unknown[]): unknown => ({
    where: () => chainable(result),
    orderBy: () => chainable(result),
    limit: () => chainable(result),
    offset: () => chainable(result),
    innerJoin: () => chainable(result),
    then: (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  });

  return {
    ...actual,
    db: {
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          from: () => {
            const call = nextSelectCall();
            if (call === 1) return chainable(products);
            if (call === 2) return chainable(threats);
            return chainable(existingMatches);
          },
        };
      },
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return {
          values: (value: unknown) => {
            insertedBatches.push(value);
            return Promise.resolve(value);
          },
        };
      },
    },
  };
});

import { matchThreatsToWorkspace } from "./workspaceService";

describe("workspaceService performance batching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedBatches.length = 0;
    resetSelectCall();
  });

  it("batches new threat matches into a single insert call", async () => {
    await matchThreatsToWorkspace("ws-1");

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(insertedBatches).toHaveLength(1);
    expect(insertedBatches[0]).toEqual([
      expect.objectContaining({ workspaceId: "ws-1", threatId: 101 }),
      expect.objectContaining({ workspaceId: "ws-1", threatId: 102 }),
    ]);
  });
});
