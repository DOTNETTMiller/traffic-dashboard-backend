-- Event Lifecycle Tracking Table
-- Persists event tracking data across server restarts

CREATE TABLE IF NOT EXISTS event_lifecycle (
  event_id VARCHAR(255) PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  first_seen TIMESTAMP NOT NULL,
  last_seen TIMESTAMP NOT NULL,
  seen_count INTEGER DEFAULT 1,
  original_end_time TIMESTAMP,
  current_end_time TIMESTAMP,
  extension_count INTEGER DEFAULT 0,
  has_native_end_time BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_event_lifecycle_source ON event_lifecycle(source);
CREATE INDEX IF NOT EXISTS idx_event_lifecycle_last_seen ON event_lifecycle(last_seen);
CREATE INDEX IF NOT EXISTS idx_event_lifecycle_current_end_time ON event_lifecycle(current_end_time);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_lifecycle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS event_lifecycle_updated_at ON event_lifecycle;
CREATE TRIGGER event_lifecycle_updated_at
  BEFORE UPDATE ON event_lifecycle
  FOR EACH ROW
  EXECUTE FUNCTION update_event_lifecycle_timestamp();

-- Cleanup function to remove old expired events (not seen in 24 hours)
CREATE OR REPLACE FUNCTION cleanup_expired_event_lifecycle()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM event_lifecycle
  WHERE last_seen < CURRENT_TIMESTAMP - INTERVAL '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- View for lifecycle statistics
CREATE OR REPLACE VIEW event_lifecycle_stats AS
SELECT
  source,
  COUNT(*) as total_events,
  COUNT(CASE WHEN has_native_end_time THEN 1 END) as with_native_end_time,
  COUNT(CASE WHEN NOT has_native_end_time THEN 1 END) as with_estimated_end_time,
  COUNT(CASE WHEN extension_count > 0 THEN 1 END) as extended_events,
  ROUND(AVG(seen_count), 1) as avg_seen_count,
  ROUND(AVG(extension_count), 1) as avg_extensions,
  MAX(last_seen) as most_recent_update
FROM event_lifecycle
GROUP BY source;

COMMENT ON TABLE event_lifecycle IS 'Tracks event lifecycle including first/last seen times and end time extensions';
COMMENT ON COLUMN event_lifecycle.event_id IS 'Unique event identifier';
COMMENT ON COLUMN event_lifecycle.source IS 'Source state or feed (e.g., IA, OH-API, CA-LCS)';
COMMENT ON COLUMN event_lifecycle.first_seen IS 'When event was first observed in feed';
COMMENT ON COLUMN event_lifecycle.last_seen IS 'Most recent time event was observed in feed';
COMMENT ON COLUMN event_lifecycle.seen_count IS 'Number of times event has been seen in feed refreshes';
COMMENT ON COLUMN event_lifecycle.original_end_time IS 'Original end time from feed (if provided)';
COMMENT ON COLUMN event_lifecycle.current_end_time IS 'Current end time (may be extended)';
COMMENT ON COLUMN event_lifecycle.extension_count IS 'Number of times end time has been extended';
COMMENT ON COLUMN event_lifecycle.has_native_end_time IS 'True if event had end time in original feed';
