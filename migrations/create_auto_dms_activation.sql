-- Migration: Auto-DMS Activation Rules (CCAI UC #2 Enhancement)
-- Date: 2026-03-03
-- Description: Automatic DMS message activation based on event severity and type

-- Auto-DMS activation rules
CREATE TABLE IF NOT EXISTS auto_dms_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10,
  event_type_pattern VARCHAR(100),
  event_severity VARCHAR(20),
  event_category VARCHAR(50),
  template_id INTEGER REFERENCES dms_message_templates(id),
  activation_conditions JSONB,
  variable_mapping JSONB,
  dms_device_selector VARCHAR(50) DEFAULT 'nearest',
  notify_adjacent_states BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  activation_count INTEGER DEFAULT 0,
  last_activated TIMESTAMP,
  CONSTRAINT valid_severity CHECK (event_severity IN ('low', 'medium', 'high', 'any')),
  CONSTRAINT valid_device_selector CHECK (dms_device_selector IN (
    'nearest', 'upstream', 'downstream', 'all_nearby', 'corridor'
  ))
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_auto_dms_rules_enabled ON auto_dms_rules(enabled, priority DESC);
CREATE INDEX IF NOT EXISTS idx_auto_dms_rules_severity ON auto_dms_rules(event_severity);

-- Add comment
COMMENT ON TABLE auto_dms_rules IS 'Automatic DMS activation rules based on event characteristics. CCAI UC #2.';

-- Function to find matching auto-DMS rule for an event
CREATE OR REPLACE FUNCTION find_auto_dms_rule(
  p_event_type VARCHAR(100),
  p_event_severity VARCHAR(20),
  p_event_category VARCHAR(50),
  p_description TEXT
)
RETURNS TABLE(
  rule_id INTEGER,
  rule_name VARCHAR(255),
  template_id INTEGER,
  template_name VARCHAR(255),
  variable_mapping JSONB,
  dms_device_selector VARCHAR(50),
  notify_states BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id as rule_id,
    r.rule_name,
    r.template_id,
    t.template_name,
    r.variable_mapping,
    r.dms_device_selector,
    r.notify_adjacent_states as notify_states
  FROM auto_dms_rules r
  JOIN dms_message_templates t ON r.template_id = t.id
  WHERE r.enabled = true
    AND t.approval_status = 'approved'
    AND (
      -- Match severity
      r.event_severity = 'any' OR
      r.event_severity = p_event_severity
    )
    AND (
      -- Match category if specified
      r.event_category IS NULL OR
      r.event_category = p_event_category OR
      r.event_type_pattern IS NULL
    )
    AND (
      -- Match type pattern if specified
      r.event_type_pattern IS NULL OR
      p_event_type ILIKE '%' || r.event_type_pattern || '%' OR
      p_description ILIKE '%' || r.event_type_pattern || '%'
    )
  ORDER BY r.priority DESC, r.id ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to extract variable values from event
CREATE OR REPLACE FUNCTION extract_dms_variables(
  p_description TEXT,
  p_location VARCHAR(255),
  p_route VARCHAR(50),
  p_variable_mapping JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_variables JSONB := '{}'::JSONB;
  v_location_match TEXT;
  v_distance_match TEXT;
  v_lanes_match TEXT;
BEGIN
  -- Extract LOCATION from description or location field
  v_location_match := COALESCE(p_location, 'AHEAD');
  v_variables := jsonb_set(v_variables, '{LOCATION}', to_jsonb(v_location_match));

  -- Extract ROUTE
  IF p_route IS NOT NULL AND p_route != '' THEN
    v_variables := jsonb_set(v_variables, '{ROUTE}', to_jsonb(p_route));
  END IF;

  -- Extract DISTANCE (look for "X miles" or "MM XXX" in description)
  v_distance_match := substring(p_description FROM '\d+\s*(?:mile|mi|MM)');
  IF v_distance_match IS NOT NULL THEN
    v_distance_match := regexp_replace(v_distance_match, '[^\d]', '', 'g');
    v_variables := jsonb_set(v_variables, '{DISTANCE}', to_jsonb(v_distance_match));
  ELSE
    v_variables := jsonb_set(v_variables, '{DISTANCE}', to_jsonb('1'));
  END IF;

  -- Extract LANES_BLOCKED
  IF p_description ILIKE '%all lanes%' OR p_description ILIKE '%road closed%' THEN
    v_variables := jsonb_set(v_variables, '{LANES_BLOCKED}', to_jsonb('ALL LANES'));
  ELSIF p_description ILIKE '%left lane%' THEN
    v_variables := jsonb_set(v_variables, '{LANES_BLOCKED}', to_jsonb('LEFT LANE'));
  ELSIF p_description ILIKE '%right lane%' THEN
    v_variables := jsonb_set(v_variables, '{LANES_BLOCKED}', to_jsonb('RIGHT LANE'));
  ELSE
    v_variables := jsonb_set(v_variables, '{LANES_BLOCKED}', to_jsonb('LANES'));
  END IF;

  -- Apply custom variable mapping if provided
  IF p_variable_mapping IS NOT NULL THEN
    v_variables := v_variables || p_variable_mapping;
  END IF;

  RETURN v_variables;
END;
$$ LANGUAGE plpgsql;

-- Insert default auto-DMS activation rules
INSERT INTO auto_dms_rules (
  rule_name, enabled, priority, event_type_pattern, event_severity, event_category,
  template_id, notify_adjacent_states, activation_conditions
) VALUES
-- High-priority crash rules
('Major Crash - High Severity', true, 100, 'crash', 'high', 'incident',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Major Crash Ahead' LIMIT 1),
 true, '{"min_severity": "high", "event_types": ["crash", "accident"]}'::JSONB),

('Vehicle Fire', true, 95, 'fire', 'high', 'incident',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Vehicle Fire' LIMIT 1),
 true, '{"event_types": ["fire"]}'::JSONB),

('Road Closure', true, 90, 'closed', 'high', 'incident',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Road Closed' LIMIT 1),
 true, '{"lanes_blocked": "all"}'::JSONB),

-- Weather rules
('Ice Warning', true, 85, 'ice', 'any', 'weather',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Ice Warning' LIMIT 1),
 true, '{"weather_type": "ice"}'::JSONB),

('Fog Warning', true, 85, 'fog', 'any', 'weather',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Fog Warning' LIMIT 1),
 true, '{"weather_type": "fog"}'::JSONB),

('Heavy Rain', true, 80, 'rain', 'medium', 'weather',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Heavy Rain' LIMIT 1),
 true, '{"weather_type": "rain"}'::JSONB),

-- Construction rules
('Lane Closure', true, 70, 'lane', 'medium', 'construction',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Lane Closure' LIMIT 1),
 false, '{"event_category": "construction"}'::JSONB),

('Work Zone Ahead', true, 65, 'work', 'medium', 'construction',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Work Zone Ahead' LIMIT 1),
 false, '{"event_category": "construction"}'::JSONB),

-- Queue/traffic rules
('Queue Ahead', true, 75, 'stopped', 'high', 'queue_warning',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Queue Ahead' LIMIT 1),
 true, '{"traffic_condition": "stopped"}'::JSONB),

('Slow Traffic', true, 60, 'slow', 'medium', 'queue_warning',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Slow Traffic' LIMIT 1),
 false, '{"traffic_condition": "slow"}'::JSONB),

-- Emergency rules
('Emergency Vehicles', true, 98, 'emergency', 'high', 'incident',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Emergency Vehicles' LIMIT 1),
 false, '{"event_types": ["emergency", "first responders"]}'::JSONB),

-- Crash with injuries
('Crash With Injuries', true, 95, 'injury', 'high', 'incident',
 (SELECT id FROM dms_message_templates WHERE template_name = 'Crash With Injuries' LIMIT 1),
 true, '{"has_injuries": true}'::JSONB);

-- Trigger to update timestamp and activation count
CREATE OR REPLACE FUNCTION update_auto_dms_rule_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_dms_rule_update
BEFORE UPDATE ON auto_dms_rules
FOR EACH ROW
EXECUTE FUNCTION update_auto_dms_rule_timestamp();

-- Grant permissions
GRANT SELECT ON auto_dms_rules TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_rule_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_rule_count FROM auto_dms_rules WHERE enabled = true;

  RAISE NOTICE 'Auto-DMS Activation System Configured:';
  RAISE NOTICE '- % active rules created', v_rule_count;
  RAISE NOTICE '- Rule matching by severity, type, and category';
  RAISE NOTICE '- Automatic variable extraction';
  RAISE NOTICE '- Adjacent state notification support';
  RAISE NOTICE '- Ready for automatic DMS activation';
END $$;
