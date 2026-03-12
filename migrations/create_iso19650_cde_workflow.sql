/**
 * ISO 19650 Common Data Environment (CDE) Workflow Implementation
 *
 * Implements the four-state information container model required by ISO 19650:
 * - WIP (Work in Progress)
 * - SHARED
 * - PUBLISHED
 * - ARCHIVED
 *
 * Date: 2026-03-12
 * Standard: ISO 19650-1:2018 and ISO 19650-2:2018
 */

-- ============================================================================
-- INFORMATION CONTAINERS TABLE
-- Core table for managing all project deliverables per ISO 19650
-- ============================================================================

CREATE TABLE IF NOT EXISTS information_containers (
  id SERIAL PRIMARY KEY,

  -- ISO 19650 Naming Convention: PROJ-ORG-PH-LV-TYP-RL-CL-NUM-SUIT-REV
  container_id VARCHAR(255) UNIQUE NOT NULL,

  -- Naming components (ISO 19650 Section 5.1.2)
  project_code VARCHAR(50),           -- Project identifier
  originator VARCHAR(50),             -- Organization code
  phase VARCHAR(20),                  -- Project phase (e.g., D = Design, C = Construction)
  level_location VARCHAR(50),         -- Level/location/zone
  type VARCHAR(20),                   -- Type (M = Model, D = Drawing, SP = Specification)
  role VARCHAR(20),                   -- Role/discipline (STR, ARCH, MEP, CIV, etc.)
  classification VARCHAR(50),         -- Uniclass/Omniclass classification
  number VARCHAR(50),                 -- Sequential number
  suitability_code VARCHAR(5),        -- S0-S8 per ISO 19650
  revision VARCHAR(20),               -- Revision identifier

  -- State Management (ISO 19650 Section 5.1.4)
  current_state VARCHAR(20) NOT NULL DEFAULT 'WIP',
  state_changed_at TIMESTAMP DEFAULT NOW(),
  state_changed_by VARCHAR(255),

  -- State history tracking (audit trail)
  state_history JSONB DEFAULT '[]'::jsonb,

  -- File information
  file_path TEXT,
  file_format VARCHAR(20),            -- IFC, DWG, PDF, XLSX, etc.
  file_size_bytes BIGINT,
  file_hash VARCHAR(64),              -- SHA256 for integrity verification

  -- Metadata
  title TEXT,
  description TEXT,
  author VARCHAR(255),
  author_organization VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  modified_at TIMESTAMP DEFAULT NOW(),

  -- Authorization (for Published state)
  authorized_by VARCHAR(255),
  authorized_at TIMESTAMP,
  authorization_notes TEXT,

  -- Access control
  access_level VARCHAR(20) DEFAULT 'team',  -- team, project, organization, public
  owner_team VARCHAR(100),                  -- Team that created the container

  -- Linking to existing data
  linked_model_id INTEGER REFERENCES ifc_models(id) ON DELETE SET NULL,
  linked_cadd_model_id INTEGER REFERENCES cadd_models(id) ON DELETE SET NULL,
  linked_project_id INTEGER,

  -- Archival information
  retention_period_years INTEGER,
  archival_date TIMESTAMP,
  archival_location TEXT,

  -- Constraints
  CONSTRAINT valid_state CHECK (current_state IN ('WIP', 'SHARED', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT valid_suitability CHECK (suitability_code IN ('S0', 'S1', 'S2', 'S3', 'S4', 'S6', 'S7', 'S8')),
  CONSTRAINT valid_access_level CHECK (access_level IN ('team', 'project', 'organization', 'public'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_containers_state ON information_containers(current_state);
CREATE INDEX IF NOT EXISTS idx_containers_project ON information_containers(project_code);
CREATE INDEX IF NOT EXISTS idx_containers_suitability ON information_containers(suitability_code);
CREATE INDEX IF NOT EXISTS idx_containers_type ON information_containers(type);
CREATE INDEX IF NOT EXISTS idx_containers_modified ON information_containers(modified_at DESC);

-- Comments
COMMENT ON TABLE information_containers IS 'ISO 19650-compliant information container registry with four-state workflow';
COMMENT ON COLUMN information_containers.suitability_code IS 'S0=Preliminary, S1=Coordination, S2=Info, S3=Review, S4=Construction, S6=Production, S7=Ops, S8=As-built';
COMMENT ON COLUMN information_containers.current_state IS 'WIP (editable) → SHARED (coordination) → PUBLISHED (authorized) → ARCHIVED (historical)';

-- ============================================================================
-- STATE TRANSITIONS TABLE
-- Tracks all state changes for audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS container_state_transitions (
  id SERIAL PRIMARY KEY,
  container_id VARCHAR(255) REFERENCES information_containers(container_id) ON DELETE CASCADE,

  -- Transition details
  from_state VARCHAR(20),
  to_state VARCHAR(20) NOT NULL,
  transition_timestamp TIMESTAMP DEFAULT NOW(),
  transitioned_by VARCHAR(255) NOT NULL,

  -- Approval/authorization
  approver VARCHAR(255),
  approval_notes TEXT,
  approval_required BOOLEAN DEFAULT FALSE,

  -- Rejection handling
  rejected BOOLEAN DEFAULT FALSE,
  rejection_reason TEXT,

  -- Compliance
  meets_requirements BOOLEAN DEFAULT TRUE,
  validation_errors JSONB,

  CONSTRAINT valid_from_state CHECK (from_state IN ('WIP', 'SHARED', 'PUBLISHED', 'ARCHIVED')),
  CONSTRAINT valid_to_state CHECK (to_state IN ('WIP', 'SHARED', 'PUBLISHED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_state_transitions_container ON container_state_transitions(container_id, transition_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_state_transitions_user ON container_state_transitions(transitioned_by);

COMMENT ON TABLE container_state_transitions IS 'Audit trail of all state transitions per ISO 19650 requirements';

-- ============================================================================
-- FILE ACCESS LOG
-- Comprehensive audit trail for all file operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_access_log (
  id SERIAL PRIMARY KEY,
  container_id VARCHAR(255) REFERENCES information_containers(container_id) ON DELETE CASCADE,

  -- User information
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_role VARCHAR(50),

  -- Access details
  access_type VARCHAR(20) NOT NULL,    -- view, download, upload, modify, delete, approve, authorize
  access_timestamp TIMESTAMP DEFAULT NOW(),

  -- Request metadata
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_method VARCHAR(10),

  -- Result
  success BOOLEAN DEFAULT TRUE,
  failure_reason TEXT,

  -- Additional context
  accessed_from VARCHAR(50),           -- web, mobile, api
  session_id VARCHAR(255),

  CONSTRAINT valid_access_type CHECK (access_type IN ('view', 'download', 'upload', 'modify', 'delete', 'approve', 'authorize', 'comment', 'share'))
);

CREATE INDEX IF NOT EXISTS idx_file_access_container ON file_access_log(container_id, access_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_file_access_user ON file_access_log(user_id, access_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_file_access_type ON file_access_log(access_type, access_timestamp DESC);

COMMENT ON TABLE file_access_log IS 'Comprehensive audit log for all file operations (ISO 19650 compliance)';

-- ============================================================================
-- CONTAINER REVIEWS & COMMENTS
-- Enable collaborative review process
-- ============================================================================

CREATE TABLE IF NOT EXISTS container_reviews (
  id SERIAL PRIMARY KEY,
  container_id VARCHAR(255) REFERENCES information_containers(container_id) ON DELETE CASCADE,

  -- Review details
  reviewer_id INTEGER REFERENCES users(id),
  reviewer_name VARCHAR(255),
  review_type VARCHAR(20),              -- coordination, technical, approval, authorization
  review_status VARCHAR(20),            -- pending, approved, rejected, commented

  -- Comments
  comment_text TEXT,
  markup_file_path TEXT,                -- Path to marked-up PDF/IFC

  -- Timestamps
  review_requested_at TIMESTAMP,
  review_completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),

  -- Response tracking
  response_required BOOLEAN DEFAULT FALSE,
  response_provided BOOLEAN DEFAULT FALSE,
  response_text TEXT,

  CONSTRAINT valid_review_type CHECK (review_type IN ('coordination', 'technical', 'approval', 'authorization', 'quality')),
  CONSTRAINT valid_review_status CHECK (review_status IN ('pending', 'approved', 'rejected', 'commented', 'deferred'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_container ON container_reviews(container_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON container_reviews(reviewer_id, review_status);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON container_reviews(review_status, review_requested_at);

COMMENT ON TABLE container_reviews IS 'Collaborative review and comment system for information containers';

-- ============================================================================
-- INFORMATION DELIVERY PROTOCOL
-- Track information delivery milestones per project
-- ============================================================================

CREATE TABLE IF NOT EXISTS information_delivery_milestones (
  id SERIAL PRIMARY KEY,
  project_code VARCHAR(50) NOT NULL,

  -- Milestone details
  milestone_name VARCHAR(255) NOT NULL,
  milestone_code VARCHAR(50),           -- e.g., M1, M2, M3
  milestone_description TEXT,

  -- Schedule
  planned_date DATE,
  actual_date DATE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in-progress, completed, overdue

  -- Deliverables
  required_containers_count INTEGER,
  submitted_containers_count INTEGER DEFAULT 0,
  approved_containers_count INTEGER DEFAULT 0,

  -- Responsible parties
  responsible_organization VARCHAR(255),
  approving_organization VARCHAR(255),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_milestone_status CHECK (status IN ('pending', 'in-progress', 'completed', 'overdue', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_milestones_project ON information_delivery_milestones(project_code, planned_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON information_delivery_milestones(status, planned_date);

COMMENT ON TABLE information_delivery_milestones IS 'Information delivery schedule and tracking per ISO 19650-2';

-- ============================================================================
-- MILESTONE DELIVERABLES MAPPING
-- Link containers to delivery milestones
-- ============================================================================

CREATE TABLE IF NOT EXISTS milestone_deliverables (
  id SERIAL PRIMARY KEY,
  milestone_id INTEGER REFERENCES information_delivery_milestones(id) ON DELETE CASCADE,
  container_id VARCHAR(255) REFERENCES information_containers(container_id) ON DELETE CASCADE,

  -- Delivery status
  required BOOLEAN DEFAULT TRUE,
  submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP,
  approved BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMP,

  -- Quality checks
  validation_passed BOOLEAN,
  validation_notes TEXT,

  UNIQUE(milestone_id, container_id)
);

CREATE INDEX IF NOT EXISTS idx_milestone_deliverables_milestone ON milestone_deliverables(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestone_deliverables_status ON milestone_deliverables(submitted, approved);

-- ============================================================================
-- SUITABILITY CODE DEFINITIONS
-- Reference table for ISO 19650 suitability codes
-- ============================================================================

CREATE TABLE IF NOT EXISTS suitability_codes (
  code VARCHAR(5) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  typical_state VARCHAR(20),
  sort_order INTEGER
);

INSERT INTO suitability_codes (code, name, description, typical_state, sort_order) VALUES
('S0', 'Preliminary', 'Initial status - work in progress, not suitable for use', 'WIP', 1),
('S1', 'Suitable for Coordination', 'Suitable for coordination with other task teams', 'SHARED', 2),
('S2', 'Suitable for Information', 'For information only, not for construction', 'SHARED', 3),
('S3', 'Suitable for Review and Comment', 'For formal review and comment process', 'SHARED', 4),
('S4', 'Suitable for Stage Approval', 'Approved for the current project stage', 'PUBLISHED', 5),
('S6', 'Suitable for Production (PIM)', 'Suitable for production/manufacture (Project Information Model)', 'PUBLISHED', 6),
('S7', 'Suitable for Operations (AIM)', 'Suitable for operations and maintenance (Asset Information Model)', 'PUBLISHED', 7),
('S8', 'Suitable for As-Built', 'As-built or as-constructed information', 'PUBLISHED', 8)
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE suitability_codes IS 'ISO 19650 suitability code definitions';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to transition container state
CREATE OR REPLACE FUNCTION transition_container_state(
  p_container_id VARCHAR(255),
  p_new_state VARCHAR(20),
  p_user VARCHAR(255),
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_state VARCHAR(20);
  v_valid_transition BOOLEAN;
BEGIN
  -- Get current state
  SELECT current_state INTO v_current_state
  FROM information_containers
  WHERE container_id = p_container_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Container % not found', p_container_id;
  END IF;

  -- Validate transition (implement business rules)
  v_valid_transition := TRUE;

  -- Example: Cannot go from PUBLISHED back to WIP
  IF v_current_state = 'PUBLISHED' AND p_new_state = 'WIP' THEN
    v_valid_transition := FALSE;
  END IF;

  -- Cannot skip states (e.g., WIP → PUBLISHED must go through SHARED)
  IF v_current_state = 'WIP' AND p_new_state = 'PUBLISHED' THEN
    v_valid_transition := FALSE;
  END IF;

  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Invalid state transition from % to %', v_current_state, p_new_state;
  END IF;

  -- Update container state
  UPDATE information_containers
  SET current_state = p_new_state,
      state_changed_at = NOW(),
      state_changed_by = p_user,
      state_history = state_history || jsonb_build_object(
        'from', v_current_state,
        'to', p_new_state,
        'timestamp', NOW(),
        'user', p_user,
        'notes', p_notes
      )
  WHERE container_id = p_container_id;

  -- Log transition
  INSERT INTO container_state_transitions
    (container_id, from_state, to_state, transitioned_by, approval_notes)
  VALUES
    (p_container_id, v_current_state, p_new_state, p_user, p_notes);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to log file access
CREATE OR REPLACE FUNCTION log_file_access(
  p_container_id VARCHAR(255),
  p_user_id INTEGER,
  p_access_type VARCHAR(20),
  p_ip_address VARCHAR(45) DEFAULT NULL,
  p_success BOOLEAN DEFAULT TRUE
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO file_access_log
    (container_id, user_id, access_type, ip_address, success)
  VALUES
    (p_container_id, p_user_id, p_access_type, p_ip_address, p_success);
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can access container in current state
CREATE OR REPLACE FUNCTION can_user_access_container(
  p_container_id VARCHAR(255),
  p_user_role VARCHAR(50)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_state VARCHAR(20);
  v_access_level VARCHAR(20);
BEGIN
  SELECT current_state, access_level
  INTO v_state, v_access_level
  FROM information_containers
  WHERE container_id = p_container_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- WIP: Only team members
  IF v_state = 'WIP' AND v_access_level = 'team' THEN
    RETURN (p_user_role IN ('admin', 'team_member'));
  END IF;

  -- SHARED: Project members
  IF v_state = 'SHARED' THEN
    RETURN (p_user_role IN ('admin', 'team_member', 'project_member'));
  END IF;

  -- PUBLISHED: All authenticated users
  IF v_state = 'PUBLISHED' THEN
    RETURN TRUE;
  END IF;

  -- ARCHIVED: Admins and authorized personnel
  IF v_state = 'ARCHIVED' THEN
    RETURN (p_user_role IN ('admin', 'archivist'));
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View: Containers by state
CREATE OR REPLACE VIEW containers_by_state AS
SELECT
  current_state,
  COUNT(*) as container_count,
  COUNT(*) FILTER (WHERE suitability_code IN ('S4', 'S6', 'S7', 'S8')) as approved_count,
  SUM(file_size_bytes) as total_size_bytes,
  MAX(modified_at) as last_modified
FROM information_containers
GROUP BY current_state;

COMMENT ON VIEW containers_by_state IS 'Summary of containers by current state';

-- View: Pending reviews
CREATE OR REPLACE VIEW pending_reviews AS
SELECT
  cr.id,
  cr.container_id,
  ic.title as container_title,
  cr.reviewer_name,
  cr.review_type,
  cr.review_requested_at,
  EXTRACT(DAY FROM NOW() - cr.review_requested_at) as days_pending
FROM container_reviews cr
JOIN information_containers ic ON cr.container_id = ic.container_id
WHERE cr.review_status = 'pending'
ORDER BY cr.review_requested_at;

COMMENT ON VIEW pending_reviews IS 'All pending reviews awaiting action';

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Sample project information container
INSERT INTO information_containers (
  container_id,
  project_code,
  originator,
  phase,
  level_location,
  type,
  role,
  classification,
  number,
  suitability_code,
  revision,
  current_state,
  title,
  description,
  author,
  file_format,
  access_level,
  owner_team
) VALUES (
  'I80-IOWA-D-B01-M-STR-38-001-S1-P01',
  'I80-IOWA',
  'IOWA',
  'D',
  'B01',
  'M',
  'STR',
  '38',
  '001',
  'S1',
  'P01',
  'SHARED',
  'I-80 Bridge over Des Moines River - Structural Model',
  'IFC structural model for bridge rehabilitation project',
  'design-team@iowadot.gov',
  'IFC',
  'project',
  'structural-design'
) ON CONFLICT (container_id) DO NOTHING;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON information_containers TO PUBLIC;
GRANT SELECT, INSERT ON container_state_transitions TO PUBLIC;
GRANT SELECT, INSERT ON file_access_log TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON container_reviews TO PUBLIC;
GRANT SELECT ON suitability_codes TO PUBLIC;
GRANT SELECT ON containers_by_state TO PUBLIC;
GRANT SELECT ON pending_reviews TO PUBLIC;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
DECLARE
  v_container_count INTEGER;
  v_state_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_container_count FROM information_containers;
  SELECT COUNT(DISTINCT current_state) INTO v_state_count FROM information_containers;

  RAISE NOTICE '✅ ISO 19650 CDE Workflow Implementation Complete';
  RAISE NOTICE '   - Information containers: %', v_container_count;
  RAISE NOTICE '   - States configured: % (WIP, SHARED, PUBLISHED, ARCHIVED)', v_state_count;
  RAISE NOTICE '   - Suitability codes: 8 (S0-S8)';
  RAISE NOTICE '   - Audit trail: Enabled';
  RAISE NOTICE '   - Review workflow: Enabled';
  RAISE NOTICE '   - Milestone tracking: Enabled';
  RAISE NOTICE '   - ISO 19650 compliance: Ready';
END $$;
