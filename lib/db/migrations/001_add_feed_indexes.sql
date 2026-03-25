-- Indexes for feed aggregator performance
-- Run: psql $DATABASE_URL -f lib/db/migrations/001_add_feed_indexes.sql

CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_severity ON news_items(severity);
CREATE INDEX IF NOT EXISTS idx_news_items_scope ON news_items(scope);
CREATE INDEX IF NOT EXISTS idx_news_items_source_url ON news_items(source_url);

CREATE INDEX IF NOT EXISTS idx_threat_intel_published_at ON threat_intel(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_intel_severity ON threat_intel(severity);
CREATE INDEX IF NOT EXISTS idx_threat_intel_scope ON threat_intel(scope);
CREATE INDEX IF NOT EXISTS idx_threat_intel_source_url ON threat_intel(source_url);
