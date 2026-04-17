import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { assertPgTool, runCommand } from "./backup/pgTools";
import { countTocEntries } from "./backup/toc";

interface VerifyOptions {
  dumpPath: string;
  minEntries: number;
}

function readOptions(): VerifyOptions {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    throw new Error("Usage: tsx ./src/verify-backup.ts <dump-file>");
  }
  const resolved = resolve(dumpPath);
  if (!existsSync(resolved)) {
    throw new Error(`Dump file not found: ${resolved}`);
  }
  const minEntries = Number.parseInt(process.env.VERIFY_MIN_ENTRIES ?? "1", 10);
  return { dumpPath: resolved, minEntries };
}

async function runVerify(): Promise<void> {
  const options = readOptions();
  await assertPgTool("pg_restore");

  const size = statSync(options.dumpPath).size;
  if (size === 0) {
    throw new Error(`Dump is empty: ${options.dumpPath}`);
  }

  const result = await runCommand("pg_restore", ["--list", options.dumpPath]);
  if (result.code !== 0) {
    throw new Error(`pg_restore --list failed (code ${result.code}): ${result.stderr.trim()}`);
  }
  const entries = countTocEntries(result.stdout);
  if (entries < options.minEntries) {
    throw new Error(
      `Archive has ${entries} TOC entries, expected at least ${options.minEntries}. Archive may be corrupt.`,
    );
  }

  const summary = {
    dumpPath: options.dumpPath,
    sizeBytes: size,
    tocEntries: entries,
  };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

runVerify().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
