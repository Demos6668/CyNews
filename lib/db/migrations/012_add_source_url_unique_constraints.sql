-- Add unique constraints on source_url for news_items and threat_intel.
-- Without these, ON CONFLICT (source_url) DO NOTHING throws a PostgreSQL error,
-- causing the feed scheduler to silently skip all new article inserts.

-- Deduplicate first (keep highest id per url), then add unique indexes.
-- These run idempotently: CREATE INDEX IF NOT EXISTS does nothing if already present.

DELETE FROM news_items
WHERE id NOT IN (
  SELECT MAX(id) FROM news_items GROUP BY source_url
);

DELETE FROM threat_intel
WHERE id NOT IN (
  SELECT MAX(id) FROM threat_intel GROUP BY source_url
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_items_source_url_unique
  ON news_items (source_url);

CREATE UNIQUE INDEX IF NOT EXISTS idx_threat_intel_source_url_unique
  ON threat_intel (source_url);
