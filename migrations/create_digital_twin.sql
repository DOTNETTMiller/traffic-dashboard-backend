-- Migration: Interstate Digital Twin Pilot (CCAI UC #19)
-- Date: 2026-03-03
-- Description: Digital operational model of corridor for scenario testing and planning

-- Digital Twin Corridors
CREATE TABLE IF NOT EXISTS digital_twin_corridors (
  id SERIAL PRIMARY KEY,
  corridor_id VARCHAR(100) NOT NULL UNIQUE,
  corridor_name VARCHAR(255) NOT NULL,
  states_involved TEXT[] NOT NULL,
  primary_routes TEXT[] NOT NULL,
  total_length_miles NUMERIC(10,2),
  segment_count INTEGER,
  model_version VARCHAR(20) DEFAULT '1.0',
  model_status VARCHAR(20) DEFAULT 'active',
  last_calibration TIMESTAMP,
  calibration_accuracy_pct NUMERIC(5,2),
  data_sources TEXT[],
  update_frequency_seconds INTEGER DEFAULT 60,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_model_status CHECK (model_status IN ('active', 'calibrating', 'offline', 'testing'))
);

-- Digital Twin Segments (detailed road sections)
CREATE TABLE IF NOT EXISTS digital_twin_segments (
  id SERIAL PRIMARY KEY,
  segment_id VARCHAR(100) NOT NULL UNIQUE,
  corridor_id VARCHAR(100) REFERENCES digital_twin_corridors(corridor_id) ON DELETE CASCADE,
  segment_name VARCHAR(255),
  state VARCHAR(2),
  route VARCHAR(50),
  direction VARCHAR(20),
  start_mile_marker NUMERIC(10,2),
  end_mile_marker NUMERIC(10,2),
  length_miles NUMERIC(10,2),
  lanes_count INTEGER,
  free_flow_speed_mph INTEGER,
  capacity_vehicles_per_hour INTEGER,
  geometry_data JSONB, -- GeoJSON LineString
  segment_type VARCHAR(50), -- 'rural', 'urban', 'metro', 'interchange'
  grade_percent NUMERIC(5,2),
  special_features TEXT[] -- 'bridge', 'tunnel', 'curve', 'merge-point'
);

-- Digital Twin Live State
CREATE TABLE IF NOT EXISTS digital_twin_state (
  id SERIAL PRIMARY KEY,
  segment_id VARCHAR(100) REFERENCES digital_twin_segments(segment_id) ON DELETE CASCADE,
  timestamp TIMESTAMP DEFAULT NOW(),
  current_speed_mph NUMERIC(5,2),
  current_volume_vph INTEGER,
  current_occupancy_pct NUMERIC(5,2),
  congestion_level VARCHAR(20), -- 'free-flow', 'moderate', 'heavy', 'stopped'
  active_incidents INTEGER DEFAULT 0,
  active_work_zones INTEGER DEFAULT 0,
  weather_impact_level VARCHAR(20), -- 'none', 'minor', 'moderate', 'severe'
  travel_time_minutes NUMERIC(10,2),
  reliability_index NUMERIC(10,4),
  prediction_horizon_minutes INTEGER DEFAULT 15,
  confidence_score NUMERIC(5,2)
);

-- Digital Twin Scenarios (What-if analysis)
CREATE TABLE IF NOT EXISTS digital_twin_scenarios (
  id SERIAL PRIMARY KEY,
  scenario_id VARCHAR(100) NOT NULL UNIQUE,
  corridor_id VARCHAR(100) REFERENCES digital_twin_corridors(corridor_id) ON DELETE CASCADE,
  scenario_name VARCHAR(255) NOT NULL,
  scenario_type VARCHAR(50), -- 'incident', 'closure', 'construction', 'weather', 'special-event'
  description TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  run_status VARCHAR(20) DEFAULT 'pending',
  run_started TIMESTAMP,
  run_completed TIMESTAMP,
  simulation_duration_minutes INTEGER,
  base_date TIMESTAMP,
  CONSTRAINT valid_run_status CHECK (run_status IN ('pending', 'running', 'completed', 'failed'))
);

-- Digital Twin Scenario Parameters
CREATE TABLE IF NOT EXISTS digital_twin_scenario_params (
  id SERIAL PRIMARY KEY,
  scenario_id VARCHAR(100) REFERENCES digital_twin_scenarios(scenario_id) ON DELETE CASCADE,
  param_type VARCHAR(50), -- 'lane-closure', 'incident', 'speed-limit', 'ramp-closure', 'diversion'
  affected_segment_id VARCHAR(100),
  param_start_time TIMESTAMP,
  param_duration_minutes INTEGER,
  param_details JSONB, -- Specific parameters like lanes closed, severity, etc.
  expected_impact_level VARCHAR(20)
);

-- Digital Twin Scenario Results
CREATE TABLE IF NOT EXISTS digital_twin_scenario_results (
  id SERIAL PRIMARY KEY,
  scenario_id VARCHAR(100) REFERENCES digital_twin_scenarios(scenario_id) ON DELETE CASCADE,
  segment_id VARCHAR(100) REFERENCES digital_twin_segments(segment_id) ON DELETE CASCADE,
  time_offset_minutes INTEGER, -- Minutes from scenario start
  predicted_speed_mph NUMERIC(5,2),
  predicted_volume_vph INTEGER,
  predicted_delay_minutes NUMERIC(10,2),
  predicted_queue_length_miles NUMERIC(5,2),
  spillback_risk VARCHAR(20), -- 'none', 'low', 'medium', 'high'
  secondary_incident_probability NUMERIC(5,4)
);

-- Digital Twin Performance Predictions
CREATE TABLE IF NOT EXISTS digital_twin_predictions (
  id SERIAL PRIMARY KEY,
  prediction_id VARCHAR(100) NOT NULL UNIQUE,
  segment_id VARCHAR(100) REFERENCES digital_twin_segments(segment_id) ON DELETE CASCADE,
  prediction_timestamp TIMESTAMP DEFAULT NOW(),
  prediction_for_time TIMESTAMP NOT NULL,
  horizon_minutes INTEGER,
  predicted_travel_time_minutes NUMERIC(10,2),
  predicted_speed_mph NUMERIC(5,2),
  predicted_congestion_level VARCHAR(20),
  confidence_level NUMERIC(5,2),
  influencing_factors JSONB, -- What drove the prediction
  actual_travel_time_minutes NUMERIC(10,2), -- Filled in later for accuracy check
  prediction_error_pct NUMERIC(5,2)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_twin_corridors_status ON digital_twin_corridors(model_status);
CREATE INDEX IF NOT EXISTS idx_twin_segments_corridor ON digital_twin_segments(corridor_id);
CREATE INDEX IF NOT EXISTS idx_twin_segments_state ON digital_twin_segments(state, route);
CREATE INDEX IF NOT EXISTS idx_twin_state_segment ON digital_twin_state(segment_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_twin_scenarios_corridor ON digital_twin_scenarios(corridor_id, run_status);
CREATE INDEX IF NOT EXISTS idx_twin_results_scenario ON digital_twin_scenario_results(scenario_id, time_offset_minutes);
CREATE INDEX IF NOT EXISTS idx_twin_predictions_segment ON digital_twin_predictions(segment_id, prediction_for_time);

-- Comments
COMMENT ON TABLE digital_twin_corridors IS 'Digital operational models of interstate corridors. CCAI UC #19.';
COMMENT ON TABLE digital_twin_segments IS 'Detailed road segments within digital twin corridors';
COMMENT ON TABLE digital_twin_state IS 'Live operational state of corridor segments';
COMMENT ON TABLE digital_twin_scenarios IS 'What-if scenarios for corridor planning';
COMMENT ON TABLE digital_twin_scenario_results IS 'Simulation results from scenarios';
COMMENT ON TABLE digital_twin_predictions IS 'Predictive analytics for corridor conditions';

-- Function to get current corridor state
CREATE OR REPLACE FUNCTION get_corridor_live_state(
  p_corridor_id VARCHAR(100)
)
RETURNS TABLE(
  segment_id VARCHAR(100),
  segment_name VARCHAR(255),
  current_speed NUMERIC,
  congestion_level VARCHAR(20),
  travel_time_minutes NUMERIC,
  active_incidents INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.segment_id,
    s.segment_name,
    st.current_speed_mph,
    st.congestion_level,
    st.travel_time_minutes,
    st.active_incidents
  FROM digital_twin_segments s
  LEFT JOIN LATERAL (
    SELECT *
    FROM digital_twin_state
    WHERE segment_id = s.segment_id
    ORDER BY timestamp DESC
    LIMIT 1
  ) st ON true
  WHERE s.corridor_id = p_corridor_id
  ORDER BY s.start_mile_marker;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate scenario impact
CREATE OR REPLACE FUNCTION calculate_scenario_impact(
  p_scenario_id VARCHAR(100)
)
RETURNS JSONB AS $$
DECLARE
  v_impact JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_delay_hours', ROUND(SUM(predicted_delay_minutes) / 60.0, 2),
    'avg_speed_reduction_mph', ROUND(AVG(65.0 - predicted_speed_mph), 2),
    'max_queue_length_miles', ROUND(MAX(predicted_queue_length_miles), 2),
    'high_spillback_segments', COUNT(*) FILTER (WHERE spillback_risk IN ('high', 'medium')),
    'total_segments_affected', COUNT(DISTINCT segment_id)
  ) INTO v_impact
  FROM digital_twin_scenario_results
  WHERE scenario_id = p_scenario_id;

  RETURN COALESCE(v_impact, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to get prediction accuracy
CREATE OR REPLACE FUNCTION get_prediction_accuracy(
  p_segment_id VARCHAR(100),
  p_days INTEGER DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
  v_accuracy JSONB;
BEGIN
  SELECT jsonb_build_object(
    'avg_error_pct', ROUND(AVG(ABS(prediction_error_pct)), 2),
    'predictions_evaluated', COUNT(*) FILTER (WHERE actual_travel_time_minutes IS NOT NULL),
    'avg_confidence', ROUND(AVG(confidence_level), 2),
    'accuracy_within_10pct',
      ROUND(
        (COUNT(*) FILTER (WHERE ABS(prediction_error_pct) <= 10.0)::NUMERIC /
         COUNT(*) FILTER (WHERE actual_travel_time_minutes IS NOT NULL)::NUMERIC) * 100,
        2
      )
  ) INTO v_accuracy
  FROM digital_twin_predictions
  WHERE segment_id = p_segment_id
    AND prediction_timestamp >= NOW() - (p_days || ' days')::INTERVAL;

  RETURN COALESCE(v_accuracy, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to run basic traffic prediction
CREATE OR REPLACE FUNCTION predict_segment_conditions(
  p_segment_id VARCHAR(100),
  p_horizon_minutes INTEGER DEFAULT 15
)
RETURNS JSONB AS $$
DECLARE
  v_current_state RECORD;
  v_prediction JSONB;
  v_predicted_speed NUMERIC;
  v_predicted_congestion VARCHAR(20);
BEGIN
  -- Get current state
  SELECT * INTO v_current_state
  FROM digital_twin_state
  WHERE segment_id = p_segment_id
  ORDER BY timestamp DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"error": "No current state data"}'::jsonb;
  END IF;

  -- Simple prediction logic (in production, would use ML models)
  v_predicted_speed := v_current_state.current_speed_mph;

  -- Adjust for active incidents
  IF v_current_state.active_incidents > 0 THEN
    v_predicted_speed := v_predicted_speed * 0.7;
  END IF;

  -- Adjust for weather
  IF v_current_state.weather_impact_level = 'severe' THEN
    v_predicted_speed := v_predicted_speed * 0.6;
  ELSIF v_current_state.weather_impact_level = 'moderate' THEN
    v_predicted_speed := v_predicted_speed * 0.8;
  END IF;

  -- Determine congestion level
  v_predicted_congestion := CASE
    WHEN v_predicted_speed >= 55 THEN 'free-flow'
    WHEN v_predicted_speed >= 40 THEN 'moderate'
    WHEN v_predicted_speed >= 20 THEN 'heavy'
    ELSE 'stopped'
  END;

  v_prediction := jsonb_build_object(
    'segment_id', p_segment_id,
    'prediction_for', NOW() + (p_horizon_minutes || ' minutes')::INTERVAL,
    'predicted_speed_mph', ROUND(v_predicted_speed, 1),
    'predicted_congestion', v_predicted_congestion,
    'confidence', 75.0,
    'factors', jsonb_build_object(
      'active_incidents', v_current_state.active_incidents,
      'weather_impact', v_current_state.weather_impact_level
    )
  );

  RETURN v_prediction;
END;
$$ LANGUAGE plpgsql;

-- Insert sample digital twin corridor
INSERT INTO digital_twin_corridors (
  corridor_id,
  corridor_name,
  states_involved,
  primary_routes,
  total_length_miles,
  segment_count,
  model_status,
  data_sources
) VALUES (
  'DT-I35-CENTRAL',
  'I-35 Central Corridor (IA-MN)',
  ARRAY['IA', 'MN'],
  ARRAY['I-35', 'I-35W'],
  250.5,
  25,
  'active',
  ARRAY['probe-data', 'detector-data', 'incidents', 'weather']
) ON CONFLICT (corridor_id) DO NOTHING;

-- Insert sample segments
INSERT INTO digital_twin_segments (
  segment_id, corridor_id, segment_name, state, route, direction,
  start_mile_marker, end_mile_marker, length_miles, lanes_count,
  free_flow_speed_mph, capacity_vehicles_per_hour, segment_type
) VALUES
('SEG-I35-IA-080-090-N', 'DT-I35-CENTRAL', 'I-35 MM 80-90 NB', 'IA', 'I-35', 'northbound', 80.0, 90.0, 10.0, 2, 70, 4000, 'rural'),
('SEG-I35-IA-090-100-N', 'DT-I35-CENTRAL', 'I-35 MM 90-100 NB', 'IA', 'I-35', 'northbound', 90.0, 100.0, 10.0, 2, 70, 4000, 'rural'),
('SEG-I35-IA-100-110-N', 'DT-I35-CENTRAL', 'I-35 MM 100-110 NB', 'IA', 'I-35', 'northbound', 100.0, 110.0, 10.0, 3, 65, 5500, 'urban'),
('SEG-I35-MN-001-010-N', 'DT-I35-CENTRAL', 'I-35 MM 1-10 NB (MN)', 'MN', 'I-35', 'northbound', 1.0, 10.0, 9.0, 3, 65, 5500, 'urban'),
('SEG-I35-MN-010-020-N', 'DT-I35-CENTRAL', 'I-35 MM 10-20 NB (MN)', 'MN', 'I-35', 'northbound', 10.0, 20.0, 10.0, 3, 60, 6000, 'metro')
ON CONFLICT (segment_id) DO NOTHING;

-- Insert sample live state
INSERT INTO digital_twin_state (
  segment_id, current_speed_mph, current_volume_vph, congestion_level,
  active_incidents, weather_impact_level, travel_time_minutes, reliability_index, confidence_score
) VALUES
('SEG-I35-IA-080-090-N', 68.5, 1200, 'free-flow', 0, 'none', 8.8, 0.98, 92.5),
('SEG-I35-IA-090-100-N', 67.2, 1450, 'free-flow', 0, 'none', 8.9, 0.97, 91.0),
('SEG-I35-IA-100-110-N', 58.3, 2800, 'moderate', 0, 'none', 10.3, 0.89, 88.0),
('SEG-I35-MN-001-010-N', 52.1, 3200, 'moderate', 1, 'minor', 10.4, 0.82, 85.5),
('SEG-I35-MN-010-020-N', 48.7, 4100, 'heavy', 0, 'none', 12.3, 0.75, 87.0)
ON CONFLICT DO NOTHING;

-- Insert sample scenario
INSERT INTO digital_twin_scenarios (
  scenario_id,
  corridor_id,
  scenario_name,
  scenario_type,
  description,
  created_by,
  run_status,
  simulation_duration_minutes
) VALUES (
  'SCENARIO-001',
  'DT-I35-CENTRAL',
  'Major Crash at I-35 MM 95',
  'incident',
  'Simulates 3-vehicle crash blocking 2 of 3 lanes during evening peak',
  'planner@iowadot.gov',
  'completed',
  120
) ON CONFLICT (scenario_id) DO NOTHING;

-- Insert scenario parameters
INSERT INTO digital_twin_scenario_params (
  scenario_id, param_type, affected_segment_id, param_start_time,
  param_duration_minutes, param_details, expected_impact_level
) VALUES (
  'SCENARIO-001',
  'incident',
  'SEG-I35-IA-090-100-N',
  NOW(),
  45,
  '{"severity": "high", "lanes_blocked": 2, "lanes_total": 3, "incident_type": "crash"}'::jsonb,
  'severe'
) ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT ON digital_twin_corridors TO PUBLIC;
GRANT SELECT ON digital_twin_segments TO PUBLIC;
GRANT SELECT ON digital_twin_state TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON digital_twin_scenarios TO PUBLIC;
GRANT SELECT, INSERT ON digital_twin_scenario_params TO PUBLIC;
GRANT SELECT, INSERT ON digital_twin_scenario_results TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON digital_twin_predictions TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_corridor_count INTEGER;
  v_segment_count INTEGER;
  v_scenario_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_corridor_count FROM digital_twin_corridors WHERE model_status = 'active';
  SELECT COUNT(*) INTO v_segment_count FROM digital_twin_segments;
  SELECT COUNT(*) INTO v_scenario_count FROM digital_twin_scenarios;

  RAISE NOTICE 'Interstate Digital Twin Pilot Configured:';
  RAISE NOTICE '- % active digital twin corridors', v_corridor_count;
  RAISE NOTICE '- % modeled segments', v_segment_count;
  RAISE NOTICE '- % scenarios created', v_scenario_count;
  RAISE NOTICE '- Live state tracking enabled';
  RAISE NOTICE '- Scenario simulation ready';
  RAISE NOTICE '- Predictive analytics enabled';
  RAISE NOTICE '- Digital operational model active';
END $$;
