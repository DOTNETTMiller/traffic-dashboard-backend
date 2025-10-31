-- =====================================================================
-- Pennsylvania Database Cleanup Script
-- =====================================================================
-- This script removes polluted Pennsylvania events from the database
-- and keeps only legitimate PennDOT RCRS events
--
-- PROBLEM: Database contains 2,810 PA events, but only 519 are legitimate
-- SOLUTION: Delete 2,291 polluted events from Ohio, California, NJ, etc.
--
-- Run this on Railway PostgreSQL database:
--   railway run bash -c "psql \$DATABASE_URL < scripts/cleanup_pa_database.sql"
-- =====================================================================

-- First, let's see what we're dealing with
SELECT
  'BEFORE CLEANUP' as stage,
  COUNT(*) as total_pa_events,
  COUNT(*) FILTER (WHERE source LIKE '%PennDOT RCRS%') as legitimate_events,
  COUNT(*) FILTER (WHERE source NOT LIKE '%PennDOT RCRS%' AND source IS NOT NULL) as polluted_with_source,
  COUNT(*) FILTER (WHERE source IS NULL) as polluted_no_source
FROM events
WHERE state = 'PA';

-- Show breakdown by source
SELECT
  COALESCE(source, 'NULL/Unknown') as source,
  COUNT(*) as count
FROM events
WHERE state = 'PA'
GROUP BY source
ORDER BY count DESC;

-- Now delete all Pennsylvania events that are NOT from PennDOT RCRS
DELETE FROM events
WHERE state = 'PA'
  AND (source NOT LIKE '%PennDOT RCRS%' OR source IS NULL);

-- Show results after cleanup
SELECT
  'AFTER CLEANUP' as stage,
  COUNT(*) as total_pa_events,
  COUNT(*) FILTER (WHERE source LIKE '%PennDOT RCRS%') as penndot_events,
  COUNT(*) FILTER (WHERE coordinates IS NOT NULL) as events_with_coords
FROM events
WHERE state = 'PA';

-- Final verification - show all remaining sources
SELECT
  source,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE coordinates IS NOT NULL) as with_coords
FROM events
WHERE state = 'PA'
GROUP BY source
ORDER BY count DESC;

-- Success message
\echo '========================================='
\echo 'Pennsylvania Database Cleanup Complete!'
\echo '========================================='
