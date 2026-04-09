ALTER TABLE workspace_threat_matches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS resolved_severity text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamp;
