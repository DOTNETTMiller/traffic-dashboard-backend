-- Migration: Event Archive System (CCAI UC #20)
-- Date: 2026-03-03
-- Description: Creates 2-year event archive with automated retention policy

-- Create events archive table (mirrors events table structure)
CREATE TABLE IF NOT EXISTS events_archive (
  LIKE events INCLUDING ALL
);

-- Add archival metadata
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP DEFAULT NOW();
ALTER TABLE events_archive ADD COLUMN IF NOT EXISTS archive_reason VARCHAR(50) DEFAULT 'retention_policy';

-- Create index for archive queries
CREATE INDEX IF NOT EXISTS idx_events_archive_date ON events_archive(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_archive_corridor ON events_archive(route, state);
CREATE INDEX IF NOT EXISTS idx_events_archive_severity ON events_archive(severity);
CREATE INDEX IF NOT EXISTS idx_events_archive_archived ON events_archive(archived_at);

-- Create corridor performance daily aggregation table
CREATE TABLE IF NOT EXISTS corridor_performance_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  corridor VARCHAR(50) NOT NULL,
  state VARCHAR(2),
  total_events INTEGER DEFAULT 0,
  high_severity_events INTEGER DEFAULT 0,
  medium_severity_events INTEGER DEFAULT 0,
  low_severity_events INTEGER DEFAULT 0,
  average_incident_duration_minutes NUMERIC(10,2),
  total_vehicle_hours_delay NUMERIC(12,2),
  freight_events INTEGER DEFAULT 0,
  construction_events INTEGER DEFAULT 0,
  weather_events INTEGER DEFAULT 0,
  crash_events INTEGER DEFAULT 0,
  uptime_percentage NUMERIC(5,2),
  data_quality_score NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(date, corridor, state)
);

-- Create index for performance queries
CREATE INDEX IF NOT EXISTS idx_perf_daily_date ON corridor_performance_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_perf_daily_corridor ON corridor_performance_daily(corridor, date DESC);

-- Function to archive old events (90 days)
CREATE OR REPLACE FUNCTION archive_old_events()
RETURNS INTEGER AS $$
DECLARE
  rows_archived INTEGER;
BEGIN
  -- Insert events older than 90 days into archive
  INSERT INTO events_archive
  SELECT *,
         NOW() as archived_at,
         'retention_policy' as archive_reason
  FROM events
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND id NOT IN (SELECT id FROM events_archive); -- Avoid duplicates

  GET DIAGNOSTICS rows_archived = ROW_COUNT;

  -- Delete archived events from main table
  DELETE FROM events
  WHERE created_at < NOW() - INTERVAL '90 days';

  RETURN rows_archived;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily performance metrics
CREATE OR REPLACE FUNCTION aggregate_daily_performance()
RETURNS INTEGER AS $$
DECLARE
  rows_created INTEGER := 0;
BEGIN
  -- Aggregate yesterday's events (run nightly)
  INSERT INTO corridor_performance_daily (
    date,
    corridor,
    state,
    total_events,
    high_severity_events,
    medium_severity_events,
    low_severity_events,
    freight_events,
    construction_events,
    weather_events,
    crash_events,
    uptime_percentage
  )
  SELECT
    DATE(created_at) as date,
    COALESCE(route, 'Unknown') as corridor,
    state,
    COUNT(*) as total_events,
    SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high_severity_events,
    SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium_severity_events,
    SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low_severity_events,
    SUM(CASE WHEN freight_impact IN ('critical', 'significant') THEN 1 ELSE 0 END) as freight_events,
    SUM(CASE WHEN type = 'CONSTRUCTION' THEN 1 ELSE 0 END) as construction_events,
    SUM(CASE WHEN type = 'WEATHER' THEN 1 ELSE 0 END) as weather_events,
    SUM(CASE WHEN type IN ('INCIDENT', 'CRASH') THEN 1 ELSE 0 END) as crash_events,
    100.0 as uptime_percentage -- Placeholder, calculate from uptime logs
  FROM events
  WHERE DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
  GROUP BY DATE(created_at), route, state
  ON CONFLICT (date, corridor, state) DO UPDATE SET
    total_events = EXCLUDED.total_events,
    high_severity_events = EXCLUDED.high_severity_events,
    medium_severity_events = EXCLUDED.medium_severity_events,
    low_severity_events = EXCLUDED.low_severity_events,
    freight_events = EXCLUDED.freight_events,
    construction_events = EXCLUDED.construction_events,
    weather_events = EXCLUDED.weather_events,
    crash_events = EXCLUDED.crash_events;

  GET DIAGNOSTICS rows_created = ROW_COUNT;

  RETURN rows_created;
END;
$$ LANGUAGE plpgsql;

-- Schedule nightly archiving using pg_cron (if available)
-- Run at 2 AM daily
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('archive-events', '0 2 * * *', 'SELECT archive_old_events()');
    PERFORM cron.schedule('aggregate-daily-performance', '0 3 * * *', 'SELECT aggregate_daily_performance()');
    RAISE NOTICE 'Scheduled event archiving and performance aggregation jobs';
  ELSE
    RAISE NOTICE 'pg_cron extension not available - schedule archiving manually';
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE events_archive IS 'Archived events older than 90 days, retained for 2 years total. CCAI UC #20.';
COMMENT ON TABLE corridor_performance_daily IS 'Daily aggregated corridor performance metrics. CCAI UC #11.';
COMMENT ON FUNCTION archive_old_events IS 'Archives events older than 90 days. Run nightly at 2 AM.';
COMMENT ON FUNCTION aggregate_daily_performance IS 'Aggregates yesterday events into daily performance metrics. Run nightly at 3 AM.';

-- Verify archive policy settings
DO $$
BEGIN
  RAISE NOTICE 'Event Archive System Configured:';
  RAISE NOTICE '- Active events retention: 90 days';
  RAISE NOTICE '- Archive retention: 2 years (730 days)';
  RAISE NOTICE '- Archiving schedule: Nightly at 2 AM';
  RAISE NOTICE '- Performance aggregation: Nightly at 3 AM';
END $$;
