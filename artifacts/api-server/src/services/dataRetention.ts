/**
 * Data retention service — preserves the legacy hard-delete path while adding
 * a low-impact archival worker for long-running instances.
 */

import { db, newsItemsTable, threatIntelTable, advisoriesTable, pool } from "@workspace/db";
import { lt, and, inArray } from "drizzle-orm";
import type { PoolClient } from "pg";
import { logger } from "../lib/logger";

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_HOT_DAYS = 30;
const DEFAULT_ARCHIVE_DAYS = 365;
const DEFAULT_BATCH_SIZE = 500;
const DEFAULT_MAX_RUNTIME_MS = 30_000;
const DEFAULT_VACUUM_THRESHOLD = 2_000;
const MAINTENANCE_LOCK_KEY = 42_040_901;

type MaintenanceJobType = "archive" | "purge" | "analyze" | "vacuum" | "legacy-purge";
type MaintenanceRunState = "running" | "succeeded" | "failed" | "skipped";
export type MaintenanceState = "idle" | "running" | "skipped" | "failed";

interface RetentionConfig {
  enabled: boolean;
  mode: "archival" | "legacy";
  hotDays: number;
  archiveDays: number;
  batchSize: number;
  maxRuntimeMs: number;
  vacuumThreshold: number;
  legacyRetentionDays: number | null;
}

export interface RetentionMaintenanceSummary {
  archivedRows: number;
  purgedRows: number;
  mode: "archival" | "legacy";
  skipped: boolean;
  skipReason?: string;
}

export interface RetentionMaintenanceStatus {
  lastArchiveRun: string | null;
  lastPurgeRun: string | null;
  archivedRows: number;
  purgedRows: number;
  maintenanceState: MaintenanceState;
  lastMaintenanceError: string | null;
}

interface MaintenanceRunRow {
  startedAt: Date;
  finishedAt: Date | null;
  rowsArchived: number;
  rowsPurged: number;
  lastError: string | null;
}

const maintenanceStatus: RetentionMaintenanceStatus = {
  lastArchiveRun: null,
  lastPurgeRun: null,
  archivedRows: 0,
  purgedRows: 0,
  maintenanceState: "idle",
  lastMaintenanceError: null,
};

const ANALYZE_TABLES = ["news_items", "threat_intel", "advisories", "archived_records"] as const;
type AnalyzeTable = typeof ANALYZE_TABLES[number];

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return fallback;
}

function parseIntegerEnv(
  value: string | undefined,
  fallback: number,
  { min = 1, allowZero = false }: { min?: number; allowZero?: boolean } = {},
): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  if (allowZero && parsed === 0) return 0;
  return parsed >= min ? parsed : fallback;
}

function getRetentionConfig(): RetentionConfig {
  const enabled = parseBooleanEnv(process.env.RETENTION_ENABLED, true);
  const legacyRetentionRaw = process.env.RETENTION_DAYS;
  const hasSplitRetentionEnv =
    process.env.RETENTION_HOT_DAYS !== undefined || process.env.RETENTION_ARCHIVE_DAYS !== undefined;

  const legacyRetentionDays = legacyRetentionRaw
    ? parseIntegerEnv(legacyRetentionRaw, DEFAULT_RETENTION_DAYS)
    : null;

  if (!hasSplitRetentionEnv && legacyRetentionDays !== null) {
    return {
      enabled,
      mode: "legacy",
      hotDays: legacyRetentionDays,
      archiveDays: 0,
      batchSize: parseIntegerEnv(process.env.RETENTION_BATCH_SIZE, DEFAULT_BATCH_SIZE),
      maxRuntimeMs: parseIntegerEnv(process.env.RETENTION_MAX_RUNTIME_MS, DEFAULT_MAX_RUNTIME_MS),
      vacuumThreshold: parseIntegerEnv(process.env.RETENTION_VACUUM_THRESHOLD, DEFAULT_VACUUM_THRESHOLD),
      legacyRetentionDays,
    };
  }

  return {
    enabled,
    mode: "archival",
    hotDays: parseIntegerEnv(process.env.RETENTION_HOT_DAYS, DEFAULT_HOT_DAYS),
    archiveDays: parseIntegerEnv(process.env.RETENTION_ARCHIVE_DAYS, DEFAULT_ARCHIVE_DAYS, { min: 1, allowZero: true }),
    batchSize: parseIntegerEnv(process.env.RETENTION_BATCH_SIZE, DEFAULT_BATCH_SIZE),
    maxRuntimeMs: parseIntegerEnv(process.env.RETENTION_MAX_RUNTIME_MS, DEFAULT_MAX_RUNTIME_MS),
    vacuumThreshold: parseIntegerEnv(process.env.RETENTION_VACUUM_THRESHOLD, DEFAULT_VACUUM_THRESHOLD),
    legacyRetentionDays,
  };
}

