const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  try {
    const result = await pool.query(`
      SELECT geometry
      FROM corridors
      WHERE name = 'I-80 Iowa Segment'
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const geom = result.rows[0].geometry;
      console.log('I-80 Iowa Segment geometry:');
      console.log('Type:', typeof geom);
      console.log('Has coordinates:', !!geom.coordinates);
      console.log('Coordinate count:', geom.coordinates?.length || 0);
      console.log('');
      console.log('First 5 coordinates:');
      geom.coordinates.slice(0, 5).forEach((coord, i) => {
        console.log(`  [${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}]`);
      });
      console.log('');
      console.log('Last 5 coordinates:');
      geom.coordinates.slice(-5).forEach((coord, i) => {
        console.log(`  [${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}]`);
      });
    } else {
      console.log('No I-80 Iowa Segment found');
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
