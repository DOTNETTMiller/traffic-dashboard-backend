/**
 * CADD Clearances Table
 *
 * Stores vertical and horizontal clearance information extracted from
 * AutoCAD DXF/DWG design files. Includes both CAD-extracted and field-verified
 * clearance measurements for bridges, overpasses, and roadway cross-sections.
 *
 * Clearance Types:
 * - vertical: Overhead clearance (bridges, overpasses, signs)
 * - horizontal: Lateral clearance (shoulders, clear zones)
 * - lane_width: Travel lane width
 * - shoulder_width: Shoulder width
 * - offset: Offset measurements
 * - dimension: Generic dimension from DIMENSION entities
 */

-- CADD Clearances Table
CREATE TABLE IF NOT EXISTS cadd_clearances (
  id SERIAL PRIMARY KEY,

  -- Model reference
  model_id INTEGER NOT NULL REFERENCES cadd_models(id) ON DELETE CASCADE,

  -- Clearance data
  clearance_type VARCHAR(50) NOT NULL, -- vertical, horizontal, lane_width, shoulder_width, offset, dimension
  value DECIMAL(10, 3) NOT NULL, -- Primary clearance value
  max_value DECIMAL(10, 3), -- Maximum value for ranges (e.g., "14'-0\" to 16'-6\"")
  units VARCHAR(20) DEFAULT 'feet', -- feet, inches, meters, unknown

  -- Source information
  text TEXT, -- Original CAD text (e.g., "VERT CLR 14'-6\"")
  layer VARCHAR(255), -- CAD layer name
  source VARCHAR(50) NOT NULL, -- 'text' or 'dimension'
  needs_field_verification BOOLEAN DEFAULT FALSE, -- Flag for field verification requirement
  field_verified BOOLEAN DEFAULT FALSE, -- Has this been field-verified?
  field_verified_date DATE, -- Date of field verification
  field_verified_by VARCHAR(255), -- Person who verified
  field_verified_value DECIMAL(10, 3), -- Field-measured value (may differ from CAD)

  -- CAD coordinates (original State Plane or other system)
  cad_x DECIMAL(15, 3),
  cad_y DECIMAL(15, 3),
  cad_z DECIMAL(15, 3),

  -- WGS84 coordinates (georeferenced)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  georeferenced BOOLEAN DEFAULT FALSE,
  coordinate_system VARCHAR(100),

  -- Location context
  corridor VARCHAR(50), -- Route/corridor (e.g., I-80, US-30)
  state VARCHAR(2), -- State abbreviation
  county VARCHAR(100), -- County name
  milepost DECIMAL(10, 3), -- Milepost if available

  -- Associated features
  feature_type VARCHAR(100), -- bridge, overpass, sign_structure, tunnel, etc.
  feature_name VARCHAR(255), -- Name/ID of feature (e.g., "Bridge #123")
  feature_reference VARCHAR(255), -- External reference ID

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cadd_clearances_model_id ON cadd_clearances(model_id);
CREATE INDEX IF NOT EXISTS idx_cadd_clearances_type ON cadd_clearances(clearance_type);
CREATE INDEX IF NOT EXISTS idx_cadd_clearances_corridor ON cadd_clearances(corridor);
CREATE INDEX IF NOT EXISTS idx_cadd_clearances_state ON cadd_clearances(state);
CREATE INDEX IF NOT EXISTS idx_cadd_clearances_georeferenced ON cadd_clearances(georeferenced);
CREATE INDEX IF NOT EXISTS idx_cadd_clearances_needs_verification ON cadd_clearances(needs_field_verification);
CREATE INDEX IF NOT EXISTS idx_cadd_clearances_field_verified ON cadd_clearances(field_verified);

-- Spatial index (PostGIS)
-- CREATE INDEX IF NOT EXISTS idx_cadd_clearances_location ON cadd_clearances USING GIST (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326));

