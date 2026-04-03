-- Full-text search tsvector indexes for relevance-ranked search
-- Run: psql $DATABASE_URL -f lib/db/migrations/009_add_fts_indexes.sql

-- news_items: weighted tsvector (title A, summary B, content C)
CREATE INDEX IF NOT EXISTS idx_news_items_fts ON news_items USING gin (
  (setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
   setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
   setweight(to_tsvector('english', coalesce(content, '')), 'C'))
);

-- threat_intel: weighted tsvector (title A, summary B, description C)
CREATE INDEX IF NOT EXISTS idx_threat_intel_fts ON threat_intel USING gin (
  (setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
   setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
   setweight(to_tsvector('english', coalesce(description, '')), 'C'))
);

-- advisories: weighted tsvector (title A, cve_id A, description B)
CREATE INDEX IF NOT EXISTS idx_advisories_fts ON advisories USING gin (
  (setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
   setweight(to_tsvector('english', coalesce(cve_id, '')), 'A') ||
   setweight(to_tsvector('english', coalesce(description, '')), 'B'))
);
