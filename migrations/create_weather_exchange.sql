-- Migration: Weather Status Exchange Feed (CCAI UC #16)
-- Date: 2026-03-03
-- Description: Road condition data exchange during weather events for aligned response

-- Weather Events
CREATE TABLE IF NOT EXISTS weather_events (
  id SERIAL PRIMARY KEY,
  weather_id VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(2) NOT NULL,
  weather_type VARCHAR(50), -- 'snow', 'ice', 'fog', 'wind', 'flooding', 'severe-storm'
  severity VARCHAR(20) DEFAULT 'medium',
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  duration_hours NUMERIC(10,2),
  affected_routes TEXT[],
  affected_corridors TEXT[],
  geographic_extent VARCHAR(100), -- 'localized', 'regional', 'statewide'
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  CONSTRAINT valid_weather_type CHECK (weather_type IN (
    'snow', 'ice', 'freezing-rain', 'fog', 'wind', 'flooding',
    'severe-storm', 'blizzard', 'tornado', 'heat'
  )),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'moderate', 'high', 'severe', 'extreme')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'clearing', 'cleared', 'warning'))
);

-- Road Conditions (Segment-Level)
CREATE TABLE IF NOT EXISTS road_conditions (
  id SERIAL PRIMARY KEY,
  condition_id VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(2) NOT NULL,
  route VARCHAR(50) NOT NULL,
  direction VARCHAR(20),
  start_mile_marker NUMERIC(10,2),
  end_mile_marker NUMERIC(10,2),
  location_description VARCHAR(255),
  road_condition VARCHAR(50), -- 'clear', 'wet', 'slushy', 'snow-covered', 'icy', 'impassable'
  visibility VARCHAR(50), -- 'clear', 'reduced', 'low', 'near-zero'
  visibility_distance_feet INTEGER,
  temperature_f INTEGER,
  wind_speed_mph INTEGER,
  precipitation_type VARCHAR(50), -- 'none', 'rain', 'snow', 'sleet', 'freezing-rain'
  precipitation_rate VARCHAR(20), -- 'light', 'moderate', 'heavy'
  surface_status VARCHAR(50), -- 'dry', 'wet', 'chemical-wet', 'ice-warning', 'ice-watch'
  treatment_status VARCHAR(50), -- 'untreated', 'pre-treated', 'being-treated', 'treated'
  last_plow_time TIMESTAMP,
  road_status VARCHAR(20) DEFAULT 'open', -- 'open', 'restricted', 'closed', 'advisory'
  travel_advisory VARCHAR(100), -- 'normal', 'use-caution', 'not-recommended', 'no-travel-advised'
  timestamp TIMESTAMP DEFAULT NOW(),
  data_source VARCHAR(50), -- 'rwis', 'plow-truck', 'manual', 'camera'
  weather_event_id VARCHAR(100),
  CONSTRAINT valid_road_condition CHECK (road_condition IN (
    'clear', 'wet', 'slushy', 'snow-covered', 'partially-snow-covered',
    'icy', 'black-ice', 'impassable', 'unknown'
  )),
  CONSTRAINT valid_road_status CHECK (road_status IN ('open', 'restricted', 'closed', 'advisory'))
);

-- Weather Notifications (Cross-State)
CREATE TABLE IF NOT EXISTS weather_notifications (
  id SERIAL PRIMARY KEY,
  weather_id VARCHAR(100) REFERENCES weather_events(weather_id) ON DELETE CASCADE,
  reporting_state VARCHAR(2) NOT NULL,
  notified_state VARCHAR(2) NOT NULL,
  notification_type VARCHAR(50), -- 'storm-approaching', 'deteriorating-conditions', 'closure-possible'
  severity VARCHAR(20),
  estimated_arrival_time TIMESTAMP,
  expected_duration_hours NUMERIC(5,2),
  recommended_actions TEXT[],
  notified_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  response_action VARCHAR(100) -- 'pre-treating', 'mobilizing-plows', 'monitoring', 'coordinating-closures'
);

