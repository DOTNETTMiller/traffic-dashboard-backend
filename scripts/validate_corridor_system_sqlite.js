/**
 * SQLite version of corridor validation
 * Validates interstate geometries in local SQLite database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'states.db');
const db = new sqlite3.Database(dbPath);

// Expected 33 major US interstates
const EXPECTED_INTERSTATES = {
  'I-5': { orientation: 'NS' },
  'I-8': { orientation: 'EW' },
  'I-10': { orientation: 'EW' },
  'I-15': { orientation: 'NS' },
  'I-20': { orientation: 'EW' },
  'I-25': { orientation: 'NS' },
  'I-30': { orientation: 'EW' },
  'I-35': { orientation: 'NS' },
  'I-40': { orientation: 'EW' },
  'I-44': { orientation: 'EW' },
  'I-45': { orientation: 'NS' },
  'I-55': { orientation: 'NS' },
  'I-57': { orientation: 'NS' },
  'I-59': { orientation: 'NS' },
  'I-64': { orientation: 'EW' },
  'I-65': { orientation: 'NS' },
  'I-66': { orientation: 'EW' },
  'I-69': { orientation: 'NS' },
  'I-70': { orientation: 'EW' },
  'I-71': { orientation: 'NS' },
  'I-74': { orientation: 'EW' },
  'I-75': { orientation: 'NS' },
  'I-76': { orientation: 'EW' },
  'I-77': { orientation: 'NS' },
  'I-78': { orientation: 'EW' },
  'I-79': { orientation: 'NS' },
  'I-80': { orientation: 'EW' },
  'I-81': { orientation: 'NS' },
  'I-84': { orientation: 'EW' },
  'I-85': { orientation: 'NS' },
  'I-90': { orientation: 'EW' },
  'I-94': { orientation: 'EW' },
  'I-95': { orientation: 'NS' }
};

function validateGeometry(geometry) {
  const issues = [];

  if (!geometry || geometry.type !== 'LineString') {
    issues.push('Invalid geometry type');
    return issues;
  }

  const coords = geometry.coordinates;

  if (!coords || coords.length < 2) {
    issues.push('Insufficient points');
    return issues;
  }

  // Check coordinate validity
  for (let i = 0; i < Math.min(coords.length, 5); i++) {
    const [lon, lat] = coords[i];
    if (lon < -180 || lon > 180) issues.push(`Invalid longitude: ${lon}`);
    if (lat < -90 || lat > 90) issues.push(`Invalid latitude: ${lat}`);
  }

  // Check point density
  if (coords.length < 20) issues.push(`Low density (${coords.length} points)`);
  if (coords.length > 500) issues.push(`High density (${coords.length} points)`);

  return issues;
}

async function validate() {
  console.log('🔍 Validating Interstate Corridor System (SQLite)\n');

  return new Promise((resolve, reject) => {
    db.all('SELECT corridor, direction, geometry, updated_at FROM interstate_geometries', [], (err, rows) => {
      if (err) {
        console.error('❌ Database error:', err);
        reject(err);
        return;
      }

      console.log(`📊 Found ${rows.length} interstate corridor records in database\n`);
      console.log('='.repeat(70));
      console.log('TEST 1: INTERSTATE COVERAGE');
      console.log('='.repeat(70));

      // Group by interstate
      const corridorsByInterstate = {};
      for (const row of rows) {
        const match = row.corridor.match(/^(I-\d+)/);
        if (match) {
          const interstate = match[1];
          if (!corridorsByInterstate[interstate]) {
            corridorsByInterstate[interstate] = [];
          }
          corridorsByInterstate[interstate].push(row);
        }
      }

      let coveragePassed = 0;
      let coverageFailed = 0;
      const missing = [];

      for (const [interstate, info] of Object.entries(EXPECTED_INTERSTATES)) {
        const found = corridorsByInterstate[interstate];

        if (!found || found.length === 0) {
          console.log(`❌ MISSING: ${interstate} (${info.orientation})`);
          coverageFailed++;
          missing.push(interstate);
        } else {
          const directions = found.map(c => c.direction).join(', ');
          console.log(`✅ FOUND: ${interstate} (${directions})`);
          coveragePassed++;
        }
      }

      console.log('');
      console.log(`Coverage: ${coveragePassed}/${Object.keys(EXPECTED_INTERSTATES).length} interstates`);
      console.log('');

      if (rows.length === 0) {
        console.log('⚠️  NO GEOMETRIES FOUND');
        console.log('');
        console.log('📋 RECOMMENDATION:');
        console.log('   The interstate_geometries table is empty.');
        console.log('   To populate with all 33 US interstates, run the fetch script on Railway:');
        console.log('');
        console.log('   railway run node scripts/fetch_all_interstate_geometries.js');
        console.log('');
        console.log('   This will:');
        console.log('   - Fetch geometry from OpenStreetMap for 33 major interstates');
        console.log('   - Create separate records for each direction (EB/WB or NB/SB)');
        console.log('   - Take approximately 10-15 minutes');
        console.log('   - Create ~66 corridor records (33 interstates × 2 directions)');
        console.log('   - Use 100% free APIs (OSM Overpass)');
        console.log('');
        db.close();
        resolve(1);
        return;
      }

      console.log('='.repeat(70));
      console.log('TEST 2: GEOMETRY VALIDATION');
      console.log('='.repeat(70));

      let geomPassed = 0;
      let geomFailed = 0;

      for (const row of rows) {
        try {
          const geometry = JSON.parse(row.geometry);
          const issues = validateGeometry(geometry);

          if (issues.length === 0) {
            const points = geometry.coordinates?.length || 0;
            console.log(`✅ ${row.corridor} ${row.direction}: Valid (${points} points)`);
            geomPassed++;
          } else {
            console.log(`❌ ${row.corridor} ${row.direction}:`);
            for (const issue of issues) {
              console.log(`   - ${issue}`);
            }
            geomFailed++;
          }
        } catch (e) {
          console.log(`❌ ${row.corridor} ${row.direction}: Invalid JSON geometry`);
          geomFailed++;
        }
      }

      console.log('');
      console.log(`Geometry: ${geomPassed}/${rows.length} corridors valid`);
      console.log('');

      console.log('='.repeat(70));
      console.log('OVERALL ASSESSMENT');
      console.log('='.repeat(70));

      const totalTests = coveragePassed + coverageFailed + geomPassed + geomFailed;
      const totalPassed = coveragePassed + geomPassed;
      const passRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

      console.log(`Pass Rate: ${passRate}% (${totalPassed}/${totalTests} tests passed)`);
      console.log('');

      let exitCode = 0;
      if (passRate >= 95) {
        console.log('✅ OVERALL: EXCELLENT - System is in great shape!');
      } else if (passRate >= 80) {
        console.log('✅ OVERALL: GOOD - Minor issues to address');
      } else if (passRate >= 60) {
        console.log('⚠️  OVERALL: FAIR - Several issues need attention');
        exitCode = 1;
      } else {
        console.log('❌ OVERALL: POOR - Significant issues detected');
        exitCode = 1;
      }

      console.log('');

      if (missing.length > 0) {
        console.log('📋 MISSING INTERSTATES:');
        console.log(`   ${missing.join(', ')}`);
        console.log('');
      }

      db.close();
      resolve(exitCode);
    });
  });
}

// Run validation
validate()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('Validation error:', error);
    process.exit(2);
  });
