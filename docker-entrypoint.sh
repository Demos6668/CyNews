#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node -e "
const pg = require('pg');
const fs = require('fs');
const path = require('path');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const dir = path.resolve(process.cwd(), 'lib/db/migrations');
  if (!fs.existsSync(dir)) { console.log('No migrations directory found, skipping'); return; }

  // Create tracking table if it doesn't exist
  await pool.query(\`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT now()
    )
  \`);

  // Get already-applied migrations
  const { rows: applied } = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename');
  const appliedSet = new Set(applied.map(r => r.filename));

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    console.log('  Applying ' + file + '...');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES (\$1)', [file]);
      await pool.query('COMMIT');
      count++;
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  }
  console.log('[entrypoint] Migrations complete (' + count + ' applied, ' + (files.length - count) + ' already up to date)');
  await pool.end();
}
run().catch(e => { console.error('Migration failed:', e); process.exit(1); });
"

echo "[entrypoint] Starting server..."
exec node artifacts/api-server/dist/index.cjs
