-- IPAWS SOP Compliance Schema
-- Implements Iowa DOT IPAWS SOP Sections 11, 13, and 14
-- - Section 11: After-Action Review
-- - Section 13: Training & Certification
-- - Section 14: Compliance & Enforcement

-- =============================================================================
-- SECTION 13: USER CERTIFICATION TRACKING
-- =============================================================================

-- IPAWS Authorized Users Table
-- Tracks FEMA-certified personnel authorized to activate IPAWS alerts
CREATE TABLE IF NOT EXISTS ipaws_authorized_users (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  agency VARCHAR(255) DEFAULT 'Iowa DOT',
  role VARCHAR(100), -- 'TMC Operator', 'Supervisor', 'District', 'HSEMD', etc.

  -- FEMA Certifications (SOP Section 13)
  fema_is247_certified BOOLEAN DEFAULT FALSE, -- FEMA IS-247: Integrated Public Alert & Warning System
  fema_is247_date DATE,
  fema_is247_expires DATE,

  fema_is251_certified BOOLEAN DEFAULT FALSE, -- FEMA IS-251: Earthquakes, Tsunamis, and Volcanoes
  fema_is251_date DATE,
  fema_is251_expires DATE,

  fema_is315_certified BOOLEAN DEFAULT FALSE, -- FEMA IS-315: IPAWS for Alerting Authorities
  fema_is315_date DATE,
  fema_is315_expires DATE,

  -- Iowa DOT Policy Orientation
  iowa_dot_policy_certified BOOLEAN DEFAULT FALSE,
  iowa_dot_policy_date DATE,
  iowa_dot_policy_version VARCHAR(50), -- e.g., "2024-v1"

  -- Annual Refresher (SOP Section 13)
  last_refresher_date DATE,
  next_refresher_due DATE,

  -- Authorization Status
  authorized BOOLEAN DEFAULT FALSE,
  authorization_date DATE,
  authorized_by VARCHAR(255),
  authorization_notes TEXT,

  -- Suspension/Revocation (SOP Section 14)
  suspended BOOLEAN DEFAULT FALSE,
  suspension_date DATE,
  suspended_by VARCHAR(255),
  suspension_reason TEXT,
  revoked BOOLEAN DEFAULT FALSE,
  revocation_date DATE,
  revoked_by VARCHAR(255),
  revocation_reason TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ipaws_users_user_id ON ipaws_authorized_users(user_id);
CREATE INDEX IF NOT EXISTS idx_ipaws_users_authorized ON ipaws_authorized_users(authorized, suspended, revoked);
CREATE INDEX IF NOT EXISTS idx_ipaws_users_refresher_due ON ipaws_authorized_users(next_refresher_due);

-- =============================================================================
-- SECTION 13: TRAINING RECORDS
-- =============================================================================

-- Training Sessions Table
-- Logs all training activities including annual refreshers
CREATE TABLE IF NOT EXISTS ipaws_training_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  training_type VARCHAR(100) NOT NULL, -- 'FEMA IS-247', 'FEMA IS-251', 'FEMA IS-315', 'Iowa DOT Policy', 'Annual Refresher', 'Geofence Exercise', 'Message Development'
  training_date DATE NOT NULL,
  completion_status VARCHAR(50) DEFAULT 'completed', -- 'completed', 'failed', 'in_progress'
  score DECIMAL(5,2), -- If applicable (e.g., test score)
  certificate_number VARCHAR(100),
  certificate_url TEXT,
  instructor VARCHAR(255),
  duration_hours DECIMAL(4,2),
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES ipaws_authorized_users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_training_user ON ipaws_training_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_training_date ON ipaws_training_sessions(training_date);

-- =============================================================================
-- SECTION 11: AFTER-ACTION REVIEW
-- =============================================================================

-- After-Action Reviews Table
-- Per SOP Section 11: Conduct review within 7 days of activation
CREATE TABLE IF NOT EXISTS ipaws_after_action_reviews (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(255) NOT NULL, -- References ipaws_audit_log.alert_id
  event_id INTEGER, -- References events table if available

  -- Review Metadata
  review_date DATE NOT NULL,
  reviewed_by VARCHAR(255) NOT NULL,
  review_status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'submitted', 'approved'

  -- Timing Analysis (SOP Section 11)
  activation_time TIMESTAMP,
  incident_start_time TIMESTAMP,
  first_responder_alert_delay_minutes INTEGER, -- Time from incident to alert
  appropriate_timing BOOLEAN,
  timing_notes TEXT,

  -- Scope Analysis
  geofence_appropriate BOOLEAN,
  geofence_too_large BOOLEAN,
  geofence_too_small BOOLEAN,
  actual_affected_area_description TEXT,
  scope_notes TEXT,

  -- Unintended Effects (SOP Section 11)
  unintended_recipients BOOLEAN DEFAULT FALSE,
  unintended_recipients_count INTEGER,
  unintended_recipients_areas TEXT, -- List of areas that received alert but shouldn't have
  complaint_count INTEGER DEFAULT 0,
  complaint_summary TEXT,

  -- Message Effectiveness
  message_clear BOOLEAN,
  message_actionable BOOLEAN,
  audience_qualifier_effective BOOLEAN,
  message_feedback TEXT,

  -- Public Feedback
  positive_feedback_count INTEGER DEFAULT 0,
  negative_feedback_count INTEGER DEFAULT 0,
  media_coverage TEXT,
  social_media_response TEXT,

  -- Lessons Learned (SOP Section 11)
  lessons_learned TEXT,
  recommendations TEXT,
  training_needs_identified TEXT,
  sop_updates_recommended TEXT,

  -- Follow-up Actions
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_actions TEXT,
  follow_up_completed BOOLEAN DEFAULT FALSE,
  follow_up_completed_date DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aar_alert_id ON ipaws_after_action_reviews(alert_id);
CREATE INDEX IF NOT EXISTS idx_aar_review_date ON ipaws_after_action_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_aar_status ON ipaws_after_action_reviews(review_status);

-- =============================================================================
-- SECTION 14: COMPLIANCE & ENFORCEMENT
-- =============================================================================

-- Policy Violations Table
-- Tracks violations and enforcement actions per SOP Section 14
CREATE TABLE IF NOT EXISTS ipaws_policy_violations (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(255), -- Alert that triggered violation (if applicable)
  user_id VARCHAR(255) NOT NULL,

  -- Violation Details
  violation_date TIMESTAMP NOT NULL,
  violation_type VARCHAR(100) NOT NULL, -- 'unauthorized_activation', 'population_threshold_exceeded', 'geographic_targeting_violation', 'message_content_violation', 'duration_exceeded', 'missing_coordination', 'improper_use'
  violation_severity VARCHAR(50) DEFAULT 'minor', -- 'minor', 'moderate', 'severe', 'critical'
  violation_description TEXT NOT NULL,

  -- SOP Reference
  sop_section_violated VARCHAR(100), -- e.g., "Section 7.2", "Section 6.1"
  policy_requirement_violated TEXT,

  -- Investigation
  investigated BOOLEAN DEFAULT FALSE,
  investigation_date DATE,
  investigated_by VARCHAR(255),
  investigation_findings TEXT,
  intentional BOOLEAN, -- Was violation intentional or accidental?

  -- Enforcement Action (SOP Section 14)
  enforcement_action VARCHAR(100), -- 'warning', 'retraining_required', 'suspension', 'revocation', 'federal_report'
  enforcement_date DATE,
  enforced_by VARCHAR(255),
  suspension_duration_days INTEGER,
  retraining_required BOOLEAN DEFAULT FALSE,
  retraining_completed BOOLEAN DEFAULT FALSE,
  retraining_completed_date DATE,

  -- Federal Reporting (SOP Section 14.9)
  reported_to_federal BOOLEAN DEFAULT FALSE,
  federal_report_date DATE,
  federal_case_number VARCHAR(100),
  federal_penalty_assessed BOOLEAN DEFAULT FALSE,
  federal_penalty_amount DECIMAL(10,2),

  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolution_date DATE,
  resolution_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES ipaws_authorized_users(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_violations_user ON ipaws_policy_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_violations_date ON ipaws_policy_violations(violation_date);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON ipaws_policy_violations(violation_severity);
CREATE INDEX IF NOT EXISTS idx_violations_resolved ON ipaws_policy_violations(resolved);

-- =============================================================================
-- COMPLIANCE AUDIT TRAIL
-- =============================================================================

-- Compliance Events Table
-- Logs all compliance-related activities for audit purposes
CREATE TABLE IF NOT EXISTS ipaws_compliance_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL, -- 'certification_granted', 'certification_expired', 'refresher_completed', 'authorization_suspended', 'authorization_revoked', 'violation_logged', 'aar_completed'
  user_id VARCHAR(255),
  alert_id VARCHAR(255),
  event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  performed_by VARCHAR(255),
  details JSONB,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_compliance_events_type ON ipaws_compliance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_user ON ipaws_compliance_events(user_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_date ON ipaws_compliance_events(event_date);

-- =============================================================================
-- VIEWS FOR REPORTING
-- =============================================================================

-- View: Users needing refresher training
CREATE OR REPLACE VIEW ipaws_users_refresher_due AS
SELECT
  u.user_id,
  u.full_name,
  u.email,
  u.role,
  u.last_refresher_date,
  u.next_refresher_due,
  CASE
    WHEN u.next_refresher_due < CURRENT_DATE THEN 'OVERDUE'
    WHEN u.next_refresher_due <= CURRENT_DATE + INTERVAL '30 days' THEN 'DUE_SOON'
    ELSE 'CURRENT'
  END as refresher_status,
  CURRENT_DATE - u.next_refresher_due as days_overdue
FROM ipaws_authorized_users u
WHERE u.authorized = TRUE
  AND u.suspended = FALSE
  AND u.revoked = FALSE
  AND (u.next_refresher_due IS NULL OR u.next_refresher_due <= CURRENT_DATE + INTERVAL '90 days')
ORDER BY u.next_refresher_due ASC NULLS FIRST;

-- View: Certification expiration tracking
CREATE OR REPLACE VIEW ipaws_certification_expiration AS
SELECT
  u.user_id,
  u.full_name,
  u.email,
  u.role,
  u.fema_is247_expires,
  u.fema_is251_expires,
  u.fema_is315_expires,
  LEAST(
    u.fema_is247_expires,
    u.fema_is251_expires,
    u.fema_is315_expires
  ) as earliest_expiration,
  CASE
    WHEN LEAST(u.fema_is247_expires, u.fema_is251_expires, u.fema_is315_expires) < CURRENT_DATE THEN 'EXPIRED'
    WHEN LEAST(u.fema_is247_expires, u.fema_is251_expires, u.fema_is315_expires) <= CURRENT_DATE + INTERVAL '60 days' THEN 'EXPIRING_SOON'
    ELSE 'CURRENT'
  END as cert_status
FROM ipaws_authorized_users u
WHERE u.authorized = TRUE
  AND u.suspended = FALSE
  AND u.revoked = FALSE
ORDER BY earliest_expiration ASC;

-- View: Outstanding after-action reviews
-- Only create if ipaws_audit_log table exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ipaws_audit_log') THEN
    EXECUTE 'CREATE OR REPLACE VIEW ipaws_aar_outstanding AS
      SELECT
        al.alert_id,
        al.event_id,
        al.activation_date,
        al.activated_by,
        CURRENT_DATE - al.activation_date::date as days_since_activation,
        CASE
          WHEN CURRENT_DATE - al.activation_date::date > 7 THEN ''OVERDUE''
          WHEN CURRENT_DATE - al.activation_date::date >= 5 THEN ''DUE_SOON''
          ELSE ''IN_WINDOW''
        END as aar_status
      FROM ipaws_audit_log al
      LEFT JOIN ipaws_after_action_reviews aar ON al.alert_id = aar.alert_id
      WHERE al.status IN (''transmitted'', ''completed'')
        AND aar.id IS NULL
        AND al.activation_date >= CURRENT_DATE - INTERVAL ''30 days''
      ORDER BY al.activation_date ASC';
  END IF;
END $$;

-- View: User violation history
CREATE OR REPLACE VIEW ipaws_user_violation_summary AS
SELECT
  u.user_id,
  u.full_name,
  u.email,
  u.role,
  u.authorized,
  u.suspended,
  u.revoked,
  COUNT(v.id) as total_violations,
  COUNT(CASE WHEN v.violation_severity = 'critical' THEN 1 END) as critical_violations,
  COUNT(CASE WHEN v.violation_severity = 'severe' THEN 1 END) as severe_violations,
  COUNT(CASE WHEN v.violation_severity = 'moderate' THEN 1 END) as moderate_violations,
  COUNT(CASE WHEN v.violation_severity = 'minor' THEN 1 END) as minor_violations,
  COUNT(CASE WHEN v.resolved = FALSE THEN 1 END) as unresolved_violations,
  MAX(v.violation_date) as last_violation_date
FROM ipaws_authorized_users u
LEFT JOIN ipaws_policy_violations v ON u.user_id = v.user_id
GROUP BY u.user_id, u.full_name, u.email, u.role, u.authorized, u.suspended, u.revoked
ORDER BY total_violations DESC, last_violation_date DESC;

-- =============================================================================
-- SEED DATA: Default Admin User
-- =============================================================================

-- Insert a default system administrator (update with real credentials)
INSERT INTO ipaws_authorized_users (
  user_id, full_name, email, role,
  fema_is247_certified, fema_is251_certified, fema_is315_certified,
  iowa_dot_policy_certified, authorized, authorization_date, authorized_by
) VALUES (
  'system_admin',
  'System Administrator',
  'ipaws-admin@iowadot.gov',
  'System Administrator',
  TRUE, TRUE, TRUE,
  TRUE, TRUE, CURRENT_DATE, 'System Initialization'
) ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE ipaws_authorized_users IS 'SOP Section 13: Tracks FEMA-certified and Iowa DOT authorized IPAWS users';
COMMENT ON TABLE ipaws_training_sessions IS 'SOP Section 13: Logs all FEMA and Iowa DOT IPAWS training activities';
COMMENT ON TABLE ipaws_after_action_reviews IS 'SOP Section 11: After-action reviews conducted within 7 days of alert activation';
COMMENT ON TABLE ipaws_policy_violations IS 'SOP Section 14: Compliance violations and enforcement actions';
COMMENT ON TABLE ipaws_compliance_events IS 'Audit trail for all compliance-related activities';

-- Migration complete
-- This schema implements SOP Sections 11, 13, and 14 for complete IPAWS compliance
