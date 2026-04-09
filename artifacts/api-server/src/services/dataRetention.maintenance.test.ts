import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDeleteWhere,
  mockDeleteReturning,
  mockQuery,
  mockRelease,
  mockConnect,
} = vi.hoisted(() => ({
  mockDeleteWhere: vi.fn(),
  mockDeleteReturning: vi.fn(),
  mockQuery: vi.fn(),
  mockRelease: vi.fn(),
  mockConnect: vi.fn(),
}));

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
    pool: {
      connect: mockConnect,
    },
  };
});

import {
  getRetentionMaintenanceStatus,
  hydrateRetentionMaintenanceStatus,
  runRetentionMaintenance,
} from "./dataRetention";

describe("dataRetention maintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T12:00:00.000Z"));
    delete process.env.RETENTION_ENABLED;
    delete process.env.RETENTION_DAYS;
    delete process.env.RETENTION_HOT_DAYS;
    delete process.env.RETENTION_ARCHIVE_DAYS;
    delete process.env.RETENTION_BATCH_SIZE;
    delete process.env.RETENTION_MAX_RUNTIME_MS;
    delete process.env.RETENTION_VACUUM_THRESHOLD;
    mockConnect.mockResolvedValue({
      query: mockQuery,
      release: mockRelease,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips maintenance while a feed refresh is running", async () => {
    const result = await runRetentionMaintenance({ feedUpdateRunning: true });

    expect(result).toEqual({
      archivedRows: 0,
      purgedRows: 0,
      mode: "archival",
      skipped: true,
      skipReason: "feed-update-running",
    });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(getRetentionMaintenanceStatus().maintenanceState).toBe("skipped");
  });

  it("skips when another maintenance worker holds the advisory lock", async () => {
    mockQuery.mockImplementation(async (text: string) => {
      if (text.includes("pg_try_advisory_lock")) return { rows: [{ locked: false }] };
      if (text.includes("pg_advisory_unlock")) return { rows: [] };
      throw new Error(`Unexpected query: ${text}`);
    });

    const result = await runRetentionMaintenance();

    expect(result.skipped).toBe(true);
    expect(result.skipReason).toBe("lease-held");
    expect(getRetentionMaintenanceStatus().maintenanceState).toBe("skipped");
  });

  it("falls back to the legacy purge path when only RETENTION_DAYS is configured", async () => {
    process.env.RETENTION_DAYS = "45";
    const { db } = await import("@workspace/db");

    let maintenanceRunId = 0;
    mockQuery.mockImplementation(async (text: string) => {
      if (text.includes("pg_try_advisory_lock")) return { rows: [{ locked: true }] };
      if (text.startsWith("insert into maintenance_runs")) return { rows: [{ id: ++maintenanceRunId }] };
      if (text.startsWith("update maintenance_runs")) return { rows: [] };
      if (text.includes("pg_advisory_unlock")) return { rows: [] };
      throw new Error(`Unexpected query: ${text}`);
    });

    let callIndex = 0;
    const deletedRows = [
      [{ id: 1 }, { id: 2 }],
      [{ id: 10 }],
      [{ id: 20 }, { id: 21 }, { id: 22 }],
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

    const result = await runRetentionMaintenance();

    expect(result).toEqual({
      archivedRows: 0,
      purgedRows: 6,
      mode: "legacy",
      skipped: false,
    });
    expect(getRetentionMaintenanceStatus().purgedRows).toBe(6);
    expect(getRetentionMaintenanceStatus().archivedRows).toBe(0);
  });

  it("archives terminal-state rows in batches and tracks purge counts", async () => {
    process.env.RETENTION_HOT_DAYS = "30";
    process.env.RETENTION_ARCHIVE_DAYS = "365";
    process.env.RETENTION_BATCH_SIZE = "500";
    process.env.RETENTION_VACUUM_THRESHOLD = "10";

    let maintenanceRunId = 0;
    mockQuery.mockImplementation(async (text: string) => {
      if (text.includes("pg_try_advisory_lock")) return { rows: [{ locked: true }] };
      if (text.startsWith("insert into maintenance_runs")) return { rows: [{ id: ++maintenanceRunId }] };
      if (text.startsWith("update maintenance_runs")) return { rows: [] };
      if (text.includes("from news_items")) return { rows: [{ count: 2 }] };
      if (text.includes("from threat_intel")) return { rows: [{ count: 0 }] };
      if (text.includes("from advisories")) return { rows: [{ count: 1 }] };
      if (text.includes("from archived_records")) return { rows: [{ count: 3 }] };
      if (text.startsWith("ANALYZE ")) return { rows: [] };
      if (text.includes("pg_advisory_unlock")) return { rows: [] };
      throw new Error(`Unexpected query: ${text}`);
    });

    const result = await runRetentionMaintenance();

    expect(result).toEqual({
      archivedRows: 3,
      purgedRows: 3,
      mode: "archival",
      skipped: false,
    });
    expect(getRetentionMaintenanceStatus()).toMatchObject({
      archivedRows: 3,
      purgedRows: 3,
      maintenanceState: "idle",
    });
  });

  it("hydrates the last successful archive and purge run from persisted maintenance rows", async () => {
    mockQuery.mockImplementation(async (text: string) => {
      if (text.includes("where job_type = 'archive'")) {
        return {
          rows: [{
            startedAt: new Date("2026-04-08T03:00:00.000Z"),
            finishedAt: new Date("2026-04-08T03:00:03.000Z"),
            rowsArchived: 12,
            rowsPurged: 0,
            lastError: null,
          }],
        };
      }
      if (text.includes("where job_type in ('purge', 'legacy-purge')")) {
        return {
          rows: [{
            startedAt: new Date("2026-04-08T03:00:03.000Z"),
            finishedAt: new Date("2026-04-08T03:00:04.000Z"),
            rowsArchived: 0,
            rowsPurged: 8,
            lastError: null,
          }],
        };
      }
      throw new Error(`Unexpected query: ${text}`);
    });

    await hydrateRetentionMaintenanceStatus();

    expect(getRetentionMaintenanceStatus()).toMatchObject({
      lastArchiveRun: "2026-04-08T03:00:03.000Z",
      lastPurgeRun: "2026-04-08T03:00:04.000Z",
      archivedRows: 12,
      purgedRows: 8,
    });
  });
});
