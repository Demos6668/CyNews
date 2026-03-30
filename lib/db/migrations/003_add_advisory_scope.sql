-- Scope and India fields for advisories
-- Run: psql $DATABASE_URL -f lib/db/migrations/003_add_advisory_scope.sql

ALTER TABLE advisories ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'global';
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS is_india_related BOOLEAN DEFAULT false;
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS india_confidence INTEGER DEFAULT 0;
