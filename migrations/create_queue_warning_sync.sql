-- Migration: Cross-State Queue Warning Synchronization (CCAI UC #9)
-- Date: 2026-03-03
-- Description: Extend queue detection alerts across state borders to reduce secondary crashes

-- Queue Detection Events
CREATE TABLE IF NOT EXISTS queue_detection_events (
  id SERIAL PRIMARY KEY,
  queue_id VARCHAR(100) NOT NULL UNIQUE,
  detected_state VARCHAR(2) NOT NULL,
  route VARCHAR(50) NOT NULL,
  direction VARCHAR(20),
  start_location VARCHAR(255),
  start_latitude NUMERIC(10,7),
  start_longitude NUMERIC(10,7),
  queue_length_miles NUMERIC(5,2),
  queue_tail_latitude NUMERIC(10,7),
  queue_tail_longitude NUMERIC(10,7),
  severity VARCHAR(20) DEFAULT 'medium',
  avg_speed_mph NUMERIC(5,2),
  stopped_vehicles_estimated INTEGER,
  detection_method VARCHAR(50), -- 'probe-data', 'detector', 'camera', 'manual'
  cause VARCHAR(100), -- 'incident', 'construction', 'weather', 'congestion', 'special-event'
  status VARCHAR(20) DEFAULT 'active',
  detected_at TIMESTAMP DEFAULT NOW(),
  cleared_at TIMESTAMP,
  peak_length_miles NUMERIC(5,2),
  duration_minutes INTEGER,
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'severe')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'expanding', 'clearing', 'cleared'))
);

-- Queue Warning Notifications (Cross-State)
CREATE TABLE IF NOT EXISTS queue_warning_notifications (
  id SERIAL PRIMARY KEY,
  queue_id VARCHAR(100) REFERENCES queue_detection_events(queue_id) ON DELETE CASCADE,
  detecting_state VARCHAR(2) NOT NULL,
  notified_state VARCHAR(2) NOT NULL,
  notification_reason VARCHAR(100), -- 'proximity-to-border', 'spillover-risk', 'adjacent-state'
  distance_to_border_miles NUMERIC(5,2),
  spillover_probability NUMERIC(5,2), -- 0.0 to 100.0
  notified_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  response_action VARCHAR(100), -- 'dms-activated', 'ramp-metering', 'diversion', 'monitoring'
  response_notes TEXT
);

-- Queue Warning Thresholds (Configurable by State)
CREATE TABLE IF NOT EXISTS queue_warning_thresholds (
  id SERIAL PRIMARY KEY,
  state VARCHAR(2) NOT NULL,
  corridor VARCHAR(100),
  threshold_name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  min_queue_length_miles NUMERIC(5,2) DEFAULT 1.0,
  min_severity VARCHAR(20) DEFAULT 'medium',
  distance_from_border_miles NUMERIC(5,2) DEFAULT 10.0,
  auto_notify_adjacent_states BOOLEAN DEFAULT true,
  auto_activate_dms BOOLEAN DEFAULT false,
  notify_upstream_distance_miles NUMERIC(5,2) DEFAULT 5.0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(state, corridor, threshold_name)
);

-- Queue Warning DMS Activations
CREATE TABLE IF NOT EXISTS queue_warning_dms (
  id SERIAL PRIMARY KEY,
  queue_id VARCHAR(100) REFERENCES queue_detection_events(queue_id) ON DELETE CASCADE,
  state VARCHAR(2) NOT NULL,
  dms_id VARCHAR(100),
  dms_location VARCHAR(255),
  distance_upstream_miles NUMERIC(5,2),
  message_text TEXT,
  activated_at TIMESTAMP DEFAULT NOW(),
  deactivated_at TIMESTAMP,
  estimated_vehicles_warned INTEGER
);

