#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node -e "
const pg = require('pg');
const fs = require('fs');
const path = require('path');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const dir = path.resolve(__dirname, 'lib/db/migrations');
  if (!fs.existsSync(dir)) { console.log('No migrations directory found, skipping'); return; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    console.log('  Applying ' + file + '...');
    await pool.query(sql);
  }
  console.log('[entrypoint] Migrations complete');
  await pool.end();
}
run().catch(e => { console.error('Migration failed:', e); process.exit(1); });
"

echo "[entrypoint] Starting server..."
exec node artifacts/api-server/dist/index.cjs
