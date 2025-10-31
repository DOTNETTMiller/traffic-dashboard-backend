-- Quick Pennsylvania database cleanup
-- Delete all PA events that are NOT from PennDOT RCRS

DELETE FROM events
WHERE state = 'PA'
  AND (source NOT LIKE '%PennDOT RCRS%' OR source IS NULL);

-- Show results
SELECT COUNT(*) as remaining_pa_events FROM events WHERE state = 'PA';
