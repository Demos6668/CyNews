-- Deduplicate advisories with the same source_url, then add a partial unique
-- index to prevent future duplicates. CISA KEV is excluded because all of its
-- entries legitimately share one catalog URL; they are deduplicated by cve_id
-- in the fetcher instead.
--
-- Also adds an index on published_at to speed up the common ORDER BY / WHERE
-- clauses that filter advisories by date.

-- Step 1: Remove duplicate source_url rows (keep the highest id per url).
-- Only applies to rows where source_url is NOT the shared CISA KEV catalog URL
-- and is NOT NULL.
DELETE FROM advisories
WHERE id NOT IN (
  SELECT MAX(id)
  FROM advisories
  WHERE source_url IS NOT NULL
    AND source_url != 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog'
  GROUP BY source_url
)
AND source_url IS NOT NULL
AND source_url != 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog';

-- Step 2: Partial unique index — enforces uniqueness for RSS / NVD advisories
-- while leaving CISA KEV rows (all sharing one URL) untouched.
CREATE UNIQUE INDEX IF NOT EXISTS idx_advisories_source_url_unique
  ON advisories (source_url)
  WHERE source_url IS NOT NULL
    AND source_url != 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog';

-- Step 3: Index on published_at for the ORDER BY / WHERE published_at >= ?
-- queries used by every advisory list, cert-in, and dashboard endpoint.
CREATE INDEX IF NOT EXISTS idx_advisories_published_at
  ON advisories (published_at DESC);
