/**
 * Simple BIM Import - Load extracted BIM data into database
 * Uses the already-generated GeoJSON from parse_ifc_models.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway',
  ssl: { rejectUnauthorized: false }
});

async function createBIMTable() {
  console.log('🔧 Creating bim_bridges table for V2X/AV features...\n');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bim_bridges (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      file_name TEXT,

      -- Location
      route TEXT,
      county TEXT,
      city TEXT,
      state TEXT,
      district TEXT,

      -- GPS Coordinates
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,

      -- State Plane (for precise positioning)
      stateplane_easting DOUBLE PRECISION,
      stateplane_northing DOUBLE PRECISION,
      crs TEXT,

      -- Bridge Data
      spans INTEGER,
      supports INTEGER,
      clearance DOUBLE PRECISION, -- feet

      -- V2X/AV Critical Data
      posted_speed INTEGER, -- mph
      design_speed INTEGER, -- mph
      adt INTEGER, -- average daily traffic

      -- V2X/AV Tags
      v2x_applicable BOOLEAN DEFAULT true, -- All bridges are V2X-applicable (clearance warnings)
      av_applicable BOOLEAN DEFAULT true, -- All bridges are AV-applicable (route planning)
      v2x_features TEXT[] DEFAULT ARRAY['clearance_monitoring', 'height_warning', 'oversize_routing'],
      av_features TEXT[] DEFAULT ARRAY['hd_map_eligible', 'dynamic_routing', 'clearance_verification'],

      -- Full Properties
      properties JSONB,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_bim_bridges_latlon ON bim_bridges(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_bim_bridges_v2x ON bim_bridges(v2x_applicable) WHERE v2x_applicable = true;
    CREATE INDEX IF NOT EXISTS idx_bim_bridges_route ON bim_bridges(route);
  `);

  console.log('✅ bim_bridges table created\n');
}

async function importGeoJSON() {
  const geoJsonPath = path.join(__dirname, '../data/bim_models.geojson');
  console.log('📂 Reading GeoJSON:', geoJsonPath);

  const data = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));
  console.log(`📊 Found ${data.features.length} BIM bridges\n`);

  for (const feature of data.features) {
    const props = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;

    console.log(`🌉 Importing: ${props.name}`);

    await pool.query(`
      INSERT INTO bim_bridges (
        name, file_name, route, county, city, state, district,
        latitude, longitude,
        stateplane_easting, stateplane_northing, crs,
        spans, supports, clearance,
        posted_speed, design_speed, adt,
        v2x_applicable, av_applicable,
        v2x_features, av_features,
        properties
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9,
        $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20,
        $21, $22,
        $23
      )
      ON CONFLICT DO NOTHING
    `, [
      props.name,
      props.fileName,
      props.route,
      props.county,
      props.city,
      props.state,
      props.district,
      lat,
      lng,
      props.stateplane?.easting,
      props.stateplane?.northing,
      props.crs,
      props.spans,
      props.supports,
      props.clearance,
      props.postedSpeed,
      props.designSpeed,
      props.adt,
      true, // v2x_applicable
      true, // av_applicable
      ['clearance_monitoring', 'height_warning', 'oversize_routing'],
      ['hd_map_eligible', 'dynamic_routing', 'clearance_verification'],
      JSON.stringify(props)
    ]);

    console.log(`  ✅ ${props.route} - ${props.city}, ${props.county} County`);
    console.log(`  🚦 V2X: Clearance ${props.clearance} ft, ADT ${props.adt?.toLocaleString()}`);
    console.log(`  🤖 AV: Posted ${props.postedSpeed} mph, Design ${props.designSpeed} mph\n`);
  }
}

async function displayResults() {
  const result = await pool.query(`
    SELECT
      name, route, city, state,
      clearance, posted_speed, adt,
      array_length(v2x_features, 1) as v2x_feature_count,
      array_length(av_features, 1) as av_feature_count
    FROM bim_bridges
    ORDER BY name
  `);

  console.log('\n' + '='.repeat(80));
  console.log('📊 BIM BRIDGES LOADED WITH V2X/AV TAGGING');
  console.log('='.repeat(80));

  for (const row of result.rows) {
    console.log(`\n🌉 ${row.name}`);
    console.log(`   Route: ${row.route} - ${row.city}, ${row.state}`);
    console.log(`   Clearance: ${row.clearance} ft (⚠️  V2X Height Warning)`);
    console.log(`   ADT: ${row.adt?.toLocaleString()} vehicles/day`);
    console.log(`   Posted Speed: ${row.posted_speed} mph`);
    console.log(`   🚦 V2X Features: ${row.v2x_feature_count}`);
    console.log(`   🤖 AV Features: ${row.av_feature_count}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All BIM bridges are now tagged for V2X and AV applications!');
  console.log('='.repeat(80));
  console.log('\nNext: Query /api/bim/bridges?v2x=true to get V2X-tagged bridges\n');
}

async function main() {
  try {
    await createBIMTable();
    await importGeoJSON();
    await displayResults();
    await pool.end();
    console.log('✅ Import complete!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

main();
