-- Composite indexes for workspace threat match queries
-- Used by getWorkspaceFeed (workspace_id + dismissed) and dedup check (workspace_id + threat_id)

CREATE INDEX IF NOT EXISTS idx_wtm_workspace_dismissed
  ON workspace_threat_matches (workspace_id, dismissed);

CREATE INDEX IF NOT EXISTS idx_wtm_workspace_threat
  ON workspace_threat_matches (workspace_id, threat_id);
