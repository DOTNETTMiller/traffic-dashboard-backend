-- CADD Models Table
-- Stores uploaded CAD files (DXF, DWG, DGN) and extracted operational data

CREATE TABLE IF NOT EXISTS cadd_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_format TEXT NOT NULL, -- 'DXF', 'DWG', 'DGN'
  file_size INTEGER,
  file_path TEXT NOT NULL, -- Path to stored file

  -- Metadata
  cad_version TEXT, -- e.g., 'AutoCAD 2021', 'MicroStation V8'
  units TEXT, -- Drawing units (feet, meters, etc.)
  coordinate_system TEXT, -- State plane, UTM, etc.
  extents_min_x REAL,
  extents_min_y REAL,
  extents_max_x REAL,
  extents_max_y REAL,

  -- Project information
  project_name TEXT,
  project_location TEXT,
  corridor TEXT, -- Associated corridor (I-80, US-30, etc.)
  state TEXT, -- State abbreviation
  county TEXT,

  -- Extraction status
  extraction_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  extraction_started_at DATETIME,
  extraction_completed_at DATETIME,
  extraction_error TEXT,

  -- Extracted counts
  total_layers INTEGER DEFAULT 0,
  total_entities INTEGER DEFAULT 0,
  total_blocks INTEGER DEFAULT 0,
  its_equipment_count INTEGER DEFAULT 0,
  road_geometry_count INTEGER DEFAULT 0,
  traffic_devices_count INTEGER DEFAULT 0,

  -- Upload metadata
  uploaded_by TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,

  -- Full extraction data (JSON)
  extraction_data TEXT -- Stores full parsed data as JSON
);

-- CADD Layers Table
-- Stores individual layers from CAD files
CREATE TABLE IF NOT EXISTS cadd_layers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cadd_model_id INTEGER NOT NULL,
  layer_name TEXT NOT NULL,
  layer_color INTEGER,
  visible BOOLEAN DEFAULT 1,
  frozen BOOLEAN DEFAULT 0,
  entity_count INTEGER DEFAULT 0,

  -- Classification
  operational_category TEXT, -- 'ITS Equipment', 'Road Geometry', 'Traffic Control', 'Work Zone', etc.

  FOREIGN KEY (cadd_model_id) REFERENCES cadd_models(id) ON DELETE CASCADE
);

-- CADD Entities Table
-- Stores individual CAD entities (lines, polylines, blocks, text, etc.)
CREATE TABLE IF NOT EXISTS cadd_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cadd_model_id INTEGER NOT NULL,
  layer_id INTEGER,

  -- Entity info
  entity_type TEXT NOT NULL, -- 'LINE', 'POLYLINE', 'CIRCLE', 'TEXT', 'INSERT', etc.
  handle TEXT, -- CAD handle/reference

  -- Classification
  operational_category TEXT, -- 'ITS Equipment', 'Road Geometry', etc.
  equipment_type TEXT, -- 'Sign', 'Signal', 'Camera', 'DMS', etc. (for ITS)

  -- Geometry (stored as JSON)
  geometry TEXT NOT NULL, -- JSON: coordinates, vertices, etc.

  -- Location (for spatial queries)
  longitude REAL,
  latitude REAL,
  elevation REAL,

  -- Attributes
  block_name TEXT, -- For INSERT entities (symbols)
  text_content TEXT, -- For TEXT entities
  color INTEGER,
  line_weight INTEGER,

  FOREIGN KEY (cadd_model_id) REFERENCES cadd_models(id) ON DELETE CASCADE,
  FOREIGN KEY (layer_id) REFERENCES cadd_layers(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cadd_models_corridor ON cadd_models(corridor);
CREATE INDEX IF NOT EXISTS idx_cadd_models_state ON cadd_models(state);
CREATE INDEX IF NOT EXISTS idx_cadd_models_status ON cadd_models(extraction_status);
CREATE INDEX IF NOT EXISTS idx_cadd_layers_model ON cadd_layers(cadd_model_id);
CREATE INDEX IF NOT EXISTS idx_cadd_layers_category ON cadd_layers(operational_category);
CREATE INDEX IF NOT EXISTS idx_cadd_entities_model ON cadd_entities(cadd_model_id);
CREATE INDEX IF NOT EXISTS idx_cadd_entities_layer ON cadd_entities(layer_id);
CREATE INDEX IF NOT EXISTS idx_cadd_entities_category ON cadd_entities(operational_category);
CREATE INDEX IF NOT EXISTS idx_cadd_entities_type ON cadd_entities(equipment_type);
CREATE INDEX IF NOT EXISTS idx_cadd_entities_location ON cadd_entities(longitude, latitude);
