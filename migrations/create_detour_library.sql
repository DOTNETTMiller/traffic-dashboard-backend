-- Migration: Shared Emergency Detour Library (CCAI UC #10)
-- Date: 2026-03-03
-- Description: Pre-approved detour route database for cross-state visibility during closures

-- Emergency Detour Routes
CREATE TABLE IF NOT EXISTS emergency_detour_routes (
  id SERIAL PRIMARY KEY,
  detour_id VARCHAR(100) NOT NULL UNIQUE,
  detour_name VARCHAR(255) NOT NULL,
  primary_state VARCHAR(2) NOT NULL,
  secondary_states TEXT[], -- Additional states involved in detour
  primary_route VARCHAR(50) NOT NULL,
  closure_start_location VARCHAR(255),
  closure_end_location VARCHAR(255),
  detour_route_description TEXT NOT NULL,
  detour_route_sequence TEXT[], -- Array of routes in order: ['I-35', 'US-69', 'IA-5']
  total_detour_miles NUMERIC(10,2),
  additional_miles NUMERIC(10,2), -- vs normal route
  estimated_time_minutes INTEGER,
  detour_type VARCHAR(50), -- 'full-closure', 'partial', 'emergency', 'planned-construction'
  suitable_for_trucks BOOLEAN DEFAULT true,
  truck_restrictions TEXT,
  approval_status VARCHAR(20) DEFAULT 'approved',
  approved_by TEXT[],
  approved_date DATE,
  last_used TIMESTAMP,
  usage_count INTEGER DEFAULT 0,
  effectiveness_rating NUMERIC(3,2), -- 1.0 to 5.0
  dms_message_template TEXT,
  signage_requirements TEXT[],
  traffic_control_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_detour_type CHECK (detour_type IN (
    'full-closure', 'partial', 'emergency', 'planned-construction', 'incident', 'weather'
  )),
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'draft', 'pending-approval', 'approved', 'expired', 'superseded'
  ))
);

-- Detour Route Points (for mapping)
CREATE TABLE IF NOT EXISTS detour_route_points (
  id SERIAL PRIMARY KEY,
  detour_id VARCHAR(100) REFERENCES emergency_detour_routes(detour_id) ON DELETE CASCADE,
  point_sequence INTEGER NOT NULL,
  point_type VARCHAR(50), -- 'closure-start', 'decision-point', 'waypoint', 'merge-back'
  location_description VARCHAR(255),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  route VARCHAR(50),
  mile_marker NUMERIC(10,2),
  instructions TEXT,
  dms_location BOOLEAN DEFAULT false,
  signage_type VARCHAR(100), -- 'regulatory', 'warning', 'guide', 'temporary'
  UNIQUE(detour_id, point_sequence)
);

-- Detour Activations (Usage History)
CREATE TABLE IF NOT EXISTS detour_activations (
  id SERIAL PRIMARY KEY,
  activation_id VARCHAR(100) NOT NULL UNIQUE,
  detour_id VARCHAR(100) REFERENCES emergency_detour_routes(detour_id) ON DELETE CASCADE,
  event_id VARCHAR(255),
  activating_state VARCHAR(2),
  reason VARCHAR(100),
  closure_type VARCHAR(50),
  activated_at TIMESTAMP DEFAULT NOW(),
  deactivated_at TIMESTAMP,
  duration_hours NUMERIC(10,2),
  estimated_vehicles_diverted INTEGER,
  dms_signs_used INTEGER,
  personnel_deployed INTEGER,
  effectiveness_score NUMERIC(3,2), -- Post-activation rating
  operator_notes TEXT,
  lessons_learned TEXT
);

-- Detour Performance Metrics
CREATE TABLE IF NOT EXISTS detour_performance_metrics (
  id SERIAL PRIMARY KEY,
  activation_id VARCHAR(100) REFERENCES detour_activations(activation_id) ON DELETE CASCADE,
  metric_timestamp TIMESTAMP DEFAULT NOW(),
  detour_volume_vph INTEGER,
  mainline_volume_vph INTEGER,
  diversion_rate_pct NUMERIC(5,2),
  avg_detour_speed_mph NUMERIC(5,2),
  avg_detour_travel_time_minutes NUMERIC(10,2),
  compliance_rate_pct NUMERIC(5,2), -- % of drivers following detour
  incidents_on_detour INTEGER DEFAULT 0,
  congestion_points TEXT[]
);

