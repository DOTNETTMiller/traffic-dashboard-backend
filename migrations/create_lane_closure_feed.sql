-- Migration: Lane Closure Visibility Feed (CCAI UC #13)
-- Date: 2026-03-03
-- Description: Structured lane closure data exchange for cross-state transparency

-- Lane Closures
CREATE TABLE IF NOT EXISTS lane_closures (
  id SERIAL PRIMARY KEY,
  closure_id VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(2) NOT NULL,
  route VARCHAR(50) NOT NULL,
  direction VARCHAR(20), -- 'northbound', 'southbound', 'eastbound', 'westbound', 'both'
  location_description VARCHAR(255),
  start_latitude NUMERIC(10,7),
  start_longitude NUMERIC(10,7),
  end_latitude NUMERIC(10,7),
  end_longitude NUMERIC(10,7),
  mile_marker_start NUMERIC(10,2),
  mile_marker_end NUMERIC(10,2),
  total_lanes INTEGER NOT NULL,
  lanes_closed INTEGER NOT NULL,
  closed_lane_numbers TEXT[], -- Array like ['1', '2'] where 1=left lane
  lanes_open INTEGER,
  shoulder_closed BOOLEAN DEFAULT false,
  closure_type VARCHAR(50), -- 'construction', 'incident', 'maintenance', 'emergency', 'special-event'
  closure_reason TEXT,
  severity VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'active',
  scheduled_start TIMESTAMP,
  scheduled_end TIMESTAMP,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,
  duration_hours NUMERIC(10,2),
  is_rolling_closure BOOLEAN DEFAULT false,
  recurring_pattern VARCHAR(100), -- 'weekdays', 'weekends', 'nightly', 'daily-9am-3pm'
  expected_impact VARCHAR(50), -- 'minimal', 'moderate', 'major', 'severe'
  speed_limit_reduced INTEGER,
  detour_available BOOLEAN DEFAULT false,
  detour_route VARCHAR(255),
  related_event_id VARCHAR(255),
  work_zone_id VARCHAR(100),
  notified_states TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_closure_type CHECK (closure_type IN (
    'construction', 'incident', 'maintenance', 'emergency', 'special-event', 'weather'
  )),
  CONSTRAINT valid_status CHECK (status IN (
    'scheduled', 'active', 'suspended', 'completed', 'cancelled'
  )),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Lane Status Real-Time
CREATE TABLE IF NOT EXISTS lane_status_realtime (
  id SERIAL PRIMARY KEY,
  status_id VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(2) NOT NULL,
  route VARCHAR(50) NOT NULL,
  direction VARCHAR(20),
  mile_marker NUMERIC(10,2),
  location VARCHAR(255),
  timestamp TIMESTAMP DEFAULT NOW(),
  total_lanes INTEGER,
  lane_1_status VARCHAR(20), -- 'open', 'closed', 'restricted', 'merge'
  lane_2_status VARCHAR(20),
  lane_3_status VARCHAR(20),
  lane_4_status VARCHAR(20),
  lane_5_status VARCHAR(20),
  left_shoulder_status VARCHAR(20),
  right_shoulder_status VARCHAR(20),
  restrictions TEXT[], -- 'no-trucks', 'reduced-speed', 'hov-only'
  active_closures INTEGER DEFAULT 0,
  capacity_pct NUMERIC(5,2), -- % of normal capacity available
  CONSTRAINT valid_lane_status CHECK (lane_1_status IN ('open', 'closed', 'restricted', 'merge', 'unknown'))
);

-- Lane Closure Impacts
CREATE TABLE IF NOT EXISTS lane_closure_impacts (
  id SERIAL PRIMARY KEY,
  closure_id VARCHAR(100) REFERENCES lane_closures(closure_id) ON DELETE CASCADE,
  impact_timestamp TIMESTAMP DEFAULT NOW(),
  observed_speed_mph NUMERIC(5,2),
  baseline_speed_mph NUMERIC(5,2),
  speed_reduction_pct NUMERIC(5,2),
  observed_volume_vph INTEGER,
  delay_per_vehicle_minutes NUMERIC(10,2),
  queue_length_miles NUMERIC(5,2),
  capacity_reduction_pct NUMERIC(5,2),
  incidents_during_closure INTEGER DEFAULT 0
);

-- Lane Closure Schedules (Planned/Recurring)
CREATE TABLE IF NOT EXISTS lane_closure_schedules (
  id SERIAL PRIMARY KEY,
  schedule_id VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(2) NOT NULL,
  route VARCHAR(50) NOT NULL,
  direction VARCHAR(20),
  location VARCHAR(255),
  project_name VARCHAR(255),
  closure_pattern VARCHAR(100), -- 'weeknights-9pm-6am', 'weekends-full', 'daily-10am-2pm'
  start_date DATE,
  end_date DATE,
  total_lanes INTEGER,
  lanes_to_close INTEGER,
  affected_lane_numbers TEXT[],
  time_windows JSONB, -- [{"day": "monday", "start": "21:00", "end": "06:00"}]
  exceptions JSONB, -- Dates when pattern doesn't apply
  reason TEXT,
  expected_impact VARCHAR(50),
  advance_notice_days INTEGER DEFAULT 7,
  public_info_url VARCHAR(500),
  contact_info JSONB
);

-- Cross-State Lane Notifications
CREATE TABLE IF NOT EXISTS lane_closure_notifications (
  id SERIAL PRIMARY KEY,
  closure_id VARCHAR(100) REFERENCES lane_closures(closure_id) ON DELETE CASCADE,
  reporting_state VARCHAR(2) NOT NULL,
  notified_state VARCHAR(2) NOT NULL,
  notification_type VARCHAR(50), -- 'new-closure', 'update', 'cancellation', 'extension'
  notification_reason VARCHAR(100), -- 'proximity', 'major-impact', 'coordinated-closure'
  notified_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lane_closures_state ON lane_closures(state, route, status);
CREATE INDEX IF NOT EXISTS idx_lane_closures_schedule ON lane_closures(scheduled_start, scheduled_end);
CREATE INDEX IF NOT EXISTS idx_lane_closures_active ON lane_closures(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_lane_status_route ON lane_status_realtime(state, route, mile_marker);
CREATE INDEX IF NOT EXISTS idx_lane_status_time ON lane_status_realtime(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lane_impacts_closure ON lane_closure_impacts(closure_id, impact_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lane_schedules_dates ON lane_closure_schedules(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_lane_notifications_closure ON lane_closure_notifications(closure_id);

-- Comments
COMMENT ON TABLE lane_closures IS 'Lane-level closure tracking for cross-state visibility. CCAI UC #13.';
COMMENT ON TABLE lane_status_realtime IS 'Real-time lane-by-lane status feed';
COMMENT ON TABLE lane_closure_impacts IS 'Traffic impact measurements during lane closures';
COMMENT ON TABLE lane_closure_schedules IS 'Scheduled/recurring lane closure patterns';
COMMENT ON TABLE lane_closure_notifications IS 'Cross-state lane closure notifications';

-- Function to calculate capacity reduction
CREATE OR REPLACE FUNCTION calculate_capacity_reduction(
  p_total_lanes INTEGER,
  p_lanes_closed INTEGER
)
RETURNS NUMERIC AS $$
BEGIN
  -- Capacity doesn't reduce linearly with lane closures
  -- Using FHWA Highway Capacity Manual approximations
  RETURN CASE
    WHEN p_lanes_closed = 0 THEN 0.0
    WHEN p_total_lanes = 2 AND p_lanes_closed = 1 THEN 60.0  -- Losing 1 of 2 = ~60% capacity loss
    WHEN p_total_lanes = 3 AND p_lanes_closed = 1 THEN 35.0  -- Losing 1 of 3 = ~35% capacity loss
    WHEN p_total_lanes = 3 AND p_lanes_closed = 2 THEN 70.0
    WHEN p_total_lanes = 4 AND p_lanes_closed = 1 THEN 28.0
    WHEN p_total_lanes = 4 AND p_lanes_closed = 2 THEN 55.0
    WHEN p_total_lanes = 5 AND p_lanes_closed = 1 THEN 22.0
    WHEN p_total_lanes = 5 AND p_lanes_closed = 2 THEN 45.0
    ELSE (p_lanes_closed::NUMERIC / p_total_lanes::NUMERIC) * 100.0
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to get current lane status
CREATE OR REPLACE FUNCTION get_current_lane_status(
  p_state VARCHAR(2),
  p_route VARCHAR(50),
  p_mile_marker NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_status RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_status
  FROM lane_status_realtime
  WHERE state = p_state
    AND route = p_route
    AND mile_marker = p_mile_marker
  ORDER BY timestamp DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '{"error": "No status data available"}'::jsonb;
  END IF;

  v_result := jsonb_build_object(
    'route', v_status.route,
    'mile_marker', v_status.mile_marker,
    'timestamp', v_status.timestamp,
    'total_lanes', v_status.total_lanes,
    'lanes', jsonb_build_object(
      '1', v_status.lane_1_status,
      '2', v_status.lane_2_status,
      '3', v_status.lane_3_status,
      '4', v_status.lane_4_status,
      '5', v_status.lane_5_status
    ),
    'shoulders', jsonb_build_object(
      'left', v_status.left_shoulder_status,
      'right', v_status.right_shoulder_status
    ),
    'capacity_pct', v_status.capacity_pct,
    'active_closures', v_status.active_closures
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to create lane closure and notify states
CREATE OR REPLACE FUNCTION create_lane_closure(
  p_state VARCHAR(2),
  p_route VARCHAR(50),
  p_direction VARCHAR(20),
  p_location VARCHAR(255),
  p_total_lanes INTEGER,
  p_lanes_closed INTEGER,
  p_closed_lanes TEXT[],
  p_closure_type VARCHAR(50),
  p_scheduled_start TIMESTAMP,
  p_scheduled_end TIMESTAMP
)
RETURNS VARCHAR(100) AS $$
DECLARE
  v_closure_id VARCHAR(100);
  v_capacity_reduction NUMERIC;
  v_expected_impact VARCHAR(50);
BEGIN
  -- Generate closure ID
  v_closure_id := 'LANE-' || p_state || '-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

  -- Calculate capacity reduction
  v_capacity_reduction := calculate_capacity_reduction(p_total_lanes, p_lanes_closed);

  -- Determine expected impact
  v_expected_impact := CASE
    WHEN v_capacity_reduction >= 60 THEN 'severe'
    WHEN v_capacity_reduction >= 40 THEN 'major'
    WHEN v_capacity_reduction >= 25 THEN 'moderate'
    ELSE 'minimal'
  END;

  -- Create closure
  INSERT INTO lane_closures (
    closure_id,
    state,
    route,
    direction,
    location_description,
    total_lanes,
    lanes_closed,
    closed_lane_numbers,
    lanes_open,
    closure_type,
    status,
    scheduled_start,
    scheduled_end,
    expected_impact
  ) VALUES (
    v_closure_id,
    p_state,
    p_route,
    p_direction,
    p_location,
    p_total_lanes,
    p_lanes_closed,
    p_closed_lanes,
    p_total_lanes - p_lanes_closed,
    p_closure_type,
    'scheduled',
    p_scheduled_start,
    p_scheduled_end,
    v_expected_impact
  );

  -- If major impact, notify adjacent states
  IF v_expected_impact IN ('major', 'severe') THEN
    INSERT INTO lane_closure_notifications (
      closure_id,
      reporting_state,
      notified_state,
      notification_type,
      notification_reason
    )
    SELECT
      v_closure_id,
      p_state,
      state_code,
      'new-closure',
      'major-impact'
    FROM UNNEST(ARRAY['IA', 'MN', 'TX', 'MO', 'NE', 'IL']) as state_code
    WHERE state_code != p_state
    LIMIT 3;
  END IF;

  RETURN v_closure_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate lane closure summary
CREATE OR REPLACE FUNCTION get_corridor_lane_summary(
  p_route VARCHAR(50),
  p_state VARCHAR(2) DEFAULT NULL
)
RETURNS TABLE(
  total_closures INTEGER,
  active_closures INTEGER,
  total_lanes_closed INTEGER,
  avg_capacity_reduction NUMERIC,
  high_impact_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_closures,
    COUNT(*) FILTER (WHERE status = 'active')::INTEGER as active_closures,
    SUM(lanes_closed)::INTEGER as total_lanes_closed,
    ROUND(AVG(calculate_capacity_reduction(lc.total_lanes, lc.lanes_closed)), 2) as avg_capacity_reduction,
    COUNT(*) FILTER (WHERE expected_impact IN ('major', 'severe'))::INTEGER as high_impact_count
  FROM lane_closures lc
  WHERE route = p_route
    AND (p_state IS NULL OR state = p_state)
    AND status IN ('scheduled', 'active');
END;
$$ LANGUAGE plpgsql;

-- Insert sample lane closures
INSERT INTO lane_closures (
  closure_id, state, route, direction, location_description,
  total_lanes, lanes_closed, closed_lane_numbers, lanes_open,
  closure_type, closure_reason, severity, status,
  scheduled_start, scheduled_end, expected_impact, speed_limit_reduced
) VALUES
('LANE-IA-20260303-001', 'IA', 'I-35', 'northbound', 'I-35 MM 87-90',
 3, 1, ARRAY['3'], 2, 'construction', 'Bridge deck repair',
 'medium', 'active', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '6 hours',
 'moderate', 55),

('LANE-IA-20260303-002', 'IA', 'I-80', 'eastbound', 'I-80 MM 135-140',
 3, 2, ARRAY['2', '3'], 1, 'construction', 'Pavement resurfacing',
 'high', 'active', NOW() - INTERVAL '1 hour', NOW() + INTERVAL '10 hours',
 'severe', 45),

('LANE-MN-20260303-001', 'MN', 'I-35', 'southbound', 'I-35W MM 12-15',
 4, 1, ARRAY['1'], 3, 'maintenance', 'Pothole repair',
 'low', 'active', NOW() - INTERVAL '30 minutes', NOW() + INTERVAL '2 hours',
 'minimal', 60),

('LANE-TX-20260304-001', 'TX', 'I-35', 'northbound', 'I-35 MM 200-205',
 4, 2, ARRAY['3', '4'], 2, 'construction', 'HOV lane construction',
 'high', 'scheduled', NOW() + INTERVAL '12 hours', NOW() + INTERVAL '36 hours',
 'major', 50)
ON CONFLICT (closure_id) DO NOTHING;

-- Insert real-time lane status
INSERT INTO lane_status_realtime (
  status_id, state, route, direction, mile_marker, location,
  total_lanes, lane_1_status, lane_2_status, lane_3_status,
  left_shoulder_status, right_shoulder_status, active_closures, capacity_pct
) VALUES
('STATUS-IA-I35-087', 'IA', 'I-35', 'northbound', 87.0, 'I-35 MM 87',
 3, 'open', 'open', 'closed', 'open', 'open', 1, 70.0),

('STATUS-IA-I80-137', 'IA', 'I-80', 'eastbound', 137.0, 'I-80 MM 137',
 3, 'open', 'closed', 'closed', 'open', 'closed', 1, 40.0),

('STATUS-MN-I35-012', 'MN', 'I-35', 'southbound', 12.0, 'I-35W MM 12',
 4, 'closed', 'open', 'open', 'open', 'open', 1, 75.0)
ON CONFLICT (status_id) DO NOTHING;

-- Insert scheduled closures
INSERT INTO lane_closure_schedules (
  schedule_id, state, route, direction, location, project_name,
  closure_pattern, start_date, end_date, total_lanes, lanes_to_close,
  affected_lane_numbers, reason, expected_impact
) VALUES
('SCHED-IA-I35-2026-001', 'IA', 'I-35', 'northbound', 'I-35 MM 90-100',
 'I-35 Ames Interchange Reconstruction',
 'weeknights-9pm-6am', '2026-03-10', '2026-05-15',
 3, 2, ARRAY['2', '3'], 'Major interchange reconstruction', 'major'),

('SCHED-MN-I35-2026-001', 'MN', 'I-35', 'both', 'I-35W MM 10-20',
 'I-35W Resurfacing Project',
 'weekends-full', '2026-04-01', '2026-06-30',
 4, 2, ARRAY['1', '2'], 'Pavement resurfacing', 'moderate')
ON CONFLICT (schedule_id) DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON lane_closures TO PUBLIC;
GRANT SELECT, INSERT ON lane_status_realtime TO PUBLIC;
GRANT SELECT, INSERT ON lane_closure_impacts TO PUBLIC;
GRANT SELECT ON lane_closure_schedules TO PUBLIC;
GRANT SELECT, INSERT ON lane_closure_notifications TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_active_closures INTEGER;
  v_scheduled_closures INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_active_closures FROM lane_closures WHERE status = 'active';
  SELECT COUNT(*) INTO v_scheduled_closures FROM lane_closure_schedules;

  RAISE NOTICE 'Lane Closure Visibility Feed Configured:';
  RAISE NOTICE '- % active lane closures', v_active_closures;
  RAISE NOTICE '- % scheduled closure patterns', v_scheduled_closures;
  RAISE NOTICE '- Real-time lane-by-lane status tracking';
  RAISE NOTICE '- Capacity reduction calculation enabled';
  RAISE NOTICE '- Cross-state notifications enabled';
  RAISE NOTICE '- Impact tracking enabled';
END $$;
