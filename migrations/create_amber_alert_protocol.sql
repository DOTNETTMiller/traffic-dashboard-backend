-- Migration: Coordinated Amber Alert Protocol (CCAI UC #8)
-- Date: 2026-03-03
-- Description: Multi-state Amber Alert coordination to minimize traffic disruption

-- Amber Alert Events
CREATE TABLE IF NOT EXISTS amber_alert_events (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(100) NOT NULL UNIQUE,
  issuing_state VARCHAR(2) NOT NULL,
  alert_type VARCHAR(50) DEFAULT 'amber', -- 'amber', 'silver', 'blue'
  child_name VARCHAR(255),
  suspect_vehicle VARCHAR(255),
  license_plate VARCHAR(20),
  last_seen_location VARCHAR(255),
  last_seen_latitude NUMERIC(10,7),
  last_seen_longitude NUMERIC(10,7),
  direction_of_travel VARCHAR(50),
  alert_description TEXT,
  severity VARCHAR(20) DEFAULT 'high',
  status VARCHAR(20) DEFAULT 'active',
  issued_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  CONSTRAINT valid_alert_type CHECK (alert_type IN ('amber', 'silver', 'blue', 'endangered')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'resolved', 'expired', 'cancelled'))
);

-- Amber Alert State Notifications
CREATE TABLE IF NOT EXISTS amber_alert_notifications (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(100) REFERENCES amber_alert_events(alert_id) ON DELETE CASCADE,
  notified_state VARCHAR(2) NOT NULL,
  notification_reason VARCHAR(100), -- 'proximity', 'direction-of-travel', 'adjacent-state'
  notified_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  traffic_impact_level VARCHAR(20) DEFAULT 'medium',
  dms_activated BOOLEAN DEFAULT false,
  dms_count INTEGER DEFAULT 0,
  estimated_traffic_delay_minutes INTEGER
);

-- Amber Alert DMS Activation Rules
CREATE TABLE IF NOT EXISTS amber_alert_dms_rules (
  id SERIAL PRIMARY KEY,
  state VARCHAR(2) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  activation_trigger VARCHAR(50), -- 'immediate', 'proximity-based', 'manual'
  min_alert_age_minutes INTEGER DEFAULT 0,
  max_alert_age_hours INTEGER DEFAULT 12,
  display_duration_minutes INTEGER DEFAULT 30,
  message_priority INTEGER DEFAULT 95,
  affected_corridors TEXT[],
  message_template TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_trigger CHECK (activation_trigger IN ('immediate', 'proximity-based', 'manual', 'directional'))
);

