// Cross-platform migration runner (replaces psql $DATABASE_URL -f <file>)
// Usage: node run-migration.cjs ./migrations/001_add_feed_indexes.sql
const { Pool } = require("pg");
const { readFileSync } = require("fs");
const { resolve } = require("path");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node run-migration.cjs <migration-file>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = readFileSync(resolve(__dirname, file), "utf8");

pool
  .query(sql)
  .then(() => {
    console.log(`Applied ${file}`);
    return pool.end();
  })
  .catch((err) => {
    console.error(`Failed ${file}:`, err.message);
    process.exit(1);
  });