-- Weather Response Coordination
CREATE TABLE IF NOT EXISTS weather_response_coordination (
  id SERIAL PRIMARY KEY,
  coordination_id VARCHAR(100) NOT NULL UNIQUE,
  weather_id VARCHAR(100) REFERENCES weather_events(weather_id) ON DELETE CASCADE,
  participating_states TEXT[],
  coordination_type VARCHAR(50), -- 'joint-closure', 'synchronized-treatment', 'travel-advisory'
  lead_state VARCHAR(2),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  actions JSONB, -- {"IA": "closing I-35 MM 85-100", "MN": "closing I-35 MM 0-10"}
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  CONSTRAINT valid_coordination_status CHECK (status IN ('planning', 'active', 'completed', 'cancelled'))
);

-- Road Weather Information System (RWIS) Stations
CREATE TABLE IF NOT EXISTS rwis_stations (
  id SERIAL PRIMARY KEY,
  station_id VARCHAR(100) NOT NULL UNIQUE,
  station_name VARCHAR(255),
  state VARCHAR(2) NOT NULL,
  route VARCHAR(50),
  mile_marker NUMERIC(10,2),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  elevation_feet INTEGER,
  station_type VARCHAR(50), -- 'ess', 'mobile', 'temporary'
  operational_status VARCHAR(20) DEFAULT 'active',
  last_report TIMESTAMP,
  shared_with_states TEXT[],
  CONSTRAINT valid_operational_status CHECK (operational_status IN ('active', 'inactive', 'maintenance'))
);