-- Queue Spillover Analysis
CREATE TABLE IF NOT EXISTS queue_spillover_analysis (
  id SERIAL PRIMARY KEY,
  queue_id VARCHAR(100) REFERENCES queue_detection_events(queue_id) ON DELETE CASCADE,
  analysis_timestamp TIMESTAMP DEFAULT NOW(),
  current_tail_state VARCHAR(2),
  spillover_occurred BOOLEAN DEFAULT false,
  affected_states TEXT[],
  max_spillover_distance_miles NUMERIC(5,2),
  interstate_border_crossed BOOLEAN DEFAULT false,
  secondary_queues_formed INTEGER DEFAULT 0,
  total_delay_vehicle_hours NUMERIC(10,2)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_queue_events_status ON queue_detection_events(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_events_state ON queue_detection_events(detected_state, route);
CREATE INDEX IF NOT EXISTS idx_queue_notifications_queue ON queue_warning_notifications(queue_id);
CREATE INDEX IF NOT EXISTS idx_queue_notifications_state ON queue_warning_notifications(notified_state, acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_queue_thresholds_state ON queue_warning_thresholds(state, enabled);
CREATE INDEX IF NOT EXISTS idx_queue_dms_queue ON queue_warning_dms(queue_id, activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_spillover_queue ON queue_spillover_analysis(queue_id);

-- Comments
COMMENT ON TABLE queue_detection_events IS 'Queue detection events for cross-state coordination. CCAI UC #9.';
COMMENT ON TABLE queue_warning_notifications IS 'Cross-state queue warning notifications';
COMMENT ON TABLE queue_warning_thresholds IS 'Configurable thresholds for queue warning activation';
COMMENT ON TABLE queue_warning_dms IS 'DMS activations for queue warnings';
COMMENT ON TABLE queue_spillover_analysis IS 'Analysis of queue spillover across state borders';

-- Function to determine spillover risk
CREATE OR REPLACE FUNCTION calculate_queue_spillover_risk(
  p_queue_id VARCHAR(100)
)
RETURNS NUMERIC AS $$
DECLARE
  v_queue RECORD;
  v_distance_to_border NUMERIC;
  v_risk_score NUMERIC;
BEGIN
  SELECT * INTO v_queue
  FROM queue_detection_events
  WHERE queue_id = p_queue_id;

  IF NOT FOUND THEN
    RETURN 0.0;
  END IF;

  -- Simplified distance calculation (in production, would use actual border data)
  -- For now, estimate based on typical state sizes
  v_distance_to_border := 25.0; -- Placeholder

  -- Calculate risk score based on queue length and distance to border
  v_risk_score := CASE
    WHEN v_queue.queue_length_miles >= v_distance_to_border THEN 95.0
    WHEN v_queue.queue_length_miles >= (v_distance_to_border * 0.7) THEN 75.0
    WHEN v_queue.queue_length_miles >= (v_distance_to_border * 0.5) THEN 50.0
    WHEN v_queue.queue_length_miles >= (v_distance_to_border * 0.3) THEN 25.0
    ELSE 10.0
  END;

  -- Adjust for severity
  IF v_queue.severity = 'severe' THEN
    v_risk_score := LEAST(v_risk_score * 1.5, 100.0);
  ELSIF v_queue.severity = 'high' THEN
    v_risk_score := LEAST(v_risk_score * 1.2, 100.0);
  END IF;

  RETURN v_risk_score;
END;
$$ LANGUAGE plpgsql;

-- Function to determine which states to notify
CREATE OR REPLACE FUNCTION determine_queue_notification_states(
  p_queue_id VARCHAR(100)
)
RETURNS TABLE(
  notified_state VARCHAR(2),
  notification_reason VARCHAR(100),
  spillover_probability NUMERIC
) AS $$
DECLARE
  v_queue RECORD;
  v_spillover_risk NUMERIC;
BEGIN
  SELECT * INTO v_queue
  FROM queue_detection_events
  WHERE queue_id = p_queue_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_spillover_risk := calculate_queue_spillover_risk(p_queue_id);

  -- Notify adjacent states based on risk
  IF v_spillover_risk >= 25.0 THEN
    RETURN QUERY
    WITH adjacent_states AS (
      SELECT UNNEST(ARRAY['IA', 'MN', 'WI', 'IL', 'MO', 'NE', 'SD', 'KS', 'OK', 'TX']) as state_code
    )
    SELECT
      a.state_code as notified_state,
      CASE
        WHEN v_spillover_risk >= 75.0 THEN 'spillover-imminent'
        WHEN v_spillover_risk >= 50.0 THEN 'spillover-risk'
        ELSE 'proximity-to-border'
      END as notification_reason,
      v_spillover_risk as spillover_probability
    FROM adjacent_states a
    WHERE a.state_code != v_queue.detected_state
    LIMIT 3;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create queue detection and notify states
CREATE OR REPLACE FUNCTION create_queue_detection(
  p_detected_state VARCHAR(2),
  p_route VARCHAR(50),
  p_direction VARCHAR(20),
  p_location VARCHAR(255),
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_queue_length_miles NUMERIC,
  p_severity VARCHAR(20),
  p_cause VARCHAR(100)
)
RETURNS VARCHAR(100) AS $$
DECLARE
  v_queue_id VARCHAR(100);
  v_state RECORD;
  v_spillover_risk NUMERIC;
BEGIN
  -- Generate queue ID
  v_queue_id := 'QUEUE-' || p_detected_state || '-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

  -- Create queue event
  INSERT INTO queue_detection_events (
    queue_id,
    detected_state,
    route,
    direction,
    start_location,
    start_latitude,
    start_longitude,
    queue_length_miles,
    severity,
    cause,
    status
  ) VALUES (
    v_queue_id,
    p_detected_state,
    p_route,
    p_direction,
    p_location,
    p_latitude,
    p_longitude,
    p_queue_length_miles,
    p_severity,
    p_cause,
    CASE
      WHEN p_queue_length_miles >= 3.0 THEN 'expanding'
      ELSE 'active'
    END
  );

  -- Calculate spillover risk
  v_spillover_risk := calculate_queue_spillover_risk(v_queue_id);

  -- Notify adjacent states if needed
  IF v_spillover_risk >= 25.0 THEN
    FOR v_state IN
      SELECT * FROM determine_queue_notification_states(v_queue_id)
    LOOP
      INSERT INTO queue_warning_notifications (
        queue_id,
        detecting_state,
        notified_state,
        notification_reason,
        spillover_probability
      ) VALUES (
        v_queue_id,
        p_detected_state,
        v_state.notified_state,
        v_state.notification_reason,
        v_state.spillover_probability
      );
    END LOOP;
  END IF;

  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate queue warning DMS message
CREATE OR REPLACE FUNCTION generate_queue_warning_message(
  p_queue_id VARCHAR(100),
  p_distance_ahead_miles NUMERIC
)
RETURNS TEXT AS $$
DECLARE
  v_queue RECORD;
  v_message TEXT;
BEGIN
  SELECT * INTO v_queue
  FROM queue_detection_events
  WHERE queue_id = p_queue_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Generate message
  v_message := 'TRAFFIC STOPPED AHEAD';

  IF p_distance_ahead_miles <= 2.0 THEN
    v_message := v_message || ' / ' || ROUND(p_distance_ahead_miles, 1)::TEXT || ' MI';
  ELSIF p_distance_ahead_miles <= 5.0 THEN
    v_message := v_message || ' / ' || ROUND(p_distance_ahead_miles, 0)::TEXT || ' MI';
  END IF;

  IF v_queue.queue_length_miles >= 3.0 THEN
    v_message := v_message || ' / ' || ROUND(v_queue.queue_length_miles, 0)::TEXT || ' MI BACKUP';
  END IF;

  v_message := v_message || ' / REDUCE SPEED';

  RETURN v_message;
END;
$$ LANGUAGE plpgsql;

-- Insert default queue warning thresholds
INSERT INTO queue_warning_thresholds (
  state, corridor, threshold_name, enabled,
  min_queue_length_miles, min_severity,
  distance_from_border_miles, auto_notify_adjacent_states
) VALUES
('IA', 'I-35', 'I-35 Border Queue Warning', true, 2.0, 'medium', 15.0, true),
('IA', 'I-80', 'I-80 Border Queue Warning', true, 2.0, 'medium', 15.0, true),
('MN', 'I-35', 'I-35 Metro Queue Warning', true, 1.5, 'medium', 20.0, true),
('TX', 'I-35', 'I-35 Urban Queue Warning', true, 1.0, 'medium', 10.0, true),
('MO', 'I-35', 'I-35 Queue Warning', true, 2.0, 'medium', 15.0, true)
ON CONFLICT (state, corridor, threshold_name) DO NOTHING;

-- Insert sample historical queue events
INSERT INTO queue_detection_events (
  queue_id, detected_state, route, direction, start_location,
  start_latitude, start_longitude, queue_length_miles,
  severity, avg_speed_mph, detection_method, cause, status,
  detected_at, cleared_at, duration_minutes
) VALUES
('QUEUE-IA-20260301-001', 'IA', 'I-35', 'northbound', 'I-35 MM 85',
 41.5500, -93.6200, 4.2, 'high', 12.5, 'probe-data', 'incident', 'cleared',
 NOW() - INTERVAL '48 hours', NOW() - INTERVAL '46 hours', 120),

('QUEUE-IA-20260302-001', 'IA', 'I-80', 'eastbound', 'I-80 MM 130',
 41.5800, -93.5900, 2.8, 'medium', 18.3, 'detector', 'construction', 'cleared',
 NOW() - INTERVAL '24 hours', NOW() - INTERVAL '23 hours', 60)
ON CONFLICT DO NOTHING;

-- Insert sample notifications
INSERT INTO queue_warning_notifications (
  queue_id, detecting_state, notified_state, notification_reason,
  distance_to_border_miles, spillover_probability,
  notified_at, acknowledged_at, acknowledged_by, response_action
) VALUES
('QUEUE-IA-20260301-001', 'IA', 'MN', 'spillover-risk', 8.5, 65.0,
 NOW() - INTERVAL '48 hours', NOW() - INTERVAL '47.5 hours',
 'operator@mndot.gov', 'dms-activated'),

('QUEUE-IA-20260302-001', 'IA', 'NE', 'proximity-to-border', 12.3, 35.0,
 NOW() - INTERVAL '24 hours', NOW() - INTERVAL '23.5 hours',
 'operator@nebraska.gov', 'monitoring')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON queue_detection_events TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON queue_warning_notifications TO PUBLIC;
GRANT SELECT ON queue_warning_thresholds TO PUBLIC;
GRANT SELECT, INSERT ON queue_warning_dms TO PUBLIC;
GRANT SELECT, INSERT ON queue_spillover_analysis TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_threshold_count INTEGER;
  v_queue_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_threshold_count FROM queue_warning_thresholds WHERE enabled = true;
  SELECT COUNT(*) INTO v_queue_count FROM queue_detection_events;

  RAISE NOTICE 'Queue Warning Synchronization Configured:';
  RAISE NOTICE '- % active warning thresholds', v_threshold_count;
  RAISE NOTICE '- % historical queue events', v_queue_count;
  RAISE NOTICE '- Spillover risk calculation enabled';
  RAISE NOTICE '- Cross-state notification automation ready';
  RAISE NOTICE '- DMS queue warning generation enabled';
END $$;
