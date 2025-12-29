-- Migration: Add NODE (National Operations Dataset Exchange) Features
-- Purpose: Enable bidirectional data exchange, external contributions, and data provenance tracking
-- Date: 2025-01-15

-- =============================================================================
-- API Keys for External Consumers
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  key_hash TEXT UNIQUE NOT NULL,              -- SHA-256 hash of the API key
  key_prefix TEXT NOT NULL,                   -- First 8 chars for identification
  name TEXT NOT NULL,                         -- Descriptive name (e.g., "TomTom Fleet Integration")
  organization TEXT,                           -- Organization name
  contact_email TEXT,                          -- Contact for key owner
  key_type TEXT NOT NULL,                     -- 'public', 'commercial', 'research', 'government'
  tier TEXT DEFAULT 'basic',                  -- 'basic', 'standard', 'premium', 'unlimited'
  rate_limit_per_hour INTEGER DEFAULT 1000,  -- API calls allowed per hour
  allowed_endpoints TEXT,                      -- JSON array of allowed endpoints
  allowed_ip_addresses TEXT,                   -- JSON array of whitelisted IPs (optional)
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,                        -- NULL = no expiration
  last_used TIMESTAMP,
  usage_count INTEGER DEFAULT 0
);

-- Index for fast key lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(active);

-- =============================================================================
-- API Usage Tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id SERIAL PRIMARY KEY,
  api_key_id INTEGER,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Index for usage analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_key_time ON api_usage_logs(api_key_id, created_at);

