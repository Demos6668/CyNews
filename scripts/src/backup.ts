import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertPgTool, runCommand } from "./backup/pgTools";
import { planRetention, timestampForFilename, type BackupFileInfo } from "./backup/retention";

interface BackupOptions {
  databaseUrl: string;
  outDir: string;
  prefix: string;
  keepCount: number;
}

function readOptions(): BackupOptions {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const outDir = resolve(process.env.BACKUP_DIR ?? "./backups");
  const prefix = process.env.BACKUP_PREFIX ?? "cyfy";
  const keepCount = Number.parseInt(process.env.BACKUP_KEEP ?? "14", 10);
  if (!Number.isFinite(keepCount) || keepCount < 0) {
    throw new Error(`BACKUP_KEEP must be a non-negative integer, got "${process.env.BACKUP_KEEP}"`);
  }
  return { databaseUrl, outDir, prefix, keepCount };
}

function listDumps(outDir: string, prefix: string): BackupFileInfo[] {
  let entries: string[];
  try {
    entries = readdirSync(outDir);
  } catch {
    return [];
  }
  const dumps: BackupFileInfo[] = [];
  for (const entry of entries) {
    if (!entry.startsWith(`${prefix}-`) || !entry.endsWith(".dump")) continue;
    const full = resolve(outDir, entry);
    const st = statSync(full);
    dumps.push({ path: full, mtimeMs: st.mtimeMs, size: st.size });
  }
  return dumps;
}

async function takeDump(options: BackupOptions, timestamp: string): Promise<string> {
  mkdirSync(options.outDir, { recursive: true });
  const outPath = resolve(options.outDir, `${options.prefix}-${timestamp}.dump`);
  const args = [
    "--format=custom",
    "--compress=9",
    "--no-owner",
    "--no-privileges",
    `--file=${outPath}`,
    options.databaseUrl,
  ];
  const result = await runCommand("pg_dump", args);
  if (result.code !== 0) {
    throw new Error(`pg_dump failed (code ${result.code}): ${result.stderr.trim()}`);
  }
  return outPath;
}

function writeManifest(outPath: string, meta: Record<string, unknown>): void {
  writeFileSync(`${outPath}.manifest.json`, JSON.stringify(meta, null, 2), "utf-8");
}

export async function runBackup(): Promise<void> {
  const options = readOptions();
  const version = await assertPgTool("pg_dump");

  const startedAt = new Date();
  const timestamp = timestampForFilename(startedAt);
  const outPath = await takeDump(options, timestamp);
  const size = statSync(outPath).size;

  writeManifest(outPath, {
    createdAt: startedAt.toISOString(),
    prefix: options.prefix,
    pgDumpVersion: version,
    sizeBytes: size,
  });

  const plan = planRetention(listDumps(options.outDir, options.prefix), options.keepCount);
  for (const f of plan.delete) {
    unlinkSync(f.path);
    try {
      unlinkSync(`${f.path}.manifest.json`);
    } catch {
      // manifest may not exist for pre-existing dumps
    }
  }

  const summary = {
    backupPath: outPath,
    sizeBytes: size,
    kept: plan.keep.length,
    pruned: plan.delete.length,
    durationMs: Date.now() - startedAt.getTime(),
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

runBackup().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
