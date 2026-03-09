-- Migration: Cross-Border Geofencing Alerts (CCAI UC #17)
-- Date: 2026-03-03
-- Description: Automatic adjacent state notifications based on event proximity to borders

-- Border proximity configuration table
CREATE TABLE IF NOT EXISTS border_proximity_config (
  id SERIAL PRIMARY KEY,
  distance_threshold_miles INTEGER DEFAULT 50,
  auto_notify_enabled BOOLEAN DEFAULT true,
  notification_severity_threshold VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_severity CHECK (notification_severity_threshold IN ('low', 'medium', 'high'))
);

-- Insert default configuration
INSERT INTO border_proximity_config (distance_threshold_miles, auto_notify_enabled, notification_severity_threshold)
VALUES (50, true, 'medium')
ON CONFLICT DO NOTHING;

-- Border notification log
CREATE TABLE IF NOT EXISTS border_notifications (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  source_state VARCHAR(2) NOT NULL,
  notified_state VARCHAR(2) NOT NULL,
  distance_to_border_miles NUMERIC(10,2),
  notification_type VARCHAR(50) DEFAULT 'auto_geofence',
  notification_sent_at TIMESTAMP DEFAULT NOW(),
  message_id INTEGER,
  event_severity VARCHAR(20),
  event_type VARCHAR(100)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_border_notifications_event ON border_notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_border_notifications_states ON border_notifications(source_state, notified_state);
CREATE INDEX IF NOT EXISTS idx_border_notifications_date ON border_notifications(notification_sent_at DESC);

-- State border geometries (simplified - can be enhanced with actual border lines)
CREATE TABLE IF NOT EXISTS state_borders (
  id SERIAL PRIMARY KEY,
  state_code VARCHAR(2) NOT NULL,
  adjacent_state_code VARCHAR(2) NOT NULL,
  border_geometry GEOMETRY(LINESTRING, 4326),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(state_code, adjacent_state_code)
);

-- Add comments
COMMENT ON TABLE border_proximity_config IS 'Configuration for automatic border proximity notifications. CCAI UC #17.';
COMMENT ON TABLE border_notifications IS 'Log of all automatic border proximity notifications sent';
COMMENT ON TABLE state_borders IS 'State border geometries for precise distance calculations';

-- Function to get adjacent states for a state
CREATE OR REPLACE FUNCTION get_adjacent_states(p_state_code VARCHAR(2))
RETURNS TABLE(adjacent_state VARCHAR(2)) AS $$
BEGIN
  -- Hardcoded adjacency map for major corridor states
  -- This is a simplified version - can be replaced with actual border geometry queries

  RETURN QUERY
  SELECT CASE
    -- Iowa adjacencies
    WHEN p_state_code = 'IA' THEN unnest(ARRAY['MN', 'WI', 'IL', 'MO', 'NE', 'SD'])
    -- Minnesota adjacencies
    WHEN p_state_code = 'MN' THEN unnest(ARRAY['ND', 'SD', 'IA', 'WI'])
    -- Missouri adjacencies
    WHEN p_state_code = 'MO' THEN unnest(ARRAY['IA', 'NE', 'KS', 'OK', 'AR', 'TN', 'KY', 'IL'])
    -- Kansas adjacencies
    WHEN p_state_code = 'KS' THEN unnest(ARRAY['NE', 'MO', 'OK', 'CO'])
    -- Nebraska adjacencies
    WHEN p_state_code = 'NE' THEN unnest(ARRAY['SD', 'IA', 'MO', 'KS', 'CO', 'WY'])
    -- Texas adjacencies
    WHEN p_state_code = 'TX' THEN unnest(ARRAY['OK', 'AR', 'LA', 'NM'])
    -- Oklahoma adjacencies
    WHEN p_state_code = 'OK' THEN unnest(ARRAY['KS', 'MO', 'AR', 'TX', 'NM', 'CO'])
    -- Colorado adjacencies
    WHEN p_state_code = 'CO' THEN unnest(ARRAY['WY', 'NE', 'KS', 'OK', 'NM', 'UT'])
    -- California adjacencies
    WHEN p_state_code = 'CA' THEN unnest(ARRAY['OR', 'NV', 'AZ'])
    -- Oregon adjacencies
    WHEN p_state_code = 'OR' THEN unnest(ARRAY['WA', 'ID', 'NV', 'CA'])
    -- Washington adjacencies
    WHEN p_state_code = 'WA' THEN unnest(ARRAY['ID', 'OR'])
    -- Arizona adjacencies
    WHEN p_state_code = 'AZ' THEN unnest(ARRAY['CA', 'NV', 'UT', 'NM'])
    -- Nevada adjacencies
    WHEN p_state_code = 'NV' THEN unnest(ARRAY['OR', 'ID', 'UT', 'AZ', 'CA'])
    -- New Mexico adjacencies
    WHEN p_state_code = 'NM' THEN unnest(ARRAY['CO', 'OK', 'TX', 'AZ'])
    -- Utah adjacencies
    WHEN p_state_code = 'UT' THEN unnest(ARRAY['ID', 'WY', 'CO', 'NM', 'AZ', 'NV'])
    -- Wyoming adjacencies
    WHEN p_state_code = 'WY' THEN unnest(ARRAY['MT', 'SD', 'NE', 'CO', 'UT', 'ID'])
    -- South Dakota adjacencies
    WHEN p_state_code = 'SD' THEN unnest(ARRAY['ND', 'MN', 'IA', 'NE', 'WY', 'MT'])
    -- North Dakota adjacencies
    WHEN p_state_code = 'ND' THEN unnest(ARRAY['MN', 'SD', 'MT'])
    -- Montana adjacencies
    WHEN p_state_code = 'MT' THEN unnest(ARRAY['ND', 'SD', 'WY', 'ID'])
    -- Idaho adjacencies
    WHEN p_state_code = 'ID' THEN unnest(ARRAY['MT', 'WY', 'UT', 'NV', 'OR', 'WA'])
    -- Illinois adjacencies
    WHEN p_state_code = 'IL' THEN unnest(ARRAY['WI', 'IA', 'MO', 'KY', 'IN'])
    -- Wisconsin adjacencies
    WHEN p_state_code = 'WI' THEN unnest(ARRAY['MN', 'IA', 'IL', 'MI'])
    -- Indiana adjacencies
    WHEN p_state_code = 'IN' THEN unnest(ARRAY['MI', 'OH', 'KY', 'IL'])
    -- Michigan adjacencies
    WHEN p_state_code = 'MI' THEN unnest(ARRAY['WI', 'IN', 'OH'])
    -- Ohio adjacencies
    WHEN p_state_code = 'OH' THEN unnest(ARRAY['MI', 'IN', 'KY', 'WV', 'PA'])
    -- Pennsylvania adjacencies
    WHEN p_state_code = 'PA' THEN unnest(ARRAY['NY', 'NJ', 'DE', 'MD', 'WV', 'OH'])
    ELSE NULL
  END AS adjacent_state
  WHERE p_state_code IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to estimate distance from event to nearest state border
-- Simplified version using bounding box approximation
CREATE OR REPLACE FUNCTION estimate_distance_to_border(
  p_lat NUMERIC,
  p_lon NUMERIC,
  p_state_code VARCHAR(2)
)
RETURNS NUMERIC AS $$
DECLARE
  v_distance NUMERIC;
  -- State bounding boxes (approximate)
  v_min_lat NUMERIC;
  v_max_lat NUMERIC;
  v_min_lon NUMERIC;
  v_max_lon NUMERIC;
  v_dist_to_edge NUMERIC;
BEGIN
  -- Simplified bounding boxes for major states (in degrees)
  -- These are approximations - can be replaced with actual state polygon queries

  CASE p_state_code
    WHEN 'IA' THEN
      v_min_lat := 40.4; v_max_lat := 43.5;
      v_min_lon := -96.6; v_max_lon := -90.1;
    WHEN 'MN' THEN
      v_min_lat := 43.5; v_max_lat := 49.4;
      v_min_lon := -97.2; v_max_lon := -89.5;
    WHEN 'MO' THEN
      v_min_lat := 36.0; v_max_lat := 40.6;
      v_min_lon := -95.8; v_max_lon := -89.1;
    WHEN 'KS' THEN
      v_min_lat := 37.0; v_max_lat := 40.0;
      v_min_lon := -102.0; v_max_lon := -94.6;
    WHEN 'NE' THEN
      v_min_lat := 40.0; v_max_lat := 43.0;
      v_min_lon := -104.1; v_max_lon := -95.3;
    WHEN 'TX' THEN
      v_min_lat := 25.8; v_max_lat := 36.5;
      v_min_lon := -106.6; v_max_lon := -93.5;
    ELSE
      -- Default - assume not near border
      RETURN 999;
  END CASE;

  -- Calculate distance to nearest edge (in degrees, then convert to miles)
  -- 1 degree latitude ≈ 69 miles
  -- 1 degree longitude ≈ 54.6 miles at 40° latitude

  v_dist_to_edge := LEAST(
    ABS(p_lat - v_min_lat) * 69,
    ABS(p_lat - v_max_lat) * 69,
    ABS(p_lon - v_min_lon) * 54.6,
    ABS(p_lon - v_max_lon) * 54.6
  );

  RETURN ROUND(v_dist_to_edge, 1);
END;
$$ LANGUAGE plpgsql;

-- Function to check if event should trigger border notification
CREATE OR REPLACE FUNCTION should_notify_adjacent_states(
  p_event_id VARCHAR(255),
  p_state VARCHAR(2),
  p_severity VARCHAR(20),
  p_lat NUMERIC,
  p_lon NUMERIC
)
RETURNS TABLE(
  should_notify BOOLEAN,
  adjacent_state VARCHAR(2),
  estimated_distance_miles NUMERIC,
  reason TEXT
) AS $$
DECLARE
  v_config RECORD;
  v_distance NUMERIC;
BEGIN
  -- Get configuration
  SELECT * INTO v_config FROM border_proximity_config ORDER BY id DESC LIMIT 1;

  -- Check if auto-notification is enabled
  IF NOT v_config.auto_notify_enabled THEN
    RETURN;
  END IF;

  -- Check severity threshold
  IF v_config.notification_severity_threshold = 'high' AND p_severity NOT IN ('high') THEN
    RETURN;
  END IF;

  IF v_config.notification_severity_threshold = 'medium' AND p_severity NOT IN ('high', 'medium') THEN
    RETURN;
  END IF;

  -- Calculate distance to border
  v_distance := estimate_distance_to_border(p_lat, p_lon, p_state);

  -- If within threshold, return adjacent states
  IF v_distance <= v_config.distance_threshold_miles THEN
    RETURN QUERY
    SELECT
      true as should_notify,
      adj.adjacent_state,
      v_distance as estimated_distance_miles,
      format('Event within %s miles of %s border', v_distance, p_state) as reason
    FROM get_adjacent_states(p_state) adj;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-notify adjacent states (called from backend)
CREATE OR REPLACE FUNCTION auto_notify_border_states(
  p_event_id VARCHAR(255),
  p_state VARCHAR(2),
  p_severity VARCHAR(20),
  p_lat NUMERIC,
  p_lon NUMERIC,
  p_event_type VARCHAR(100),
  p_event_description TEXT
)
RETURNS TABLE(
  notified_state VARCHAR(2),
  distance_miles NUMERIC,
  notification_created BOOLEAN
) AS $$
DECLARE
  v_notification RECORD;
BEGIN
  -- Get states to notify
  FOR v_notification IN
    SELECT * FROM should_notify_adjacent_states(p_event_id, p_state, p_severity, p_lat, p_lon)
    WHERE should_notify = true
  LOOP
    -- Log the notification
    INSERT INTO border_notifications (
      event_id,
      source_state,
      notified_state,
      distance_to_border_miles,
      notification_type,
      event_severity,
      event_type
    ) VALUES (
      p_event_id,
      p_state,
      v_notification.adjacent_state,
      v_notification.estimated_distance_miles,
      'auto_geofence',
      p_severity,
      p_event_type
    );

    -- Return notification record
    RETURN QUERY
    SELECT
      v_notification.adjacent_state,
      v_notification.estimated_distance_miles,
      true as notification_created;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-notify when events are created/updated
-- Note: This would be called from backend via explicit function call
-- rather than as a database trigger, for better control

-- Grant permissions
GRANT SELECT, INSERT ON border_notifications TO PUBLIC;
GRANT SELECT, UPDATE ON border_proximity_config TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_config RECORD;
BEGIN
  SELECT * INTO v_config FROM border_proximity_config LIMIT 1;

  RAISE NOTICE 'Border Geofencing System Configured:';
  RAISE NOTICE '- Distance threshold: % miles', v_config.distance_threshold_miles;
  RAISE NOTICE '- Auto-notify enabled: %', v_config.auto_notify_enabled;
  RAISE NOTICE '- Severity threshold: %', v_config.notification_severity_threshold;
  RAISE NOTICE '- Adjacent state detection: Ready';
  RAISE NOTICE '- Notification logging: Enabled';
END $$;
