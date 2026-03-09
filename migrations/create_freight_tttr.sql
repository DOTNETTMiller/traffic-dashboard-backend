-- Migration: Freight TTTR Data Layer (CCAI UC #18)
-- Date: 2026-03-03
-- Description: Corridor freight performance monitoring with Truck Travel Time Reliability Index

-- Freight Travel Time Observations
CREATE TABLE IF NOT EXISTS freight_travel_time_observations (
  id SERIAL PRIMARY KEY,
  observation_id VARCHAR(100) NOT NULL UNIQUE,
  corridor VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  route VARCHAR(50) NOT NULL,
  direction VARCHAR(20),
  start_location VARCHAR(255),
  end_location VARCHAR(255),
  start_mile_marker NUMERIC(10,2),
  end_mile_marker NUMERIC(10,2),
  segment_length_miles NUMERIC(10,2),
  observation_timestamp TIMESTAMP DEFAULT NOW(),
  travel_time_minutes NUMERIC(10,2) NOT NULL,
  average_speed_mph NUMERIC(5,2),
  vehicle_classification VARCHAR(50), -- 'single-unit-truck', 'tractor-trailer', 'heavy-truck'
  time_of_day VARCHAR(20), -- 'peak-am', 'peak-pm', 'midday', 'overnight', 'weekend'
  day_of_week INTEGER, -- 1=Monday, 7=Sunday
  is_holiday BOOLEAN DEFAULT false,
  weather_condition VARCHAR(50),
  incident_nearby BOOLEAN DEFAULT false,
  construction_active BOOLEAN DEFAULT false,
  data_source VARCHAR(50) -- 'probe-data', 'fleet-data', 'weigh-station', 'toll-data'
);

-- Freight TTTR Metrics (Monthly)
CREATE TABLE IF NOT EXISTS freight_tttr_metrics (
  id SERIAL PRIMARY KEY,
  metric_id VARCHAR(100) NOT NULL UNIQUE,
  corridor VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  route VARCHAR(50) NOT NULL,
  direction VARCHAR(20),
  segment_start VARCHAR(255),
  segment_end VARCHAR(255),
  month DATE NOT NULL, -- First day of month
  observation_count INTEGER,

  -- Travel Time Percentiles (minutes)
  percentile_50th_minutes NUMERIC(10,2), -- Median
  percentile_80th_minutes NUMERIC(10,2),
  percentile_95th_minutes NUMERIC(10,2),

  -- Truck TTRI Score
  truck_ttri_score NUMERIC(10,4), -- 80th / 50th percentile

  -- Planning Time Index for Trucks
  truck_pti NUMERIC(10,4), -- 95th / free-flow

  -- Buffer Time Index for Trucks
  truck_bti NUMERIC(10,4), -- (95th - 50th) / 50th

  -- Additional Metrics
  free_flow_travel_time_minutes NUMERIC(10,2),
  avg_travel_time_minutes NUMERIC(10,2),
  congested_hours_count INTEGER,
  reliability_rating VARCHAR(20), -- 'excellent', 'good', 'fair', 'poor', 'very-poor'

  -- Impact Factors
  incident_hours INTEGER DEFAULT 0,
  construction_hours INTEGER DEFAULT 0,
  weather_hours INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(corridor, state, route, direction, month)
);

-- Freight Bottlenecks
CREATE TABLE IF NOT EXISTS freight_bottlenecks (
  id SERIAL PRIMARY KEY,
  bottleneck_id VARCHAR(100) NOT NULL UNIQUE,
  corridor VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,
  route VARCHAR(50) NOT NULL,
  location_description VARCHAR(255),
  mile_marker NUMERIC(10,2),
  bottleneck_type VARCHAR(50), -- 'recurring-congestion', 'geometric', 'weigh-station', 'interchange'
  severity VARCHAR(20), -- 'minor', 'moderate', 'severe', 'critical'
  avg_delay_minutes NUMERIC(10,2),
  frequency_pct NUMERIC(5,2), -- % of time it's a bottleneck
  typical_time_windows TEXT[], -- ['weekdays-7am-9am', 'weekdays-4pm-6pm']
  primary_cause VARCHAR(100),
  recommended_improvements TEXT[],
  cost_estimate NUMERIC(15,2),
  priority_rank INTEGER,
  identified_date DATE,
  status VARCHAR(20) DEFAULT 'active',
  CONSTRAINT valid_bottleneck_type CHECK (bottleneck_type IN (
    'recurring-congestion', 'geometric', 'weigh-station',
    'interchange', 'steep-grade', 'merge-point', 'lane-drop'
  )),
  CONSTRAINT valid_bottleneck_status CHECK (status IN ('active', 'monitoring', 'improvement-planned', 'resolved'))
);

-- Freight Corridors
CREATE TABLE IF NOT EXISTS freight_corridors (
  id SERIAL PRIMARY KEY,
  corridor_id VARCHAR(100) NOT NULL UNIQUE,
  corridor_name VARCHAR(255) NOT NULL,
  states_involved TEXT[] NOT NULL,
  primary_routes TEXT[] NOT NULL,
  total_length_miles NUMERIC(10,2),
  freight_classification VARCHAR(50), -- 'critical-urban', 'critical-rural', 'nhs-connector'
  annual_truck_volume BIGINT,
  avg_daily_trucks INTEGER,
  truck_percentage NUMERIC(5,2),
  key_freight_flows TEXT[], -- ['agricultural', 'manufacturing', 'intermodal']
  major_origins_destinations TEXT[],
  is_national_highway_freight BOOLEAN DEFAULT false,
  monitoring_priority VARCHAR(20) DEFAULT 'medium',
  last_assessment_date DATE,
  CONSTRAINT valid_freight_classification CHECK (freight_classification IN (
    'critical-urban', 'critical-rural', 'nhs-connector', 'interstate', 'other'
  ))
);

-- Freight Performance Alerts
CREATE TABLE IF NOT EXISTS freight_performance_alerts (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(100) NOT NULL UNIQUE,
  corridor VARCHAR(100) NOT NULL,
  alert_type VARCHAR(50), -- 'ttri-degradation', 'new-bottleneck', 'extreme-delay'
  severity VARCHAR(20),
  metric_change VARCHAR(100), -- 'Truck TTRI increased 15% month-over-month'
  affected_segment VARCHAR(255),
  current_value NUMERIC(10,2),
  threshold_value NUMERIC(10,2),
  alert_description TEXT,
  notified_states TEXT[],
  issued_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  status VARCHAR(20) DEFAULT 'active',
  CONSTRAINT valid_freight_alert_type CHECK (alert_type IN (
    'ttri-degradation', 'new-bottleneck', 'extreme-delay',
    'reliability-decline', 'capacity-issue'
  )),
  CONSTRAINT valid_alert_status CHECK (status IN ('active', 'acknowledged', 'resolved', 'expired'))
);

-- Freight Data Sharing
CREATE TABLE IF NOT EXISTS freight_data_sharing (
  id SERIAL PRIMARY KEY,
  providing_state VARCHAR(2) NOT NULL,
  consuming_state VARCHAR(2) NOT NULL,
  corridor VARCHAR(100),
  data_type VARCHAR(50), -- 'travel-times', 'ttri-metrics', 'bottlenecks'
  data_feed_url VARCHAR(500),
  update_frequency VARCHAR(50),
  last_update TIMESTAMP,
  total_records_shared INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  CONSTRAINT valid_freight_data_status CHECK (status IN ('active', 'paused', 'error'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_freight_observations_corridor ON freight_travel_time_observations(corridor, observation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_freight_observations_route ON freight_travel_time_observations(route, state, observation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_freight_observations_time ON freight_travel_time_observations(observation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_freight_tttr_corridor ON freight_tttr_metrics(corridor, month DESC);
CREATE INDEX IF NOT EXISTS idx_freight_tttr_route ON freight_tttr_metrics(route, state, month DESC);
CREATE INDEX IF NOT EXISTS idx_freight_bottlenecks_corridor ON freight_bottlenecks(corridor, severity);
CREATE INDEX IF NOT EXISTS idx_freight_bottlenecks_status ON freight_bottlenecks(status, priority_rank);
CREATE INDEX IF NOT EXISTS idx_freight_corridors_states ON freight_corridors USING GIN(states_involved);
CREATE INDEX IF NOT EXISTS idx_freight_alerts_corridor ON freight_performance_alerts(corridor, status);
CREATE INDEX IF NOT EXISTS idx_freight_sharing_states ON freight_data_sharing(providing_state, consuming_state);

-- Comments
COMMENT ON TABLE freight_travel_time_observations IS 'Truck travel time data collection. CCAI UC #18.';
COMMENT ON TABLE freight_tttr_metrics IS 'Monthly Truck Travel Time Reliability Index metrics';
COMMENT ON TABLE freight_bottlenecks IS 'Identified freight bottleneck locations';
COMMENT ON TABLE freight_corridors IS 'Freight corridor inventory and classification';
COMMENT ON TABLE freight_performance_alerts IS 'Alerts for freight performance degradation';
COMMENT ON TABLE freight_data_sharing IS 'Cross-state freight data sharing agreements';

-- Function to calculate Truck TTRI for month
CREATE OR REPLACE FUNCTION calculate_truck_ttri_for_month(
  p_corridor VARCHAR(100),
  p_state VARCHAR(2),
  p_month DATE
)
RETURNS JSONB AS $$
DECLARE
  v_metrics RECORD;
  v_result JSONB;
BEGIN
  -- Calculate percentiles from observations
  SELECT
    COUNT(*) as obs_count,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY travel_time_minutes) as p50,
    PERCENTILE_CONT(0.80) WITHIN GROUP (ORDER BY travel_time_minutes) as p80,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY travel_time_minutes) as p95,
    AVG(travel_time_minutes) as avg_tt,
    MIN(travel_time_minutes) as free_flow,
    COUNT(*) FILTER (WHERE incident_nearby = true) as incident_obs,
    COUNT(*) FILTER (WHERE construction_active = true) as construction_obs
  INTO v_metrics
  FROM freight_travel_time_observations
  WHERE corridor = p_corridor
    AND state = p_state
    AND DATE_TRUNC('month', observation_timestamp) = p_month;

  IF v_metrics.obs_count = 0 THEN
    RETURN '{"error": "No observations for this period"}'::jsonb;
  END IF;

  -- Calculate TTRI and other indices
  v_result := jsonb_build_object(
    'corridor', p_corridor,
    'month', p_month,
    'observations', v_metrics.obs_count,
    'percentile_50th', ROUND(v_metrics.p50, 2),
    'percentile_80th', ROUND(v_metrics.p80, 2),
    'percentile_95th', ROUND(v_metrics.p95, 2),
    'truck_ttri', ROUND(v_metrics.p80 / NULLIF(v_metrics.p50, 0), 4),
    'truck_pti', ROUND(v_metrics.p95 / NULLIF(v_metrics.free_flow, 0), 4),
    'truck_bti', ROUND((v_metrics.p95 - v_metrics.p50) / NULLIF(v_metrics.p50, 0), 4),
    'avg_travel_time', ROUND(v_metrics.avg_tt, 2),
    'free_flow_time', ROUND(v_metrics.free_flow, 2),
    'incident_impact_pct', ROUND((v_metrics.incident_obs::NUMERIC / v_metrics.obs_count) * 100, 2),
    'construction_impact_pct', ROUND((v_metrics.construction_obs::NUMERIC / v_metrics.obs_count) * 100, 2)
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to identify freight bottlenecks
CREATE OR REPLACE FUNCTION identify_freight_bottlenecks(
  p_corridor VARCHAR(100),
  p_threshold_minutes NUMERIC DEFAULT 10.0
)
RETURNS TABLE(
  location VARCHAR(255),
  route VARCHAR(50),
  mile_marker NUMERIC,
  avg_delay NUMERIC,
  frequency_pct NUMERIC,
  severity VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  WITH segment_delays AS (
    SELECT
      start_location,
      route,
      start_mile_marker,
      AVG(travel_time_minutes - (segment_length_miles / 60.0 * 60)) as avg_delay_min,
      COUNT(*) as obs_count,
      (COUNT(*) FILTER (WHERE travel_time_minutes > (segment_length_miles / 50.0 * 60))::NUMERIC /
       COUNT(*)::NUMERIC * 100) as freq_pct
    FROM freight_travel_time_observations
    WHERE corridor = p_corridor
      AND observation_timestamp >= NOW() - INTERVAL '30 days'
    GROUP BY start_location, route, start_mile_marker
    HAVING AVG(travel_time_minutes - (segment_length_miles / 60.0 * 60)) >= p_threshold_minutes
  )
  SELECT
    sd.start_location as location,
    sd.route,
    sd.start_mile_marker as mile_marker,
    ROUND(sd.avg_delay_min, 2) as avg_delay,
    ROUND(sd.freq_pct, 2) as frequency_pct,
    CASE
      WHEN sd.avg_delay_min >= 30 THEN 'critical'::VARCHAR(20)
      WHEN sd.avg_delay_min >= 20 THEN 'severe'::VARCHAR(20)
      WHEN sd.avg_delay_min >= 15 THEN 'moderate'::VARCHAR(20)
      ELSE 'minor'::VARCHAR(20)
    END as severity
  FROM segment_delays sd
  ORDER BY sd.avg_delay_min DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to rate reliability
CREATE OR REPLACE FUNCTION rate_freight_reliability(
  p_truck_ttri NUMERIC
)
RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN CASE
    WHEN p_truck_ttri IS NULL THEN 'unknown'
    WHEN p_truck_ttri <= 1.10 THEN 'excellent' -- Within 10%
    WHEN p_truck_ttri <= 1.25 THEN 'good'      -- 10-25% variation
    WHEN p_truck_ttri <= 1.50 THEN 'fair'      -- 25-50% variation
    WHEN p_truck_ttri <= 2.00 THEN 'poor'      -- 50-100% variation
    ELSE 'very-poor'                            -- >100% variation
  END;
END;
$$ LANGUAGE plpgsql;

-- Insert sample freight corridors
INSERT INTO freight_corridors (
  corridor_id, corridor_name, states_involved, primary_routes,
  total_length_miles, freight_classification, annual_truck_volume,
  avg_daily_trucks, truck_percentage, key_freight_flows,
  is_national_highway_freight, monitoring_priority
) VALUES
('FC-I35-CENTRAL', 'I-35 Central Freight Corridor', ARRAY['IA', 'MN', 'MO'], ARRAY['I-35'],
 450.0, 'critical-rural', 45000000, 123000, 28.5,
 ARRAY['agricultural', 'manufacturing', 'consumer-goods'],
 true, 'high'),

('FC-I80-MIDWEST', 'I-80 Midwest Freight Corridor', ARRAY['IA', 'NE', 'IL'], ARRAY['I-80'],
 550.0, 'critical-rural', 52000000, 142000, 32.1,
 ARRAY['agricultural', 'intermodal', 'manufacturing'],
 true, 'high'),

('FC-I35-TEXAS', 'I-35 Texas Freight Corridor', ARRAY['TX', 'OK'], ARRAY['I-35'],
 380.0, 'critical-urban', 38000000, 104000, 25.8,
 ARRAY['manufacturing', 'intermodal', 'energy'],
 true, 'high')
ON CONFLICT (corridor_id) DO NOTHING;

-- Insert sample freight observations (last 30 days)
INSERT INTO freight_travel_time_observations (
  observation_id, corridor, state, route, direction,
  start_location, end_location, start_mile_marker, end_mile_marker,
  segment_length_miles, observation_timestamp, travel_time_minutes,
  average_speed_mph, vehicle_classification, time_of_day, day_of_week,
  data_source
) VALUES
('FO-001', 'FC-I35-CENTRAL', 'IA', 'I-35', 'northbound',
 'Exit 87', 'Exit 100', 87.0, 100.0, 13.0,
 NOW() - INTERVAL '12 hours', 12.5, 62.4, 'tractor-trailer', 'midday', 2, 'probe-data'),

('FO-002', 'FC-I35-CENTRAL', 'IA', 'I-35', 'northbound',
 'Exit 87', 'Exit 100', 87.0, 100.0, 13.0,
 NOW() - INTERVAL '18 hours', 15.2, 51.3, 'heavy-truck', 'peak-pm', 2, 'probe-data'),

('FO-003', 'FC-I80-MIDWEST', 'IA', 'I-80', 'eastbound',
 'MM 130', 'MM 145', 130.0, 145.0, 15.0,
 NOW() - INTERVAL '24 hours', 14.1, 63.8, 'tractor-trailer', 'overnight', 3, 'fleet-data')
ON CONFLICT (observation_id) DO NOTHING;

-- Insert sample TTRI metrics (current month)
INSERT INTO freight_tttr_metrics (
  metric_id, corridor, state, route, direction, segment_start, segment_end,
  month, observation_count, percentile_50th_minutes, percentile_80th_minutes,
  percentile_95th_minutes, truck_ttri_score, truck_pti, truck_bti,
  free_flow_travel_time_minutes, avg_travel_time_minutes,
  reliability_rating
) VALUES
('FTTRI-I35-IA-202603', 'FC-I35-CENTRAL', 'IA', 'I-35', 'northbound',
 'Exit 87', 'State Border', '2026-03-01', 8450, 12.8, 15.5, 18.2,
 1.211, 1.420, 0.422, 12.8, 13.9, 'good'),

('FTTRI-I80-IA-202603', 'FC-I80-MIDWEST', 'IA', 'I-80', 'eastbound',
 'MM 130', 'State Border', '2026-03-01', 9820, 14.2, 19.8, 25.1,
 1.394, 1.768, 0.768, 14.2, 16.5, 'fair')
ON CONFLICT DO NOTHING;

-- Insert sample bottlenecks
INSERT INTO freight_bottlenecks (
  bottleneck_id, corridor, state, route, location_description,
  mile_marker, bottleneck_type, severity, avg_delay_minutes,
  frequency_pct, typical_time_windows, primary_cause, priority_rank, status
) VALUES
('BTL-I35-IA-087', 'FC-I35-CENTRAL', 'IA', 'I-35', 'I-35 MM 87 Interchange',
 87.0, 'interchange', 'moderate', 8.5, 45.0,
 ARRAY['weekdays-7am-9am', 'weekdays-4pm-6pm'],
 'Merge congestion from I-80/I-35 interchange', 3, 'active'),

('BTL-I80-IA-137', 'FC-I80-MIDWEST', 'IA', 'I-80', 'I-80 Weigh Station MM 137',
 137.0, 'weigh-station', 'severe', 12.3, 62.0,
 ARRAY['weekdays-all-day'],
 'Insufficient weigh station capacity during peak freight hours', 1, 'improvement-planned')
ON CONFLICT (bottleneck_id) DO NOTHING;

-- Insert data sharing agreements
INSERT INTO freight_data_sharing (
  providing_state, consuming_state, corridor, data_type,
  update_frequency, status, total_records_shared
) VALUES
('IA', 'MN', 'FC-I35-CENTRAL', 'ttri-metrics', 'monthly', 'active', 12),
('IA', 'NE', 'FC-I80-MIDWEST', 'travel-times', 'daily', 'active', 2840),
('MN', 'IA', 'FC-I35-CENTRAL', 'ttri-metrics', 'monthly', 'active', 12)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT ON freight_travel_time_observations TO PUBLIC;
GRANT SELECT, INSERT ON freight_tttr_metrics TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON freight_bottlenecks TO PUBLIC;
GRANT SELECT ON freight_corridors TO PUBLIC;
GRANT SELECT, INSERT ON freight_performance_alerts TO PUBLIC;
GRANT SELECT ON freight_data_sharing TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_corridor_count INTEGER;
  v_observation_count INTEGER;
  v_bottleneck_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_corridor_count FROM freight_corridors;
  SELECT COUNT(*) INTO v_observation_count FROM freight_travel_time_observations;
  SELECT COUNT(*) INTO v_bottleneck_count FROM freight_bottlenecks WHERE status = 'active';

  RAISE NOTICE 'Freight TTTR Data Layer Configured:';
  RAISE NOTICE '- % freight corridors monitored', v_corridor_count;
  RAISE NOTICE '- % travel time observations', v_observation_count;
  RAISE NOTICE '- % active bottlenecks identified', v_bottleneck_count;
  RAISE NOTICE '- Truck TTRI calculation enabled';
  RAISE NOTICE '- Freight performance monitoring ready';
  RAISE NOTICE '- Cross-state freight data sharing enabled';
END $$;
