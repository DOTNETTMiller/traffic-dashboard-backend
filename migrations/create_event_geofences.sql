-- Event Geofences Table
-- Stores IPAWS geofences for events with population and override information

CREATE TABLE IF NOT EXISTS event_geofences (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) UNIQUE NOT NULL,
  geofence_geometry JSONB NOT NULL,
  population INTEGER NOT NULL,
  buffer_miles DECIMAL(4,2),
  override_population BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_geofences_event_id ON event_geofences(event_id);
CREATE INDEX IF NOT EXISTS idx_event_geofences_population ON event_geofences(population);
CREATE INDEX IF NOT EXISTS idx_event_geofences_override ON event_geofences(override_population);

COMMENT ON TABLE event_geofences IS 'IPAWS warning geofences saved for events';
COMMENT ON COLUMN event_geofences.event_id IS 'Event ID this geofence is associated with';
COMMENT ON COLUMN event_geofences.geofence_geometry IS 'GeoJSON polygon of the warning geofence';
COMMENT ON COLUMN event_geofences.population IS 'Estimated population within geofence';
COMMENT ON COLUMN event_geofences.buffer_miles IS 'Buffer distance in miles used to generate geofence';
COMMENT ON COLUMN event_geofences.override_population IS 'Whether 5,000 population threshold was overridden for adequate warning coverage';
