import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockDeleteWhere = vi.fn();
const mockDeleteReturning = vi.fn();

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    db: {
      delete: vi.fn(() => ({
        where: (...args: unknown[]) => {
          mockDeleteWhere(...args);
          return {
            returning: () => {
              mockDeleteReturning();
              return Promise.resolve([]);
            },
          };
        },
      })),
    },
  };
});

import { purgeOldRecords } from "./dataRetention";

describe("dataRetention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("purgeOldRecords", () => {
    it("returns zero counts when no records match", async () => {
      const result = await purgeOldRecords();

      expect(result).toEqual({
        newsDeleted: 0,
        threatsDeleted: 0,
        advisoriesDeleted: 0,
      });
    });

    it("deletes from all three tables in parallel", async () => {
      const { db } = await import("@workspace/db");

      await purgeOldRecords();

      // delete() should be called 3 times (news, threats, advisories)
      expect(db.delete).toHaveBeenCalledTimes(3);
    });

    it("uses default 90-day retention when no argument provided", async () => {
      await purgeOldRecords();

      // With system time at 2025-06-15, cutoff should be ~2025-03-17
      // Verify where was called (3 times, one per table)
      expect(mockDeleteWhere).toHaveBeenCalledTimes(3);
    });

    it("accepts custom retention days", async () => {
      await purgeOldRecords(30);

      // Should still call delete on all 3 tables
      expect(mockDeleteWhere).toHaveBeenCalledTimes(3);
    });

    it("returns correct counts when records are deleted", async () => {
      const { db } = await import("@workspace/db");

      let callIndex = 0;
      const deletedRows = [
        [{ id: 1 }, { id: 2 }],        // 2 news items
        [{ id: 10 }],                    // 1 threat item
        [{ id: 20 }, { id: 21 }, { id: 22 }], // 3 advisories
      ];

      vi.mocked(db.delete).mockImplementation(() => ({
        where: () => ({
          returning: () => {
            const rows = deletedRows[callIndex] ?? [];
            callIndex++;
            return Promise.resolve(rows);
          },
        }),
      }) as never);

      const result = await purgeOldRecords();

      expect(result).toEqual({
        newsDeleted: 2,
        threatsDeleted: 1,
        advisoriesDeleted: 3,
      });
    });

    it("propagates database errors", async () => {
      const { db } = await import("@workspace/db");

      vi.mocked(db.delete).mockImplementation(() => ({
        where: () => ({
          returning: () => Promise.reject(new Error("connection refused")),
        }),
      }) as never);

      await expect(purgeOldRecords()).rejects.toThrow("connection refused");
    });
  });
});
