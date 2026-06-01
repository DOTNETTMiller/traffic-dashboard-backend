-- Historical crash records for the I-80 / I-35 corridors (NHTSA FARS).
-- SQLite variant. The crash-data-service also creates this table on first run
-- (ensureTable), so running this migration is optional but documents the schema.

CREATE TABLE IF NOT EXISTS crash_records (
  id TEXT PRIMARY KEY,              -- FARS-<year>-<stateFips>-<ST_CASE>
  st_case TEXT NOT NULL,
  year INTEGER NOT NULL,
  state_fips INTEGER NOT NULL,
  state TEXT,
  county TEXT,
  corridor TEXT NOT NULL,           -- 'I-80' | 'I-35'
  latitude REAL,
  longitude REAL,
  work_zone INTEGER DEFAULT 0,      -- 0 none, 1 construction, 2 maintenance, 3 utility, 4 unknown
  work_zone_name TEXT,
  fatals INTEGER DEFAULT 0,
  commercial_vehicle INTEGER DEFAULT 0,  -- 1 if a large truck (BODY_TYP 60-79) or motor carrier was involved
  tway_id TEXT,
  source TEXT DEFAULT 'FARS',
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_crash_corridor ON crash_records(corridor);
CREATE INDEX IF NOT EXISTS idx_crash_year ON crash_records(year);
CREATE INDEX IF NOT EXISTS idx_crash_state ON crash_records(state);
