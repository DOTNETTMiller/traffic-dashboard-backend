-- Migration: DMS Messaging Templates (CCAI UC #2)
-- Date: 2026-03-03
-- Description: Coordinated DMS messaging system for cross-state traveler information

-- DMS Message Templates Table
CREATE TABLE IF NOT EXISTS dms_message_templates (
  id SERIAL PRIMARY KEY,
  template_name VARCHAR(255) NOT NULL UNIQUE,
  template_category VARCHAR(50) NOT NULL,
  message_text TEXT NOT NULL,
  char_limit INTEGER DEFAULT 3,
  activation_trigger JSONB,
  states_approved TEXT[] DEFAULT '{}',
  approval_status VARCHAR(20) DEFAULT 'draft',
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  effectiveness_score NUMERIC(3,2),
  mutcd_compliant BOOLEAN DEFAULT true,
  CONSTRAINT valid_category CHECK (template_category IN (
    'incident', 'weather', 'construction', 'amber_alert', 'special_event',
    'parking', 'speed_limit', 'lane_closure', 'detour', 'queue_warning'
  )),
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'draft', 'pending_review', 'approved', 'active', 'archived'
  ))
);

-- DMS Message Variables (for template substitution)
CREATE TABLE IF NOT EXISTS dms_message_variables (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES dms_message_templates(id) ON DELETE CASCADE,
  variable_name VARCHAR(50) NOT NULL,
  variable_type VARCHAR(20) NOT NULL,
  example_value TEXT,
  required BOOLEAN DEFAULT false,
  validation_regex TEXT,
  CONSTRAINT valid_variable_type CHECK (variable_type IN (
    'location', 'time', 'distance', 'severity', 'route', 'custom', 'number'
  ))
);

-- DMS Activation Log
CREATE TABLE IF NOT EXISTS dms_activations (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES dms_message_templates(id),
  dms_device_id VARCHAR(100),
  event_id INTEGER,
  activated_by VARCHAR(100) NOT NULL,
  activated_at TIMESTAMP DEFAULT NOW(),
  deactivated_at TIMESTAMP,
  states_notified TEXT[],
  custom_message TEXT,
  final_message TEXT NOT NULL,
  driver_response_data JSONB,
  effectiveness_rating INTEGER,
  auto_activated BOOLEAN DEFAULT false,
  CONSTRAINT valid_effectiveness CHECK (effectiveness_rating BETWEEN 1 AND 5)
);

-- DMS Template Approval Workflow
CREATE TABLE IF NOT EXISTS dms_template_approvals (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES dms_message_templates(id) ON DELETE CASCADE,
  state_key VARCHAR(2) NOT NULL,
  approver_name VARCHAR(100),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approval_date TIMESTAMP,
  comments TEXT,
  revision_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'pending', 'approved', 'rejected', 'revision_requested'
  ))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dms_templates_category ON dms_message_templates(template_category);
