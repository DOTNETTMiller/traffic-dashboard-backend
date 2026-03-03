/**
 * Import Additional BIM Bridge Files
 * Parses AASHTO and HRGreen IFC files and imports with V2X/AV tagging
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway',
  ssl: { rejectUnauthorized: false }
});

function parseIFCFile(filePath) {
  console.log(`\n📄 Parsing: ${path.basename(filePath)}`);
  console.log('─'.repeat(80));

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const data = {
    fileName: path.basename(filePath),
    name: null,
    route: null,
    county: null,
    city: null,
    state: null,
    district: null,
    latitude: null,
    longitude: null,
    stateplane: {
      easting: null,
      northing: null
    },
    crs: null,
    clearance: null,
    spans: null,
    supports: null,
    adt: null,
    designSpeed: null,
    postedSpeed: null,
    projectName: null
  };

  // Parse file line by line
  for (const line of lines) {
    // Project name
    if (line.includes('IFCPROJECT')) {
      const match = line.match(/,'([^']+)',/);
      if (match) data.projectName = match[1];
    }

    // Bridge name
    if (line.includes("IFCPROPERTYSINGLEVALUE('Name'") || line.includes('IFCBRIDGE')) {
      const match = line.match(/,'([^']+)',/);
      if (match && !data.name) data.name = match[1];
    }

    // GPS coordinates
    if (line.includes("IFCPROPERTYSINGLEVALUE('Latitude'")) {
      const match = line.match(/IFCREAL\(([-\d.]+)\)/);
      if (match) data.latitude = parseFloat(match[1]);
    }
    if (line.includes("IFCPROPERTYSINGLEVALUE('Longitude'")) {
      const match = line.match(/IFCREAL\(([-\d.]+)\)/);
      if (match) data.longitude = parseFloat(match[1]);
    }

    // State Plane
    if (line.includes('IFCCARTESIANPOINT')) {
      const match = line.match(/IFCCARTESIANPOINT\(\(([-\d.]+),([-\d.]+)/);
      if (match && !data.stateplane.easting) {
        data.stateplane.easting = parseFloat(match[1]);
        data.stateplane.northing = parseFloat(match[2]);
      }
    }

    // CRS
    if (line.includes('IFCPROJECTEDCRS')) {
      const match = line.match(/IFCPROJECTEDCRS\('([^']+)'/);
      if (match) data.crs = match[1];
    }

    // Location
    if (line.includes("IFCPROPERTYSINGLEVALUE('Route'")) {
      const match = line.match(/IFCTEXT\('([^']+)'\)/);
      if (match) data.route = match[1];
    }
    if (line.includes("IFCPROPERTYSINGLEVALUE('County'")) {
      const match = line.match(/IFCTEXT\('([^']+)'\)/);
      if (match) data.county = match[1];
    }
    if (line.includes("IFCPROPERTYSINGLEVALUE('City'") || line.includes("IFCPROPERTYSINGLEVALUE('Village'")) {
      const match = line.match(/IFCTEXT\('([^']+)'\)/);
      if (match) data.city = match[1];
    }
    if (line.includes("IFCPROPERTYSINGLEVALUE('State'")) {
      const match = line.match(/IFCTEXT\('([^']+)'\)/);
      if (match) data.state = match[1];
    }
    if (line.includes("IFCPROPERTYSINGLEVALUE('District'")) {
      const match = line.match(/IFCTEXT\('([^']+)'\)/);
      if (match) data.district = match[1];
    }

    // Bridge properties
    if (line.includes("MinimumVerticalClearance") || line.includes("'Clearance'")) {
      const match = line.match(/IFCREAL\(([\d.]+)\)/);
      if (match) data.clearance = parseFloat(match[1]);
    }
    if (line.includes("NumberOfSpans")) {
      const match = line.match(/IFCINTEGER\((\d+)\)/);
      if (match) data.spans = parseInt(match[1]);
    }
    if (line.includes("NumberOfSupports")) {
      const match = line.match(/IFCINTEGER\((\d+)\)/);
      if (match) data.supports = parseInt(match[1]);
    }
    if (line.includes("AverageDailyTraffic")) {
      const match = line.match(/IFCINTEGER\((\d+)\)/);
      if (match) data.adt = parseInt(match[1]);
    }
    if (line.includes("DesignSpeed")) {
      const match = line.match(/IFCINTEGER\((\d+)\)/);
      if (match) data.designSpeed = parseInt(match[1]);
    }
    if (line.includes("Posted") && line.includes("Speed")) {
      const match = line.match(/IFCREAL\(([\d.]+)\)/);
      if (match) data.postedSpeed = parseInt(match[1]);
    }
  }

  // Use project name as fallback
  if (!data.name) {
    data.name = data.projectName || path.basename(filePath, '.ifc');
  }

  return data;
}

async function importBridge(data) {
  // If no GPS coordinates, we can't map it
  if (!data.latitude || !data.longitude) {
    console.log('⚠️  No GPS coordinates found - skipping import');
    console.log('   (Bridge can still be added manually with coordinates)');
    return null;
  }

  console.log('\n✅ Found mappable bridge:');
  console.log(`   Name: ${data.name}`);
  console.log(`   Location: ${data.latitude}, ${data.longitude}`);
  if (data.route) console.log(`   Route: ${data.route}`);
  if (data.clearance) console.log(`   Clearance: ${data.clearance} ft`);

  const result = await pool.query(`
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
    RETURNING id
  `, [
    data.name,
    data.fileName,
    data.route,
    data.county,
    data.city,
    data.state,
    data.district,
    data.latitude,
    data.longitude,
    data.stateplane.easting,
    data.stateplane.northing,
    data.crs,
    data.spans,
    data.supports,
    data.clearance,
    data.postedSpeed,
    data.designSpeed,
    data.adt,
    true, // v2x_applicable
    true, // av_applicable
    ['clearance_monitoring', 'height_warning', 'oversize_routing'],
    ['hd_map_eligible', 'dynamic_routing', 'clearance_verification'],
    JSON.stringify(data)
  ]);

  console.log(`\n🎉 Imported successfully! (ID: ${result.rows[0].id})`);
  console.log('   🚦 V2X: clearance_monitoring, height_warning, oversize_routing');
  console.log('   🤖 AV: hd_map_eligible, dynamic_routing, clearance_verification');

  return result.rows[0].id;
}

async function main() {
  console.log('\n🌉 IMPORTING ADDITIONAL BIM BRIDGES');
  console.log('='.repeat(80));

  const files = [
    '/Users/mattmiller/Downloads/Aastho_IFC4.3 Bridge(Orginal Allplan Export).ifc',
    '/Users/mattmiller/Downloads/OBM_16080108_HRGreen_0322_18651_Z10.ifc'
  ];

  let imported = 0;
  let skipped = 0;

  for (const filePath of files) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`\n❌ File not found: ${path.basename(filePath)}`);
        skipped++;
        continue;
      }

      const data = parseIFCFile(filePath);
      const id = await importBridge(data);

      if (id) {
        imported++;
      } else {
        skipped++;
      }

    } catch (error) {
      console.error(`\n❌ Error processing file:`, error.message);
      skipped++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Imported: ${imported}`);
  console.log(`⚠️  Skipped: ${skipped}`);

  // Show all bridges now in database
  const result = await pool.query('SELECT name, route, city, state, latitude, longitude FROM bim_bridges ORDER BY name');
  console.log(`\n🌉 Total bridges in database: ${result.rows.length}`);
  for (const bridge of result.rows) {
    console.log(`   • ${bridge.name} - ${bridge.route || 'Unknown Route'} (${bridge.latitude}, ${bridge.longitude})`);
  }

  await pool.end();
  console.log('\n✅ Done!\n');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