-- RWIS Observations
CREATE TABLE IF NOT EXISTS rwis_observations (
  id SERIAL PRIMARY KEY,
  station_id VARCHAR(100) REFERENCES rwis_stations(station_id) ON DELETE CASCADE,
  observation_time TIMESTAMP DEFAULT NOW(),
  air_temp_f NUMERIC(5,2),
  surface_temp_f NUMERIC(5,2),
  dew_point_f NUMERIC(5,2),
  wind_speed_mph INTEGER,
  wind_gust_mph INTEGER,
  precipitation_rate_in_hr NUMERIC(5,3),
  precipitation_type VARCHAR(50),
  surface_condition VARCHAR(50),
  surface_moisture VARCHAR(20), -- 'dry', 'moist', 'wet', 'ice-warning'
  visibility_miles NUMERIC(5,2),
  atmospheric_pressure_mb NUMERIC(6,2)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weather_events_state ON weather_events(state, status);
CREATE INDEX IF NOT EXISTS idx_weather_events_time ON weather_events(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_road_conditions_route ON road_conditions(state, route, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_road_conditions_weather ON road_conditions(weather_event_id);
CREATE INDEX IF NOT EXISTS idx_weather_notifications_state ON weather_notifications(notified_state, acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_weather_coordination_weather ON weather_response_coordination(weather_id);
CREATE INDEX IF NOT EXISTS idx_rwis_stations_state ON rwis_stations(state, operational_status);
CREATE INDEX IF NOT EXISTS idx_rwis_observations_station ON rwis_observations(station_id, observation_time DESC);

-- Comments
COMMENT ON TABLE weather_events IS 'Weather event tracking for cross-state coordination. CCAI UC #16.';
COMMENT ON TABLE road_conditions IS 'Real-time road condition reports by segment';
COMMENT ON TABLE weather_notifications IS 'Cross-state weather notifications';
COMMENT ON TABLE weather_response_coordination IS 'Multi-state weather response coordination';
COMMENT ON TABLE rwis_stations IS 'Road Weather Information System station inventory';
COMMENT ON TABLE rwis_observations IS 'RWIS sensor observations';

-- Function to determine weather impact level
CREATE OR REPLACE FUNCTION calculate_weather_impact(
  p_road_condition VARCHAR(50),
  p_visibility VARCHAR(50),
  p_road_status VARCHAR(20)
)
RETURNS VARCHAR(20) AS $$
BEGIN
  IF p_road_status = 'closed' OR p_road_condition IN ('impassable', 'black-ice') THEN
    RETURN 'extreme';
  ELSIF p_road_condition IN ('icy', 'snow-covered') OR p_visibility = 'near-zero' THEN
    RETURN 'severe';
  ELSIF p_road_condition IN ('partially-snow-covered', 'slushy') OR p_visibility = 'low' THEN
    RETURN 'high';
  ELSIF p_road_condition = 'wet' OR p_visibility = 'reduced' THEN
    RETURN 'moderate';
  ELSE
    RETURN 'low';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get current road conditions
CREATE OR REPLACE FUNCTION get_current_road_conditions(
  p_route VARCHAR(50),
  p_state VARCHAR(2) DEFAULT NULL
)
RETURNS TABLE(
  route VARCHAR(50),
  state VARCHAR(2),
  segment_description VARCHAR(255),
  road_condition VARCHAR(50),
  visibility VARCHAR(50),
  road_status VARCHAR(20),
  travel_advisory VARCHAR(100),
  impact_level VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (rc.route, rc.start_mile_marker)
    rc.route,
    rc.state,
    rc.location_description as segment_description,
    rc.road_condition,
    rc.visibility,
    rc.road_status,
    rc.travel_advisory,
    calculate_weather_impact(rc.road_condition, rc.visibility, rc.road_status) as impact_level
  FROM road_conditions rc
  WHERE rc.route = p_route
    AND (p_state IS NULL OR rc.state = p_state)
  ORDER BY rc.route, rc.start_mile_marker, rc.timestamp DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to create weather event and notify states
CREATE OR REPLACE FUNCTION create_weather_event(
  p_state VARCHAR(2),
  p_weather_type VARCHAR(50),
  p_severity VARCHAR(20),
  p_affected_routes TEXT[],
  p_description TEXT
)
RETURNS VARCHAR(100) AS $$
DECLARE
  v_weather_id VARCHAR(100);
  v_notify_state VARCHAR(2);
BEGIN
  v_weather_id := 'WEATHER-' || p_state || '-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

  INSERT INTO weather_events (
    weather_id,
    state,
    weather_type,
    severity,
    affected_routes,
    description,
    status
  ) VALUES (
    v_weather_id,
    p_state,
    p_weather_type,
    p_severity,
    p_affected_routes,
    p_description,
    'active'
  );

  -- Notify adjacent states for severe weather
  IF p_severity IN ('severe', 'extreme', 'high') THEN
    FOREACH v_notify_state IN ARRAY ARRAY['IA', 'MN', 'TX', 'MO', 'NE', 'IL', 'WI']
    LOOP
      IF v_notify_state != p_state THEN
        INSERT INTO weather_notifications (
          weather_id,
          reporting_state,
          notified_state,
          notification_type,
          severity
        ) VALUES (
          v_weather_id,
          p_state,
          v_notify_state,
          'storm-approaching',
          p_severity
        );
      END IF;
    END LOOP;
  END IF;

  RETURN v_weather_id;
END;
$$ LANGUAGE plpgsql;

-- Insert sample RWIS stations
INSERT INTO rwis_stations (
  station_id, station_name, state, route, mile_marker,
  latitude, longitude, elevation_feet, station_type,
  operational_status, shared_with_states
) VALUES
('RWIS-IA-I35-087', 'I-35 MM 87 Weather Station', 'IA', 'I-35', 87.0,
 41.5868, -93.6250, 1050, 'ess', 'active', ARRAY['MN', 'MO']),

('RWIS-IA-I80-137', 'I-80 MM 137 Weather Station', 'IA', 'I-80', 137.0,
 41.5912, -93.6037, 980, 'ess', 'active', ARRAY['NE', 'IL']),

('RWIS-MN-I35-012', 'I-35W MM 12 Weather Station', 'MN', 'I-35', 12.0,
 44.9778, -93.2650, 850, 'ess', 'active', ARRAY['IA', 'WI'])
ON CONFLICT (station_id) DO NOTHING;

-- Insert sample weather event (historical)
INSERT INTO weather_events (
  weather_id, state, weather_type, severity, start_time, end_time,
  duration_hours, affected_routes, geographic_extent,
  description, status
) VALUES (
  'WEATHER-IA-20260301-001',
  'IA',
  'snow',
  'high',
  NOW() - INTERVAL '48 hours',
  NOW() - INTERVAL '40 hours',
  8.0,
  ARRAY['I-35', 'I-80', 'US-30'],
  'regional',
  'Winter storm with 6-8 inches of snow, reduced visibility',
  'cleared'
) ON CONFLICT DO NOTHING;

-- Insert sample road conditions
INSERT INTO road_conditions (
  condition_id, state, route, direction, start_mile_marker, end_mile_marker,
  location_description, road_condition, visibility, temperature_f,
  road_status, travel_advisory, data_source
) VALUES
('COND-IA-I35-085-090', 'IA', 'I-35', 'northbound', 85.0, 90.0,
 'I-35 MM 85-90 Northbound', 'wet', 'clear', 45, 'open', 'normal', 'rwis'),

('COND-IA-I80-135-140', 'IA', 'I-80', 'eastbound', 135.0, 140.0,
 'I-80 MM 135-140 Eastbound', 'clear', 'clear', 52, 'open', 'normal', 'manual'),

('COND-MN-I35-010-015', 'MN', 'I-35', 'southbound', 10.0, 15.0,
 'I-35W MM 10-15 Southbound', 'wet', 'reduced', 38, 'open', 'use-caution', 'rwis')
ON CONFLICT (condition_id) DO NOTHING;

-- Insert sample weather notification (historical)
INSERT INTO weather_notifications (
  weather_id, reporting_state, notified_state, notification_type,
  severity, notified_at, acknowledged_at, acknowledged_by, response_action
) VALUES (
  'WEATHER-IA-20260301-001',
  'IA',
  'MN',
  'storm-approaching',
  'high',
  NOW() - INTERVAL '50 hours',
  NOW() - INTERVAL '49 hours',
  'operator@mndot.gov',
  'pre-treating'
) ON CONFLICT DO NOTHING;

-- Insert sample RWIS observations
INSERT INTO rwis_observations (
  station_id, air_temp_f, surface_temp_f, wind_speed_mph,
  precipitation_type, surface_condition, visibility_miles
) VALUES
('RWIS-IA-I35-087', 45.2, 48.1, 12, 'none', 'dry', 10.0),
('RWIS-IA-I80-137', 52.8, 54.3, 8, 'none', 'dry', 10.0),
('RWIS-MN-I35-012', 38.5, 36.2, 15, 'none', 'moist', 7.5)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON weather_events TO PUBLIC;
GRANT SELECT, INSERT ON road_conditions TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON weather_notifications TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON weather_response_coordination TO PUBLIC;
GRANT SELECT ON rwis_stations TO PUBLIC;
GRANT SELECT, INSERT ON rwis_observations TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_rwis_count INTEGER;
  v_condition_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_rwis_count FROM rwis_stations WHERE operational_status = 'active';
  SELECT COUNT(*) INTO v_condition_count FROM road_conditions;

  RAISE NOTICE 'Weather Status Exchange Feed Configured:';
  RAISE NOTICE '- % active RWIS stations', v_rwis_count;
  RAISE NOTICE '- % road condition reports', v_condition_count;
  RAISE NOTICE '- Cross-state weather notifications enabled';
  RAISE NOTICE '- Road condition tracking by segment';
  RAISE NOTICE '- Weather response coordination ready';
  RAISE NOTICE '- RWIS data sharing enabled';
END $$;