-- Amber Alert Traffic Impact
CREATE TABLE IF NOT EXISTS amber_alert_traffic_impact (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(100) REFERENCES amber_alert_events(alert_id) ON DELETE CASCADE,
  state VARCHAR(2) NOT NULL,
  corridor VARCHAR(100),
  impact_start TIMESTAMP DEFAULT NOW(),
  impact_end TIMESTAMP,
  baseline_speed_mph NUMERIC(5,2),
  observed_speed_mph NUMERIC(5,2),
  speed_reduction_pct NUMERIC(5,2),
  delay_vehicle_hours NUMERIC(10,2),
  congestion_length_miles NUMERIC(5,2),
  secondary_incidents INTEGER DEFAULT 0,
  notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_amber_alerts_status ON amber_alert_events(status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_amber_alerts_state ON amber_alert_events(issuing_state, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_amber_notifications_alert ON amber_alert_notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_amber_notifications_state ON amber_alert_notifications(notified_state, acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_amber_impact_alert ON amber_alert_traffic_impact(alert_id);

-- Comments
COMMENT ON TABLE amber_alert_events IS 'Amber Alert coordination across states. CCAI UC #8.';
COMMENT ON TABLE amber_alert_notifications IS 'Multi-state Amber Alert notifications';
COMMENT ON TABLE amber_alert_dms_rules IS 'DMS activation rules for Amber Alerts';
COMMENT ON TABLE amber_alert_traffic_impact IS 'Traffic impact analysis during Amber Alerts';

-- Function to determine which states to notify
CREATE OR REPLACE FUNCTION determine_amber_alert_states(
  p_issuing_state VARCHAR(2),
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_direction VARCHAR(50)
)
RETURNS TABLE(
  notified_state VARCHAR(2),
  notification_reason VARCHAR(100)
) AS $$
BEGIN
  -- This is a simplified version. In production, would use actual state boundary data
  RETURN QUERY
  WITH adjacent_states AS (
    SELECT UNNEST(ARRAY['IA', 'MN', 'WI', 'IL', 'MO', 'NE', 'SD', 'KS']) as state_code
  )
  SELECT
    a.state_code as notified_state,
    'adjacent-state' as notification_reason
  FROM adjacent_states a
  WHERE a.state_code != p_issuing_state
  LIMIT 8;
END;
$$ LANGUAGE plpgsql;

-- Function to create Amber Alert and notify states
CREATE OR REPLACE FUNCTION create_amber_alert(
  p_issuing_state VARCHAR(2),
  p_alert_id VARCHAR(100),
  p_description TEXT,
  p_vehicle VARCHAR(255),
  p_location VARCHAR(255),
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_direction VARCHAR(50)
)
RETURNS INTEGER AS $$
DECLARE
  v_alert_id INTEGER;
  v_state RECORD;
BEGIN
  -- Create alert event
  INSERT INTO amber_alert_events (
    alert_id,
    issuing_state,
    alert_description,
    suspect_vehicle,
    last_seen_location,
    last_seen_latitude,
    last_seen_longitude,
    direction_of_travel,
    status,
    expires_at
  ) VALUES (
    p_alert_id,
    p_issuing_state,
    p_description,
    p_vehicle,
    p_location,
    p_latitude,
    p_longitude,
    p_direction,
    'active',
    NOW() + INTERVAL '24 hours'
  ) RETURNING id INTO v_alert_id;

  -- Notify adjacent states
  FOR v_state IN
    SELECT * FROM determine_amber_alert_states(p_issuing_state, p_latitude, p_longitude, p_direction)
  LOOP
    INSERT INTO amber_alert_notifications (
      alert_id,
      notified_state,
      notification_reason,
      traffic_impact_level
    ) VALUES (
      p_alert_id,
      v_state.notified_state,
      v_state.notification_reason,
      'medium'
    );
  END LOOP;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate Amber Alert traffic impact
CREATE OR REPLACE FUNCTION calculate_amber_traffic_impact(
  p_alert_id VARCHAR(100),
  p_state VARCHAR(2)
)
RETURNS JSONB AS $$
DECLARE
  v_impact JSONB;
  v_total_delay NUMERIC;
  v_avg_speed_reduction NUMERIC;
BEGIN
  SELECT
    jsonb_build_object(
      'total_delay_hours', COALESCE(SUM(delay_vehicle_hours), 0),
      'avg_speed_reduction_pct', COALESCE(AVG(speed_reduction_pct), 0),
      'total_congestion_miles', COALESCE(SUM(congestion_length_miles), 0),
      'secondary_incidents', COALESCE(SUM(secondary_incidents), 0)
    ) INTO v_impact
  FROM amber_alert_traffic_impact
  WHERE alert_id = p_alert_id
    AND state = p_state;

  RETURN v_impact;
END;
$$ LANGUAGE plpgsql;

-- Function to generate Amber Alert DMS message
CREATE OR REPLACE FUNCTION generate_amber_alert_dms_message(
  p_alert_id VARCHAR(100),
  p_state VARCHAR(2)
)
RETURNS TEXT AS $$
DECLARE
  v_alert RECORD;
  v_message TEXT;
BEGIN
  SELECT * INTO v_alert
  FROM amber_alert_events
  WHERE alert_id = p_alert_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Generate message from template
  v_message := 'AMBER ALERT';

  IF v_alert.suspect_vehicle IS NOT NULL THEN
    v_message := v_message || ' / ' || LEFT(v_alert.suspect_vehicle, 30);
  END IF;

  IF v_alert.license_plate IS NOT NULL THEN
    v_message := v_message || ' / ' || v_alert.license_plate;
  END IF;

  v_message := v_message || ' / CALL 911 IF SEEN';

  RETURN v_message;
END;
$$ LANGUAGE plpgsql;

-- Insert sample DMS activation rules
INSERT INTO amber_alert_dms_rules (
  state,
  rule_name,
  enabled,
  activation_trigger,
  display_duration_minutes,
  message_priority,
  message_template
) VALUES
('IA', 'Immediate Interstate Alert', true, 'immediate', 30, 95,
 'AMBER ALERT / {{vehicle}} / {{license}} / CALL 911 IF SEEN'),

('IA', 'Proximity-Based Highway Alert', true, 'proximity-based', 20, 90,
 'AMBER ALERT / {{vehicle}} / LAST SEEN {{location}}'),

('MN', 'Twin Cities Metro Alert', true, 'immediate', 30, 95,
 'AMBER ALERT ACTIVE / {{vehicle}} / CALL 911'),

('TX', 'Statewide Interstate Alert', true, 'immediate', 45, 95,
 'AMBER ALERT / {{vehicle}} {{license}} / 911'),

('MO', 'Border Corridor Alert', true, 'proximity-based', 20, 90,
 'AMBER ALERT / {{vehicle}} / REPORT TO 911')
ON CONFLICT DO NOTHING;

-- Create a sample historical Amber Alert (resolved)
INSERT INTO amber_alert_events (
  alert_id,
  issuing_state,
  alert_type,
  suspect_vehicle,
  license_plate,
  last_seen_location,
  last_seen_latitude,
  last_seen_longitude,
  direction_of_travel,
  alert_description,
  status,
  issued_at,
  resolved_at,
  resolution_notes
) VALUES (
  'AMBER-IA-2026-001',
  'IA',
  'amber',
  '2015 Blue Honda Civic',
  'ABC1234',
  'I-35 Exit 87, Des Moines',
  41.5868,
  -93.6250,
  'northbound',
  'Child abduction. Suspect vehicle heading north on I-35.',
  'resolved',
  NOW() - INTERVAL '72 hours',
  NOW() - INTERVAL '68 hours',
  'Child recovered safely in Minnesota. Suspect in custody.'
) ON CONFLICT DO NOTHING;

-- Insert notifications for historical alert
INSERT INTO amber_alert_notifications (
  alert_id,
  notified_state,
  notification_reason,
  notified_at,
  acknowledged_at,
  acknowledged_by,
  traffic_impact_level,
  dms_activated,
  dms_count
) VALUES
('AMBER-IA-2026-001', 'MN', 'direction-of-travel', NOW() - INTERVAL '72 hours', NOW() - INTERVAL '71 hours', 'operator@mndot.gov', 'medium', true, 8),
('AMBER-IA-2026-001', 'WI', 'adjacent-state', NOW() - INTERVAL '72 hours', NOW() - INTERVAL '71 hours', 'operator@widot.gov', 'low', true, 3),
('AMBER-IA-2026-001', 'MO', 'adjacent-state', NOW() - INTERVAL '72 hours', NOW() - INTERVAL '71.5 hours', 'operator@modot.gov', 'low', false, 0)
ON CONFLICT DO NOTHING;

-- Insert traffic impact data
INSERT INTO amber_alert_traffic_impact (
  alert_id,
  state,
  corridor,
  impact_start,
  impact_end,
  baseline_speed_mph,
  observed_speed_mph,
  speed_reduction_pct,
  delay_vehicle_hours,
  congestion_length_miles,
  secondary_incidents
) VALUES
('AMBER-IA-2026-001', 'IA', 'I-35', NOW() - INTERVAL '72 hours', NOW() - INTERVAL '68 hours', 68.5, 62.3, 9.0, 245.5, 3.2, 0),
('AMBER-IA-2026-001', 'MN', 'I-35', NOW() - INTERVAL '71 hours', NOW() - INTERVAL '68 hours', 65.0, 58.7, 9.7, 312.8, 5.1, 1)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON amber_alert_events TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON amber_alert_notifications TO PUBLIC;
GRANT SELECT ON amber_alert_dms_rules TO PUBLIC;
GRANT SELECT, INSERT ON amber_alert_traffic_impact TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_rule_count INTEGER;
  v_alert_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_rule_count FROM amber_alert_dms_rules WHERE enabled = true;
  SELECT COUNT(*) INTO v_alert_count FROM amber_alert_events;

  RAISE NOTICE 'Coordinated Amber Alert Protocol Configured:';
  RAISE NOTICE '- % DMS activation rules configured', v_rule_count;
  RAISE NOTICE '- % historical alerts in system', v_alert_count;
  RAISE NOTICE '- Multi-state notification automation enabled';
  RAISE NOTICE '- Traffic impact tracking enabled';
  RAISE NOTICE '- DMS message generation ready';
END $$;
