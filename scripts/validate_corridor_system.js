/**
 * Comprehensive Validation Checks for Corridor System
 *
 * Validates:
 * - All required interstates present
 * - Geometry quality and completeness
 * - Directional coverage (EB/WB or NB/SB)
 * - Database integrity
 * - Update timestamps
 * - Coordinate validity
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

// All US Interstate highways (major routes)
const EXPECTED_INTERSTATES = {
  // Coast-to-coast (East-West)
  'I-10': { orientation: 'EW', states: ['CA', 'AZ', 'NM', 'TX', 'LA', 'MS', 'AL', 'FL'] },
  'I-20': { orientation: 'EW', states: ['TX', 'LA', 'MS', 'AL', 'GA', 'SC'] },
  'I-40': { orientation: 'EW', states: ['CA', 'AZ', 'NM', 'TX', 'OK', 'AR', 'TN', 'NC'] },
  'I-70': { orientation: 'EW', states: ['UT', 'CO', 'KS', 'MO', 'IL', 'IN', 'OH', 'WV', 'PA', 'MD'] },
  'I-80': { orientation: 'EW', states: ['CA', 'NV', 'UT', 'WY', 'NE', 'IA', 'IL', 'IN', 'OH', 'PA', 'NJ'] },
  'I-90': { orientation: 'EW', states: ['WA', 'ID', 'MT', 'WY', 'SD', 'MN', 'WI', 'IL', 'IN', 'OH', 'PA', 'NY', 'MA'] },

  // Border-to-border (North-South)
  'I-5': { orientation: 'NS', states: ['CA', 'OR', 'WA'] },
  'I-15': { orientation: 'NS', states: ['CA', 'NV', 'AZ', 'UT', 'ID', 'MT'] },
  'I-25': { orientation: 'NS', states: ['NM', 'CO', 'WY'] },
  'I-35': { orientation: 'NS', states: ['TX', 'OK', 'KS', 'MO', 'IA', 'MN'] },
  'I-55': { orientation: 'NS', states: ['LA', 'MS', 'TN', 'AR', 'MO', 'IL'] },
  'I-65': { orientation: 'NS', states: ['AL', 'TN', 'KY', 'IN'] },
  'I-75': { orientation: 'NS', states: ['FL', 'GA', 'TN', 'KY', 'OH', 'MI'] },
  'I-95': { orientation: 'NS', states: ['FL', 'GA', 'SC', 'NC', 'VA', 'MD', 'DE', 'PA', 'NJ', 'NY', 'CT', 'RI', 'MA', 'NH', 'ME'] },

  // Additional major routes
  'I-8': { orientation: 'EW', states: ['CA', 'AZ'] },
  'I-30': { orientation: 'EW', states: ['TX', 'AR'] },
  'I-44': { orientation: 'EW', states: ['TX', 'OK', 'MO'] },
  'I-45': { orientation: 'NS', states: ['TX'] },
  'I-57': { orientation: 'NS', states: ['IL', 'MO'] },
  'I-59': { orientation: 'NS', states: ['LA', 'MS', 'AL', 'GA'] },
  'I-64': { orientation: 'EW', states: ['MO', 'IL', 'IN', 'KY', 'WV', 'VA'] },
  'I-66': { orientation: 'EW', states: ['VA'] },
  'I-69': { orientation: 'NS', states: ['TX', 'MS', 'TN', 'KY', 'IN', 'MI'] },
  'I-71': { orientation: 'NS', states: ['KY', 'OH'] },
  'I-72': { orientation: 'EW', states: ['IL'] },
  'I-74': { orientation: 'EW', states: ['IA', 'IL', 'IN', 'OH'] },
  'I-76': { orientation: 'EW', states: ['CO', 'NE', 'OH', 'PA', 'NJ'] },
  'I-77': { orientation: 'NS', states: ['SC', 'NC', 'VA', 'WV', 'OH'] },
  'I-78': { orientation: 'EW', states: ['PA', 'NJ'] },
  'I-79': { orientation: 'NS', states: ['WV', 'PA'] },
  'I-81': { orientation: 'NS', states: ['TN', 'VA', 'WV', 'MD', 'PA', 'NY'] },
  'I-82': { orientation: 'EW', states: ['WA', 'OR'] },
  'I-83': { orientation: 'NS', states: ['MD', 'PA'] },
  'I-84': { orientation: 'EW', states: ['OR', 'ID', 'UT', 'PA', 'NY', 'CT', 'MA'] },
  'I-85': { orientation: 'NS', states: ['AL', 'GA', 'SC', 'NC', 'VA'] },
  'I-86': { orientation: 'EW', states: ['ID', 'NY', 'PA'] },
  'I-87': { orientation: 'NS', states: ['NY'] },
  'I-88': { orientation: 'EW', states: ['IL', 'NY'] },
  'I-89': { orientation: 'NS', states: ['VT', 'NH'] },
  'I-91': { orientation: 'NS', states: ['CT', 'MA', 'VT'] },
  'I-93': { orientation: 'NS', states: ['MA', 'NH', 'VT'] },
  'I-94': { orientation: 'EW', states: ['MT', 'ND', 'MN', 'WI', 'IL', 'IN', 'MI'] },
  'I-96': { orientation: 'EW', states: ['MI'] },
  'I-97': { orientation: 'NS', states: ['MD'] },
  'I-99': { orientation: 'NS', states: ['PA'] }
};

/**
 * Validate geometry coordinates
 */
