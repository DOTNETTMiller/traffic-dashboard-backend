/**
 * Check what interstate corridors are in the production database
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkInterstates() {
  console.log('🔍 Checking Production Interstate Corridors\n');

  try {
    // Count total interstate corridors
    const countResult = await pool.query(
      `SELECT COUNT(*) as count FROM corridors WHERE name LIKE 'I-%'`
    );
    console.log(`📊 Total Interstate Corridors: ${countResult.rows[0].count}\n`);

    // List all interstates
    const result = await pool.query(`
      SELECT
        name,
        description,
        jsonb_array_length(geometry->'coordinates') as points,
        updated_at
      FROM corridors
      WHERE name LIKE 'I-%'
      ORDER BY name
    `);

    console.log('='.repeat(80));
    console.log('INTERSTATE CORRIDORS IN PRODUCTION DATABASE');
    console.log('='.repeat(80));
    console.log(sprintf('%-15s %-10s %-60s', 'NAME', 'POINTS', 'UPDATED'));
    console.log('-'.repeat(80));

    const interstateGroups = {};
    for (const row of result.rows) {
      const interstate = row.name.match(/^(I-\d+)/)[1];
      if (!interstateGroups[interstate]) {
        interstateGroups[interstate] = [];
      }
      interstateGroups[interstate].push(row);

      const updatedDate = row.updated_at ? new Date(row.updated_at).toLocaleDateString() : 'N/A';
      console.log(sprintf('%-15s %-10s %-60s', row.name, row.points || 'N/A', updatedDate));
    }

    console.log('='.repeat(80));
    console.log(`\n📍 Unique Interstates: ${Object.keys(interstateGroups).length}`);
    console.log(`🛣️  Total Corridors (EB/WB or NB/SB): ${result.rows.length}\n`);

    // Show which interstates are present
    console.log('Interstates with data:');
    Object.keys(interstateGroups).sort().forEach(interstate => {
      const directions = interstateGroups[interstate].map(c => c.name.split(' ')[1]).join(', ');
      console.log(`  ✅ ${interstate} (${directions})`);
    });

    // Check for expected interstates
    const expectedInterstates = [
      'I-5', 'I-8', 'I-10', 'I-15', 'I-20', 'I-25', 'I-30', 'I-35', 'I-40', 'I-44', 'I-45',
      'I-55', 'I-57', 'I-59', 'I-64', 'I-65', 'I-66', 'I-69', 'I-70', 'I-71', 'I-74', 'I-75',
      'I-76', 'I-77', 'I-78', 'I-79', 'I-80', 'I-81', 'I-84', 'I-85', 'I-90', 'I-94', 'I-95'
    ];

    const missing = expectedInterstates.filter(i => !interstateGroups[i]);

    if (missing.length > 0) {
      console.log(`\n⚠️  Missing interstates (${missing.length}):`);
      missing.forEach(i => console.log(`  ❌ ${i}`));
    } else {
      console.log('\n✅ ALL 33 EXPECTED INTERSTATES ARE PRESENT!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Simple sprintf-like function
function sprintf(format, ...args) {
  let result = format;
  for (const arg of args) {
    result = result.replace(/%-?\d*s/, String(arg).padEnd(result.match(/%-?(\d+)s/)?.[1] || 0));
  }
  return result;
}

checkInterstates();