-- View: Clearances needing field verification
CREATE OR REPLACE VIEW cadd_clearances_needs_verification AS
SELECT
  c.*,
  m.original_filename,
  m.corridor AS model_corridor,
  m.state AS model_state,
  m.uploaded_at
FROM cadd_clearances c
JOIN cadd_models m ON c.model_id = m.id
WHERE c.needs_field_verification = TRUE
  AND c.field_verified = FALSE
  AND c.georeferenced = TRUE
ORDER BY c.corridor, c.milepost;

-- View: Vertical clearances by corridor
CREATE OR REPLACE VIEW cadd_vertical_clearances AS
SELECT
  c.id,
  c.corridor,
  c.state,
  c.milepost,
  c.value AS clearance_feet,
  c.max_value,
  c.feature_type,
  c.feature_name,
  c.latitude,
  c.longitude,
  c.field_verified,
  c.field_verified_value,
  c.needs_field_verification,
  m.original_filename
FROM cadd_clearances c
JOIN cadd_models m ON c.model_id = m.id
WHERE c.clearance_type = 'vertical'
  AND c.georeferenced = TRUE
ORDER BY c.corridor, c.milepost;

-- View: Lane and shoulder widths
CREATE OR REPLACE VIEW cadd_lane_geometrics AS
SELECT
  c.id,
  c.corridor,
  c.state,
  c.milepost,
  c.clearance_type AS measurement_type,
  c.value AS width_feet,
  c.latitude,
  c.longitude,
  m.original_filename
FROM cadd_clearances c
JOIN cadd_models m ON c.model_id = m.id
WHERE c.clearance_type IN ('lane_width', 'shoulder_width')
  AND c.georeferenced = TRUE
ORDER BY c.corridor, c.milepost, c.clearance_type;

-- View: Clearance discrepancies (CAD vs. field)
CREATE OR REPLACE VIEW cadd_clearance_discrepancies AS
SELECT
  c.id,
  c.corridor,
  c.state,
  c.milepost,
  c.clearance_type,
  c.value AS cad_value,
  c.field_verified_value,
  ABS(c.value - c.field_verified_value) AS discrepancy,
  ROUND((ABS(c.value - c.field_verified_value) / c.value) * 100, 2) AS discrepancy_percent,
  c.feature_type,
  c.feature_name,
  c.field_verified_date,
  c.field_verified_by
FROM cadd_clearances c
WHERE c.field_verified = TRUE
  AND c.field_verified_value IS NOT NULL
  AND ABS(c.value - c.field_verified_value) > 0.1 -- More than 0.1 feet difference
ORDER BY discrepancy DESC;

-- Comments
COMMENT ON TABLE cadd_clearances IS 'Vertical and horizontal clearance measurements extracted from CADD design files';
COMMENT ON COLUMN cadd_clearances.clearance_type IS 'Type of clearance: vertical, horizontal, lane_width, shoulder_width, offset, dimension';
COMMENT ON COLUMN cadd_clearances.needs_field_verification IS 'Flag indicating clearance should be field-verified (e.g., not from dedicated clearance layer)';
COMMENT ON COLUMN cadd_clearances.field_verified IS 'Has this clearance been verified by field measurement?';
COMMENT ON COLUMN cadd_clearances.field_verified_value IS 'Actual field-measured value (may differ from CAD)';
COMMENT ON COLUMN cadd_clearances.source IS 'Source entity type: text (TEXT/MTEXT) or dimension (DIMENSION)';
COMMENT ON VIEW cadd_clearances_needs_verification IS 'Clearances flagged for field verification';
COMMENT ON VIEW cadd_vertical_clearances IS 'All vertical clearances (overhead structures) by corridor';
COMMENT ON VIEW cadd_lane_geometrics IS 'Lane and shoulder width measurements';
COMMENT ON VIEW cadd_clearance_discrepancies IS 'Clearances with significant differences between CAD and field measurements';
