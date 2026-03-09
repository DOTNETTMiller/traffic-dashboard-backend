-- Migration: Closure Approval Workflow (CCAI UC #15)
-- Date: 2026-03-03
-- Description: Multi-state coordination for planned closures and major incident responses

-- Planned Closures Table
CREATE TABLE IF NOT EXISTS planned_closures (
  id SERIAL PRIMARY KEY,
  closure_name VARCHAR(255) NOT NULL,
  closure_type VARCHAR(50) NOT NULL,
  route VARCHAR(50) NOT NULL,
  state VARCHAR(2) NOT NULL,
  start_location VARCHAR(255) NOT NULL,
  end_location VARCHAR(255) NOT NULL,
  start_lat NUMERIC(10,7),
  start_lon NUMERIC(10,7),
  end_lat NUMERIC(10,7),
  end_lon NUMERIC(10,7),
  geometry GEOMETRY(LINESTRING, 4326),
  planned_start TIMESTAMP NOT NULL,
  planned_end TIMESTAMP NOT NULL,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,
  duration_hours NUMERIC(10,2),
  lanes_affected VARCHAR(50),
  closure_scope VARCHAR(20) DEFAULT 'partial',
  detour_route VARCHAR(255),
  diversion_route_id INTEGER REFERENCES diversion_routes(id),
  reason TEXT NOT NULL,
  description TEXT,
  contractor VARCHAR(255),
  project_number VARCHAR(100),
  estimated_cost NUMERIC(12,2),
  border_proximity_miles NUMERIC(10,2),
  requires_multistate_approval BOOLEAN DEFAULT false,
  states_to_notify TEXT[] DEFAULT '{}',
  approval_status VARCHAR(20) DEFAULT 'draft',
  submitted_by VARCHAR(100),
  submitted_at TIMESTAMP,
  public_notice_required BOOLEAN DEFAULT true,
  public_notice_days INTEGER DEFAULT 14,
  media_contact VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_closure_type CHECK (closure_type IN (
    'construction', 'maintenance', 'bridge_work', 'utility',
    'special_event', 'emergency_repair', 'winter_maintenance'
  )),
  CONSTRAINT valid_closure_scope CHECK (closure_scope IN (
    'full', 'partial', 'shoulder', 'ramp', 'interchange'
  )),
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'draft', 'submitted', 'pending_review', 'under_review',
    'approved', 'approved_conditional', 'rejected', 'cancelled', 'completed'
  ))
);

-- Closure Approvals (Multi-state coordination)
CREATE TABLE IF NOT EXISTS closure_approvals (
  id SERIAL PRIMARY KEY,
  closure_id INTEGER REFERENCES planned_closures(id) ON DELETE CASCADE,
  state_code VARCHAR(2) NOT NULL,
  approval_level VARCHAR(50) NOT NULL,
  approver_name VARCHAR(100),
  approver_role VARCHAR(50),
  approver_email VARCHAR(255),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approval_date TIMESTAMP,
  rejection_reason TEXT,
  conditions TEXT[],
  requested_changes TEXT,
  priority_level VARCHAR(20) DEFAULT 'normal',
  delegated_to VARCHAR(100),
  escalated_to VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  response_due TIMESTAMP,
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'pending', 'under_review', 'approved', 'approved_conditional',
    'rejected', 'changes_requested', 'delegated', 'escalated'
  )),
  CONSTRAINT valid_approval_level CHECK (approval_level IN (
    'tmc_operator', 'tmc_supervisor', 'district_manager',
    'regional_director', 'state_director', 'emergency_services'
  )),
  CONSTRAINT valid_priority_level CHECK (priority_level IN (
    'routine', 'normal', 'high', 'critical', 'emergency'
  )),
  UNIQUE(closure_id, state_code, approval_level)
);

