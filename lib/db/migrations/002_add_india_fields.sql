-- India-specific fields for scope classification
-- Run: psql $DATABASE_URL -f lib/db/migrations/002_add_india_fields.sql

ALTER TABLE threat_intel ADD COLUMN IF NOT EXISTS is_india_related boolean DEFAULT false;
ALTER TABLE threat_intel ADD COLUMN IF NOT EXISTS india_confidence integer DEFAULT 0;
ALTER TABLE threat_intel ADD COLUMN IF NOT EXISTS indian_state varchar(5);
ALTER TABLE threat_intel ADD COLUMN IF NOT EXISTS indian_state_name varchar(100);
ALTER TABLE threat_intel ADD COLUMN IF NOT EXISTS indian_city varchar(100);
ALTER TABLE threat_intel ADD COLUMN IF NOT EXISTS indian_sector varchar(100);

ALTER TABLE news_items ADD COLUMN IF NOT EXISTS is_india_related boolean DEFAULT false;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS india_confidence integer DEFAULT 0;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS indian_state varchar(5);
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS indian_state_name varchar(100);
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS indian_city varchar(100);
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS indian_sector varchar(100);

CREATE INDEX IF NOT EXISTS idx_threat_intel_indian_state ON threat_intel(indian_state) WHERE indian_state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threat_intel_indian_sector ON threat_intel(indian_sector) WHERE indian_sector IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_items_indian_state ON news_items(indian_state) WHERE indian_state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_items_indian_sector ON news_items(indian_sector) WHERE indian_sector IS NOT NULL;
