-- BIM Infrastructure Table for V2X and AV Applications
-- Stores bridge, roadway, and infrastructure data from IFC/BIM models

CREATE TABLE IF NOT EXISTS bim_infrastructure (
  id SERIAL PRIMARY KEY,

  -- Identification
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  ifc_type TEXT, -- BRIDGE, ROADWAY, INTERCHANGE, etc.

  -- Location
  route TEXT,
  route_segment TEXT,
  route_offset TEXT,
  city TEXT,
  county TEXT,
  state TEXT,
  district TEXT,

  -- GPS Coordinates
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  geometry GEOMETRY(Point, 4326), -- PostGIS geometry for spatial queries

  -- State Plane Coordinates (for precise positioning)
  stateplane_easting DOUBLE PRECISION,
  stateplane_northing DOUBLE PRECISION,
  coordinate_system TEXT, -- e.g., "PA83-NF", "EPSG:6563"

  -- V2X/AV Critical Data
  vertical_clearance DOUBLE PRECISION, -- feet
  posted_speed INTEGER, -- mph
  design_speed INTEGER, -- mph
  number_of_lanes INTEGER,
  lane_width DOUBLE PRECISION, -- feet
  average_daily_traffic INTEGER,
  truck_traffic_percentage DOUBLE PRECISION,

  -- Bridge-Specific
  number_of_spans INTEGER,
  number_of_supports INTEGER,
  bridge_length DOUBLE PRECISION,

  -- Roadway-Specific (for corridor models)
  lane_configurations JSONB, -- detailed lane data
  shoulder_width DOUBLE PRECISION,
  median_type TEXT,
  surface_type TEXT,

  -- V2X/AV Classification Tags
  v2x_applicable BOOLEAN DEFAULT false,
  av_applicable BOOLEAN DEFAULT false,
  v2x_features TEXT[], -- array of applicable features: clearance_monitoring, speed_advisory, etc.
  av_features TEXT[], -- array: hd_map_eligible, dynamic_routing, obstacle_detection, etc.
  criticality_score INTEGER, -- 1-10 score for V2X/AV importance

  -- Full IFC Data
  properties JSONB, -- all extracted properties
  raw_ifc_data TEXT, -- original IFC snippet if needed

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  imported_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Spatial index for geographic queries
CREATE INDEX IF NOT EXISTS idx_bim_infrastructure_geometry ON bim_infrastructure USING GIST (geometry);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_bim_infrastructure_route ON bim_infrastructure(route);
CREATE INDEX IF NOT EXISTS idx_bim_infrastructure_state ON bim_infrastructure(state);
CREATE INDEX IF NOT EXISTS idx_bim_infrastructure_type ON bim_infrastructure(ifc_type);
CREATE INDEX IF NOT EXISTS idx_bim_infrastructure_v2x ON bim_infrastructure(v2x_applicable) WHERE v2x_applicable = true;
CREATE INDEX IF NOT EXISTS idx_bim_infrastructure_av ON bim_infrastructure(av_applicable) WHERE av_applicable = true;

-- GIN index for JSONB properties and array tags
CREATE INDEX IF NOT EXISTS idx_bim_infrastructure_properties ON bim_infrastructure USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_bim_infrastructure_v2x_features ON bim_infrastructure USING GIN (v2x_features);
CREATE INDEX IF NOT EXISTS idx_bim_infrastructure_av_features ON bim_infrastructure USING GIN (av_features);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bim_infrastructure_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bim_infrastructure_updated_at
  BEFORE UPDATE ON bim_infrastructure
  FOR EACH ROW
  EXECUTE FUNCTION update_bim_infrastructure_updated_at();

-- View for V2X-applicable infrastructure
CREATE OR REPLACE VIEW v2x_infrastructure AS
SELECT
  id, name, ifc_type, route, state,
  latitude, longitude, geometry,
  vertical_clearance, posted_speed, design_speed,
  v2x_features, criticality_score,
  average_daily_traffic
FROM bim_infrastructure
WHERE v2x_applicable = true
ORDER BY criticality_score DESC;

-- View for AV-applicable infrastructure
CREATE OR REPLACE VIEW av_infrastructure AS
SELECT
  id, name, ifc_type, route, state,
  latitude, longitude, geometry,
  number_of_lanes, lane_width, lane_configurations,
  av_features, criticality_score,
  coordinate_system, stateplane_easting, stateplane_northing
FROM bim_infrastructure
WHERE av_applicable = true
ORDER BY criticality_score DESC;
