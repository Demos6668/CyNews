-- Phase 1: Soft-delete columns on users, organizations, workspaces
-- and delete_requests table for the data-lifecycle state machine.

-- users
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMP;
CREATE INDEX IF NOT EXISTS user_purge_idx ON "user" (purge_after) WHERE deleted_at IS NOT NULL;

-- organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMP;
CREATE INDEX IF NOT EXISTS organizations_purge_idx ON organizations (purge_after) WHERE deleted_at IS NOT NULL;

-- workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMP;
CREATE INDEX IF NOT EXISTS workspaces_purge_idx ON workspaces (purge_after) WHERE deleted_at IS NOT NULL;

-- delete_requests — tracks every pending / confirmed / cancelled / purged deletion
CREATE TABLE IF NOT EXISTS delete_requests (
  id            TEXT PRIMARY KEY,
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('user', 'org', 'workspace')),
  subject_id    TEXT NOT NULL,
  requested_by  TEXT NOT NULL,
  requested_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  confirm_after TIMESTAMP NOT NULL,
  purge_after   TIMESTAMP NOT NULL,
  state         TEXT NOT NULL DEFAULT 'pending'
                  CHECK (state IN ('pending', 'confirmed', 'cancelled', 'purged')),
  reason        TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS delete_requests_subject_idx ON delete_requests (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS delete_requests_purge_idx   ON delete_requests (purge_after);
CREATE INDEX IF NOT EXISTS delete_requests_state_idx   ON delete_requests (state);
