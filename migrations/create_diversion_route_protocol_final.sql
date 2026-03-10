-- Migration: Diversion Route Protocol Enhancement (CCAI UC #3)
-- Date: 2026-03-03
-- Description: Enhanced multi-state diversion route coordination with approval workflow

-- Diversion Routes Table
CREATE TABLE IF NOT EXISTS diversion_routes (
  id SERIAL PRIMARY KEY,
  route_name VARCHAR(255) NOT NULL,
  primary_route VARCHAR(50) NOT NULL,
  diversion_route VARCHAR(50) NOT NULL,
  start_location VARCHAR(255) NOT NULL,
  end_location VARCHAR(255) NOT NULL,
  start_lat NUMERIC(10,7),
  start_lon NUMERIC(10,7),
  end_lat NUMERIC(10,7),
  end_lon NUMERIC(10,7),
  geometry_geojson TEXT,
  states_involved TEXT[] DEFAULT '{}',
  distance_miles NUMERIC(10,2),
  estimated_delay_minutes INTEGER,
  truck_suitable BOOLEAN DEFAULT true,
  hazmat_approved BOOLEAN DEFAULT false,
  osow_restrictions TEXT,
  bridge_clearances JSONB,
  activation_criteria JSONB,
  approval_status VARCHAR(20) DEFAULT 'draft',
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_activated TIMESTAMP,
  activation_count INTEGER DEFAULT 0,
  effectiveness_rating NUMERIC(3,2),
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'draft', 'pending_review', 'approved', 'active', 'suspended', 'archived'
  ))
);

-- Diversion Route Segments (for multi-state coordination)
CREATE TABLE IF NOT EXISTS diversion_route_segments (
  id SERIAL PRIMARY KEY,
  diversion_route_id INTEGER REFERENCES diversion_routes(id) ON DELETE CASCADE,
  state_code VARCHAR(2) NOT NULL,
  segment_order INTEGER NOT NULL,
  route VARCHAR(50) NOT NULL,
  segment_start VARCHAR(255),
  segment_end VARCHAR(255),
  segment_geometry_geojson TEXT,
  dms_devices TEXT[],
  tmc_contact VARCHAR(255),
  special_instructions TEXT,
  UNIQUE(diversion_route_id, state_code, segment_order)
);

-- Diversion Route Approvals (Multi-state coordination)
CREATE TABLE IF NOT EXISTS diversion_route_approvals (
  id SERIAL PRIMARY KEY,
  diversion_route_id INTEGER REFERENCES diversion_routes(id) ON DELETE CASCADE,
  state_code VARCHAR(2) NOT NULL,
  approver_name VARCHAR(100),
  approver_role VARCHAR(50),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approval_date TIMESTAMP,
  expiration_date TIMESTAMP,
  conditions TEXT,
  comments TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'pending', 'approved', 'approved_conditional', 'rejected', 'expired'
  )),
  UNIQUE(diversion_route_id, state_code)
);

-- Diversion Activations Log
CREATE TABLE IF NOT EXISTS diversion_activations (
  id SERIAL PRIMARY KEY,
  diversion_route_id INTEGER REFERENCES diversion_routes(id),
  event_id INTEGER,
  activated_by VARCHAR(100) NOT NULL,
  activated_at TIMESTAMP DEFAULT NOW(),
  deactivated_at TIMESTAMP,
  deactivated_by VARCHAR(100),
  activation_reason TEXT NOT NULL,
  states_notified TEXT[],
  dms_activated TEXT[],
  estimated_traffic_diverted INTEGER,
  actual_traffic_diverted INTEGER,
  effectiveness_rating INTEGER,
  issues_encountered TEXT,
  CONSTRAINT valid_effectiveness CHECK (effectiveness_rating BETWEEN 1 AND 5)
);

