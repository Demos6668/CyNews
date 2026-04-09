import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockExistsSync,
  mockReadFileSync,
  mockPoolQuery,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockPoolQuery: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  return {
    ...actual,
    pool: {
      query: (...args: unknown[]) => mockPoolQuery(...args),
    },
  };
});

import {
  checkPerformanceIndexes,
  ensurePerformanceIndexes,
  getPerformanceIndexStatus,
} from "./performanceIndexes";

describe("performanceIndexes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("-- test sql");
  });

  it("reports missing indexes when the required set is incomplete", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [{ indexname: "idx_news_items_published_at" }],
    });

    const result = await checkPerformanceIndexes();

    expect(result.ready).toBe(false);
    expect(result.missing).toContain("idx_threat_intel_published_at");
    expect(getPerformanceIndexStatus().ready).toBe(false);
  });

  it("applies index migrations and verifies the required indexes", async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { indexname: "idx_news_items_published_at" },
          { indexname: "idx_news_items_severity" },
          { indexname: "idx_news_items_scope" },
          { indexname: "idx_news_items_source_url" },
          { indexname: "idx_news_items_title_trgm" },
          { indexname: "idx_news_items_summary_trgm" },
          { indexname: "idx_news_items_source" },
          { indexname: "idx_news_items_status" },
          { indexname: "idx_news_items_severity_status" },
          { indexname: "idx_news_items_fts" },
          { indexname: "idx_threat_intel_published_at" },
          { indexname: "idx_threat_intel_severity" },
          { indexname: "idx_threat_intel_scope" },
          { indexname: "idx_threat_intel_source_url" },
          { indexname: "idx_threat_intel_title_trgm" },
          { indexname: "idx_threat_intel_summary_trgm" },
          { indexname: "idx_threat_intel_description_trgm" },
          { indexname: "idx_threat_intel_source" },
          { indexname: "idx_threat_intel_status" },
          { indexname: "idx_threat_intel_severity_status" },
          { indexname: "idx_threat_intel_fts" },
          { indexname: "idx_advisories_severity" },
          { indexname: "idx_advisories_title_trgm" },
          { indexname: "idx_advisories_description_trgm" },
          { indexname: "idx_advisories_cve_id_trgm" },
          { indexname: "idx_advisories_status" },
          { indexname: "idx_advisories_fts" },
          { indexname: "idx_wtm_workspace_dismissed" },
          { indexname: "idx_wtm_workspace_threat" },
        ],
      });

    const result = await ensurePerformanceIndexes();

    expect(result.ready).toBe(true);
    expect(result.missing).toEqual([]);
    expect(mockReadFileSync).toHaveBeenCalledTimes(5);
    expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining("001_add_feed_indexes.sql"));
  });

  it("does not reapply migrations when indexes already exist", async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        { indexname: "idx_news_items_published_at" },
        { indexname: "idx_news_items_severity" },
        { indexname: "idx_news_items_scope" },
        { indexname: "idx_news_items_source_url" },
        { indexname: "idx_news_items_title_trgm" },
        { indexname: "idx_news_items_summary_trgm" },
        { indexname: "idx_news_items_source" },
        { indexname: "idx_news_items_status" },
        { indexname: "idx_news_items_severity_status" },
        { indexname: "idx_news_items_fts" },
        { indexname: "idx_threat_intel_published_at" },
        { indexname: "idx_threat_intel_severity" },
        { indexname: "idx_threat_intel_scope" },
        { indexname: "idx_threat_intel_source_url" },
        { indexname: "idx_threat_intel_title_trgm" },
        { indexname: "idx_threat_intel_summary_trgm" },
        { indexname: "idx_threat_intel_description_trgm" },
        { indexname: "idx_threat_intel_source" },
        { indexname: "idx_threat_intel_status" },
        { indexname: "idx_threat_intel_severity_status" },
        { indexname: "idx_threat_intel_fts" },
        { indexname: "idx_advisories_severity" },
        { indexname: "idx_advisories_title_trgm" },
        { indexname: "idx_advisories_description_trgm" },
        { indexname: "idx_advisories_cve_id_trgm" },
        { indexname: "idx_advisories_status" },
        { indexname: "idx_advisories_fts" },
        { indexname: "idx_wtm_workspace_dismissed" },
        { indexname: "idx_wtm_workspace_threat" },
      ],
    });

    const result = await ensurePerformanceIndexes();

    expect(result.ready).toBe(true);
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });
});
