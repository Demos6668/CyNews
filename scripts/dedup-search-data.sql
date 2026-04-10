-- Deduplicate threat_intel and news_items, then add unique indexes.
-- Run once: psql $DATABASE_URL -f scripts/dedup-search-data.sql
--
-- IMPORTANT: This permanently deletes duplicate rows (keeps lowest id per source_url).
-- Take a database backup before running in production.

BEGIN;

-- ── threat_intel ──────────────────────────────────────────────────────────────
-- Count before
DO $$
DECLARE
  total_before  bigint;
  unique_count  bigint;
BEGIN
  SELECT COUNT(*) INTO total_before FROM threat_intel;
  SELECT COUNT(DISTINCT source_url) INTO unique_count
    FROM threat_intel WHERE source_url IS NOT NULL;
  RAISE NOTICE 'threat_intel before: % rows, % unique source_urls', total_before, unique_count;
END $$;

DELETE FROM threat_intel
WHERE id NOT IN (
  SELECT MIN(id)
  FROM threat_intel
  WHERE source_url IS NOT NULL
  GROUP BY source_url
)
AND source_url IS NOT NULL;

DO $$
DECLARE total_after bigint;
BEGIN
  SELECT COUNT(*) INTO total_after FROM threat_intel;
  RAISE NOTICE 'threat_intel after:  % rows', total_after;
END $$;

-- ── news_items ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  total_before  bigint;
  unique_count  bigint;
BEGIN
  SELECT COUNT(*) INTO total_before FROM news_items;
  SELECT COUNT(DISTINCT source_url) INTO unique_count
    FROM news_items WHERE source_url IS NOT NULL;
  RAISE NOTICE 'news_items before: % rows, % unique source_urls', total_before, unique_count;
END $$;

DELETE FROM news_items
WHERE id NOT IN (
  SELECT MIN(id)
  FROM news_items
  WHERE source_url IS NOT NULL
  GROUP BY source_url
)
AND source_url IS NOT NULL;

DO $$
DECLARE total_after bigint;
BEGIN
  SELECT COUNT(*) INTO total_after FROM news_items;
  RAISE NOTICE 'news_items after:  % rows', total_after;
END $$;

COMMIT;

-- ── Unique partial indexes (outside transaction — CONCURRENTLY not allowed inside BEGIN) ─
-- If you're on a live system with concurrent writes, replace with CREATE UNIQUE INDEX CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS threat_intel_source_url_uq
  ON threat_intel (source_url)
  WHERE source_url IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS news_items_source_url_uq
  ON news_items (source_url)
  WHERE source_url IS NOT NULL;
