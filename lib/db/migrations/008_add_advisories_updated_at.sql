-- Add updated_at column to advisories table for change tracking
-- Backfill existing rows with published_at value

ALTER TABLE advisories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();
UPDATE advisories SET updated_at = published_at WHERE updated_at = now() AND published_at != now();
