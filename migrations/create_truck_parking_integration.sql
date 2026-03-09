-- Migration: Truck Parking Data Integration (CCAI UC #15)
-- Date: 2026-03-03
-- Description: Cross-state truck parking awareness to reduce illegal parking exposure

-- Truck Parking Facilities
CREATE TABLE IF NOT EXISTS truck_parking_facilities (
  id SERIAL PRIMARY KEY,
  facility_id VARCHAR(100) NOT NULL UNIQUE,
  facility_name VARCHAR(255) NOT NULL,
  state VARCHAR(2) NOT NULL,
  facility_type VARCHAR(50), -- 'rest-area', 'truck-stop', 'weigh-station', 'private', 'parking-lot'
  operator VARCHAR(255), -- 'State DOT', 'Private', 'Truck Stop Chain'
  route VARCHAR(50),
  direction VARCHAR(20),
  exit_number VARCHAR(20),
  mile_marker NUMERIC(10,2),
  location_description VARCHAR(255),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  total_spaces INTEGER NOT NULL,
  standard_spaces INTEGER,
  accessible_spaces INTEGER,
  oversize_spaces INTEGER,
  amenities TEXT[], -- 'restrooms', 'food', 'fuel', 'showers', 'wifi', 'security'
  security_level VARCHAR(20), -- 'none', 'lighting', 'cameras', 'attended'
  time_limit_hours INTEGER,
  restrictions TEXT[], -- 'no-idling', 'commercial-only', 'reservation-required'
  has_real_time_data BOOLEAN DEFAULT false,
  data_source VARCHAR(100), -- 'dot-sensors', 'truck-stop-api', 'manual', 'crowd-sourced'
  data_feed_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_facility_type CHECK (facility_type IN (
    'rest-area', 'truck-stop', 'weigh-station', 'private', 'parking-lot', 'service-plaza'
  )),
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'maintenance', 'closed'))
);

-- Truck Parking Availability (Real-Time)
CREATE TABLE IF NOT EXISTS truck_parking_availability (
  id SERIAL PRIMARY KEY,
  facility_id VARCHAR(100) REFERENCES truck_parking_facilities(facility_id) ON DELETE CASCADE,
  timestamp TIMESTAMP DEFAULT NOW(),
  spaces_available INTEGER NOT NULL,
  spaces_occupied INTEGER NOT NULL,
  occupancy_rate_pct NUMERIC(5,2),
  status VARCHAR(20), -- 'spaces-available', 'nearly-full', 'full', 'unknown'
  confidence_level NUMERIC(5,2), -- How reliable is this data
  data_source VARCHAR(50), -- 'sensor', 'api', 'estimated', 'operator-report'
  forecast_full_time TIMESTAMP, -- When will it likely be full
  CONSTRAINT valid_availability_status CHECK (status IN (
    'spaces-available', 'nearly-full', 'full', 'overflow', 'unknown'
  ))
);

-- Truck Parking Alerts
CREATE TABLE IF NOT EXISTS truck_parking_alerts (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(100) NOT NULL UNIQUE,
  corridor VARCHAR(100),
  state VARCHAR(2),
  alert_type VARCHAR(50), -- 'capacity-shortage', 'all-facilities-full', 'facility-closed'
  severity VARCHAR(20) DEFAULT 'medium',
  affected_facilities TEXT[],
  alert_description TEXT,
  recommended_alternatives TEXT[],
  notified_states TEXT[],
  issued_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  CONSTRAINT valid_alert_type CHECK (alert_type IN (
    'capacity-shortage', 'all-facilities-full', 'facility-closed', 'weather-related'
  )),
  CONSTRAINT valid_alert_status CHECK (status IN ('active', 'resolved', 'expired'))
);

