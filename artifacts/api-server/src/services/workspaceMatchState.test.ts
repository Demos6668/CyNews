import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelectRow = vi.fn();
const mockUpdatedRow = vi.fn();

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const p = <T>(value: T) => Promise.resolve(value);

  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: () => ({
              limit: () => p(mockSelectRow()),
            }),
          }),
        }),
      }),
      update: () => ({
        set: (values: unknown) => ({
          where: () => ({
            returning: () => {
              const row = mockUpdatedRow(values);
              return p(row ? [row] : []);
            },
          }),
        }),
      }),
    },
  };
});

import { updateWorkspaceMatch } from "./workspaceService";

describe("updateWorkspaceMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores resolved metadata when marking a match as resolved", async () => {
    mockSelectRow.mockReturnValue([
      {
        id: "match-1",
        threatSeverity: "critical",
      },
    ]);
    mockUpdatedRow.mockImplementation((values) => ({
      id: "match-1",
      ...values,
    }));

    const result = await updateWorkspaceMatch("ws-1", "match-1", {
      matchStatus: "resolved",
    });

    expect(result).toMatchObject({
      id: "match-1",
      status: "resolved",
      reviewed: true,
      resolvedSeverity: "critical",
    });
    expect(result.resolvedAt).toBeInstanceOf(Date);
  });

  it("clears resolved metadata when restoring a match to active", async () => {
    mockSelectRow.mockReturnValue([
      {
        id: "match-2",
        threatSeverity: "high",
      },
    ]);
    mockUpdatedRow.mockImplementation((values) => ({
      id: "match-2",
      ...values,
    }));

    const result = await updateWorkspaceMatch("ws-1", "match-2", {
      matchStatus: "active",
      reviewed: false,
    });

    expect(result).toMatchObject({
      id: "match-2",
      status: "active",
      reviewed: false,
      resolvedSeverity: null,
      resolvedAt: null,
    });
  });
});
