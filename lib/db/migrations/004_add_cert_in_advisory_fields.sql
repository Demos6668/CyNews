-- CERT-In advisory fields
-- Run: psql $DATABASE_URL -f lib/db/migrations/004_add_cert_in_advisory_fields.sql

ALTER TABLE advisories ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS source VARCHAR(100);
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS is_cert_in BOOLEAN DEFAULT false;
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS cert_in_id VARCHAR(50);
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS cert_in_type VARCHAR(50);
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS cve_ids JSONB DEFAULT '[]';
ALTER TABLE advisories ADD COLUMN IF NOT EXISTS recommendations JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_advisories_cert_in_id ON advisories (cert_in_id) WHERE cert_in_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_advisories_is_cert_in ON advisories (is_cert_in) WHERE is_cert_in = true;
