-- GIN trigram indexes for full-text search performance
-- Run: psql $DATABASE_URL -f lib/db/migrations/005_add_search_indexes.sql

-- Enable pg_trgm extension for trigram-based fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- news_items trigram indexes
CREATE INDEX IF NOT EXISTS idx_news_items_title_trgm ON news_items USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_news_items_summary_trgm ON news_items USING gin (summary gin_trgm_ops);

-- threat_intel trigram indexes
CREATE INDEX IF NOT EXISTS idx_threat_intel_title_trgm ON threat_intel USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_threat_intel_summary_trgm ON threat_intel USING gin (summary gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_threat_intel_description_trgm ON threat_intel USING gin (description gin_trgm_ops);

-- advisories trigram indexes
CREATE INDEX IF NOT EXISTS idx_advisories_title_trgm ON advisories USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_advisories_description_trgm ON advisories USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_advisories_cve_id_trgm ON advisories USING gin (cve_id gin_trgm_ops);

-- B-tree indexes for source and severity filtering
CREATE INDEX IF NOT EXISTS idx_news_items_source ON news_items(source);
CREATE INDEX IF NOT EXISTS idx_threat_intel_source ON threat_intel(source);
CREATE INDEX IF NOT EXISTS idx_advisories_severity ON advisories(severity);
