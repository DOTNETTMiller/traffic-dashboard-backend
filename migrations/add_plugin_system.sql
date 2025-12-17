-- Plugin System Tables for Third-Party Data Providers
-- Supports companies like Inrix, Here, Waze, TomTom

-- Table: plugin_providers
-- Stores information about registered data providers
CREATE TABLE IF NOT EXISTS plugin_providers (
  provider_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  website_url TEXT,
  logo_url TEXT,
  description TEXT,
  data_types TEXT,  -- JSON array: ["incidents", "speed", "travel_time", "parking"]
  coverage_states TEXT,  -- JSON array: ["CA", "TX", "NY"]
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'trial', 'inactive')),
  trial_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settings TEXT  -- JSON object for provider-specific settings
);

-- Table: plugin_data_feeds
-- Individual data feeds from providers
CREATE TABLE IF NOT EXISTS plugin_data_feeds (
  feed_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  feed_name TEXT NOT NULL,
  feed_type TEXT NOT NULL CHECK(feed_type IN ('work_zone', 'incident', 'traffic_speed', 'travel_time', 'parking', 'weather', 'camera')),
  state_codes TEXT,  -- JSON array: ["CA", "NV"]
  endpoint_url TEXT,
  refresh_interval INTEGER DEFAULT 300,
  is_enabled BOOLEAN DEFAULT 1,
  last_updated TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id) ON DELETE CASCADE
);

-- Table: plugin_events
-- Traffic events submitted by plugins (WZDx format)
CREATE TABLE IF NOT EXISTS plugin_events (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  feed_id INTEGER,
  event_data TEXT NOT NULL,  -- JSON: Full WZDx event data
  event_type TEXT,
  state_code TEXT,
  latitude REAL,
  longitude REAL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id) ON DELETE CASCADE,
  FOREIGN KEY (feed_id) REFERENCES plugin_data_feeds(feed_id) ON DELETE CASCADE
);

-- Table: plugin_analytics
-- Usage and quality metrics for providers
CREATE TABLE IF NOT EXISTS plugin_analytics (
  analytics_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  metric_type TEXT NOT NULL,  -- api_calls, events_submitted, data_quality_score, etc.
  metric_value REAL NOT NULL,
  state_code TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT,  -- JSON object for additional context
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id) ON DELETE CASCADE
);

-- Table: plugin_access_tokens
-- API authentication tokens for providers
CREATE TABLE IF NOT EXISTS plugin_access_tokens (
  token_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  access_token TEXT NOT NULL UNIQUE,
  token_type TEXT DEFAULT 'api_key' CHECK(token_type IN ('api_key', 'oauth', 'jwt')),
  scopes TEXT,  -- JSON array: ["read", "write", "analytics"]
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT 1,
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id) ON DELETE CASCADE
);

-- Table: plugin_provider_interests
-- Track which states are interested in which providers
CREATE TABLE IF NOT EXISTS plugin_provider_interests (
  interest_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  state_code TEXT NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  status TEXT DEFAULT 'interested' CHECK(status IN ('interested', 'demo_requested', 'contract_signed', 'declined')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_plugin_events_provider ON plugin_events(provider_id);
CREATE INDEX IF NOT EXISTS idx_plugin_events_state ON plugin_events(state_code);
CREATE INDEX IF NOT EXISTS idx_plugin_events_time ON plugin_events(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_plugin_events_expires ON plugin_events(expires_at);
CREATE INDEX IF NOT EXISTS idx_plugin_analytics_provider ON plugin_analytics(provider_id);
CREATE INDEX IF NOT EXISTS idx_plugin_analytics_timestamp ON plugin_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_plugin_access_tokens_active ON plugin_access_tokens(is_active, expires_at);

-- Insert schema migration record
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('007_add_plugin_system', 'Add plugin system tables for third-party data providers', CURRENT_TIMESTAMP);