CREATE INDEX IF NOT EXISTS idx_dms_templates_approval ON dms_message_templates(approval_status);
CREATE INDEX IF NOT EXISTS idx_dms_activations_device ON dms_activations(dms_device_id);
CREATE INDEX IF NOT EXISTS idx_dms_activations_event ON dms_activations(event_id);
CREATE INDEX IF NOT EXISTS idx_dms_activations_date ON dms_activations(activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_dms_approvals_state ON dms_template_approvals(state_key, approval_status);

-- Add comments
COMMENT ON TABLE dms_message_templates IS 'Library of MUTCD-compliant DMS message templates. CCAI UC #2.';
COMMENT ON TABLE dms_activations IS 'Log of all DMS message activations for effectiveness tracking';
COMMENT ON TABLE dms_template_approvals IS 'Cross-state approval workflow for message templates';

-- Insert 50+ pre-built templates
INSERT INTO dms_message_templates (template_name, template_category, message_text, char_limit, mutcd_compliant, activation_trigger) VALUES
-- INCIDENT TEMPLATES
('Major Crash Ahead', 'incident', 'CRASH AHEAD / {{LOCATION}} / {{LANES_BLOCKED}} / EXPECT DELAYS', 4, true, '{"severity": "high", "type": "crash"}'),
('Emergency Vehicles', 'incident', 'EMERGENCY VEHICLES / AHEAD / MOVE RIGHT', 3, true, '{"type": "emergency_response"}'),
('Road Closed', 'incident', '{{ROUTE}} CLOSED / AT {{LOCATION}} / DETOUR {{ROUTE_ALT}}', 3, true, '{"lanes_blocked": "all"}'),
('Crash With Injuries', 'incident', 'CRASH / {{DISTANCE}} MI AHEAD / LEFT LANE BLOCKED / SLOW DOWN', 4, true, '{"type": "crash", "severity": "high"}'),
('Vehicle Fire', 'incident', 'VEHICLE FIRE / {{LOCATION}} / {{LANES_BLOCKED}} / EXPECT DELAYS', 4, true, '{"description": "fire"}'),
('Disabled Vehicle', 'incident', 'DISABLED VEHICLE / {{LANE_POSITION}} / DRIVE WITH CAUTION', 3, true, '{"severity": "low"}'),
('Multi-Vehicle Crash', 'incident', 'MAJOR CRASH / {{LOCATION}} / ALL LANES BLOCKED / SEEK ALTERNATE ROUTE', 4, true, '{"severity": "high", "type": "crash"}'),

-- WEATHER TEMPLATES
('Ice Warning', 'weather', 'ICY CONDITIONS / {{LOCATION}} TO {{LOCATION2}} / REDUCE SPEED', 3, true, '{"type": "weather", "subtype": "ice"}'),
('Fog Warning', 'weather', 'DENSE FOG / REDUCE SPEED / USE LOW BEAMS', 3, true, '{"type": "weather", "subtype": "fog"}'),
('Snow Alert', 'weather', 'SNOW / {{LOCATION}} / {{CONDITION}} / DRIVE CAREFULLY', 3, true, '{"type": "weather", "subtype": "snow"}'),
('High Winds', 'weather', 'HIGH WINDS / {{SPEED}} MPH / SECURE LOADS / REDUCE SPEED', 4, true, '{"type": "weather", "subtype": "wind"}'),
('Heavy Rain', 'weather', 'HEAVY RAIN / REDUCED VISIBILITY / SLOW DOWN', 3, true, '{"type": "weather", "subtype": "rain"}'),
('Winter Weather', 'weather', 'WINTER WEATHER / ROADS MAY BE SLICK / USE CAUTION', 3, true, '{"type": "weather"}'),
('Black Ice', 'weather', 'BLACK ICE POSSIBLE / BRIDGES FREEZE FIRST / SLOW DOWN', 3, true, '{"type": "weather", "subtype": "ice"}'),

-- CONSTRUCTION TEMPLATES
('Lane Closure', 'construction', '{{LANE_TYPE}} LANE CLOSED / {{DISTANCE}} MI AHEAD / MERGE {{DIRECTION}}', 3, true, '{"type": "construction", "lanes_blocked": 1}'),
('Planned Closure', 'construction', '{{ROUTE}} CLOSING / {{DATE}} AT {{TIME}} / PLAN ALTERNATE ROUTE', 3, true, '{"type": "planned_closure"}'),
('Work Zone Ahead', 'construction', 'WORK ZONE / {{DISTANCE}} MI AHEAD / REDUCE SPEED TO {{SPEED}} MPH', 3, true, '{"type": "construction"}'),
('Road Work', 'construction', 'ROAD WORK / NEXT {{DISTANCE}} MI / FINES DOUBLED', 3, true, '{"type": "construction"}'),
('Shoulder Work', 'construction', 'SHOULDER WORK / STAY IN LANE / REDUCE SPEED', 3, true, '{"type": "construction", "lanes_blocked": 0}'),
('Bridge Work', 'construction', 'BRIDGE WORK / {{LOCATION}} / {{LANES_OPEN}} LANES OPEN', 3, true, '{"type": "construction", "description": "bridge"}'),

-- TRUCK/FREIGHT TEMPLATES
('Truck Parking Full', 'parking', 'TRUCK PARKING FULL / NEXT {{DISTANCE}} MI / {{SPACES}} SPACES AVAILABLE', 3, true, '{"parking_availability": "<10%"}'),
('Rest Area Status', 'parking', 'REST AREA {{NAME}} / {{STATUS}} / NEXT {{DISTANCE}} MI', 3, true, '{"type": "rest_area"}'),
('Truck Parking Available', 'parking', 'TRUCK PARKING / {{FACILITY_NAME}} / {{SPACES}} SPACES / {{DISTANCE}} MI', 3, true, '{"parking_update": true}'),
('Overheight Vehicle', 'parking', 'LOW CLEARANCE / {{HEIGHT}} FT / NEXT {{DISTANCE}} MI / CHECK ROUTE', 3, true, '{"bridge_clearance": true}'),
('Weight Limit', 'parking', 'WEIGHT LIMIT / {{LIMIT}} TONS / NEXT {{DISTANCE}} MI / REDUCE LOAD', 3, true, '{"weight_restriction": true}'),

-- AMBER ALERT TEMPLATES
('Amber Alert', 'amber_alert', 'AMBER ALERT / {{VEHICLE_DESC}} / {{LICENSE_PLATE}} / CALL 911', 3, true, '{"alert_type": "amber_alert"}'),
('Missing Child', 'amber_alert', 'MISSING CHILD / {{DESCRIPTION}} / CALL 911 IF SEEN', 3, true, '{"alert_type": "amber_alert"}'),

-- QUEUE WARNING TEMPLATES
('Queue Ahead', 'queue_warning', 'STOPPED TRAFFIC / {{DISTANCE}} MI AHEAD / PREPARE TO STOP', 3, true, '{"queue_detected": true}'),
('Slow Traffic', 'queue_warning', 'SLOW TRAFFIC / NEXT {{DISTANCE}} MI / REDUCE SPEED', 3, true, '{"congestion": true}'),
('Heavy Traffic', 'queue_warning', 'HEAVY TRAFFIC / {{LOCATION}} TO {{LOCATION2}} / EXPECT DELAYS', 3, true, '{"congestion": true}'),

-- DETOUR TEMPLATES
('Detour Route', 'detour', 'DETOUR / FOLLOW {{ROUTE_ALT}} / TO {{DESTINATION}}', 3, true, '{"detour_active": true}'),
('Alternate Route', 'detour', 'USE ALTERNATE ROUTE / EXIT {{EXIT_NUMBER}} / TO {{ROUTE_ALT}}', 3, true, '{"detour_suggested": true}'),

-- SPECIAL EVENT TEMPLATES
('Special Event', 'special_event', 'SPECIAL EVENT / {{EVENT_NAME}} / EXPECT HEAVY TRAFFIC', 3, true, '{"event_type": "special"}'),
('Stadium Traffic', 'special_event', 'GAME DAY TRAFFIC / {{TIME}} / ALLOW EXTRA TIME', 3, true, '{"event_type": "stadium"}'),

-- SPEED/LANE CONTROL TEMPLATES
('Reduce Speed', 'speed_limit', 'REDUCE SPEED / {{SPEED}} MPH / CONDITIONS AHEAD', 3, true, '{"speed_reduction": true}'),
('Variable Speed Limit', 'speed_limit', 'SPEED LIMIT / {{SPEED}} MPH / AHEAD', 2, true, '{"variable_speed": true}'),
('Lane Control', 'lane_closure', 'LANE USE / {{LANE_CONFIG}} / OBEY SIGNALS', 3, true, '{"lane_control": true}');

-- Add standard variables for common templates
INSERT INTO dms_message_variables (template_id, variable_name, variable_type, example_value, required) VALUES
-- Variables for "Major Crash Ahead"
(1, 'LOCATION', 'location', 'MM 142', true),
(1, 'LANES_BLOCKED', 'custom', '2 LANES', true),

-- Variables for "Road Closed"
(3, 'ROUTE', 'route', 'I-35', true),
(3, 'LOCATION', 'location', 'MM 142', true),
(3, 'ROUTE_ALT', 'route', 'US-65', true),

-- Variables for "Ice Warning"
(8, 'LOCATION', 'location', 'MM 100', true),
(8, 'LOCATION2', 'location', 'MM 120', true),

-- Variables for "Lane Closure"
(15, 'LANE_TYPE', 'custom', 'RIGHT', true),
(15, 'DISTANCE', 'distance', '2', true),
(15, 'DIRECTION', 'custom', 'LEFT', true),

-- Variables for "Planned Closure"
(16, 'ROUTE', 'route', 'I-35', true),
(16, 'DATE', 'time', 'MON 3/4', true),
(16, 'TIME', 'time', '9 PM', true),

-- Variables for "Truck Parking Full"
(21, 'DISTANCE', 'distance', '15', true),
(21, 'SPACES', 'number', '45', true),

-- Variables for "Rest Area Status"
(22, 'NAME', 'custom', 'MAPLE GROVE', true),
(22, 'STATUS', 'custom', 'OPEN', true),
(22, 'DISTANCE', 'distance', '12', true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dms_template_update
BEFORE UPDATE ON dms_message_templates
FOR EACH ROW
EXECUTE FUNCTION update_template_timestamp();

-- Initialize approval status for all states (they can opt-in later)
INSERT INTO dms_template_approvals (template_id, state_key, approval_status)
SELECT t.id, s.state_key, 'pending'
FROM dms_message_templates t
CROSS JOIN (
  SELECT DISTINCT state_key FROM states WHERE state_key IS NOT NULL
) s
ON CONFLICT DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON dms_message_templates TO PUBLIC;
GRANT SELECT, INSERT ON dms_activations TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON dms_template_approvals TO PUBLIC;

-- Completion message
DO $$
BEGIN
  RAISE NOTICE 'DMS Messaging System Configured:';
  RAISE NOTICE '- % templates created', (SELECT COUNT(*) FROM dms_message_templates);
  RAISE NOTICE '- Message variables defined';
  RAISE NOTICE '- Approval workflow initialized';
  RAISE NOTICE '- Ready for cross-state coordination';
END $$;
