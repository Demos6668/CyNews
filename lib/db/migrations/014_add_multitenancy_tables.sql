-- Migration 014: Multi-tenancy tables + Better Auth tables
-- All operations are ADDITIVE — no columns dropped, no tables removed.
-- Existing data is backfilled to a DEFAULT_ORG (see step at the bottom).
--
-- Run with:
--   node lib/db/run-migration.cjs lib/db/migrations/014_add_multitenancy_tables.sql
-- Or via drizzle-kit push if using schema push mode.

-- =============================================================================
-- Better Auth core tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS "user" (
  id               TEXT        PRIMARY KEY,
  name             TEXT        NOT NULL,
  email            TEXT        NOT NULL UNIQUE,
  email_verified   BOOLEAN     NOT NULL DEFAULT FALSE,
  image            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  id          TEXT        PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL,
  token       TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address  TEXT,
  user_agent  TEXT,
  user_id     TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_idx ON "session"(user_id);

CREATE TABLE IF NOT EXISTS "account" (
  id                       TEXT        PRIMARY KEY,
  account_id               TEXT        NOT NULL,
  provider_id              TEXT        NOT NULL,
  user_id                  TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token             TEXT,
  refresh_token            TEXT,
  id_token                 TEXT,
  access_token_expires_at  TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope                    TEXT,
  password                 TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_user_idx ON "account"(user_id);

CREATE TABLE IF NOT EXISTS "verification" (
  id          TEXT        PRIMARY KEY,
  identifier  TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification"(identifier);

-- =============================================================================
-- Organizations
-- =============================================================================

CREATE TABLE IF NOT EXISTS organizations (
  id                 TEXT        PRIMARY KEY,
  name               VARCHAR(255) NOT NULL,
  slug               VARCHAR(100) NOT NULL,
  plan               TEXT        NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_uq UNIQUE (slug)
);

-- =============================================================================
-- Memberships
-- =============================================================================

CREATE TABLE IF NOT EXISTS memberships (
  id             TEXT        PRIMARY KEY,
  user_id        TEXT        REFERENCES "user"(id) ON DELETE CASCADE,
  org_id         TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role           TEXT        NOT NULL DEFAULT 'viewer',
  invite_email   VARCHAR(320),
  invite_token   TEXT,
  invite_expires TIMESTAMPTZ,
  joined_at      TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS memberships_user_org_uq
  ON memberships(user_id, org_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS memberships_org_idx ON memberships(org_id);

-- =============================================================================
-- Add orgId to workspaces (additive — nullable for now)
-- =============================================================================

ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS workspaces_org_idx ON workspaces(org_id);

-- =============================================================================
-- Bookmarks (per-user, per-org)
-- =============================================================================

CREATE TABLE IF NOT EXISTS bookmarks (
  id           SERIAL      PRIMARY KEY,
  user_id      TEXT        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  org_id       TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  news_item_id INTEGER     NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bookmarks_user_news_uq UNIQUE (user_id, news_item_id)
);
CREATE INDEX IF NOT EXISTS bookmarks_org_idx ON bookmarks(org_id);

-- =============================================================================
-- Per-org advisory status
-- =============================================================================

CREATE TABLE IF NOT EXISTS org_advisory_status (
  id              SERIAL      PRIMARY KEY,
  org_id          TEXT        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  advisory_id     INTEGER     NOT NULL REFERENCES advisories(id) ON DELETE CASCADE,
  status          TEXT        DEFAULT 'new',
  patch_available BOOLEAN,
  patch_url       TEXT,
  updated_by      TEXT        REFERENCES "user"(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_advisory_status_org_advisory_uq UNIQUE (org_id, advisory_id)
);
CREATE INDEX IF NOT EXISTS org_advisory_status_org_idx ON org_advisory_status(org_id);

-- =============================================================================
-- API Keys (stub — full feature Phase 2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id          SERIAL       PRIMARY KEY,
  org_id      TEXT         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by  TEXT         REFERENCES "user"(id) ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  key_hash    TEXT         NOT NULL,
  key_prefix  VARCHAR(8)   NOT NULL,
  last_used_at TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys(org_id);

-- =============================================================================
-- Alert Rules (stub — full feature Phase 2)
-- =============================================================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id           SERIAL       PRIMARY KEY,
  org_id       TEXT         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by   TEXT         REFERENCES "user"(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  conditions   JSONB        NOT NULL DEFAULT '{}',
  channels     JSONB        NOT NULL DEFAULT '[]',
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
  last_fired_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS alert_rules_org_idx ON alert_rules(org_id);

-- =============================================================================
-- Saved Views
-- =============================================================================

CREATE TABLE IF NOT EXISTS saved_views (
  id         SERIAL       PRIMARY KEY,
  org_id     TEXT         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT         NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  page       VARCHAR(100) NOT NULL,
  name       VARCHAR(255) NOT NULL,
  filters    JSONB        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_views_user_page_idx ON saved_views(user_id, page);

-- =============================================================================
-- Audit Log
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL       PRIMARY KEY,
  org_id        TEXT         REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       TEXT         REFERENCES "user"(id) ON DELETE SET NULL,
  action        TEXT         NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  metadata      JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_org_created_idx ON audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log(user_id);

-- =============================================================================
-- Stripe Events
-- =============================================================================

CREATE TABLE IF NOT EXISTS stripe_events (
  id              SERIAL PRIMARY KEY,
  stripe_event_id TEXT        NOT NULL,
  type            TEXT        NOT NULL,
  org_id          TEXT        REFERENCES organizations(id) ON DELETE SET NULL,
  data            JSONB       NOT NULL,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stripe_events_event_id_uq UNIQUE (stripe_event_id)
);
CREATE INDEX IF NOT EXISTS stripe_events_org_idx ON stripe_events(org_id);

-- =============================================================================
-- Usage Daily
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_daily (
  id               SERIAL  PRIMARY KEY,
  org_id           TEXT    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date             DATE    NOT NULL,
  searches         INTEGER NOT NULL DEFAULT 0,
  advisory_exports INTEGER NOT NULL DEFAULT 0,
  api_calls        INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usage_daily_org_date_uq UNIQUE (org_id, date)
);
CREATE INDEX IF NOT EXISTS usage_daily_date_idx ON usage_daily(date);

-- =============================================================================
-- DEFAULT ORG backfill
-- All existing workspaces are assigned to a single "default" org so that
-- the schema is internally consistent after the migration.
-- The operator can reassign workspaces to real orgs via the admin UI.
-- =============================================================================

DO $$
DECLARE
  default_org_id TEXT := 'org_default_000000000000';
BEGIN
  -- Create the default org if it doesn't exist
  INSERT INTO organizations (id, name, slug, plan)
  VALUES (default_org_id, 'Default Organisation', 'default', 'free')
  ON CONFLICT (id) DO NOTHING;

  -- Back-fill all workspaces that have no orgId yet
  UPDATE workspaces SET org_id = default_org_id WHERE org_id IS NULL;
END $$;
