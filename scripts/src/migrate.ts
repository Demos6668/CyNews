import { resolve } from "path";
import { readFileSync, readdirSync } from "fs";
import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function runMigrations(): Promise<void> {
  const migrationsDir = resolve(import.meta.dirname, "../../lib/db/migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const sql = readFileSync(resolve(migrationsDir, file), "utf-8");
    console.log(`Running ${file}...`);
    await pool.query(sql);
    console.log(`  ✓ ${file} applied`);
  }

  console.log("All migrations applied successfully");
  await pool.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