-- Truck Parking Historical Data
CREATE TABLE IF NOT EXISTS truck_parking_historical (
  id SERIAL PRIMARY KEY,
  facility_id VARCHAR(100) REFERENCES truck_parking_facilities(facility_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  hour INTEGER NOT NULL, -- 0-23
  avg_spaces_available NUMERIC(5,2),
  avg_occupancy_pct NUMERIC(5,2),
  peak_occupancy_pct NUMERIC(5,2),
  times_full INTEGER DEFAULT 0,
  UNIQUE(facility_id, date, hour),
  CONSTRAINT valid_hour CHECK (hour >= 0 AND hour <= 23)
);

-- Truck Parking Cross-State Sharing
CREATE TABLE IF NOT EXISTS truck_parking_data_sharing (
  id SERIAL PRIMARY KEY,
  providing_state VARCHAR(2) NOT NULL,
  consuming_state VARCHAR(2) NOT NULL,
  data_feed_url VARCHAR(500),
  data_format VARCHAR(20) DEFAULT 'json',
  update_frequency_minutes INTEGER DEFAULT 15,
  last_update TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  facilities_shared INTEGER,
  CONSTRAINT valid_sharing_status CHECK (status IN ('active', 'paused', 'error'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parking_facilities_state ON truck_parking_facilities(state, route);
CREATE INDEX IF NOT EXISTS idx_parking_facilities_route ON truck_parking_facilities(route, mile_marker);
CREATE INDEX IF NOT EXISTS idx_parking_availability_facility ON truck_parking_availability(facility_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_parking_availability_time ON truck_parking_availability(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_parking_alerts_corridor ON truck_parking_alerts(corridor, status);
CREATE INDEX IF NOT EXISTS idx_parking_historical_facility ON truck_parking_historical(facility_id, date, hour);
CREATE INDEX IF NOT EXISTS idx_parking_sharing_states ON truck_parking_data_sharing(providing_state, consuming_state);

-- Comments
COMMENT ON TABLE truck_parking_facilities IS 'Truck parking facility inventory. CCAI UC #15.';
COMMENT ON TABLE truck_parking_availability IS 'Real-time truck parking availability data';
COMMENT ON TABLE truck_parking_alerts IS 'Corridor-level truck parking capacity alerts';
COMMENT ON TABLE truck_parking_historical IS 'Historical parking utilization patterns';
COMMENT ON TABLE truck_parking_data_sharing IS 'Cross-state parking data sharing agreements';

-- Function to calculate occupancy status
CREATE OR REPLACE FUNCTION calculate_parking_status(
  p_total_spaces INTEGER,
  p_spaces_available INTEGER
)
RETURNS VARCHAR(20) AS $$
DECLARE
  v_occupancy_pct NUMERIC;
BEGIN
  IF p_spaces_available IS NULL OR p_total_spaces = 0 THEN
    RETURN 'unknown';
  END IF;

  v_occupancy_pct := ((p_total_spaces - p_spaces_available)::NUMERIC / p_total_spaces::NUMERIC) * 100;

  RETURN CASE
    WHEN p_spaces_available = 0 THEN 'full'
    WHEN v_occupancy_pct >= 90 THEN 'nearly-full'
    WHEN v_occupancy_pct >= 50 THEN 'spaces-available'
    ELSE 'spaces-available'
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearest parking with availability
CREATE OR REPLACE FUNCTION find_nearest_parking(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_route VARCHAR(50) DEFAULT NULL,
  p_min_spaces INTEGER DEFAULT 5
)
RETURNS TABLE(
  facility_id VARCHAR(100),
  facility_name VARCHAR(255),
  distance_miles NUMERIC,
  spaces_available INTEGER,
  occupancy_status VARCHAR(20),
  amenities TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.facility_id,
    f.facility_name,
    ROUND(
      SQRT(
        POWER((f.latitude - p_latitude) * 69, 2) +
        POWER((f.longitude - p_longitude) * 54.6, 2)
      ),
      1
    ) as distance_miles,
    a.spaces_available,
    a.status as occupancy_status,
    f.amenities
  FROM truck_parking_facilities f
  LEFT JOIN LATERAL (
    SELECT spaces_available, status
    FROM truck_parking_availability
    WHERE facility_id = f.facility_id
    ORDER BY timestamp DESC
    LIMIT 1
  ) a ON true
  WHERE f.status = 'active'
    AND (p_route IS NULL OR f.route = p_route)
    AND f.latitude IS NOT NULL
    AND f.longitude IS NOT NULL
    AND (a.spaces_available IS NULL OR a.spaces_available >= p_min_spaces)
  ORDER BY distance_miles ASC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Function to update parking availability
CREATE OR REPLACE FUNCTION update_parking_availability(
  p_facility_id VARCHAR(100),
  p_spaces_available INTEGER,
  p_data_source VARCHAR(50) DEFAULT 'sensor'
)
RETURNS VOID AS $$
DECLARE
  v_total_spaces INTEGER;
  v_spaces_occupied INTEGER;
  v_occupancy_pct NUMERIC;
  v_status VARCHAR(20);
BEGIN
  -- Get total spaces
  SELECT total_spaces INTO v_total_spaces
  FROM truck_parking_facilities
  WHERE facility_id = p_facility_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facility not found: %', p_facility_id;
  END IF;

  -- Calculate metrics
  v_spaces_occupied := v_total_spaces - p_spaces_available;
  v_occupancy_pct := (v_spaces_occupied::NUMERIC / v_total_spaces::NUMERIC) * 100;
  v_status := calculate_parking_status(v_total_spaces, p_spaces_available);

  -- Insert availability record
  INSERT INTO truck_parking_availability (
    facility_id,
    spaces_available,
    spaces_occupied,
    occupancy_rate_pct,
    status,
    confidence_level,
    data_source
  ) VALUES (
    p_facility_id,
    p_spaces_available,
    v_spaces_occupied,
    v_occupancy_pct,
    v_status,
    CASE p_data_source
      WHEN 'sensor' THEN 95.0
      WHEN 'api' THEN 90.0
      WHEN 'operator-report' THEN 85.0
      ELSE 70.0
    END,
    p_data_source
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check corridor parking capacity
CREATE OR REPLACE FUNCTION check_corridor_parking_capacity(
  p_corridor VARCHAR(100)
)
RETURNS JSONB AS $$
DECLARE
  v_capacity JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_facilities', COUNT(*),
    'total_spaces', SUM(f.total_spaces),
    'spaces_available', SUM(a.spaces_available),
    'occupancy_pct', ROUND(AVG(a.occupancy_rate_pct), 2),
    'facilities_full', COUNT(*) FILTER (WHERE a.status = 'full'),
    'facilities_nearly_full', COUNT(*) FILTER (WHERE a.status = 'nearly-full')
  ) INTO v_capacity
  FROM truck_parking_facilities f
  LEFT JOIN LATERAL (
    SELECT spaces_available, occupancy_rate_pct, status
    FROM truck_parking_availability
    WHERE facility_id = f.facility_id
    ORDER BY timestamp DESC
    LIMIT 1
  ) a ON true
  WHERE f.route = p_corridor
    AND f.status = 'active';

  RETURN COALESCE(v_capacity, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Insert sample truck parking facilities
INSERT INTO truck_parking_facilities (
  facility_id, facility_name, state, facility_type, operator,
  route, direction, mile_marker, location_description,
  latitude, longitude, total_spaces, standard_spaces,
  amenities, security_level, has_real_time_data, data_source, status
) VALUES
('TP-IA-I35-087', 'I-35 Rest Area MM 87', 'IA', 'rest-area', 'Iowa DOT',
 'I-35', 'northbound', 87.0, 'I-35 Exit 87 Rest Area',
 41.5868, -93.6250, 45, 40, ARRAY['restrooms', 'wifi', 'picnic'], 'lighting', true, 'dot-sensors', 'active'),

('TP-IA-I35-092', 'Travel Plaza Des Moines', 'IA', 'truck-stop', 'Travel Centers of America',
 'I-35', 'both', 92.0, 'I-35 Exit 92',
 41.6123, -93.6100, 120, 100, ARRAY['restrooms', 'food', 'fuel', 'showers', 'wifi'], 'cameras', true, 'truck-stop-api', 'active'),

('TP-IA-I80-137', 'I-80 Rest Area MM 137', 'IA', 'rest-area', 'Iowa DOT',
 'I-80', 'eastbound', 137.0, 'I-80 Mile Marker 137',
 41.5912, -93.6037, 55, 50, ARRAY['restrooms', 'vending', 'wifi'], 'lighting', true, 'dot-sensors', 'active'),

('TP-MN-I35-012', 'Twin Cities Truck Plaza', 'MN', 'truck-stop', 'Pilot Flying J',
 'I-35', 'both', 12.0, 'I-35W Exit 12',
 44.9778, -93.2650, 150, 130, ARRAY['restrooms', 'food', 'fuel', 'showers', 'wifi', 'security'], 'attended', true, 'truck-stop-api', 'active'),

('TP-TX-I35-200', 'Austin Truck Center', 'TX', 'truck-stop', 'Love''s Travel Stops',
 'I-35', 'both', 200.0, 'I-35 Exit 200',
 30.2672, -97.7431, 200, 175, ARRAY['restrooms', 'food', 'fuel', 'showers', 'wifi'], 'cameras', true, 'truck-stop-api', 'active')
ON CONFLICT (facility_id) DO NOTHING;

-- Insert current availability data
INSERT INTO truck_parking_availability (
  facility_id, spaces_available, spaces_occupied, occupancy_rate_pct,
  status, confidence_level, data_source
) VALUES
('TP-IA-I35-087', 12, 33, 73.3, 'spaces-available', 95.0, 'sensor'),
('TP-IA-I35-092', 8, 112, 93.3, 'nearly-full', 90.0, 'api'),
('TP-IA-I80-137', 22, 33, 60.0, 'spaces-available', 95.0, 'sensor'),
('TP-MN-I35-012', 35, 115, 76.7, 'spaces-available', 90.0, 'api'),
('TP-TX-I35-200', 0, 200, 100.0, 'full', 90.0, 'api')
ON CONFLICT DO NOTHING;

-- Insert historical patterns (sample weekend evening data)
INSERT INTO truck_parking_historical (
  facility_id, date, hour, avg_spaces_available, avg_occupancy_pct, peak_occupancy_pct, times_full
) VALUES
('TP-IA-I35-087', CURRENT_DATE - 1, 20, 8.5, 81.1, 95.6, 0),
('TP-IA-I35-087', CURRENT_DATE - 1, 21, 3.2, 92.9, 100.0, 1),
('TP-IA-I35-087', CURRENT_DATE - 1, 22, 0.8, 98.2, 100.0, 3),
('TP-IA-I35-092', CURRENT_DATE - 1, 20, 15.3, 87.3, 96.7, 0),
('TP-IA-I35-092', CURRENT_DATE - 1, 21, 5.1, 95.8, 100.0, 1),
('TP-IA-I35-092', CURRENT_DATE - 1, 22, 0.0, 100.0, 100.0, 4)
ON CONFLICT DO NOTHING;

-- Insert data sharing agreements
INSERT INTO truck_parking_data_sharing (
  providing_state, consuming_state, data_format, update_frequency_minutes,
  status, facilities_shared
) VALUES
('IA', 'MN', 'json', 15, 'active', 3),
('IA', 'NE', 'json', 15, 'active', 3),
('MN', 'IA', 'json', 15, 'active', 2),
('TX', 'OK', 'json', 15, 'active', 5)
ON CONFLICT DO NOTHING;

-- Insert sample alert
INSERT INTO truck_parking_alerts (
  alert_id, corridor, state, alert_type, severity,
  affected_facilities, alert_description, recommended_alternatives,
  notified_states, issued_at, expires_at, status
) VALUES (
  'ALERT-TP-20260303-001',
  'I-35',
  'TX',
  'all-facilities-full',
  'high',
  ARRAY['TP-TX-I35-200', 'TP-TX-I35-195'],
  'All truck parking facilities full on I-35 corridor between MM 195-205. Next available parking at MM 215 (20 miles north).',
  ARRAY['TP-TX-I35-215', 'Local parking in Georgetown'],
  ARRAY['OK'],
  NOW() - INTERVAL '2 hours',
  NOW() + INTERVAL '6 hours',
  'active'
) ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT ON truck_parking_facilities TO PUBLIC;
GRANT SELECT, INSERT ON truck_parking_availability TO PUBLIC;
GRANT SELECT ON truck_parking_alerts TO PUBLIC;
GRANT SELECT ON truck_parking_historical TO PUBLIC;
GRANT SELECT ON truck_parking_data_sharing TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_facility_count INTEGER;
  v_total_spaces INTEGER;
  v_sharing_count INTEGER;
BEGIN
  SELECT COUNT(*), SUM(total_spaces) INTO v_facility_count, v_total_spaces
  FROM truck_parking_facilities WHERE status = 'active';

  SELECT COUNT(*) INTO v_sharing_count
  FROM truck_parking_data_sharing WHERE status = 'active';

  RAISE NOTICE 'Truck Parking Data Integration Configured:';
  RAISE NOTICE '- % active parking facilities', v_facility_count;
  RAISE NOTICE '- % total truck parking spaces', v_total_spaces;
  RAISE NOTICE '- % data sharing agreements', v_sharing_count;
  RAISE NOTICE '- Real-time availability tracking enabled';
  RAISE NOTICE '- Cross-state parking visibility enabled';
  RAISE NOTICE '- Capacity alert system ready';
END $$;