function validateGeometry(geometry, corridorName) {
  const issues = [];

  if (!geometry || geometry.type !== 'LineString') {
    issues.push('Invalid geometry type (should be LineString)');
    return issues;
  }

  const coords = geometry.coordinates;

  if (!coords || coords.length < 2) {
    issues.push('Insufficient coordinate points (need at least 2)');
    return issues;
  }

  // Check coordinate validity
  for (let i = 0; i < coords.length; i++) {
    const [lon, lat] = coords[i];

    // Valid longitude: -180 to 180
    if (lon < -180 || lon > 180) {
      issues.push(`Invalid longitude at index ${i}: ${lon}`);
    }

    // Valid latitude: -90 to 90
    if (lat < -90 || lat > 90) {
      issues.push(`Invalid latitude at index ${i}: ${lat}`);
    }

    // US-specific bounds (continental + Alaska + Hawaii)
    if (lon < -180 || lon > -65 || lat < 18 || lat > 72) {
      // Outside reasonable US bounds
      if (i < 5) {
        issues.push(`Coordinate outside US bounds at index ${i}: [${lon}, ${lat}]`);
      }
    }
  }

  // Check for point density
  if (coords.length < 20) {
    issues.push(`Low point density (${coords.length} points) - may appear jagged`);
  }

  if (coords.length > 500) {
    issues.push(`High point density (${coords.length} points) - consider simplification`);
  }

  // Check for duplicate consecutive points
  let duplicates = 0;
  for (let i = 1; i < coords.length; i++) {
    if (coords[i][0] === coords[i-1][0] && coords[i][1] === coords[i-1][1]) {
      duplicates++;
    }
  }

  if (duplicates > coords.length * 0.1) {
    issues.push(`Many duplicate points (${duplicates}/${coords.length}) - needs deduplication`);
  }

  return issues;
}

/**
 * Main validation function
 */