-- Pre-approved Diversion Route Conditions
CREATE TABLE IF NOT EXISTS diversion_route_conditions (
  id SERIAL PRIMARY KEY,
  diversion_route_id INTEGER REFERENCES diversion_routes(id) ON DELETE CASCADE,
  condition_type VARCHAR(50) NOT NULL,
  condition_description TEXT NOT NULL,
  auto_activate BOOLEAN DEFAULT false,
  requires_approval BOOLEAN DEFAULT true,
  notification_required BOOLEAN DEFAULT true,
  CONSTRAINT valid_condition_type CHECK (condition_type IN (
    'full_closure', 'incident_severity_high', 'construction_planned',
    'weather_severe', 'hazmat_spill', 'bridge_closure', 'duration_over_4hrs'
  ))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_diversion_routes_primary ON diversion_routes(primary_route);
CREATE INDEX IF NOT EXISTS idx_diversion_routes_status ON diversion_routes(approval_status);
CREATE INDEX IF NOT EXISTS idx_diversion_routes_states ON diversion_routes USING GIN(states_involved);
CREATE INDEX IF NOT EXISTS idx_diversion_segments_route ON diversion_route_segments(diversion_route_id, segment_order);
CREATE INDEX IF NOT EXISTS idx_diversion_segments_state ON diversion_route_segments(state_code);
CREATE INDEX IF NOT EXISTS idx_diversion_approvals_status ON diversion_route_approvals(diversion_route_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_diversion_activations_route ON diversion_activations(diversion_route_id);
CREATE INDEX IF NOT EXISTS idx_diversion_activations_event ON diversion_activations(event_id);
CREATE INDEX IF NOT EXISTS idx_diversion_activations_date ON diversion_activations(activated_at DESC);

-- Add comments
COMMENT ON TABLE diversion_routes IS 'Pre-approved diversion routes for multi-state coordination. CCAI UC #3.';
COMMENT ON TABLE diversion_route_segments IS 'State-specific segments of diversion routes for coordinated activation';
COMMENT ON TABLE diversion_route_approvals IS 'Multi-state approval workflow for diversion routes';
COMMENT ON TABLE diversion_activations IS 'Log of all diversion route activations for effectiveness tracking';

-- Insert sample pre-approved diversion routes
INSERT INTO diversion_routes (
  route_name, primary_route, diversion_route, start_location, end_location,
  states_involved, distance_miles, estimated_delay_minutes, truck_suitable,
  hazmat_approved, approval_status
) VALUES
-- I-35 Corridor Diversions
('I-35 to US-69 (Iowa-Missouri Border)', 'I-35', 'US-69', 'I-35 Exit 1 (Iowa)', 'I-35 Exit 12 (Missouri)',
 ARRAY['Iowa', 'Missouri'], 25.5, 15, true, true, 'approved'),

('I-35 to I-80 East (Iowa)', 'I-35', 'I-80', 'I-35/I-80 Junction Des Moines', 'I-35 Exit 92',
 ARRAY['Iowa'], 18.2, 10, true, true, 'approved'),

('I-35 to US-75 (Minnesota)', 'I-35', 'US-75', 'I-35 Exit 12', 'I-35 Exit 45',
 ARRAY['Minnesota'], 32.0, 20, true, false, 'approved'),

-- I-70 Corridor Diversions
('I-70 to US-40 (Kansas-Colorado)', 'I-70', 'US-40', 'I-70 MM 420 (KS)', 'I-70 MM 20 (CO)',
 ARRAY['Kansas', 'Colorado'], 45.0, 30, true, false, 'approved'),

-- I-80 Corridor Diversions
('I-80 to I-35 South (Iowa)', 'I-80', 'I-35', 'I-80 Exit 137', 'I-80 Exit 110',
 ARRAY['Iowa'], 22.0, 12, true, true, 'approved'),

('I-80 to US-30 (Nebraska)', 'I-80', 'US-30', 'I-80 Exit 395', 'I-80 Exit 440',
 ARRAY['Nebraska'], 42.0, 25, true, false, 'approved');

-- Add segments for I-35 to US-69 diversion (crosses state line)
INSERT INTO diversion_route_segments (
  diversion_route_id, state_code, segment_order, route,
  segment_start, segment_end, special_instructions
) VALUES
(1, 'IA', 1, 'US-69', 'I-35 Exit 1', 'State Line',
 'Coordinate with Missouri TMC before activation'),
(1, 'MO', 2, 'US-69', 'State Line', 'I-35 Exit 12',
 'Notify Iowa TMC when traffic crosses border');

-- Add approval records for multi-state routes
INSERT INTO diversion_route_approvals (diversion_route_id, state_code, approval_status, approver_role, approval_date) VALUES
(1, 'IA', 'approved', 'TMC Director', NOW() - INTERVAL '30 days'),
(1, 'MO', 'approved', 'TMC Director', NOW() - INTERVAL '28 days'),
(4, 'KS', 'approved', 'TMC Director', NOW() - INTERVAL '60 days'),
(4, 'CO', 'approved', 'District Manager', NOW() - INTERVAL '55 days');

-- Add activation conditions for auto-trigger scenarios
INSERT INTO diversion_route_conditions (
  diversion_route_id, condition_type, condition_description,
  auto_activate, requires_approval
) VALUES
(1, 'full_closure', 'I-35 full closure between MM 1-12', true, false),
(1, 'incident_severity_high', 'High severity incident blocking all lanes', true, false),
(1, 'duration_over_4hrs', 'Expected closure duration exceeds 4 hours', false, true),
(4, 'weather_severe', 'Severe weather closure on I-70', true, false),
(4, 'construction_planned', 'Planned construction full closure', false, true);

-- Function to check if diversion route should auto-activate
CREATE OR REPLACE FUNCTION check_diversion_auto_activation(
  p_event_id INTEGER,
  p_route VARCHAR(50),
  p_severity VARCHAR(20),
  p_lanes_blocked VARCHAR(20)
)
RETURNS TABLE(
  diversion_route_id INTEGER,
  route_name VARCHAR(255),
  should_activate BOOLEAN,
  condition_met VARCHAR(255)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dr.id,
    dr.route_name,
    true as should_activate,
    drc.condition_description as condition_met
  FROM diversion_routes dr
  JOIN diversion_route_conditions drc ON dr.id = drc.diversion_route_id
  WHERE dr.primary_route = p_route
    AND dr.approval_status = 'approved'
    AND drc.auto_activate = true
    AND (
      (drc.condition_type = 'full_closure' AND p_lanes_blocked = 'all') OR
      (drc.condition_type = 'incident_severity_high' AND p_severity = 'high') OR
      (drc.condition_type = 'weather_severe' AND p_severity = 'high')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to activate diversion route and notify states
CREATE OR REPLACE FUNCTION activate_diversion_route(
  p_diversion_route_id INTEGER,
  p_event_id INTEGER,
  p_activated_by VARCHAR(100),
  p_reason TEXT
)
RETURNS INTEGER AS $$
DECLARE
  v_activation_id INTEGER;
  v_states_involved TEXT[];
  v_dms_devices TEXT[];
BEGIN
  -- Get states involved
  SELECT states_involved INTO v_states_involved
  FROM diversion_routes
  WHERE id = p_diversion_route_id;

  -- Get DMS devices along route
  SELECT array_agg(DISTINCT unnest(dms_devices)) INTO v_dms_devices
  FROM diversion_route_segments
  WHERE diversion_route_id = p_diversion_route_id;

  -- Create activation record
  INSERT INTO diversion_activations (
    diversion_route_id,
    event_id,
    activated_by,
    activated_at,
    activation_reason,
    states_notified,
    dms_activated
  ) VALUES (
    p_diversion_route_id,
    p_event_id,
    p_activated_by,
    NOW(),
    p_reason,
    v_states_involved,
    v_dms_devices
  ) RETURNING id INTO v_activation_id;

  -- Update route statistics
  UPDATE diversion_routes
  SET last_activated = NOW(),
      activation_count = activation_count + 1
  WHERE id = p_diversion_route_id;

  RETURN v_activation_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_diversion_route_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER diversion_route_update
BEFORE UPDATE ON diversion_routes
FOR EACH ROW
EXECUTE FUNCTION update_diversion_route_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON diversion_routes TO PUBLIC;
GRANT SELECT, INSERT ON diversion_activations TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON diversion_route_approvals TO PUBLIC;

-- Completion message
DO $$
BEGIN
  RAISE NOTICE 'Diversion Route Protocol Configured:';
  RAISE NOTICE '- % pre-approved routes created', (SELECT COUNT(*) FROM diversion_routes);
  RAISE NOTICE '- Multi-state approval workflow initialized';
  RAISE NOTICE '- Auto-activation conditions configured';
  RAISE NOTICE '- Ready for coordinated traffic management';
END $$;
