/**
 * WZDx Feed Metadata Tracking
 *
 * Tracks generated WZDx feeds for states without existing feeds.
 * Enables feed versioning, archiving, and analytics for FHWA WZDx compliance.
 *
 * WZDx Specification: https://github.com/usdot-jpo-ode/wzdx
 * Version: 4.2
 */

-- WZDx Feed Generations Table
CREATE TABLE IF NOT EXISTS wzdx_feed_generations (
  id SERIAL PRIMARY KEY,

  -- Feed identification
  feed_id VARCHAR(255) NOT NULL UNIQUE, -- UUID for this feed generation
  data_source_id VARCHAR(255) NOT NULL DEFAULT 'corridor-communicator',

  -- Feed scope
  state VARCHAR(2), -- State code (if state-specific feed)
  corridor VARCHAR(50), -- Corridor/route (if corridor-specific feed)
  feed_type VARCHAR(50) NOT NULL DEFAULT 'full', -- full, state, corridor

  -- Feed metadata
  wzdx_version VARCHAR(10) NOT NULL DEFAULT '4.2',
  publisher VARCHAR(255) NOT NULL DEFAULT 'State DOT',
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  update_frequency INTEGER DEFAULT 300, -- seconds

  -- Feed content statistics
  total_features INTEGER DEFAULT 0,
  active_events INTEGER DEFAULT 0,
  planned_events INTEGER DEFAULT 0,
  work_zones INTEGER DEFAULT 0,
  detours INTEGER DEFAULT 0,
  incidents INTEGER DEFAULT 0,
  restrictions INTEGER DEFAULT 0,

  -- Validation
  is_valid BOOLEAN DEFAULT TRUE,
  validation_errors TEXT, -- JSON array of validation errors

  -- Feed storage
  feed_json TEXT, -- Complete WZDx feed JSON
  feed_url VARCHAR(500), -- Public URL if hosted

  -- Access tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,

  -- Metadata
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Optional expiration
  archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP
);

-- WZDx Feed Access Log
CREATE TABLE IF NOT EXISTS wzdx_feed_access_log (
  id SERIAL PRIMARY KEY,

  -- Feed reference
  feed_id VARCHAR(255) NOT NULL REFERENCES wzdx_feed_generations(feed_id) ON DELETE CASCADE,

  -- Access details
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45), -- IPv4 or IPv6
  user_agent TEXT,
  referer TEXT,

  -- Request parameters
  state VARCHAR(2),
  corridor VARCHAR(50),
  include_completed BOOLEAN,
  format VARCHAR(20), -- json, validate

  -- Response
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT
);

