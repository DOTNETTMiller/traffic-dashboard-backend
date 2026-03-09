-- Migration: Multi-State Work Zone Synchronization (CCAI UC #17)
-- Date: 2026-03-03
-- Description: Construction event coordination to prevent overlapping high-impact closures

-- Work Zones
CREATE TABLE IF NOT EXISTS work_zones (
  id SERIAL PRIMARY KEY,
  work_zone_id VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(2) NOT NULL,
  project_name VARCHAR(255) NOT NULL,
  project_number VARCHAR(100),
  contractor VARCHAR(255),
  route VARCHAR(50) NOT NULL,
  direction VARCHAR(20), -- 'northbound', 'southbound', 'eastbound', 'westbound', 'both'
  start_location VARCHAR(255),
  end_location VARCHAR(255),
  start_mile_marker NUMERIC(10,2),
  end_mile_marker NUMERIC(10,2),
  project_length_miles NUMERIC(10,2),
  start_latitude NUMERIC(10,7),
  start_longitude NUMERIC(10,7),
  work_type VARCHAR(100), -- 'resurfacing', 'bridge-work', 'interchange', 'widening', 'maintenance'
  project_description TEXT,
  contract_amount NUMERIC(15,2),
  project_start_date DATE,
  project_end_date DATE,
  project_duration_days INTEGER,
  current_phase VARCHAR(100),
  completion_percentage NUMERIC(5,2),
  impact_level VARCHAR(20), -- 'minimal', 'moderate', 'major', 'severe'
  peak_impact_dates DATE[],
  typical_lane_config VARCHAR(100), -- '2 of 3 lanes open', '1 lane alternating', 'full closure'
  speed_limit_reduced INTEGER,
  requires_coordination BOOLEAN DEFAULT false,
  coordination_notes TEXT,
  public_info_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_work_type CHECK (work_type IN (
    'resurfacing', 'bridge-work', 'bridge-replacement', 'interchange',
    'widening', 'maintenance', 'shoulder-work', 'signing', 'striping'
  )),
  CONSTRAINT valid_impact_level CHECK (impact_level IN ('minimal', 'moderate', 'major', 'severe')),
  CONSTRAINT valid_status CHECK (status IN ('planned', 'active', 'suspended', 'completed', 'cancelled'))
);

-- Work Zone Closures (Specific Closure Windows)
CREATE TABLE IF NOT EXISTS work_zone_closures (
  id SERIAL PRIMARY KEY,
  closure_id VARCHAR(100) NOT NULL UNIQUE,
  work_zone_id VARCHAR(100) REFERENCES work_zones(work_zone_id) ON DELETE CASCADE,
  closure_type VARCHAR(50), -- 'full-closure', 'rolling-closure', 'lane-closure', 'ramp-closure'
  scheduled_start TIMESTAMP NOT NULL,
  scheduled_end TIMESTAMP NOT NULL,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,
  duration_hours NUMERIC(10,2),
  lanes_affected TEXT[],
  detour_required BOOLEAN DEFAULT false,
  detour_route VARCHAR(255),
  status VARCHAR(20) DEFAULT 'scheduled',
  CONSTRAINT valid_closure_type CHECK (closure_type IN (
    'full-closure', 'partial-closure', 'rolling-closure',
    'lane-closure', 'ramp-closure', 'shoulder-closure'
  )),
  CONSTRAINT valid_closure_status CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled'))
);

-- Work Zone Coordination (Multi-State)
CREATE TABLE IF NOT EXISTS work_zone_coordination (
  id SERIAL PRIMARY KEY,
  coordination_id VARCHAR(100) NOT NULL UNIQUE,
  participating_states TEXT[] NOT NULL,
  corridor VARCHAR(100),
  coordination_type VARCHAR(50), -- 'timing-deconfliction', 'joint-project', 'phased-construction'
  lead_state VARCHAR(2),
  coordinated_projects TEXT[], -- Array of work_zone_ids
  coordination_start_date DATE,
  coordination_end_date DATE,
  coordination_rules JSONB, -- Rules like "no simultaneous full closures"
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_coordination_type CHECK (coordination_type IN (
    'timing-deconfliction', 'joint-project', 'phased-construction',
    'sequential-closures', 'synchronized-restrictions'
  )),
  CONSTRAINT valid_coordination_status CHECK (status IN ('planning', 'active', 'completed', 'suspended'))
);

-- Work Zone Conflicts
CREATE TABLE IF NOT EXISTS work_zone_conflicts (
  id SERIAL PRIMARY KEY,
  conflict_id VARCHAR(100) NOT NULL UNIQUE,
  work_zone_1_id VARCHAR(100) REFERENCES work_zones(work_zone_id) ON DELETE CASCADE,
  work_zone_2_id VARCHAR(100) REFERENCES work_zones(work_zone_id) ON DELETE CASCADE,
  conflict_type VARCHAR(50), -- 'simultaneous-full-closures', 'excessive-detour', 'cumulative-impact'
  severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
  distance_between_miles NUMERIC(10,2),
  overlapping_dates DATE[],
  estimated_impact TEXT,
  resolution_status VARCHAR(20) DEFAULT 'identified',
  resolution_plan TEXT,
  resolved_at TIMESTAMP,
  CONSTRAINT valid_conflict_type CHECK (conflict_type IN (
    'simultaneous-full-closures', 'overlapping-restrictions',
    'excessive-detour', 'cumulative-impact', 'duration-conflict'
  )),
  CONSTRAINT valid_resolution_status CHECK (resolution_status IN (
    'identified', 'under-review', 'resolved', 'accepted-risk'
  ))
);

-- Work Zone Notifications
CREATE TABLE IF NOT EXISTS work_zone_notifications (
  id SERIAL PRIMARY KEY,
  work_zone_id VARCHAR(100) REFERENCES work_zones(work_zone_id) ON DELETE CASCADE,
  notifying_state VARCHAR(2) NOT NULL,
  notified_state VARCHAR(2) NOT NULL,
  notification_type VARCHAR(50), -- 'new-project', 'major-closure', 'schedule-change', 'conflict-alert'
  notification_reason TEXT,
  notified_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  response VARCHAR(20), -- 'acknowledged', 'requires-discussion', 'conflict-raised'
  response_notes TEXT
);

-- Work Zone Calendar (for visualization)
CREATE TABLE IF NOT EXISTS work_zone_calendar (
  id SERIAL PRIMARY KEY,
  calendar_date DATE NOT NULL,
  state VARCHAR(2),
  route VARCHAR(50),
  total_work_zones INTEGER DEFAULT 0,
  full_closures_count INTEGER DEFAULT 0,
  major_impacts_count INTEGER DEFAULT 0,
  cumulative_impact_score NUMERIC(10,2), -- Calculated impact across all projects
  notes TEXT,
  UNIQUE(calendar_date, state, route)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_work_zones_state ON work_zones(state, route, status);
CREATE INDEX IF NOT EXISTS idx_work_zones_dates ON work_zones(project_start_date, project_end_date);
CREATE INDEX IF NOT EXISTS idx_work_zones_impact ON work_zones(impact_level, requires_coordination);
CREATE INDEX IF NOT EXISTS idx_work_zone_closures_zone ON work_zone_closures(work_zone_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_work_zone_closures_dates ON work_zone_closures(scheduled_start, scheduled_end);
CREATE INDEX IF NOT EXISTS idx_work_zone_coordination_states ON work_zone_coordination USING GIN(participating_states);
CREATE INDEX IF NOT EXISTS idx_work_zone_conflicts_zones ON work_zone_conflicts(work_zone_1_id, work_zone_2_id);
CREATE INDEX IF NOT EXISTS idx_work_zone_conflicts_status ON work_zone_conflicts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_work_zone_notifications_zone ON work_zone_notifications(work_zone_id);
CREATE INDEX IF NOT EXISTS idx_work_zone_calendar_date ON work_zone_calendar(calendar_date, state);

-- Comments
COMMENT ON TABLE work_zones IS 'Construction project tracking for cross-state coordination. CCAI UC #17.';
COMMENT ON TABLE work_zone_closures IS 'Specific closure windows within work zones';
COMMENT ON TABLE work_zone_coordination IS 'Multi-state work zone coordination agreements';
COMMENT ON TABLE work_zone_conflicts IS 'Identified conflicts between work zones';
COMMENT ON TABLE work_zone_notifications IS 'Cross-state work zone notifications';
COMMENT ON TABLE work_zone_calendar IS 'Daily work zone impact calendar';

-- Function to detect work zone conflicts
CREATE OR REPLACE FUNCTION detect_work_zone_conflicts(
  p_work_zone_id VARCHAR(100)
)
RETURNS TABLE(
  conflicting_work_zone_id VARCHAR(100),
  conflict_type VARCHAR(50),
  severity VARCHAR(20),
  description TEXT
) AS $$
DECLARE
  v_work_zone RECORD;
  v_other_zone RECORD;
BEGIN
  SELECT * INTO v_work_zone FROM work_zones WHERE work_zone_id = p_work_zone_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_other_zone IN
    SELECT *
    FROM work_zones
    WHERE work_zone_id != p_work_zone_id
      AND route = v_work_zone.route
      AND status IN ('planned', 'active')
      AND (
        (project_start_date, project_end_date) OVERLAPS
        (v_work_zone.project_start_date, v_work_zone.project_end_date)
      )
  LOOP
    -- Check for simultaneous high-impact work
    IF v_work_zone.impact_level IN ('major', 'severe')
       AND v_other_zone.impact_level IN ('major', 'severe') THEN

      RETURN QUERY SELECT
        v_other_zone.work_zone_id,
        'simultaneous-full-closures'::VARCHAR(50),
        'high'::VARCHAR(20),
        'Two high-impact projects scheduled simultaneously on ' || v_work_zone.route::TEXT;
    END IF;

    -- Check for cumulative impact
    IF ABS(v_work_zone.start_mile_marker - v_other_zone.start_mile_marker) <= 20 THEN
      RETURN QUERY SELECT
        v_other_zone.work_zone_id,
        'cumulative-impact'::VARCHAR(50),
        'medium'::VARCHAR(20),
        'Projects within 20 miles may cause cumulative congestion'::TEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate corridor impact score
CREATE OR REPLACE FUNCTION calculate_corridor_impact_score(
  p_route VARCHAR(50),
  p_date DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_score NUMERIC := 0;
  v_zone RECORD;
BEGIN
  FOR v_zone IN
    SELECT *
    FROM work_zones
    WHERE route = p_route
      AND status = 'active'
      AND p_date BETWEEN project_start_date AND project_end_date
  LOOP
    v_score := v_score + CASE v_zone.impact_level
      WHEN 'severe' THEN 10.0
      WHEN 'major' THEN 5.0
      WHEN 'moderate' THEN 2.0
      ELSE 1.0
    END;
  END LOOP;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Function to check coordination requirements
CREATE OR REPLACE FUNCTION check_coordination_required(
  p_work_zone_id VARCHAR(100)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_work_zone RECORD;
  v_conflicts INTEGER;
BEGIN
  SELECT * INTO v_work_zone FROM work_zones WHERE work_zone_id = p_work_zone_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Require coordination for major/severe impact
  IF v_work_zone.impact_level IN ('major', 'severe') THEN
    RETURN true;
  END IF;

  -- Check for conflicts
  SELECT COUNT(*) INTO v_conflicts
  FROM detect_work_zone_conflicts(p_work_zone_id);

  RETURN v_conflicts > 0;
END;
$$ LANGUAGE plpgsql;

-- Insert sample work zones
INSERT INTO work_zones (
  work_zone_id, state, project_name, project_number, contractor,
  route, direction, start_location, end_location,
  start_mile_marker, end_mile_marker, project_length_miles,
  work_type, project_description, contract_amount,
  project_start_date, project_end_date, project_duration_days,
  impact_level, typical_lane_config, speed_limit_reduced,
  requires_coordination, status
) VALUES
('WZ-IA-I35-2026-001', 'IA', 'I-35 Ames Interchange Reconstruction', 'IM-35-1(120)', 'ABC Construction',
 'I-35', 'both', 'Exit 111', 'Exit 123', 111.0, 123.0, 12.0,
 'interchange', 'Complete reconstruction of Ames interchange with ramp improvements',
 45000000.00, '2026-04-01', '2027-10-31', 578, 'major', '2 of 3 lanes open', 55, true, 'planned'),

('WZ-IA-I80-2026-001', 'IA', 'I-80 Des Moines Metro Resurfacing', 'NHS-80-2(45)', 'Pavement Pros Inc',
 'I-80', 'both', 'MM 130', 'MM 145', 130.0, 145.0, 15.0,
 'resurfacing', 'Full-depth pavement resurfacing and shoulder work',
 28000000.00, '2026-05-15', '2026-09-30', 138, 'moderate', '1 lane alternating', 50, false, 'planned'),

('WZ-MN-I35-2026-001', 'MN', 'I-35W Bridge Deck Rehabilitation', 'BR-35W-012', 'Bridge Builders LLC',
 'I-35', 'both', 'MM 10', 'MM 15', 10.0, 15.0, 5.0,
 'bridge-work', 'Bridge deck overlay and joint replacement on 3 structures',
 12500000.00, '2026-04-15', '2026-08-15', 122, 'major', '2 of 4 lanes open', 45, true, 'planned'),

('WZ-TX-I35-2026-001', 'TX', 'I-35 Austin HOV Lane Addition', 'CSJ-0015-13-234', 'Texas Road Builders',
 'I-35', 'northbound', 'MM 195', 'MM 210', 195.0, 210.0, 15.0,
 'widening', 'Add HOV lane in center median with barrier work',
 65000000.00, '2026-03-01', '2027-12-31', 670, 'severe', '2 of 3 lanes open', 50, true, 'active')
ON CONFLICT (work_zone_id) DO NOTHING;

-- Insert work zone closures
INSERT INTO work_zone_closures (
  closure_id, work_zone_id, closure_type,
  scheduled_start, scheduled_end, status
) VALUES
('CL-WZ-IA-I35-001', 'WZ-IA-I35-2026-001', 'full-closure',
 '2026-04-12 22:00:00', '2026-04-13 06:00:00', 'scheduled'),

('CL-WZ-IA-I35-002', 'WZ-IA-I35-2026-001', 'lane-closure',
 '2026-04-15 09:00:00', '2026-04-15 15:00:00', 'scheduled'),

('CL-WZ-MN-I35-001', 'WZ-MN-I35-2026-001', 'rolling-closure',
 '2026-04-20 07:00:00', '2026-04-20 16:00:00', 'scheduled')
ON CONFLICT (closure_id) DO NOTHING;

-- Insert coordination agreement
INSERT INTO work_zone_coordination (
  coordination_id, participating_states, corridor, coordination_type,
  lead_state, coordinated_projects, coordination_start_date, coordination_end_date,
  coordination_rules, status
) VALUES (
  'COORD-I35-2026-001',
  ARRAY['IA', 'MN'],
  'I-35',
  'timing-deconfliction',
  'IA',
  ARRAY['WZ-IA-I35-2026-001', 'WZ-MN-I35-2026-001'],
  '2026-04-01',
  '2027-10-31',
  '{"rule1": "No simultaneous full closures within 50 miles", "rule2": "Coordinate major closure windows"}'::jsonb,
  'active'
) ON CONFLICT (coordination_id) DO NOTHING;

-- Insert sample notifications
INSERT INTO work_zone_notifications (
  work_zone_id, notifying_state, notified_state, notification_type,
  notification_reason, notified_at, acknowledged_at, acknowledged_by, response
) VALUES
('WZ-IA-I35-2026-001', 'IA', 'MN', 'new-project',
 'Major interchange reconstruction may impact I-35 traffic from Iowa into Minnesota',
 NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days',
 'planner@mndot.gov', 'acknowledged'),

('WZ-MN-I35-2026-001', 'MN', 'IA', 'major-closure',
 'Bridge work requiring weekend full closures, coordination needed with Iowa projects',
 NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days',
 'planner@iowadot.gov', 'requires-discussion')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON work_zones TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON work_zone_closures TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON work_zone_coordination TO PUBLIC;
GRANT SELECT, INSERT ON work_zone_conflicts TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON work_zone_notifications TO PUBLIC;
GRANT SELECT, INSERT ON work_zone_calendar TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_work_zone_count INTEGER;
  v_coordination_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_work_zone_count FROM work_zones WHERE status IN ('planned', 'active');
  SELECT COUNT(*) INTO v_coordination_count FROM work_zone_coordination WHERE status = 'active';

  RAISE NOTICE 'Multi-State Work Zone Synchronization Configured:';
  RAISE NOTICE '- % active/planned work zones', v_work_zone_count;
  RAISE NOTICE '- % active coordination agreements', v_coordination_count;
  RAISE NOTICE '- Conflict detection enabled';
  RAISE NOTICE '- Cross-state notifications enabled';
  RAISE NOTICE '- Impact scoring enabled';
  RAISE NOTICE '- Construction calendar ready';
END $$;
