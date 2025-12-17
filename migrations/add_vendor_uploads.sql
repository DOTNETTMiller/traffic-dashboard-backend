-- Vendor Upload System
-- Supports file uploads, truck parking data (ATRI), and segment data enrichment

-- Table: vendor_uploads
-- Tracks all file uploads from vendors
CREATE TABLE IF NOT EXISTS vendor_uploads (
  upload_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,

  -- File metadata
  filename TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,  -- 'csv', 'json', 'excel', etc.
  file_path TEXT,  -- Server storage path

  -- Upload details
  data_type TEXT NOT NULL,  -- 'truck_parking', 'traffic', 'incidents', 'weather', etc.
  upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uploaded_by TEXT,

  -- Processing status
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
  rows_processed INTEGER DEFAULT 0,
  rows_failed INTEGER DEFAULT 0,
  error_log TEXT,

  -- Metadata
  notes TEXT,
  tags TEXT,  -- JSON array

  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id)
);

-- Table: truck_parking_data
-- Stores truck parking availability data from ATRI and other vendors
CREATE TABLE IF NOT EXISTS truck_parking_data (
  parking_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  upload_id INTEGER,  -- Links to vendor_uploads

  -- Location
  facility_name TEXT,
  facility_id TEXT,
  state_code TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  exit_number TEXT,
  mile_marker REAL,

  -- Capacity
  total_spaces INTEGER,
  available_spaces INTEGER,
  occupied_spaces INTEGER,
  reserved_spaces INTEGER,

  -- Facility details
  facility_type TEXT,  -- 'rest_area', 'truck_stop', 'private_lot', 'weigh_station', etc.
  amenities TEXT,  -- JSON array: ['restrooms', 'fuel', 'food', 'wifi', etc.]
  security_features TEXT,  -- JSON array

  -- Timing
  timestamp TIMESTAMP NOT NULL,
  is_real_time BOOLEAN DEFAULT 0,
  forecast_time TEXT,  -- For predicted availability

  -- Operational
  is_open BOOLEAN DEFAULT 1,
  hours_of_operation TEXT,
  restrictions TEXT,  -- JSON: weight limits, vehicle types, etc.

  -- Pricing
  is_paid BOOLEAN DEFAULT 0,
  hourly_rate REAL,
  daily_rate REAL,

  -- Quality metrics
  confidence_score REAL,  -- AI model confidence (0-1)
  data_quality_score REAL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id),
  FOREIGN KEY (upload_id) REFERENCES vendor_uploads(upload_id)
);

-- Table: segment_enrichment_data
-- Vendor-provided enrichment data for road segments
CREATE TABLE IF NOT EXISTS segment_enrichment_data (
  enrichment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  upload_id INTEGER,

  -- Segment identification
  segment_id TEXT,
  corridor_id TEXT,
  state_code TEXT,
  route_name TEXT,  -- 'I-10', 'US-50', etc.

  -- Geometry
  start_latitude REAL,
  start_longitude REAL,
  end_latitude REAL,
  end_longitude REAL,
  start_mile_marker REAL,
  end_mile_marker REAL,
  length_miles REAL,

  -- Enrichment data (JSON fields for flexibility)
  traffic_data TEXT,  -- JSON: speed, volume, occupancy, etc.
  safety_data TEXT,   -- JSON: crash history, risk scores, etc.
  infrastructure_data TEXT,  -- JSON: lane count, surface type, etc.
  weather_data TEXT,  -- JSON: historical weather impacts
  economic_data TEXT,  -- JSON: freight value, employment centers, etc.

  -- Temporal
  data_date DATE,
  time_period TEXT,  -- 'peak', 'off_peak', 'weekend', etc.

  -- Metadata
  data_source TEXT,
  confidence_score REAL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id),
  FOREIGN KEY (upload_id) REFERENCES vendor_uploads(upload_id)
);

-- Table: ai_model_predictions
-- Stores predictions from truck parking AI model
CREATE TABLE IF NOT EXISTS ai_model_predictions (
  prediction_id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Location
  facility_id TEXT,
  state_code TEXT,
  latitude REAL,
  longitude REAL,

  -- Prediction
  predicted_availability INTEGER,  -- Number of available spaces
  predicted_occupancy_rate REAL,  -- 0-1
  prediction_time TIMESTAMP NOT NULL,
  prediction_horizon_hours INTEGER,  -- How far ahead (1, 2, 4, 8, 24 hours)

  -- Model details
  model_version TEXT,
  confidence_score REAL,
  features_used TEXT,  -- JSON: list of features that influenced prediction

  -- Input data sources
  input_data_providers TEXT,  -- JSON: which vendors contributed
  historical_data_count INTEGER,

  -- Validation (populated later when actual data available)
  actual_availability INTEGER,
  actual_occupancy_rate REAL,
  prediction_error REAL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: vendor_api_usage
-- Track vendor API usage and quotas
CREATE TABLE IF NOT EXISTS vendor_api_usage (
  usage_id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,

  -- Usage metrics
  api_endpoint TEXT,
  request_count INTEGER DEFAULT 0,
  upload_count INTEGER DEFAULT 0,
  data_volume_mb REAL DEFAULT 0,

  -- Time period
  usage_date DATE NOT NULL,
  hour_of_day INTEGER,

  -- Quota tracking
  monthly_quota_limit INTEGER,
  monthly_usage_current INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (provider_id) REFERENCES plugin_providers(provider_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_uploads_provider ON vendor_uploads(provider_id);
CREATE INDEX IF NOT EXISTS idx_vendor_uploads_status ON vendor_uploads(status);
CREATE INDEX IF NOT EXISTS idx_vendor_uploads_date ON vendor_uploads(upload_date);

CREATE INDEX IF NOT EXISTS idx_truck_parking_location ON truck_parking_data(state_code, latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_truck_parking_provider ON truck_parking_data(provider_id);
CREATE INDEX IF NOT EXISTS idx_truck_parking_timestamp ON truck_parking_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_truck_parking_facility ON truck_parking_data(facility_id);

CREATE INDEX IF NOT EXISTS idx_segment_enrichment_segment ON segment_enrichment_data(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_enrichment_corridor ON segment_enrichment_data(corridor_id);
CREATE INDEX IF NOT EXISTS idx_segment_enrichment_state ON segment_enrichment_data(state_code);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_facility ON ai_model_predictions(facility_id);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_time ON ai_model_predictions(prediction_time);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_location ON ai_model_predictions(state_code, latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON vendor_api_usage(provider_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON vendor_api_usage(usage_date);
