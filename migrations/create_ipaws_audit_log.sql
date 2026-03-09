-- IPAWS Alert Audit Log
-- Per SOP Section 11: Documentation & After-Action Review
-- Maintains logs of all IPAWS activations for compliance review

CREATE TABLE IF NOT EXISTS ipaws_alert_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Alert Identification
  alert_id TEXT NOT NULL UNIQUE,           -- CAP alert identifier (e.g., IADOT-WEA-1234567890)
  event_id INTEGER,                        -- Reference to events table

  -- User & Timestamp (SOP Section 11)
  user_id TEXT NOT NULL,                   -- FEMA authorized user ID
  user_name TEXT,                          -- User display name
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Alert Status
  status TEXT NOT NULL DEFAULT 'draft',    -- draft, pending_approval, issued, updated, cancelled, expired

  -- Event Details
  corridor TEXT,                           -- Route (e.g., I-80)
  direction TEXT,                          -- EB, WB, NB, SB
  location TEXT,                           -- Human-readable location
  mile_marker_range TEXT,                  -- MM range (e.g., MM 137-145)
  event_type TEXT,                         -- incident, hazmat, weather, etc.
  severity TEXT,                           -- high, medium, low

  -- Alert Content (SOP Section 11)
  headline_english TEXT,                   -- WEA headline
  instruction_english TEXT,                -- WEA instruction
  headline_spanish TEXT,                   -- Spanish translation
  instruction_spanish TEXT,                -- Spanish instruction

  -- Channels (SOP Section 11)
  channel_wea BOOLEAN DEFAULT 0,           -- Wireless Emergency Alert
  channel_eas BOOLEAN DEFAULT 0,           -- Emergency Alert System
  channel_public BOOLEAN DEFAULT 0,        -- Public feeds (511, social)

  -- Geofence (SOP Section 11)
  geofence_polygon TEXT,                   -- CAP-format polygon
  geofence_buffer_miles REAL,              -- Buffer width in miles
  geofence_area_sq_miles REAL,             -- Total area
  geofence_is_asymmetric BOOLEAN DEFAULT 0,-- Advance warning mode
  corridor_ahead_miles REAL,               -- Distance ahead of event
  corridor_behind_miles REAL,              -- Distance behind event

  -- Population Impact
  estimated_population INTEGER,            -- Total population in geofence
  population_rural INTEGER,                -- Rural population
  population_urban INTEGER,                -- Urban population
  population_source TEXT,                  -- Data source (LandScan, Census, OSM)
  population_confidence TEXT,              -- high, medium, low

  -- Duration & Timing (SOP Section 10)
  effective_time DATETIME,                 -- When alert becomes active
  expires_time DATETIME,                   -- When alert expires
  duration_minutes INTEGER,                -- Alert duration in minutes
  max_duration_hours INTEGER DEFAULT 4,    -- Maximum allowed (SOP: 4 hours)

  -- Qualification
  qualified BOOLEAN DEFAULT 0,             -- Met activation criteria
  qualification_reason TEXT,               -- Why qualified (or not)
  override_applied BOOLEAN DEFAULT 0,      -- Operator override used
  override_reason TEXT,                    -- Justification for override

  -- Coordination (SOP Section 7.8)
  coordinated_with_law_enforcement BOOLEAN DEFAULT 0,
  coordinated_with_emergency_mgmt BOOLEAN DEFAULT 0,
  coordination_notes TEXT,

  -- Lifecycle Events
  issued_at DATETIME,                      -- When alert was sent to IPAWS
  updated_at DATETIME,                     -- When alert was last updated
  cancelled_at DATETIME,                   -- When alert was cancelled
  cancellation_reason TEXT,                -- Why alert was cancelled

  -- After-Action Review (SOP Section 11, 6.4.5)
  review_completed BOOLEAN DEFAULT 0,
  review_completed_at DATETIME,
  review_notes TEXT,
  unintended_reach_reported BOOLEAN DEFAULT 0,
  public_feedback TEXT,
  lessons_learned TEXT,

  -- Compliance
  sop_version TEXT DEFAULT '2024-v1',      -- SOP version used
  fema_training_verified BOOLEAN DEFAULT 0,-- IS247/IS251/IS315 verified
  audit_exported BOOLEAN DEFAULT 0,        -- Exported to HSEMD
  audit_exported_at DATETIME

  -- Note: Foreign key to events table omitted to allow standalone operation
  -- event_id references events(id) but without formal constraint
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_ipaws_log_alert_id ON ipaws_alert_log(alert_id);
CREATE INDEX IF NOT EXISTS idx_ipaws_log_event_id ON ipaws_alert_log(event_id);
CREATE INDEX IF NOT EXISTS idx_ipaws_log_status ON ipaws_alert_log(status);
CREATE INDEX IF NOT EXISTS idx_ipaws_log_created_at ON ipaws_alert_log(created_at);
CREATE INDEX IF NOT EXISTS idx_ipaws_log_user_id ON ipaws_alert_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ipaws_log_corridor ON ipaws_alert_log(corridor);

-- Create view for active alerts
CREATE VIEW IF NOT EXISTS ipaws_active_alerts AS
SELECT
  alert_id,
  event_id,
  corridor,
  direction,
  location,
  status,
  effective_time,
  expires_time,
  estimated_population,
  geofence_area_sq_miles,
  CASE
    WHEN expires_time < datetime('now') THEN 'expired'
    WHEN status = 'cancelled' THEN 'cancelled'
    WHEN status = 'issued' THEN 'active'
    ELSE status
  END as computed_status
FROM ipaws_alert_log
WHERE status IN ('issued', 'updated')
  AND (expires_time IS NULL OR expires_time > datetime('now'))
  AND cancelled_at IS NULL
ORDER BY created_at DESC;

-- Create view for compliance reporting
CREATE VIEW IF NOT EXISTS ipaws_compliance_report AS
SELECT
  DATE(created_at) as alert_date,
  COUNT(*) as total_alerts,
  SUM(CASE WHEN qualified = 1 THEN 1 ELSE 0 END) as qualified_alerts,
  SUM(CASE WHEN override_applied = 1 THEN 1 ELSE 0 END) as override_alerts,
  SUM(CASE WHEN duration_minutes <= 60 THEN 1 ELSE 0 END) as sop_compliant_duration,
  SUM(CASE WHEN review_completed = 1 THEN 1 ELSE 0 END) as reviews_completed,
  AVG(estimated_population) as avg_population_reached,
  AVG(duration_minutes) as avg_duration_minutes
FROM ipaws_alert_log
GROUP BY DATE(created_at)
ORDER BY alert_date DESC;

-- Table documentation (SQLite doesn't support COMMENT ON syntax)
-- ipaws_alert_log: Audit log for all IPAWS activations per SOP Section 11
-- alert_id: Unique CAP alert identifier
-- user_id: FEMA authorized user who created the alert
-- status: Alert lifecycle status
-- duration_minutes: SOP requires 30-60 min default, 4 hour max
