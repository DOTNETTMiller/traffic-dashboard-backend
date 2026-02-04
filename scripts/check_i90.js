const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkI90() {
  try {
    const result = await pool.query(
      `SELECT name,
              jsonb_array_length(geometry->'coordinates') as point_count
       FROM corridors
       WHERE name LIKE 'I-90%'
       ORDER BY name`
    );

    console.log('\nI-90 Corridor Geometries:\n');
    result.rows.forEach(row => {
      console.log(`${row.name}: ${row.point_count} points`);
    });

    // Check for potential gaps by sampling coordinates
    const eb = await pool.query(
      `SELECT geometry->'coordinates' as coords
       FROM corridors
       WHERE name = 'I-90 EB'`
    );

    if (eb.rows.length > 0) {
      const coords = eb.rows[0].coords;
      console.log(`\nI-90 EB first 5 coords:`);
      for (let i = 0; i < Math.min(5, coords.length); i++) {
        console.log(`  ${i}: [${coords[i][0]}, ${coords[i][1]}]`);
      }

      console.log(`\nI-90 EB last 5 coords:`);
      for (let i = Math.max(0, coords.length - 5); i < coords.length; i++) {
        console.log(`  ${i}: [${coords[i][0]}, ${coords[i][1]}]`);
      }

      // Check for large gaps between consecutive points
      let maxGap = 0;
      let maxGapIndex = -1;
      let gapCount = 0;

      for (let i = 1; i < coords.length; i++) {
        const [lon1, lat1] = coords[i-1];
        const [lon2, lat2] = coords[i];
        const gap = Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));

        // Count gaps larger than 0.5 degrees (likely disconnected segments)
        if (gap > 0.5) {
          gapCount++;
        }

        if (gap > maxGap) {
          maxGap = gap;
          maxGapIndex = i;
        }
      }

      console.log(`\n=== Gap Analysis ===`);
      console.log(`Total points: ${coords.length}`);
      console.log(`Large gaps (>0.5 degrees): ${gapCount}`);
      console.log(`\nLargest gap: ${maxGap.toFixed(4)} degrees at index ${maxGapIndex}`);

      if (maxGapIndex > 0) {
        console.log(`  From: [${coords[maxGapIndex - 1][0]}, ${coords[maxGapIndex - 1][1]}]`);
        console.log(`  To:   [${coords[maxGapIndex][0]}, ${coords[maxGapIndex][1]}]`);
      }

      // Show a few more large gaps
      const largeGaps = [];
      for (let i = 1; i < coords.length; i++) {
        const [lon1, lat1] = coords[i-1];
        const [lon2, lat2] = coords[i];
        const gap = Math.sqrt(Math.pow(lon2 - lon1, 2) + Math.pow(lat2 - lat1, 2));
        if (gap > 0.5) {
          largeGaps.push({
            index: i,
            gap: gap,
            from: coords[i-1],
            to: coords[i]
          });
        }
      }

      if (largeGaps.length > 0) {
        console.log(`\nTop 10 largest gaps:`);
        largeGaps.sort((a, b) => b.gap - a.gap);
        largeGaps.slice(0, 10).forEach((g, i) => {
          console.log(`${i+1}. Index ${g.index}: ${g.gap.toFixed(4)}° - [${g.from[0].toFixed(2)}, ${g.from[1].toFixed(2)}] → [${g.to[0].toFixed(2)}, ${g.to[1].toFixed(2)}]`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkI90();