export function getRetentionMaintenanceStatus(): RetentionMaintenanceStatus {
  return { ...maintenanceStatus };
}

export async function hydrateRetentionMaintenanceStatus(): Promise<void> {
  const client = await pool.connect();
  try {
    const [archiveResult, purgeResult] = await Promise.all([
      client.query<MaintenanceRunRow>(
        `select started_at as "startedAt",
                finished_at as "finishedAt",
                rows_archived as "rowsArchived",
                rows_purged as "rowsPurged",
                last_error as "lastError"
           from maintenance_runs
          where job_type = 'archive'
            and state = 'succeeded'
          order by started_at desc
          limit 1`,
      ),
      client.query<MaintenanceRunRow>(
        `select started_at as "startedAt",
                finished_at as "finishedAt",
                rows_archived as "rowsArchived",
                rows_purged as "rowsPurged",
                last_error as "lastError"
           from maintenance_runs
          where job_type in ('purge', 'legacy-purge')
            and state = 'succeeded'
          order by started_at desc
          limit 1`,
      ),
    ]);

    const archiveRow = archiveResult.rows[0];
    const purgeRow = purgeResult.rows[0];

    if (archiveRow) {
      maintenanceStatus.lastArchiveRun = (archiveRow.finishedAt ?? archiveRow.startedAt).toISOString();
      maintenanceStatus.archivedRows = archiveRow.rowsArchived;
    }
    if (purgeRow) {
      maintenanceStatus.lastPurgeRun = (purgeRow.finishedAt ?? purgeRow.startedAt).toISOString();
      maintenanceStatus.purgedRows = purgeRow.rowsPurged;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    maintenanceStatus.lastMaintenanceError = message;
    logger.warn({ error: message }, "Data retention: unable to hydrate maintenance status");
  } finally {
    client.release();
  }
}

/**
 * Legacy hard-delete path kept intact for compatibility.
 */
export async function purgeOldRecords(retentionDays = DEFAULT_RETENTION_DAYS): Promise<{
  newsDeleted: number;
  threatsDeleted: number;
  advisoriesDeleted: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  logger.info({ retentionDays, cutoff: cutoff.toISOString() }, "Data retention: starting cleanup");

  const [newsResult, threatsResult, advisoriesResult] = await Promise.all([
    db
      .delete(newsItemsTable)
      .where(
        and(
          lt(newsItemsTable.publishedAt, cutoff),
          inArray(newsItemsTable.status, ["resolved"]),
        ),
      )
      .returning({ id: newsItemsTable.id }),

    db
      .delete(threatIntelTable)
      .where(
        and(
          lt(threatIntelTable.publishedAt, cutoff),
          inArray(threatIntelTable.status, ["resolved"]),
        ),
      )
      .returning({ id: threatIntelTable.id }),

    db
      .delete(advisoriesTable)
      .where(
        and(
          lt(advisoriesTable.publishedAt, cutoff),
          inArray(advisoriesTable.status, ["patched", "dismissed"]),
        ),
      )
      .returning({ id: advisoriesTable.id }),
  ]);

  const summary = {
    newsDeleted: newsResult.length,
    threatsDeleted: threatsResult.length,
    advisoriesDeleted: advisoriesResult.length,
  };

  logger.info(summary, "Data retention: cleanup complete");
  return summary;
}

async function createMaintenanceRun(client: PoolClient, jobType: MaintenanceJobType): Promise<number> {
  const result = await client.query<{ id: number }>(
    `insert into maintenance_runs (job_type, state)
     values ($1, 'running')
     returning id`,
    [jobType],
  );
  return result.rows[0]?.id ?? 0;
}

async function completeMaintenanceRun(
  client: PoolClient,
  id: number,
  state: Exclude<MaintenanceRunState, "running">,
  payload: {
    rowsArchived?: number;
    rowsPurged?: number;
    lastError?: string | null;
    details?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await client.query(
    `update maintenance_runs
        set state = $2,
            rows_archived = $3,
            rows_purged = $4,
            last_error = $5,
            details = $6::jsonb,
            finished_at = now()
      where id = $1`,
    [
      id,
      state,
      payload.rowsArchived ?? 0,
      payload.rowsPurged ?? 0,
      payload.lastError ?? null,
      JSON.stringify(payload.details ?? {}),
    ],
  );
}

function buildPurgeAfter(now: Date, archiveDays: number): Date {
  const purgeAfter = new Date(now);
  purgeAfter.setDate(purgeAfter.getDate() + archiveDays);
  return purgeAfter;
}

async function acquireMaintenanceLock(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ locked: boolean }>(
    "select pg_try_advisory_lock($1) as locked",
    [MAINTENANCE_LOCK_KEY],
  );
  return Boolean(result.rows[0]?.locked);
}

async function releaseMaintenanceLock(client: PoolClient): Promise<void> {
  await client.query("select pg_advisory_unlock($1)", [MAINTENANCE_LOCK_KEY]).catch(() => {});
}

async function archiveNewsBatch(client: PoolClient, cutoff: Date, purgeAfter: Date, limit: number): Promise<number> {
  const result = await client.query<{ count: number }>(
    `with eligible as (
       select n.id, n.title, n.summary, n.severity, n.status, n.source, n.source_url, n.published_at, n.updated_at,
              n.type, n.scope, n.category,
              coalesce(jsonb_array_length(n.tags), 0) as tags_count,
              coalesce(jsonb_array_length(n.iocs), 0) as ioc_count,
              coalesce(jsonb_array_length(n.affected_systems), 0) as affected_systems_count
         from news_items n
        where n.status = 'resolved'
          and n.published_at < $1
        order by n.published_at asc
        limit $3
     ),
     archived as (
       insert into archived_records (
         record_type, source_record_id, title, summary, severity, status, source, source_url,
         published_at, resolved_at, metadata, archived_at, purge_after
       )
       select
         'news',
         e.id,
         e.title,
         left(coalesce(e.summary, ''), 1000),
         e.severity,
         e.status,
         e.source,
         e.source_url,
         e.published_at,
         e.updated_at,
         jsonb_build_object(
           'type', e.type,
           'scope', e.scope,
           'category', e.category,
           'tagsCount', e.tags_count,
           'iocCount', e.ioc_count,
           'affectedSystemsCount', e.affected_systems_count
         ),
         now(),
         $2
       from eligible e
       on conflict (record_type, source_record_id) do update
         set title = excluded.title,
             summary = excluded.summary,
             severity = excluded.severity,
             status = excluded.status,
             source = excluded.source,
             source_url = excluded.source_url,
             published_at = excluded.published_at,
             resolved_at = excluded.resolved_at,
             metadata = excluded.metadata,
             archived_at = now(),
             purge_after = excluded.purge_after
       returning source_record_id
     ),
     deleted as (
       delete from news_items n
       using archived a
       where n.id = a.source_record_id
       returning n.id
     )
     select count(*)::int as count from deleted`,
    [cutoff, purgeAfter, limit],
  );

  return result.rows[0]?.count ?? 0;
}

async function archiveThreatBatch(client: PoolClient, cutoff: Date, purgeAfter: Date, limit: number): Promise<number> {
  const result = await client.query<{ count: number }>(
    `with eligible as (
       select t.id, t.title, t.summary, t.severity, t.status, t.source, t.source_url, t.published_at, t.updated_at,
              t.scope, t.category, t.threat_actor,
              coalesce(jsonb_array_length(t.references), 0) as references_count,
              coalesce(jsonb_array_length(t.ttps), 0) as ttps_count,
              coalesce(jsonb_array_length(t.iocs), 0) as ioc_count,
              coalesce(jsonb_array_length(t.malware_families), 0) as malware_count
         from threat_intel t
        where t.status = 'resolved'
          and t.published_at < $1
          and not exists (
            select 1
              from workspace_threat_matches w
             where w.threat_id = t.id
               and coalesce(w.dismissed, false) = false
          )
        order by t.published_at asc
        limit $3
     ),
     archived as (
       insert into archived_records (
         record_type, source_record_id, title, summary, severity, status, source, source_url,
         published_at, resolved_at, metadata, archived_at, purge_after
       )
       select
         'threat',
         e.id,
         e.title,
         left(coalesce(e.summary, ''), 1000),
         e.severity,
         e.status,
         e.source,
         e.source_url,
         e.published_at,
         e.updated_at,
         jsonb_build_object(
           'scope', e.scope,
           'category', e.category,
           'threatActor', e.threat_actor,
           'referencesCount', e.references_count,
           'ttpsCount', e.ttps_count,
           'iocCount', e.ioc_count,
           'malwareCount', e.malware_count
         ),
         now(),
         $2
       from eligible e
       on conflict (record_type, source_record_id) do update
         set title = excluded.title,
             summary = excluded.summary,
             severity = excluded.severity,
             status = excluded.status,
             source = excluded.source,
             source_url = excluded.source_url,
             published_at = excluded.published_at,
             resolved_at = excluded.resolved_at,
             metadata = excluded.metadata,
             archived_at = now(),
             purge_after = excluded.purge_after
       returning source_record_id
     ),
     deleted as (
       delete from threat_intel t
       using archived a
       where t.id = a.source_record_id
       returning t.id
     )
     select count(*)::int as count from deleted`,
    [cutoff, purgeAfter, limit],
  );

  return result.rows[0]?.count ?? 0;
}

async function archiveAdvisoryBatch(client: PoolClient, cutoff: Date, purgeAfter: Date, limit: number): Promise<number> {
  const result = await client.query<{ count: number }>(
    `with eligible as (
       select a.id, a.title, a.summary, a.severity, a.status, a.source, a.source_url, a.published_at, a.updated_at,
              a.vendor, a.patch_available, a.category,
              coalesce(jsonb_array_length(a.references), 0) as references_count,
              coalesce(jsonb_array_length(a.cve_ids), 0) as cve_count
         from advisories a
        where a.status in ('patched', 'dismissed')
          and a.published_at < $1
        order by a.published_at asc
        limit $3
     ),
     archived as (
       insert into archived_records (
         record_type, source_record_id, title, summary, severity, status, source, source_url,
         published_at, resolved_at, metadata, archived_at, purge_after
       )
       select
         'advisory',
         e.id,
         e.title,
         left(coalesce(e.summary, ''), 1000),
         e.severity,
         e.status,
         e.source,
         e.source_url,
         e.published_at,
         e.updated_at,
         jsonb_build_object(
           'vendor', e.vendor,
           'patchAvailable', e.patch_available,
           'category', e.category,
           'referencesCount', e.references_count,
           'cveCount', e.cve_count
         ),
         now(),
         $2
       from eligible e
       on conflict (record_type, source_record_id) do update
         set title = excluded.title,
             summary = excluded.summary,
             severity = excluded.severity,
             status = excluded.status,
             source = excluded.source,
             source_url = excluded.source_url,
             published_at = excluded.published_at,
             resolved_at = excluded.resolved_at,
             metadata = excluded.metadata,
             archived_at = now(),
             purge_after = excluded.purge_after
       returning source_record_id
     ),
     deleted as (
       delete from advisories a
       using archived r
       where a.id = r.source_record_id
       returning a.id
     )
     select count(*)::int as count from deleted`,
    [cutoff, purgeAfter, limit],
  );

  return result.rows[0]?.count ?? 0;
}

async function purgeArchivedBatch(client: PoolClient, batchSize: number): Promise<number> {
  const result = await client.query<{ count: number }>(
    `with eligible as (
       select id
         from archived_records
        where purge_after <= now()
        order by purge_after asc
        limit $1
     ),
     deleted as (
       delete from archived_records a
       using eligible e
       where a.id = e.id
       returning a.id
     )
     select count(*)::int as count from deleted`,
    [batchSize],
  );

  return result.rows[0]?.count ?? 0;
}

async function runAnalyze(client: PoolClient, touchedTables: Set<AnalyzeTable>): Promise<void> {
  if (!touchedTables.size) return;

  const runId = await createMaintenanceRun(client, "analyze");
  try {
    for (const tableName of touchedTables) {
      await client.query(`ANALYZE ${tableName}`);
    }
    await completeMaintenanceRun(client, runId, "succeeded", {
      details: { tables: [...touchedTables] },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await completeMaintenanceRun(client, runId, "failed", {
      lastError: message,
      details: { tables: [...touchedTables] },
    });
    throw error;
  }
}

async function runVacuum(client: PoolClient, touchedTables: Set<AnalyzeTable>): Promise<void> {
  if (!touchedTables.size) return;

  const runId = await createMaintenanceRun(client, "vacuum");
  try {
    for (const tableName of touchedTables) {
      await client.query(`VACUUM (ANALYZE) ${tableName}`);
    }
    await completeMaintenanceRun(client, runId, "succeeded", {
      details: { tables: [...touchedTables] },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await completeMaintenanceRun(client, runId, "failed", {
      lastError: message,
      details: { tables: [...touchedTables] },
    });
    throw error;
  }
}

export async function runRetentionMaintenance(
  options: { feedUpdateRunning?: boolean } = {},
): Promise<RetentionMaintenanceSummary> {
  const config = getRetentionConfig();

  if (!config.enabled) {
    maintenanceStatus.maintenanceState = "idle";
    logger.info("Data retention: disabled via RETENTION_ENABLED");
    return { archivedRows: 0, purgedRows: 0, mode: config.mode, skipped: true, skipReason: "disabled" };
  }

  if (options.feedUpdateRunning) {
    maintenanceStatus.maintenanceState = "skipped";
    logger.info("Data retention: skipped because feed update is still running");
    return {
      archivedRows: 0,
      purgedRows: 0,
      mode: config.mode,
      skipped: true,
      skipReason: "feed-update-running",
    };
  }

  const client = await pool.connect();
  let lockHeld = false;

  try {
    lockHeld = await acquireMaintenanceLock(client);
    if (!lockHeld) {
      maintenanceStatus.maintenanceState = "skipped";
      logger.info("Data retention: skipped because another maintenance run holds the lease");
      return {
        archivedRows: 0,
        purgedRows: 0,
        mode: config.mode,
        skipped: true,
        skipReason: "lease-held",
      };
    }

    maintenanceStatus.maintenanceState = "running";
    maintenanceStatus.lastMaintenanceError = null;

    if (config.mode === "legacy" && config.legacyRetentionDays !== null) {
      const runId = await createMaintenanceRun(client, "legacy-purge");
      try {
        const legacySummary = await purgeOldRecords(config.legacyRetentionDays);
        const purgedRows =
          legacySummary.newsDeleted + legacySummary.threatsDeleted + legacySummary.advisoriesDeleted;
        await completeMaintenanceRun(client, runId, "succeeded", {
          rowsPurged: purgedRows,
          details: legacySummary,
        });
        maintenanceStatus.lastPurgeRun = new Date().toISOString();
        maintenanceStatus.purgedRows = purgedRows;
        maintenanceStatus.archivedRows = 0;
        maintenanceStatus.maintenanceState = "idle";
        return { archivedRows: 0, purgedRows, mode: "legacy", skipped: false };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await completeMaintenanceRun(client, runId, "failed", { lastError: message });
        maintenanceStatus.maintenanceState = "failed";
        maintenanceStatus.lastMaintenanceError = message;
        throw error;
      }
    }

    const startedAt = Date.now();
    const deadline = startedAt + config.maxRuntimeMs;
    const hotCutoff = new Date();
    hotCutoff.setDate(hotCutoff.getDate() - config.hotDays);
    const purgeAfter = buildPurgeAfter(new Date(), config.archiveDays);
    const touchedTables = new Set<AnalyzeTable>();

    const archiveRunId = await createMaintenanceRun(client, "archive");
    let archivedRows = 0;
    try {
      let remaining = config.batchSize;
      if (Date.now() < deadline && remaining > 0) {
        const archived = await archiveNewsBatch(client, hotCutoff, purgeAfter, remaining);
        archivedRows += archived;
        remaining -= archived;
        if (archived > 0) {
          touchedTables.add("news_items");
          touchedTables.add("archived_records");
        }
      }
      if (Date.now() < deadline && remaining > 0) {
        const archived = await archiveThreatBatch(client, hotCutoff, purgeAfter, remaining);
        archivedRows += archived;
        remaining -= archived;
        if (archived > 0) {
          touchedTables.add("threat_intel");
          touchedTables.add("archived_records");
        }
      }
      if (Date.now() < deadline && remaining > 0) {
        const archived = await archiveAdvisoryBatch(client, hotCutoff, purgeAfter, remaining);
        archivedRows += archived;
        if (archived > 0) {
          touchedTables.add("advisories");
          touchedTables.add("archived_records");
        }
      }
      await completeMaintenanceRun(client, archiveRunId, "succeeded", { rowsArchived: archivedRows });
      maintenanceStatus.lastArchiveRun = new Date().toISOString();
      maintenanceStatus.archivedRows = archivedRows;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await completeMaintenanceRun(client, archiveRunId, "failed", { rowsArchived: archivedRows, lastError: message });
      maintenanceStatus.maintenanceState = "failed";
      maintenanceStatus.lastMaintenanceError = message;
      throw error;
    }

    const purgeRunId = await createMaintenanceRun(client, "purge");
    let purgedRows = 0;
    try {
      if (Date.now() < deadline) {
        purgedRows = await purgeArchivedBatch(client, config.batchSize);
        if (purgedRows > 0) touchedTables.add("archived_records");
      }
      await completeMaintenanceRun(client, purgeRunId, "succeeded", { rowsPurged: purgedRows });
      maintenanceStatus.lastPurgeRun = new Date().toISOString();
      maintenanceStatus.purgedRows = purgedRows;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await completeMaintenanceRun(client, purgeRunId, "failed", { rowsPurged: purgedRows, lastError: message });
      maintenanceStatus.maintenanceState = "failed";
      maintenanceStatus.lastMaintenanceError = message;
      throw error;
    }

    if (touchedTables.size > 0) {
      await runAnalyze(client, touchedTables);
      if (archivedRows + purgedRows >= config.vacuumThreshold) {
        await runVacuum(client, touchedTables);
      }
    }

    maintenanceStatus.maintenanceState = "idle";

    logger.info(
      {
        mode: config.mode,
        archivedRows,
        purgedRows,
        hotDays: config.hotDays,
        archiveDays: config.archiveDays,
      },
      "Data retention: maintenance complete",
    );

    return { archivedRows, purgedRows, mode: config.mode, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    maintenanceStatus.maintenanceState = "failed";
    maintenanceStatus.lastMaintenanceError = message;
    logger.error({ error: message }, "Data retention: maintenance failed");
    throw error;
  } finally {
    if (lockHeld) {
      await releaseMaintenanceLock(client);
    }
    client.release();
  }
}
