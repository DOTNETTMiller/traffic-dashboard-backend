// Test Minnesota event geometry issues
const { Pool } = require('pg');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function analyzeMinnesotaGeometry() {
  console.log('\n🔍 Analyzing Minnesota Event Geometry Issues\n');
  console.log('='.repeat(80));

  try {
    // Get Minnesota events with geometry
    const result = await pgPool.query(`
      SELECT
        id,
        type,
        corridor,
        location,
        description,
        latitude,
        longitude,
        geometry,
        ST_GeometryType(geometry) as geom_type,
        ST_NumPoints(geometry) as num_points,
        ST_Length(geography(geometry)) as length_meters
      FROM data_feeds
      WHERE state = 'MN'
        AND geometry IS NOT NULL
      ORDER BY length_meters DESC NULLS LAST
      LIMIT 50;
    `);

    console.log(`\nFound ${result.rows.length} Minnesota events with geometry\n`);

    // Analyze geometry issues
    const issues = {
      twoPointLongLines: [],
      emptyGeometry: [],
      straightLines: [],
      veryLongLines: []
    };

    result.rows.forEach(event => {
      const numPoints = event.num_points;
      const lengthMiles = event.length_meters ? event.length_meters / 1609.34 : 0;

      // Check for two-point long lines (> 0.5 miles)
      if (numPoints === 2 && lengthMiles > 0.5) {
        issues.twoPointLongLines.push({
          id: event.id,
          corridor: event.corridor,
          location: event.location,
          numPoints,
          lengthMiles: lengthMiles.toFixed(2),
          geomType: event.geom_type
        });
      }

      // Check for very long lines (> 50 miles)
      if (lengthMiles > 50) {
        issues.veryLongLines.push({
          id: event.id,
          corridor: event.corridor,
          location: event.location,
          numPoints,
          lengthMiles: lengthMiles.toFixed(2),
          geomType: event.geom_type
        });
      }

      // Check geometry source
      const geom = event.geometry;
      if (geom && geom.geometrySource === 'straight_line') {
        issues.straightLines.push({
          id: event.id,
          corridor: event.corridor,
          lengthMiles: lengthMiles.toFixed(2)
        });
      }
    });

    console.log('\n📊 GEOMETRY ISSUES SUMMARY:\n');

    console.log(`1. Two-point long lines (> 0.5 mi): ${issues.twoPointLongLines.length}`);
    if (issues.twoPointLongLines.length > 0) {
      console.log('\nTop 10 problematic two-point lines:');
      console.table(issues.twoPointLongLines.slice(0, 10));
    }

    console.log(`\n2. Very long lines (> 50 mi): ${issues.veryLongLines.length}`);
    if (issues.veryLongLines.length > 0) {
      console.log('\nVery long lines:');
      console.table(issues.veryLongLines.slice(0, 10));
    }

    console.log(`\n3. Straight line fallbacks: ${issues.straightLines.length}`);
    if (issues.straightLines.length > 0) {
      console.log('\nTop 10 straight line fallbacks:');
      console.table(issues.straightLines.slice(0, 10));
    }

    // Check for events with no description or location
    const emptyDataResult = await pgPool.query(`
      SELECT
        id,
        type,
        corridor,
        location,
        description,
        ST_NumPoints(geometry) as num_points
      FROM data_feeds
      WHERE state = 'MN'
        AND geometry IS NOT NULL
        AND (description IS NULL OR description = '' OR location IS NULL OR location = '')
      LIMIT 20;
    `);

    console.log(`\n4. Events with missing data: ${emptyDataResult.rows.length}`);
    if (emptyDataResult.rows.length > 0) {
      console.log('\nEvents missing description/location:');
      console.table(emptyDataResult.rows);
    }

    // Get total count and breakdown
    const statsResult = await pgPool.query(`
      SELECT
        COUNT(*) as total_mn_events,
        COUNT(geometry) as events_with_geometry,
        COUNT(CASE WHEN ST_NumPoints(geometry) = 2 THEN 1 END) as two_point_lines,
        COUNT(CASE WHEN ST_Length(geography(geometry)) > 804.672 THEN 1 END) as lines_over_half_mile
      FROM data_feeds
      WHERE state = 'MN';
    `);

    console.log('\n📈 MINNESOTA STATISTICS:');
    console.table(statsResult.rows);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Analysis complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pgPool.end();
  }
}

analyzeMinnesotaGeometry();
