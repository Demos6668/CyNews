import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { assertPgTool, runCommand } from "./backup/pgTools";

interface RestoreOptions {
  dumpPath: string;
  targetUrl: string;
  allowProduction: boolean;
}

function readOptions(): RestoreOptions {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    throw new Error(
      "Usage: tsx ./src/restore.ts <dump-file>\n" +
        "Environment:\n" +
        "  RESTORE_TARGET_DATABASE_URL  required — where to restore\n" +
        "  RESTORE_ALLOW_PRODUCTION=1   required to overwrite a non-test DB",
    );
  }
  const resolvedDump = resolve(dumpPath);
  if (!existsSync(resolvedDump)) {
    throw new Error(`Dump file not found: ${resolvedDump}`);
  }
  const targetUrl = process.env.RESTORE_TARGET_DATABASE_URL;
  if (!targetUrl) {
    throw new Error("RESTORE_TARGET_DATABASE_URL is required — refusing to fall back to DATABASE_URL");
  }
  return {
    dumpPath: resolvedDump,
    targetUrl,
    allowProduction: process.env.RESTORE_ALLOW_PRODUCTION === "1",
  };
}

function looksLikeProduction(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes("localhost") || lower.includes("127.0.0.1")) return false;
  if (/\b(test|dev|staging|local|restore|drill)\b/.test(lower)) return false;
  return true;
}

export async function runRestore(): Promise<void> {
  const options = readOptions();

  if (looksLikeProduction(options.targetUrl) && !options.allowProduction) {
    throw new Error(
      "Target URL looks like production; set RESTORE_ALLOW_PRODUCTION=1 to proceed (you probably don't want this).",
    );
  }

  await assertPgTool("pg_restore");

  const startedAt = Date.now();
  const args = [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
    "--exit-on-error",
    "--dbname",
    options.targetUrl,
    options.dumpPath,
  ];
  const result = await runCommand("pg_restore", args);
  if (result.code !== 0) {
    throw new Error(`pg_restore failed (code ${result.code}): ${result.stderr.trim()}`);
  }

  const summary = {
    dumpPath: options.dumpPath,
    durationMs: Date.now() - startedAt,
    stderrWarnings: result.stderr.split("\n").filter(Boolean).length,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

runRestore().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