-- WZDx Event Mapping Table
-- Maps internal events to WZDx features (generic - can reference multiple event sources)
CREATE TABLE IF NOT EXISTS wzdx_event_mapping (
  id SERIAL PRIMARY KEY,

  -- Event reference (generic - no FK constraint since events come from multiple tables)
  event_id INTEGER NOT NULL,
  event_source VARCHAR(100), -- 'weather_events', 'work_zones', 'calendar_events', etc.

  -- WZDx details
  wzdx_id VARCHAR(255) NOT NULL UNIQUE, -- WZDx feature ID
  feed_id VARCHAR(255) REFERENCES wzdx_feed_generations(feed_id) ON DELETE SET NULL,

  -- WZDx fields
  event_type VARCHAR(50), -- work-zone, detour, incident, restriction
  vehicle_impact VARCHAR(100),
  location_method VARCHAR(50),
  work_zone_type VARCHAR(50),

  -- Mapping metadata
  mapped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Validation
  is_compliant BOOLEAN DEFAULT TRUE,
  compliance_issues TEXT -- JSON array of issues
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wzdx_feed_state ON wzdx_feed_generations(state);
CREATE INDEX IF NOT EXISTS idx_wzdx_feed_corridor ON wzdx_feed_generations(corridor);
CREATE INDEX IF NOT EXISTS idx_wzdx_feed_generated_at ON wzdx_feed_generations(generated_at);
CREATE INDEX IF NOT EXISTS idx_wzdx_feed_archived ON wzdx_feed_generations(archived);

CREATE INDEX IF NOT EXISTS idx_wzdx_access_feed_id ON wzdx_feed_access_log(feed_id);
CREATE INDEX IF NOT EXISTS idx_wzdx_access_accessed_at ON wzdx_feed_access_log(accessed_at);

CREATE INDEX IF NOT EXISTS idx_wzdx_event_mapping_event_id ON wzdx_event_mapping(event_id);
CREATE INDEX IF NOT EXISTS idx_wzdx_event_mapping_feed_id ON wzdx_event_mapping(feed_id);

-- View: Latest feeds by state
CREATE OR REPLACE VIEW wzdx_latest_feeds_by_state AS
SELECT DISTINCT ON (state)
  fg.id,
  fg.feed_id,
  fg.state,
  fg.feed_type,
  fg.total_features,
  fg.active_events,
  fg.planned_events,
  fg.is_valid,
  fg.generated_at,
  fg.access_count,
  fg.feed_url
FROM wzdx_feed_generations fg
WHERE fg.state IS NOT NULL
  AND fg.archived = FALSE
ORDER BY fg.state, fg.generated_at DESC;

-- View: Feed generation statistics
CREATE OR REPLACE VIEW wzdx_feed_statistics AS
SELECT
  COUNT(*) as total_feeds_generated,
  COUNT(CASE WHEN archived = FALSE THEN 1 END) as active_feeds,
  COUNT(CASE WHEN is_valid = TRUE THEN 1 END) as valid_feeds,
  COUNT(DISTINCT state) as states_covered,
  COUNT(DISTINCT corridor) as corridors_covered,
  SUM(total_features) as total_events_published,
  SUM(access_count) as total_feed_accesses,
  MAX(generated_at) as last_generation_time
FROM wzdx_feed_generations;

-- View: Most accessed feeds
CREATE OR REPLACE VIEW wzdx_most_accessed_feeds AS
SELECT
  fg.feed_id,
  fg.state,
  fg.corridor,
  fg.feed_type,
  fg.total_features,
  fg.access_count,
  fg.generated_at,
  COUNT(al.id) as access_log_count,
  MAX(al.accessed_at) as last_access
FROM wzdx_feed_generations fg
LEFT JOIN wzdx_feed_access_log al ON fg.feed_id = al.feed_id
WHERE fg.archived = FALSE
GROUP BY fg.id, fg.feed_id, fg.state, fg.corridor, fg.feed_type, fg.total_features, fg.access_count, fg.generated_at
ORDER BY fg.access_count DESC, access_log_count DESC
LIMIT 20;

-- View: WZDx compliance report (simplified - shows mappings without event source join)
CREATE OR REPLACE VIEW wzdx_compliance_report AS
SELECT
  em.id,
  em.event_id,
  em.event_source,
  em.wzdx_id,
  em.event_type as wzdx_event_type,
  em.vehicle_impact,
  em.is_compliant,
  em.compliance_issues,
  em.mapped_at,
  fg.feed_id,
  fg.state,
  fg.corridor,
  fg.is_valid as feed_is_valid
FROM wzdx_event_mapping em
LEFT JOIN wzdx_feed_generations fg ON em.feed_id = fg.feed_id
ORDER BY em.is_compliant ASC, fg.state, em.mapped_at DESC;

-- View: Feed access analytics (last 7 days)
CREATE OR REPLACE VIEW wzdx_feed_access_analytics AS
SELECT
  DATE(al.accessed_at) as access_date,
  COUNT(*) as total_requests,
  COUNT(DISTINCT al.feed_id) as unique_feeds_accessed,
  COUNT(DISTINCT al.ip_address) as unique_ips,
  AVG(al.response_time_ms) as avg_response_time_ms,
  COUNT(CASE WHEN al.status_code >= 200 AND al.status_code < 300 THEN 1 END) as successful_requests,
  COUNT(CASE WHEN al.status_code >= 400 THEN 1 END) as failed_requests
FROM wzdx_feed_access_log al
WHERE al.accessed_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(al.accessed_at)
ORDER BY access_date DESC;

-- Comments
COMMENT ON TABLE wzdx_feed_generations IS 'Metadata tracking for generated WZDx v4.2 feeds';
COMMENT ON TABLE wzdx_feed_access_log IS 'Access log for WZDx feed requests';
COMMENT ON TABLE wzdx_event_mapping IS 'Mapping between internal events and WZDx features';

COMMENT ON COLUMN wzdx_feed_generations.feed_id IS 'Unique UUID for this feed generation';
COMMENT ON COLUMN wzdx_feed_generations.data_source_id IS 'WZDx data source identifier';
COMMENT ON COLUMN wzdx_feed_generations.feed_type IS 'Scope of feed: full, state, or corridor-specific';
COMMENT ON COLUMN wzdx_feed_generations.feed_json IS 'Complete WZDx feed JSON (may be large)';

COMMENT ON COLUMN wzdx_event_mapping.wzdx_id IS 'WZDx feature ID (appears in feed)';
COMMENT ON COLUMN wzdx_event_mapping.event_type IS 'WZDx event type: work-zone, detour, incident, restriction';
COMMENT ON COLUMN wzdx_event_mapping.is_compliant IS 'Does this event meet WZDx v4.2 business rules?';

COMMENT ON VIEW wzdx_latest_feeds_by_state IS 'Most recent feed for each state';
COMMENT ON VIEW wzdx_feed_statistics IS 'Overall WZDx feed generation statistics';
COMMENT ON VIEW wzdx_compliance_report IS 'WZDx compliance status for all active events';
