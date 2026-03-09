-- Migration: Auto-DMS Activation Rules (CCAI UC #2 Enhancement) - Simplified
-- Date: 2026-03-03
-- Creates tables even if dms_message_templates doesn't exist yet

-- Auto-DMS activation rules
CREATE TABLE IF NOT EXISTS auto_dms_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(255) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10,
  event_type_pattern VARCHAR(100),
  event_severity VARCHAR(20),
  event_category VARCHAR(50),
  template_id INTEGER,
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

-- Insert sample rules (without template_id since table may not exist)
INSERT INTO auto_dms_rules (
  rule_name, enabled, priority, event_type_pattern, event_severity, event_category,
  notify_adjacent_states, activation_conditions
) VALUES
('Major Crash - High Severity', true, 100, 'crash', 'high', 'incident',
 true, '{"min_severity": "high", "event_types": ["crash", "accident"]}'::JSONB),

('Vehicle Fire', true, 95, 'fire', 'high', 'incident',
 true, '{"event_types": ["fire"]}'::JSONB),

('Road Closure', true, 90, 'closed', 'high', 'incident',
 true, '{"lanes_blocked": "all"}'::JSONB),

('Ice Warning', true, 85, 'ice', 'any', 'weather',
 true, '{"weather_type": "ice"}'::JSONB),

('Fog Warning', true, 85, 'fog', 'any', 'weather',
 true, '{"weather_type": "fog"}'::JSONB),

('Heavy Rain', true, 80, 'rain', 'medium', 'weather',
 true, '{"weather_type": "rain"}'::JSONB),

('Lane Closure', true, 70, 'lane', 'medium', 'construction',
 false, '{"event_category": "construction"}'::JSONB),

('Work Zone Ahead', true, 65, 'work', 'medium', 'construction',
 false, '{"event_category": "construction"}'::JSONB),

('Queue Ahead', true, 75, 'stopped', 'high', 'queue_warning',
 true, '{"traffic_condition": "stopped"}'::JSONB),

('Slow Traffic', true, 60, 'slow', 'medium', 'queue_warning',
 false, '{"traffic_condition": "slow"}'::JSONB),

('Emergency Vehicles', true, 98, 'emergency', 'high', 'incident',
 false, '{"event_types": ["emergency", "first responders"]}'::JSONB),

('Crash With Injuries', true, 95, 'injury', 'high', 'incident',
 true, '{"has_injuries": true}'::JSONB)
ON CONFLICT (rule_name) DO NOTHING;

-- Grant permissions
GRANT SELECT ON auto_dms_rules TO PUBLIC;

-- Completion message
SELECT 'Auto-DMS Activation System Configured (Simplified)' as status;
SELECT COUNT(*)::text || ' active rules created' as rules FROM auto_dms_rules WHERE enabled = true;
SELECT 'Rule matching by severity, type, and category' as feature_1;
SELECT 'Adjacent state notification support' as feature_2;
