-- Migration: Add CIVIC (Civil Infrastructure Verification & Interoperability Coalition) Support
-- Purpose: Enable Matter-like infrastructure IoT device management
-- Date: 2025-12-28

-- =============================================================================
-- CIVIC Device Registry
-- =============================================================================
CREATE TABLE IF NOT EXISTS civic_devices (
  id SERIAL PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,              -- UUID or MAC-based unique ID
  device_type TEXT NOT NULL,                    -- 'rsu', 'dms', 'camera', 'weather_sensor', 'parking_sensor'
  manufacturer TEXT,                            -- 'Kapsch', 'Daktronics', 'Axis', 'Vaisala'
  model TEXT,
  firmware_version TEXT,

  -- Installation & Location
  installed_date TIMESTAMP,
  location_lat DOUBLE PRECISION,
  location_lon DOUBLE PRECISION,
  corridor TEXT,
  milepost DOUBLE PRECISION,
  state_key TEXT,

  -- Certification (Infrastructure-Specific)
  certification_authority TEXT,                 -- 'FHWA', 'State DOT', 'Testing Lab'
  certification_level TEXT,                     -- 'production', 'pilot', 'experimental'
  certification_issued TIMESTAMP,
  certification_expires TIMESTAMP,
  certification_scope TEXT,                     -- JSON array of capabilities

  -- Data Quality Tier (From NODE Model)
  data_quality_tier TEXT DEFAULT 'validated',  -- 'official_dot', 'commercial_validated', 'crowdsource'
  expected_accuracy TEXT,                       -- '±2 meters', '±0.5°F'
  calibration_schedule TEXT,                    -- 'annual', 'quarterly'
  last_calibration TIMESTAMP,
  sla_uptime REAL,                             -- 99.9% uptime guarantee

  -- Access Control (From NODE API Key Model)
  owner_organization TEXT NOT NULL,
  public_access BOOLEAN DEFAULT TRUE,
  commercial_access BOOLEAN DEFAULT TRUE,
  research_access BOOLEAN DEFAULT TRUE,
  data_sharing_agreement_url TEXT,

  -- Status
  active BOOLEAN DEFAULT TRUE,
  online_status BOOLEAN DEFAULT FALSE,
  last_heartbeat TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_civic_devices_type ON civic_devices(device_type);
CREATE INDEX IF NOT EXISTS idx_civic_devices_corridor ON civic_devices(corridor);
CREATE INDEX IF NOT EXISTS idx_civic_devices_location ON civic_devices(location_lat, location_lon);
CREATE INDEX IF NOT EXISTS idx_civic_devices_active ON civic_devices(active);

-- =============================================================================
-- CIVIC Device Observations (Time-Series Data)
-- =============================================================================
CREATE TABLE IF NOT EXISTS civic_observations (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  observation_type TEXT NOT NULL,               -- 'temperature', 'traffic_speed', 'parking_occupancy', etc.
  observation_data TEXT NOT NULL,               -- JSON with type-specific data

  -- Data Quality (Individual Observation Level)
  confidence_score REAL DEFAULT 0.5,            -- From NODE provenance model
  validation_status TEXT DEFAULT 'unvalidated', -- 'validated', 'suspicious', 'rejected'

  -- Provenance Chain
  sensor_id TEXT,                                -- Which sensor on the device
  processing_pipeline TEXT,                      -- 'kalman_filter_v2', 'ai_model_v3'
  cross_validated_with TEXT,                     -- JSON array of other sources

  -- Timestamp
  observation_timestamp TIMESTAMP NOT NULL,
  received_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (device_id) REFERENCES civic_devices(device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_civic_obs_device ON civic_observations(device_id, observation_timestamp);
CREATE INDEX IF NOT EXISTS idx_civic_obs_type ON civic_observations(observation_type);
CREATE INDEX IF NOT EXISTS idx_civic_obs_time ON civic_observations(observation_timestamp);

-- =============================================================================
-- CIVIC-Matter Bridge Mappings
-- =============================================================================
CREATE TABLE IF NOT EXISTS civic_matter_mappings (
  id SERIAL PRIMARY KEY,
  civic_device_id TEXT NOT NULL,
  matter_device_type TEXT NOT NULL,             -- Translated Matter device type
  matter_friendly_name TEXT NOT NULL,
  matter_capabilities TEXT,                      -- JSON array: ['notifications', 'automation_triggers']

  -- Mapping Configuration
  observation_mapping TEXT,                      -- JSON: which CIVIC observations map to which Matter states
  notification_rules TEXT,                       -- JSON: when to trigger Matter notifications
  automation_triggers TEXT,                      -- JSON: conditions for triggering automations

  -- Status
  active BOOLEAN DEFAULT TRUE,
  last_sync TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (civic_device_id) REFERENCES civic_devices(device_id) ON DELETE CASCADE
);

-- =============================================================================
-- CIVIC Device Capabilities (What Each Device Can Do)
-- =============================================================================
CREATE TABLE IF NOT EXISTS civic_device_capabilities (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  capability_name TEXT NOT NULL,                -- 'bsm', 'tim', 'spat', 'temperature_sensing', etc.
  capability_version TEXT,                       -- 'SAE J2735 2016', 'NTCIP 1203 v3'
  enabled BOOLEAN DEFAULT TRUE,

  -- Performance Metrics
  success_rate_30d REAL,                        -- % successful operations
  latency_ms_avg REAL,                          -- Average response time

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (device_id) REFERENCES civic_devices(device_id) ON DELETE CASCADE,
  UNIQUE(device_id, capability_name)
);

-- =============================================================================
-- CIVIC Data Quality Metrics (Daily Rollups)
-- =============================================================================
CREATE TABLE IF NOT EXISTS civic_quality_metrics (
  id SERIAL PRIMARY KEY,
  device_id TEXT NOT NULL,
  metric_date DATE NOT NULL,

  -- Observation Counts
  total_observations INTEGER DEFAULT 0,
  validated_observations INTEGER DEFAULT 0,
  rejected_observations INTEGER DEFAULT 0,

  -- Quality Scores
  avg_confidence_score REAL,
  min_confidence_score REAL,
  max_confidence_score REAL,

  -- Uptime
  expected_observations INTEGER,                 -- Based on device configuration
  actual_observations INTEGER,
  uptime_percentage REAL,

  -- Cross-Validation
  cross_validated_count INTEGER DEFAULT 0,      -- How many observations were cross-checked
  cross_validation_agreement_rate REAL,         -- % that agreed with other sources

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (device_id) REFERENCES civic_devices(device_id) ON DELETE CASCADE,
  UNIQUE(device_id, metric_date)
);

-- =============================================================================
-- Sample CIVIC Devices (For Demonstration)
-- =============================================================================

-- Weather Sensor on I-80
INSERT INTO civic_devices (
  device_id, device_type, manufacturer, model,
  location_lat, location_lon, corridor, milepost, state_key,
  certification_authority, certification_level,
  certification_issued, certification_expires,
  data_quality_tier, expected_accuracy,
  owner_organization, active
) VALUES (
  'civic-weather-i80-mm142',
  'weather_sensor',
  'Vaisala',
  'DST111',
  41.5868, -93.6091,
  'I-80', 142.3, 'ia',
  'FHWA',
  'production',
  '2025-01-01', '2026-12-31',
  'official_dot',
  '±0.5°F temperature, ±2% humidity',
  'Iowa DOT',
  TRUE
) ON CONFLICT (device_id) DO NOTHING;

-- Roadside Unit (RSU) on I-80
INSERT INTO civic_devices (
  device_id, device_type, manufacturer, model,
  location_lat, location_lon, corridor, milepost, state_key,
  certification_authority, certification_level,
  data_quality_tier,
  owner_organization, active
) VALUES (
  'civic-rsu-i80-mm145',
  'rsu',
  'Kapsch',
  'RSU-4000',
  41.5920, -93.5850,
  'I-80', 145.0, 'ia',
  'FHWA',
  'production',
  'official_dot',
  'Iowa DOT',
  TRUE
) ON CONFLICT (device_id) DO NOTHING;

-- Parking Sensor on I-80
INSERT INTO civic_devices (
  device_id, device_type, manufacturer, model,
  location_lat, location_lon, corridor, milepost, state_key,
  certification_authority, certification_level,
  data_quality_tier,
  owner_organization, active
) VALUES (
  'civic-parking-i80-mm140',
  'parking_sensor',
  'SmartCity Inc',
  'ParkSense-200',
  41.5800, -93.6200,
  'I-80', 140.0, 'ia',
  'Iowa DOT',
  'pilot',
  'commercial_validated',
  'Iowa DOT + SmartCity Partnership',
  TRUE
) ON CONFLICT (device_id) DO NOTHING;

-- Add capabilities for RSU
INSERT INTO civic_device_capabilities (device_id, capability_name, capability_version)
VALUES
  ('civic-rsu-i80-mm145', 'bsm', 'SAE J2735-2016'),
  ('civic-rsu-i80-mm145', 'tim', 'SAE J2735-2016'),
  ('civic-rsu-i80-mm145', 'spat', 'SAE J2735-2016')
ON CONFLICT (device_id, capability_name) DO NOTHING;

-- Add Matter bridge mapping for weather sensor
INSERT INTO civic_matter_mappings (
  civic_device_id, matter_device_type, matter_friendly_name,
  matter_capabilities, observation_mapping, notification_rules
) VALUES (
  'civic-weather-i80-mm142',
  'infrastructure_sensor',
  'I-80 Weather Conditions',
  '["notifications", "automation_triggers"]',
  '{"temperature": "temperature", "road_condition": "state"}',
  '{"ice_detected": {"condition": "road_surface == ice", "severity": "high"}}'
) ON CONFLICT DO NOTHING;

-- =============================================================================
-- Schema Migration Tracking
-- =============================================================================
INSERT INTO schema_migrations (migration_name, applied_at)
VALUES ('add_civic_infrastructure_iot', CURRENT_TIMESTAMP)
ON CONFLICT (migration_name) DO NOTHING;