-- =============================================================================
-- Cached Events with Provenance
-- =============================================================================
CREATE TABLE IF NOT EXISTS cached_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT UNIQUE NOT NULL,               -- Original event ID from source
  event_data TEXT NOT NULL,                     -- Full event data (JSON)

  -- Source & Provenance
  source_type TEXT NOT NULL,                    -- 'official_dot', 'commercial_fleet', 'crowdsource', 'sensor'
  source_id TEXT NOT NULL,                      -- State key, provider ID, etc.
  source_name TEXT,                             -- Human-readable source name
  data_provenance TEXT,                         -- JSON chain of data transformations

  -- Data Quality
  confidence_score REAL DEFAULT 0.5,            -- 0.0 to 1.0
  quality_flags TEXT,                           -- JSON array of quality issues
  validation_status TEXT DEFAULT 'unvalidated', -- 'validated', 'unvalidated', 'suspicious', 'rejected'

  -- Verification
  last_verified TIMESTAMP,
  verified_by TEXT,                             -- State key or system that verified
  verification_method TEXT,                     -- 'manual', 'automated', 'cross_reference'

  -- Geospatial
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  corridor TEXT,
  state_key TEXT,

  -- Event Details
  event_type TEXT,                              -- 'work-zone', 'incident', 'road-condition', etc.
  severity TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,                         -- When to purge from cache
  access_level TEXT DEFAULT 'public'            -- 'public', 'government', 'commercial', 'research'
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_cached_events_source ON cached_events(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_cached_events_location ON cached_events(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_cached_events_corridor ON cached_events(corridor);
CREATE INDEX IF NOT EXISTS idx_cached_events_time ON cached_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_cached_events_expires ON cached_events(expires_at);

-- =============================================================================
-- External Data Contributions
-- =============================================================================
CREATE TABLE IF NOT EXISTS external_contributions (
  id SERIAL PRIMARY KEY,
  contributor_id INTEGER,                       -- FK to api_keys
  contribution_type TEXT NOT NULL,              -- 'probe_data', 'incident_report', 'road_condition', 'parking_status'
  data TEXT NOT NULL,                           -- JSON data in standardized format

  -- Location
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_accuracy_meters REAL,

  -- Quality & Review
  validation_status TEXT DEFAULT 'pending',     -- 'pending', 'approved', 'rejected', 'flagged'
  confidence_score REAL DEFAULT 0.3,            -- Lower for unverified external data
  reviewed_by TEXT,
  review_notes TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,

  FOREIGN KEY (contributor_id) REFERENCES api_keys(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contributions_status ON external_contributions(validation_status);
CREATE INDEX IF NOT EXISTS idx_contributions_time ON external_contributions(created_at);

-- =============================================================================
-- Data Quality Metrics
-- =============================================================================
CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id SERIAL PRIMARY KEY,
  source_id TEXT NOT NULL,                      -- State key or provider ID
  source_type TEXT NOT NULL,
  metric_date DATE NOT NULL,

  -- Completeness metrics
  total_events INTEGER DEFAULT 0,
  events_with_coordinates INTEGER DEFAULT 0,
  events_with_end_time INTEGER DEFAULT 0,
  events_with_severity INTEGER DEFAULT 0,

  -- Accuracy metrics
  validation_passed INTEGER DEFAULT 0,
  validation_failed INTEGER DEFAULT 0,
  coordinate_errors INTEGER DEFAULT 0,

  -- Timeliness
  avg_update_frequency_minutes REAL,
  max_age_hours REAL,

  -- Overall quality score
  quality_score REAL,                           -- 0.0 to 1.0

  -- Metadata
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(source_id, source_type, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_quality_metrics_source ON data_quality_metrics(source_id, metric_date);

-- =============================================================================
-- WZDx Feed Registry
-- =============================================================================
CREATE TABLE IF NOT EXISTS wzdx_feed_registry (
  id SERIAL PRIMARY KEY,
  feed_url TEXT UNIQUE NOT NULL,
  feed_name TEXT NOT NULL,
  provider_organization TEXT,
  provider_contact TEXT,

  -- Coverage
  states_covered TEXT,                          -- JSON array of state keys
  corridors_covered TEXT,                       -- JSON array of corridor names

  -- Technical Details
  wzdx_version TEXT,                            -- e.g., "4.2", "4.1"
  update_frequency_minutes INTEGER,
  feed_format TEXT DEFAULT 'geojson',           -- 'geojson', 'json-ld'

  -- Status
  active BOOLEAN DEFAULT TRUE,
  last_successful_fetch TIMESTAMP,
  last_error TEXT,
  consecutive_errors INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Schema Migration Tracking
-- =============================================================================
INSERT INTO schema_migrations (migration_name, applied_at)
VALUES ('add_node_features', CURRENT_TIMESTAMP)
ON CONFLICT (migration_name) DO NOTHING;

-- =============================================================================
-- Sample Data: Create an API key for testing
-- =============================================================================
-- Note: This creates a test API key. In production, generate keys via admin interface.
-- Test key: node_test_1234567890abcdef (hash shown below)
INSERT INTO api_keys (
  key_hash,
  key_prefix,
  name,
  organization,
  contact_email,
  key_type,
  tier,
  rate_limit_per_hour,
  allowed_endpoints,
  active
) VALUES (
  'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', -- SHA-256 of 'test_key_123'
  'node_tes',
  'Development Test Key',
  'DOT Corridor Communicator Dev',
  'dev@corridor-comm.org',
  'research',
  'unlimited',
  10000,
  '["*"]',
  TRUE
) ON CONFLICT (key_hash) DO NOTHING;

-- =============================================================================
-- Comments for Documentation (PostgreSQL only - SQLite ignores these)
-- =============================================================================
-- COMMENT ON TABLE api_keys IS 'External API consumers with authentication and rate limiting';
-- COMMENT ON TABLE cached_events IS 'Cached traffic events with provenance and quality metadata for NODE publishing';
-- COMMENT ON TABLE external_contributions IS 'Data contributed by external sources (fleet operators, crowdsource, sensors)';
-- COMMENT ON TABLE data_quality_metrics IS 'Daily quality metrics for each data source';
-- COMMENT ON TABLE wzdx_feed_registry IS 'Registry of external WZDx feeds consumed by the system';
