-- Add indexes on status columns used heavily by dashboard and list queries

CREATE INDEX IF NOT EXISTS idx_news_items_status ON news_items (status);
CREATE INDEX IF NOT EXISTS idx_threat_intel_status ON threat_intel (status);
CREATE INDEX IF NOT EXISTS idx_advisories_status ON advisories (status);

-- Composite index for dashboard critical/high alert queries (severity + status)
CREATE INDEX IF NOT EXISTS idx_news_items_severity_status ON news_items (severity, status);
CREATE INDEX IF NOT EXISTS idx_threat_intel_severity_status ON threat_intel (severity, status);