-- Cross-State Detour Agreements
CREATE TABLE IF NOT EXISTS detour_interstate_agreements (
  id SERIAL PRIMARY KEY,
  agreement_id VARCHAR(100) NOT NULL UNIQUE,
  participating_states TEXT[] NOT NULL,
  corridor VARCHAR(100),
  agreement_name VARCHAR(255),
  agreement_type VARCHAR(50), -- 'mou', 'operational-agreement', 'emergency-protocol'
  effective_date DATE,
  expiration_date DATE,
  scope_description TEXT,
  notification_requirements TEXT,
  coordination_contacts JSONB, -- {"IA": {"name": "...", "phone": "..."}}
  status VARCHAR(20) DEFAULT 'active',
  document_url VARCHAR(500),
  CONSTRAINT valid_agreement_status CHECK (status IN ('draft', 'active', 'expired', 'superseded'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_detour_routes_state ON emergency_detour_routes(primary_state, approval_status);
CREATE INDEX IF NOT EXISTS idx_detour_routes_route ON emergency_detour_routes(primary_route, detour_type);
CREATE INDEX IF NOT EXISTS idx_detour_points_detour ON detour_route_points(detour_id, point_sequence);
CREATE INDEX IF NOT EXISTS idx_detour_activations_detour ON detour_activations(detour_id, activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_detour_activations_event ON detour_activations(event_id);
CREATE INDEX IF NOT EXISTS idx_detour_performance_activation ON detour_performance_metrics(activation_id);
CREATE INDEX IF NOT EXISTS idx_detour_agreements_states ON detour_interstate_agreements USING GIN(participating_states);

-- Comments
COMMENT ON TABLE emergency_detour_routes IS 'Pre-approved emergency detour routes library. CCAI UC #10.';
COMMENT ON TABLE detour_route_points IS 'Geographic points and instructions for detour routes';
COMMENT ON TABLE detour_activations IS 'History of detour route activations';
COMMENT ON TABLE detour_performance_metrics IS 'Performance metrics during detour activations';
COMMENT ON TABLE detour_interstate_agreements IS 'Cross-state agreements for detour coordination';

-- Function to find suitable detour for closure
CREATE OR REPLACE FUNCTION find_suitable_detour(
  p_route VARCHAR(50),
  p_closure_location VARCHAR(255),
  p_closure_type VARCHAR(50),
  p_trucks_allowed BOOLEAN DEFAULT true
)
RETURNS TABLE(
  detour_id VARCHAR(100),
  detour_name VARCHAR(255),
  additional_miles NUMERIC,
  estimated_time_minutes INTEGER,
  effectiveness_rating NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.detour_id,
    d.detour_name,
    d.additional_miles,
    d.estimated_time_minutes,
    d.effectiveness_rating
  FROM emergency_detour_routes d
  WHERE d.primary_route = p_route
    AND d.approval_status = 'approved'
    AND (NOT p_trucks_allowed OR d.suitable_for_trucks = true)
    AND d.detour_type IN (p_closure_type, 'emergency', 'full-closure')
  ORDER BY d.effectiveness_rating DESC NULLS LAST, d.additional_miles ASC
  LIMIT 5;
END;
$$ LANGUAGE plpgsql;

-- Function to activate detour
CREATE OR REPLACE FUNCTION activate_detour(
  p_detour_id VARCHAR(100),
  p_activating_state VARCHAR(2),
  p_event_id VARCHAR(255),
  p_reason VARCHAR(100)
)
RETURNS VARCHAR(100) AS $$
DECLARE
  v_activation_id VARCHAR(100);
BEGIN
  v_activation_id := 'ACT-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || substring(md5(random()::text), 1, 6);

  INSERT INTO detour_activations (
    activation_id,
    detour_id,
    event_id,
    activating_state,
    reason,
    activated_at
  ) VALUES (
    v_activation_id,
    p_detour_id,
    p_event_id,
    p_activating_state,
    p_reason,
    NOW()
  );

  -- Update usage count
  UPDATE emergency_detour_routes
  SET usage_count = usage_count + 1,
      last_used = NOW()
  WHERE detour_id = p_detour_id;

  RETURN v_activation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate detour effectiveness
CREATE OR REPLACE FUNCTION calculate_detour_effectiveness(
  p_activation_id VARCHAR(100)
)
RETURNS NUMERIC AS $$
DECLARE
  v_metrics RECORD;
  v_effectiveness NUMERIC;
BEGIN
  SELECT
    AVG(diversion_rate_pct) as avg_diversion,
    AVG(compliance_rate_pct) as avg_compliance,
    SUM(incidents_on_detour) as total_incidents
  INTO v_metrics
  FROM detour_performance_metrics
  WHERE activation_id = p_activation_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Calculate effectiveness score (1.0 to 5.0)
  v_effectiveness := 3.0; -- Base score

  -- Boost for high diversion rate
  IF v_metrics.avg_diversion >= 70 THEN
    v_effectiveness := v_effectiveness + 1.0;
  ELSIF v_metrics.avg_diversion >= 50 THEN
    v_effectiveness := v_effectiveness + 0.5;
  END IF;

  -- Boost for high compliance
  IF v_metrics.avg_compliance >= 80 THEN
    v_effectiveness := v_effectiveness + 1.0;
  ELSIF v_metrics.avg_compliance >= 60 THEN
    v_effectiveness := v_effectiveness + 0.5;
  END IF;

  -- Penalty for incidents
  IF v_metrics.total_incidents > 5 THEN
    v_effectiveness := v_effectiveness - 1.0;
  ELSIF v_metrics.total_incidents > 2 THEN
    v_effectiveness := v_effectiveness - 0.5;
  END IF;

  RETURN GREATEST(LEAST(v_effectiveness, 5.0), 1.0);
END;
$$ LANGUAGE plpgsql;

-- Insert sample detour routes
INSERT INTO emergency_detour_routes (
  detour_id, detour_name, primary_state, secondary_states, primary_route,
  closure_start_location, closure_end_location, detour_route_description,
  detour_route_sequence, total_detour_miles, additional_miles,
  estimated_time_minutes, detour_type, suitable_for_trucks,
  approval_status, approved_by, effectiveness_rating
) VALUES
('DETOUR-I35-IA-001', 'I-35 Ames Detour via US-69', 'IA', ARRAY['IA'], 'I-35',
 'I-35 Exit 111', 'I-35 Exit 123',
 'Exit at 111, take US-69 north, rejoin I-35 at Exit 123',
 ARRAY['I-35', 'US-69', 'I-35'], 15.8, 3.2, 18,
 'full-closure', true, 'approved', ARRAY['Iowa DOT', 'Story County'], 4.2),

('DETOUR-I35-IA-002', 'I-35 Des Moines Metro Detour via I-235', 'IA', ARRAY['IA'], 'I-35',
 'I-35 Exit 87', 'I-35 Exit 92',
 'Exit at 87, take I-235 west to I-35 north, rejoin at Exit 92',
 ARRAY['I-35', 'I-235', 'I-35'], 12.5, 1.8, 12,
 'partial', true, 'approved', ARRAY['Iowa DOT'], 4.5),

('DETOUR-I80-IA-001', 'I-80 Iowa City Detour via US-218', 'IA', ARRAY['IA'], 'I-80',
 'I-80 Exit 239', 'I-80 Exit 254',
 'Exit at 239, take US-218 south to IA-1, rejoin I-80 at Exit 254',
 ARRAY['I-80', 'US-218', 'IA-1', 'I-80'], 18.2, 4.5, 25,
 'emergency', true, 'approved', ARRAY['Iowa DOT', 'Johnson County'], 3.8),

('DETOUR-I35-MN-001', 'I-35W Metro Detour via I-35E', 'MN', ARRAY['MN'], 'I-35',
 'I-35W Exit 17', 'I-35W Exit 23',
 'Exit at 17, take I-35E north, rejoin I-35W at Exit 23',
 ARRAY['I-35W', 'I-35E', 'I-35W'], 14.3, 2.1, 15,
 'planned-construction', true, 'approved', ARRAY['MnDOT'], 4.7),

('DETOUR-I35-TX-001', 'I-35 Austin Downtown Detour via Mopac', 'TX', ARRAY['TX'], 'I-35',
 'I-35 Exit 230', 'I-35 Exit 238',
 'Exit at 230, take Loop 1 (Mopac) north, rejoin I-35 at Exit 238',
 ARRAY['I-35', 'Loop-1', 'I-35'], 10.5, 0.8, 10,
 'incident', false, 'approved', ARRAY['TxDOT'], 4.0)
ON CONFLICT (detour_id) DO NOTHING;

-- Insert detour route points for first detour
INSERT INTO detour_route_points (
  detour_id, point_sequence, point_type, location_description,
  latitude, longitude, route, mile_marker, instructions, dms_location
) VALUES
('DETOUR-I35-IA-001', 1, 'closure-start', 'I-35 Exit 111', 41.9878, -93.6250, 'I-35', 111.0, 'Exit to US-69 North', true),
('DETOUR-I35-IA-001', 2, 'waypoint', 'US-69 & 13th St', 42.0340, -93.6218, 'US-69', NULL, 'Continue north on US-69', false),
('DETOUR-I35-IA-001', 3, 'merge-back', 'I-35 Exit 123', 42.1523, -93.6100, 'I-35', 123.0, 'Merge back to I-35 North', true)
ON CONFLICT DO NOTHING;

-- Insert sample activations
INSERT INTO detour_activations (
  activation_id, detour_id, event_id, activating_state, reason,
  closure_type, activated_at, deactivated_at, duration_hours,
  estimated_vehicles_diverted, dms_signs_used, effectiveness_score
) VALUES
('ACT-20260301-001', 'DETOUR-I35-IA-001', 'INC-20260301-001', 'IA', 'Major crash - full closure',
 'emergency', NOW() - INTERVAL '72 hours', NOW() - INTERVAL '68 hours', 4.0, 3200, 6, 4.3),

('ACT-20260302-001', 'DETOUR-I80-IA-001', 'CONST-20260302-001', 'IA', 'Bridge repair - full closure',
 'planned-construction', NOW() - INTERVAL '48 hours', NOW() - INTERVAL '40 hours', 8.0, 5800, 8, 4.0)
ON CONFLICT DO NOTHING;

-- Insert interstate agreements
INSERT INTO detour_interstate_agreements (
  agreement_id, participating_states, corridor, agreement_name,
  agreement_type, effective_date, scope_description, status
) VALUES
('AGR-I35-CENTRAL', ARRAY['IA', 'MN', 'MO'], 'I-35',
 'I-35 Central Corridor Emergency Detour Coordination Agreement',
 'operational-agreement', '2025-01-01',
 'Establishes procedures for coordinating emergency detour routes across state lines on I-35 corridor',
 'active'),

('AGR-I80-EASTWEST', ARRAY['IA', 'IL', 'NE'], 'I-80',
 'I-80 East-West Detour Coordination Protocol',
 'emergency-protocol', '2025-01-01',
 'Emergency procedures for major I-80 closures requiring cross-state coordination',
 'active')
ON CONFLICT (agreement_id) DO NOTHING;

-- Grant permissions
GRANT SELECT ON emergency_detour_routes TO PUBLIC;
GRANT SELECT ON detour_route_points TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON detour_activations TO PUBLIC;
GRANT SELECT, INSERT ON detour_performance_metrics TO PUBLIC;
GRANT SELECT ON detour_interstate_agreements TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_detour_count INTEGER;
  v_activation_count INTEGER;
  v_agreement_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_detour_count FROM emergency_detour_routes WHERE approval_status = 'approved';
  SELECT COUNT(*) INTO v_activation_count FROM detour_activations;
  SELECT COUNT(*) INTO v_agreement_count FROM detour_interstate_agreements WHERE status = 'active';

  RAISE NOTICE 'Emergency Detour Library Configured:';
  RAISE NOTICE '- % pre-approved detour routes', v_detour_count;
  RAISE NOTICE '- % historical activations', v_activation_count;
  RAISE NOTICE '- % interstate agreements', v_agreement_count;
  RAISE NOTICE '- Detour search and activation enabled';
  RAISE NOTICE '- Performance tracking enabled';
  RAISE NOTICE '- Cross-state visibility ready';
END $$;