async function validateCorridorSystem() {
  console.log('🔍 Validating Interstate Corridor System\n');

  const results = {
    coverage: { passed: 0, failed: 0, missing: [] },
    geometry: { passed: 0, failed: 0, issues: [] },
    directions: { passed: 0, failed: 0, issues: [] },
    timestamps: { passed: 0, failed: 0, issues: [] },
    overall: 'UNKNOWN'
  };

  try {
    // Get all corridors from database
    const corridorsResult = await pool.query(`
      SELECT
        id,
        name,
        description,
        geometry,
        bounds,
        created_at,
        updated_at
      FROM corridors
      WHERE name LIKE 'I-%'
      ORDER BY name
    `);

    const dbCorridors = corridorsResult.rows;
    console.log(`📊 Found ${dbCorridors.rows.length} interstate corridors in database\n`);

    // Group by interstate number
    const corridorsByInterstate = {};
    for (const corridor of dbCorridors) {
      const match = corridor.name.match(/^(I-\d+)/);
      if (match) {
        const interstate = match[1];
        if (!corridorsByInterstate[interstate]) {
          corridorsByInterstate[interstate] = [];
        }
        corridorsByInterstate[interstate].push(corridor);
      }
    }

    console.log('=' .repeat(70));
    console.log('TEST 1: INTERSTATE COVERAGE');
    console.log('='.repeat(70));

    // Check coverage
    for (const [interstate, info] of Object.entries(EXPECTED_INTERSTATES)) {
      const found = corridorsByInterstate[interstate];

      if (!found || found.length === 0) {
        console.log(`❌ MISSING: ${interstate} (${info.orientation}, ${info.states.length} states)`);
        results.coverage.failed++;
        results.coverage.missing.push(interstate);
      } else {
        const directions = found.map(c => c.name.split(' ').pop()).join(', ');
        console.log(`✅ FOUND: ${interstate} (${directions})`);
        results.coverage.passed++;
      }
    }

    console.log('');
    console.log(`Coverage: ${results.coverage.passed}/${Object.keys(EXPECTED_INTERSTATES).length} interstates`);
    console.log('');

    // Check for extra interstates (not in expected list)
    const extraInterstates = Object.keys(corridorsByInterstate).filter(
      i => !EXPECTED_INTERSTATES[i]
    );

    if (extraInterstates.length > 0) {
      console.log('ℹ️  Additional interstates found (not in expected list):');
      for (const interstate of extraInterstates) {
        console.log(`   - ${interstate}`);
      }
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('TEST 2: GEOMETRY VALIDATION');
    console.log('='.repeat(70));

    for (const corridor of dbCorridors) {
      const issues = validateGeometry(corridor.geometry, corridor.name);

      if (issues.length === 0) {
        console.log(`✅ ${corridor.name}: Valid geometry (${corridor.geometry?.coordinates?.length || 0} points)`);
        results.geometry.passed++;
      } else {
        console.log(`❌ ${corridor.name}: Geometry issues found`);
        for (const issue of issues) {
          console.log(`   - ${issue}`);
        }
        results.geometry.failed++;
        results.geometry.issues.push({ corridor: corridor.name, issues });
      }
    }

    console.log('');
    console.log(`Geometry: ${results.geometry.passed}/${dbCorridors.length} corridors valid`);
    console.log('');

    console.log('='.repeat(70));
    console.log('TEST 3: DIRECTIONAL COVERAGE');
    console.log('='.repeat(70));

    for (const [interstate, info] of Object.entries(EXPECTED_INTERSTATES)) {
      const corridors = corridorsByInterstate[interstate];

      if (!corridors || corridors.length === 0) continue;

      const expectedDirections = info.orientation === 'EW' ? ['EB', 'WB'] : ['NB', 'SB'];
      const foundDirections = corridors.map(c => {
        const parts = c.name.split(' ');
        return parts[parts.length - 1];
      });

      const hasAllDirections = expectedDirections.every(d => foundDirections.includes(d));

      if (hasAllDirections) {
        console.log(`✅ ${interstate}: Both directions present (${foundDirections.join(', ')})`);
        results.directions.passed++;
      } else if (foundDirections.length === 1 && !['EB', 'WB', 'NB', 'SB'].includes(foundDirections[0])) {
        console.log(`ℹ️  ${interstate}: Combined corridor (no directional split)`);
        results.directions.passed++;
      } else {
        console.log(`⚠️  ${interstate}: Missing direction(s) - Expected: ${expectedDirections.join(', ')}, Found: ${foundDirections.join(', ')}`);
        results.directions.failed++;
        results.directions.issues.push({ interstate, expected: expectedDirections, found: foundDirections });
      }
    }

    console.log('');
    console.log(`Directions: ${results.directions.passed}/${Object.keys(corridorsByInterstate).length} complete`);
    console.log('');

    console.log('='.repeat(70));
    console.log('TEST 4: UPDATE TIMESTAMPS');
    console.log('='.repeat(70));

    for (const corridor of dbCorridors) {
      if (!corridor.updated_at) {
        console.log(`⚠️  ${corridor.name}: No update timestamp`);
        results.timestamps.failed++;
        results.timestamps.issues.push({ corridor: corridor.name, issue: 'No timestamp' });
      } else {
        const age = Math.floor((new Date() - new Date(corridor.updated_at)) / (1000 * 60 * 60 * 24));
        if (age > 365) {
          console.log(`⚠️  ${corridor.name}: Very old (${age} days)`);
          results.timestamps.failed++;
          results.timestamps.issues.push({ corridor: corridor.name, issue: `${age} days old` });
        } else {
          console.log(`✅ ${corridor.name}: Updated ${age} days ago`);
          results.timestamps.passed++;
        }
      }
    }

    console.log('');
    console.log(`Timestamps: ${results.timestamps.passed}/${dbCorridors.length} current`);
    console.log('');

    // Overall assessment
    console.log('='.repeat(70));
    console.log('OVERALL ASSESSMENT');
    console.log('='.repeat(70));

    const totalTests = results.coverage.passed + results.coverage.failed +
                      results.geometry.passed + results.geometry.failed +
                      results.directions.passed + results.directions.failed +
                      results.timestamps.passed + results.timestamps.failed;

    const totalPassed = results.coverage.passed + results.geometry.passed +
                       results.directions.passed + results.timestamps.passed;

    const passRate = Math.round((totalPassed / totalTests) * 100);

    console.log(`Pass Rate: ${passRate}% (${totalPassed}/${totalTests} tests passed)`);
    console.log('');

    if (passRate >= 95) {
      results.overall = 'EXCELLENT';
      console.log('✅ OVERALL: EXCELLENT - System is in great shape!');
    } else if (passRate >= 80) {
      results.overall = 'GOOD';
      console.log('✅ OVERALL: GOOD - Minor issues to address');
    } else if (passRate >= 60) {
      results.overall = 'FAIR';
      console.log('⚠️  OVERALL: FAIR - Several issues need attention');
    } else {
      results.overall = 'POOR';
      console.log('❌ OVERALL: POOR - Significant issues detected');
    }

    console.log('');

    // Recommendations
    if (results.coverage.missing.length > 0) {
      console.log('📋 RECOMMENDATIONS:');
      console.log('');
      console.log(`Missing ${results.coverage.missing.length} interstates:`);
      console.log(`   ${results.coverage.missing.join(', ')}`);
      console.log('');
      console.log('   Run: railway run node scripts/fetch_all_interstate_geometries.js');
      console.log('');
    }

    if (results.geometry.failed > 0) {
      console.log(`${results.geometry.failed} corridors have geometry issues`);
      console.log('   Review geometry validation output above');
      console.log('');
    }

    if (results.timestamps.failed > 0) {
      console.log(`${results.timestamps.failed} corridors have outdated timestamps`);
      console.log('   Run: railway run node scripts/fetch_all_interstate_geometries.js');
      console.log('');
    }

    // Exit code based on overall assessment
    return results.overall === 'EXCELLENT' || results.overall === 'GOOD' ? 0 : 1;

  } catch (error) {
    console.error('\n❌ Validation error:', error);
    return 2;
  } finally {
    await pool.end();
  }
}

// Run
if (require.main === module) {
  validateCorridorSystem()
    .then(exitCode => process.exit(exitCode))
    .catch(error => {
      console.error(error);
      process.exit(2);
    });
}

module.exports = { validateCorridorSystem };
