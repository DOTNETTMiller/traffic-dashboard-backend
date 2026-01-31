-- Setup table to track corridor update checks
-- This allows you to monitor when corridors were last checked and what changed

CREATE TABLE IF NOT EXISTS corridor_update_checks (
  id SERIAL PRIMARY KEY,
  check_date TIMESTAMP NOT NULL DEFAULT NOW(),
  up_to_date_count INTEGER NOT NULL DEFAULT 0,
  needs_update_count INTEGER NOT NULL DEFAULT 0,
  significant_update_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  results JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_corridor_update_checks_date ON corridor_update_checks(check_date DESC);

-- Add updated_at tracking to corridors table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'corridors' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE corridors ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Add created_at tracking to corridors table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'corridors' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE corridors ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
  END IF;
END $$;

-- Create view for latest update check summary
CREATE OR REPLACE VIEW latest_corridor_update_status AS
SELECT
  c.id,
  c.name,
  c.description,
  c.updated_at as last_geometry_update,
  jsonb_array_length((c.geometry->'coordinates')) as point_count,
  CASE
    WHEN c.updated_at IS NULL THEN 'Never updated'
    WHEN c.updated_at < NOW() - INTERVAL '6 months' THEN 'Needs significant update'
    WHEN c.updated_at < NOW() - INTERVAL '3 months' THEN 'Needs update'
    WHEN c.updated_at < NOW() - INTERVAL '1 month' THEN 'Recently updated'
    ELSE 'Up to date'
  END as status,
  EXTRACT(days FROM (NOW() - c.updated_at))::INTEGER as days_since_update
FROM corridors c
WHERE c.name LIKE 'I-%'
ORDER BY c.updated_at ASC NULLS FIRST;

-- Comments for documentation
COMMENT ON TABLE corridor_update_checks IS 'Tracks periodic checks of corridor geometry freshness against OpenStreetMap';
COMMENT ON VIEW latest_corridor_update_status IS 'Quick view of which corridors need geometry updates';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT ON corridor_update_checks TO your_app_user;
-- GRANT SELECT ON latest_corridor_update_status TO your_app_user;

-- Show current status
SELECT
  status,
  COUNT(*) as corridor_count,
  array_agg(name ORDER BY days_since_update DESC) as corridors
FROM latest_corridor_update_status
GROUP BY status
ORDER BY
  CASE status
    WHEN 'Never updated' THEN 1
    WHEN 'Needs significant update' THEN 2
    WHEN 'Needs update' THEN 3
    WHEN 'Recently updated' THEN 4
    ELSE 5
  END;
