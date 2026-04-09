import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

const INDEX_MIGRATION_FILES = [
  "001_add_feed_indexes.sql",
  "005_add_search_indexes.sql",
  "006_add_status_indexes.sql",
  "007_add_workspace_match_indexes.sql",
  "009_add_fts_indexes.sql",
] as const;

const REQUIRED_INDEXES = [
  "idx_news_items_published_at",
  "idx_news_items_severity",
  "idx_news_items_scope",
  "idx_news_items_source_url",
  "idx_news_items_title_trgm",
  "idx_news_items_summary_trgm",
  "idx_news_items_source",
  "idx_news_items_status",
  "idx_news_items_severity_status",
  "idx_news_items_fts",
  "idx_threat_intel_published_at",
  "idx_threat_intel_severity",
  "idx_threat_intel_scope",
  "idx_threat_intel_source_url",
  "idx_threat_intel_title_trgm",
  "idx_threat_intel_summary_trgm",
  "idx_threat_intel_description_trgm",
  "idx_threat_intel_source",
  "idx_threat_intel_status",
  "idx_threat_intel_severity_status",
  "idx_threat_intel_fts",
  "idx_advisories_severity",
  "idx_advisories_title_trgm",
  "idx_advisories_description_trgm",
  "idx_advisories_cve_id_trgm",
  "idx_advisories_status",
  "idx_advisories_fts",
  "idx_wtm_workspace_dismissed",
  "idx_wtm_workspace_threat",
] as const;

interface PerformanceIndexStatus {
  ready: boolean;
  missing: string[];
  checkedAt: string | null;
}

const status: PerformanceIndexStatus = {
  ready: false,
  missing: [...REQUIRED_INDEXES],
  checkedAt: null,
};

function getMigrationPath(fileName: string): string {
  return resolve(import.meta.dirname, "../../../../lib/db/migrations", fileName);
}

async function listExistingIndexes(): Promise<Set<string>> {
  const result = await pool.query<{ indexname: string }>(
    `select indexname
       from pg_indexes
      where schemaname = 'public'
        and indexname = any($1::text[])`,
    [[...REQUIRED_INDEXES]],
  );

  return new Set(result.rows.map((row) => row.indexname));
}

function updateStatus(missing: string[]): PerformanceIndexStatus {
  status.ready = missing.length === 0;
  status.missing = missing;
  status.checkedAt = new Date().toISOString();
  return { ...status };
}

export function getPerformanceIndexStatus(): PerformanceIndexStatus {
  return { ...status };
}

export async function checkPerformanceIndexes(): Promise<PerformanceIndexStatus> {
  const existing = await listExistingIndexes();
  const missing = REQUIRED_INDEXES.filter((name) => !existing.has(name));
  return updateStatus([...missing]);
}

export async function ensurePerformanceIndexes(): Promise<PerformanceIndexStatus> {
  const before = await checkPerformanceIndexes();
  if (before.ready) {
    logger.info("Performance indexes already present");
    return before;
  }

  logger.warn({ missingIndexes: before.missing }, "Missing performance indexes detected, applying index migrations");

  for (const fileName of INDEX_MIGRATION_FILES) {
    const path = getMigrationPath(fileName);
    if (!existsSync(path)) {
      logger.warn({ fileName, path }, "Performance index migration file missing");
      continue;
    }

    const sql = readFileSync(path, "utf8");
    await pool.query(sql);
  }

  const after = await checkPerformanceIndexes();
  if (!after.ready) {
    logger.error({ missingIndexes: after.missing }, "Performance index verification failed after applying migrations");
  } else {
    logger.info("Performance indexes verified");
  }
  return after;
}