-- Closure Notification Log
CREATE TABLE IF NOT EXISTS closure_notifications (
  id SERIAL PRIMARY KEY,
  closure_id INTEGER REFERENCES planned_closures(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  recipient_state VARCHAR(2),
  recipient_role VARCHAR(50),
  recipient_email VARCHAR(255),
  sent_at TIMESTAMP DEFAULT NOW(),
  sent_by VARCHAR(100),
  delivery_status VARCHAR(20) DEFAULT 'sent',
  read_at TIMESTAMP,
  acknowledged_at TIMESTAMP,
  response TEXT,
  CONSTRAINT valid_notification_type CHECK (notification_type IN (
    'initial_submission', 'approval_request', 'status_update',
    'approval_granted', 'approval_denied', 'changes_requested',
    'closure_reminder', 'closure_activated', 'closure_completed', 'emergency_notice'
  )),
  CONSTRAINT valid_delivery_status CHECK (delivery_status IN (
    'queued', 'sent', 'delivered', 'read', 'acknowledged', 'bounced', 'failed'
  ))
);

-- Closure Coordination Comments (Multi-state discussion thread)
CREATE TABLE IF NOT EXISTS closure_coordination_comments (
  id SERIAL PRIMARY KEY,
  closure_id INTEGER REFERENCES planned_closures(id) ON DELETE CASCADE,
  comment_by VARCHAR(100) NOT NULL,
  comment_role VARCHAR(50),
  state_code VARCHAR(2),
  comment_text TEXT NOT NULL,
  comment_type VARCHAR(20) DEFAULT 'general',
  parent_comment_id INTEGER REFERENCES closure_coordination_comments(id),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_comment_type CHECK (comment_type IN (
    'general', 'question', 'concern', 'suggestion', 'approval_note', 'coordination'
  ))
);

-- Closure Impact Analysis
CREATE TABLE IF NOT EXISTS closure_impact_analysis (
  id SERIAL PRIMARY KEY,
  closure_id INTEGER REFERENCES planned_closures(id) ON DELETE CASCADE,
  analysis_type VARCHAR(50) NOT NULL,
  impact_severity VARCHAR(20),
  affected_population INTEGER,
  estimated_delay_minutes INTEGER,
  freight_impact VARCHAR(20),
  emergency_access_maintained BOOLEAN DEFAULT true,
  alternate_routes_available BOOLEAN DEFAULT true,
  peak_hour_impact BOOLEAN DEFAULT false,
  special_event_conflict BOOLEAN DEFAULT false,
  school_zone_affected BOOLEAN DEFAULT false,
  hospital_access_affected BOOLEAN DEFAULT false,
  analysis_notes TEXT,
  mitigation_measures TEXT[],
  analyzed_by VARCHAR(100),
  analyzed_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_analysis_type CHECK (analysis_type IN (
    'traffic_flow', 'freight_operations', 'emergency_access',
    'public_safety', 'economic_impact', 'environmental'
  )),
  CONSTRAINT valid_impact_severity CHECK (impact_severity IN (
    'minimal', 'low', 'moderate', 'high', 'severe'
  ))
);

-- Closure Public Notices
CREATE TABLE IF NOT EXISTS closure_public_notices (
  id SERIAL PRIMARY KEY,
  closure_id INTEGER REFERENCES planned_closures(id) ON DELETE CASCADE,
  notice_type VARCHAR(50) NOT NULL,
  notice_title VARCHAR(255) NOT NULL,
  notice_text TEXT NOT NULL,
  publication_date DATE,
  published_to TEXT[],
  media_contacts TEXT[],
  public_meeting_required BOOLEAN DEFAULT false,
  public_meeting_date TIMESTAMP,
  public_comment_period_end DATE,
  comments_received INTEGER DEFAULT 0,
  published_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_notice_type CHECK (notice_type IN (
    'initial_notice', 'public_hearing', 'final_notice',
    'media_release', 'website_post', 'social_media'
  ))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_closures_route ON planned_closures(route, state);
CREATE INDEX IF NOT EXISTS idx_closures_status ON planned_closures(approval_status);
CREATE INDEX IF NOT EXISTS idx_closures_dates ON planned_closures(planned_start, planned_end);
CREATE INDEX IF NOT EXISTS idx_closures_states ON planned_closures USING GIN(states_to_notify);
CREATE INDEX IF NOT EXISTS idx_closures_geom ON planned_closures USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_closure_approvals_closure ON closure_approvals(closure_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_closure_approvals_state ON closure_approvals(state_code, approval_status);
CREATE INDEX IF NOT EXISTS idx_closure_notifications_closure ON closure_notifications(closure_id);
CREATE INDEX IF NOT EXISTS idx_closure_comments_closure ON closure_coordination_comments(closure_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_closure_impact_closure ON closure_impact_analysis(closure_id);

-- Add comments
COMMENT ON TABLE planned_closures IS 'Planned closure coordination with multi-state approval workflow. CCAI UC #15.';
COMMENT ON TABLE closure_approvals IS 'Multi-level, multi-state approval workflow for closures';
COMMENT ON TABLE closure_notifications IS 'Notification log for closure coordination';
COMMENT ON TABLE closure_coordination_comments IS 'Discussion thread for multi-state closure coordination';
COMMENT ON TABLE closure_impact_analysis IS 'Impact analysis for closures';

-- Function to determine required approval levels
CREATE OR REPLACE FUNCTION determine_required_approvals(
  p_closure_id INTEGER
)
RETURNS TABLE(
  state_code VARCHAR(2),
  approval_level VARCHAR(50),
  response_due TIMESTAMP
) AS $$
DECLARE
  v_closure RECORD;
  v_response_days INTEGER;
BEGIN
  -- Get closure details
  SELECT * INTO v_closure
  FROM planned_closures
  WHERE id = p_closure_id;

  -- Determine response time based on closure scope
  v_response_days := CASE
    WHEN v_closure.closure_scope = 'full' THEN 10
    WHEN v_closure.border_proximity_miles < 25 THEN 7
    ELSE 5
  END;

  -- Owning state approvals
  RETURN QUERY
  SELECT
    v_closure.state as state_code,
    'tmc_supervisor'::VARCHAR(50) as approval_level,
    NOW() + INTERVAL '2 days' as response_due
  UNION ALL
  SELECT
    v_closure.state,
    'district_manager'::VARCHAR(50),
    NOW() + INTERVAL '5 days';

  -- Multi-state approvals if crossing border or near border
  IF v_closure.requires_multistate_approval OR v_closure.border_proximity_miles < 50 THEN
    RETURN QUERY
    SELECT
      unnest(v_closure.states_to_notify),
      'tmc_supervisor'::VARCHAR(50),
      NOW() + (v_response_days || ' days')::INTERVAL;
  END IF;

  -- Emergency approval for critical closures
  IF v_closure.closure_scope = 'full' AND
     (v_closure.planned_end - v_closure.planned_start) > INTERVAL '8 hours' THEN
    RETURN QUERY
    SELECT
      v_closure.state,
      'state_director'::VARCHAR(50),
      NOW() + INTERVAL '7 days';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to submit closure for approval
CREATE OR REPLACE FUNCTION submit_closure_for_approval(
  p_closure_id INTEGER,
  p_submitted_by VARCHAR(100)
)
RETURNS INTEGER AS $$
DECLARE
  v_approvals_created INTEGER := 0;
  v_approval RECORD;
BEGIN
  -- Update closure status
  UPDATE planned_closures
  SET approval_status = 'submitted',
      submitted_at = NOW(),
      submitted_by = p_submitted_by
  WHERE id = p_closure_id;

  -- Create approval records
  FOR v_approval IN
    SELECT * FROM determine_required_approvals(p_closure_id)
  LOOP
    INSERT INTO closure_approvals (
      closure_id,
      state_code,
      approval_level,
      approval_status,
      response_due
    ) VALUES (
      p_closure_id,
      v_approval.state_code,
      v_approval.approval_level,
      'pending',
      v_approval.response_due
    ) ON CONFLICT DO NOTHING;

    v_approvals_created := v_approvals_created + 1;
  END LOOP;

  -- Send notifications
  INSERT INTO closure_notifications (
    closure_id,
    notification_type,
    recipient_state,
    sent_by
  )
  SELECT
    p_closure_id,
    'approval_request',
    state_code,
    p_submitted_by
  FROM closure_approvals
  WHERE closure_id = p_closure_id;

  RETURN v_approvals_created;
END;
$$ LANGUAGE plpgsql;

-- Function to check approval status
CREATE OR REPLACE FUNCTION check_closure_approval_status(
  p_closure_id INTEGER
)
RETURNS TABLE(
  total_approvals INTEGER,
  approved INTEGER,
  pending INTEGER,
  rejected INTEGER,
  overall_status VARCHAR(50)
) AS $$
DECLARE
  v_total INTEGER;
  v_approved INTEGER;
  v_pending INTEGER;
  v_rejected INTEGER;
  v_status VARCHAR(50);
BEGIN
  SELECT
    COUNT(*),
    SUM(CASE WHEN approval_status IN ('approved', 'approved_conditional') THEN 1 ELSE 0 END),
    SUM(CASE WHEN approval_status = 'pending' THEN 1 ELSE 0 END),
    SUM(CASE WHEN approval_status = 'rejected' THEN 1 ELSE 0 END)
  INTO v_total, v_approved, v_pending, v_rejected
  FROM closure_approvals
  WHERE closure_id = p_closure_id;

  -- Determine overall status
  IF v_rejected > 0 THEN
    v_status := 'rejected';
  ELSIF v_pending > 0 THEN
    v_status := 'pending_review';
  ELSIF v_approved = v_total THEN
    v_status := 'approved';
  ELSE
    v_status := 'under_review';
  END IF;

  -- Update closure status
  UPDATE planned_closures
  SET approval_status = v_status
  WHERE id = p_closure_id;

  RETURN QUERY
  SELECT v_total, v_approved, v_pending, v_rejected, v_status;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update closure status when approvals change
CREATE OR REPLACE FUNCTION auto_update_closure_status()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_closure_approval_status(NEW.closure_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER closure_approval_status_update
AFTER INSERT OR UPDATE ON closure_approvals
FOR EACH ROW
EXECUTE FUNCTION auto_update_closure_status();

-- Trigger to update timestamp
CREATE OR REPLACE FUNCTION update_closure_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER closure_update
BEFORE UPDATE ON planned_closures
FOR EACH ROW
EXECUTE FUNCTION update_closure_timestamp();

-- Insert sample planned closure (for testing)
INSERT INTO planned_closures (
  closure_name,
  closure_type,
  route,
  state,
  start_location,
  end_location,
  planned_start,
  planned_end,
  duration_hours,
  lanes_affected,
  closure_scope,
  reason,
  description,
  border_proximity_miles,
  requires_multistate_approval,
  states_to_notify,
  submitted_by,
  approval_status
) VALUES (
  'I-35 Bridge Rehabilitation - Des Moines',
  'bridge_work',
  'I-35',
  'IA',
  'I-35 Exit 87 (Des Moines)',
  'I-35 Exit 92 (Ankeny)',
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '30 days' + INTERVAL '48 hours',
  48.0,
  '2 of 4 lanes',
  'partial',
  'Emergency bridge deck repairs',
  'Critical bridge deck deterioration requires immediate repair. Traffic will be reduced to 2 lanes. Detour available via US-69.',
  125.0,
  true,
  ARRAY['Minnesota', 'Missouri'],
  'TMC Supervisor - Iowa DOT',
  'draft'
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON planned_closures TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON closure_approvals TO PUBLIC;
GRANT SELECT, INSERT ON closure_notifications TO PUBLIC;
GRANT SELECT, INSERT ON closure_coordination_comments TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_sample_closure_id INTEGER;
BEGIN
  SELECT id INTO v_sample_closure_id FROM planned_closures LIMIT 1;

  RAISE NOTICE 'Closure Approval Workflow Configured:';
  RAISE NOTICE '- Multi-state approval workflow initialized';
  RAISE NOTICE '- Impact analysis framework created';
  RAISE NOTICE '- Public notice requirements configured';
  RAISE NOTICE '- Sample closure created (ID: %)', v_sample_closure_id;
  RAISE NOTICE '- Ready for coordinated closure management';
END $$;
