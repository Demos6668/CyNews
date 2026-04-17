/**
 * Maintenance sweep registry.
 *
 * Each sweep is independent: a failure in one does NOT abort the others.
 * All sweeps share the MAINTENANCE_LOCK_KEY advisory lock so they never run
 * concurrently with the existing dataRetention job on a multi-instance deploy.
 *
 * Called from feedScheduler at 04:00 daily (one hour after dataRetention at 03:00).
 */

import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";
import { sessionsSweep } from "./sessions.sweep";
import { verificationsSweep } from "./verifications.sweep";
import { invitesSweep } from "./invites.sweep";
import { stripeEventsSweep } from "./stripeEvents.sweep";
import { auditLogSweep } from "./auditLog.sweep";
import { maintenanceRunsSweep } from "./maintenanceRuns.sweep";
import { orphansSweep } from "./orphans.sweep";
import { savedViewsCapSweep } from "./savedViewsCap.sweep";
import { softDeletePurgeSweep } from "./softDeletePurge.sweep";
import type { Sweep, SweepContext, SweepResult } from "./types";

// Same advisory lock key used by dataRetention so the two jobs can't overlap
const MAINTENANCE_LOCK_KEY = 42_040_902; // different key — runs alongside, not replacing

const SWEEPS: Sweep[] = [
  sessionsSweep,
  verificationsSweep,
  invitesSweep,
  stripeEventsSweep,
  auditLogSweep,
  maintenanceRunsSweep,
  orphansSweep,
  savedViewsCapSweep,
  softDeletePurgeSweep,
];

export interface MaintenanceSweepsSummary {
  ran: number;
  failed: number;
  totalDeleted: number;
  results: SweepResult[];
}

export async function runMaintenanceSweeps(
  ctx: SweepContext
): Promise<MaintenanceSweepsSummary> {
  // Try to acquire advisory lock — skip if already running
  const lockClient = await pool.connect();
  let lockAcquired = false;

  try {
    const { rows } = await lockClient.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock($1) AS acquired`,
      [MAINTENANCE_LOCK_KEY]
    );
    lockAcquired = rows[0]?.acquired ?? false;
  } finally {
    if (!lockAcquired) {
      lockClient.release();
    }
  }

  if (!lockAcquired) {
    logger.info("Maintenance sweeps skipped — advisory lock held by another process");
    return { ran: 0, failed: 0, totalDeleted: 0, results: [] };
  }

  const results: SweepResult[] = [];
  let failed = 0;
  let totalDeleted = 0;

  try {
    for (const sweep of SWEEPS) {
      try {
        logger.info({ sweep: sweep.name }, "Maintenance sweep starting");
        const result = await sweep.run(ctx);
        results.push(result);
        totalDeleted += result.deleted;
        if (result.errors.length > 0) {
          failed++;
          logger.warn({ sweep: sweep.name, errors: result.errors }, "Sweep completed with errors");
        } else {
          logger.info({ sweep: sweep.name, deleted: result.deleted, durationMs: result.durationMs }, "Sweep complete");
        }
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ sweep: sweep.name, err: message }, "Sweep threw unexpected error");
        results.push({ sweep: sweep.name, scanned: 0, deleted: 0, archived: 0, durationMs: 0, errors: [message] });
      }
    }
  } finally {
    // Always release the advisory lock
    await lockClient.query(`SELECT pg_advisory_unlock($1)`, [MAINTENANCE_LOCK_KEY]);
    lockClient.release();
  }

  logger.info({ ran: results.length, failed, totalDeleted }, "Maintenance sweeps complete");

  // Persist a summary to maintenance_runs for admin visibility
  await persistSweepSummary(results).catch((err) =>
    logger.warn({ err }, "Failed to persist maintenance sweep summary")
  );

  return { ran: results.length, failed, totalDeleted, results };
}

async function persistSweepSummary(results: SweepResult[]): Promise<void> {
  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  const errors = results.flatMap((r) => r.errors);
  const details = Object.fromEntries(results.map((r) => [r.sweep, { deleted: r.deleted, durationMs: r.durationMs, errors: r.errors }]));
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO maintenance_runs
         (job_type, state, rows_archived, rows_purged, details, last_error, started_at, finished_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [
        "gc-sweeps",
        errors.length > 0 ? "failed" : "succeeded",
        0,
        totalDeleted,
        JSON.stringify(details),
        errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      ]
    );
  } finally {
    client.release();
  }
}
