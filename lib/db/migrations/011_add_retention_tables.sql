CREATE TABLE IF NOT EXISTS archived_records (
  id SERIAL PRIMARY KEY,
  record_type TEXT NOT NULL,
  source_record_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  source TEXT,
  source_url TEXT,
  published_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  archived_at TIMESTAMP NOT NULL DEFAULT NOW(),
  purge_after TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS archived_records_record_type_source_record_id_idx
  ON archived_records (record_type, source_record_id);

CREATE INDEX IF NOT EXISTS archived_records_purge_after_idx
  ON archived_records (purge_after);

CREATE TABLE IF NOT EXISTS maintenance_runs (
  id SERIAL PRIMARY KEY,
  job_type TEXT NOT NULL,
  state TEXT NOT NULL,
  rows_archived INTEGER NOT NULL DEFAULT 0,
  rows_purged INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS maintenance_runs_job_type_idx
  ON maintenance_runs (job_type);

CREATE INDEX IF NOT EXISTS maintenance_runs_started_at_idx
  ON maintenance_runs (started_at);
