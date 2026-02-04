#!/usr/bin/env node

/**
 * Add direction_corrected column to events table to track which events
 * have had their direction fixed using bearing calculations
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addDirectionCorrectedColumn() {
  console.log('Adding direction_corrected column to events table...\n');

  try {
    // Add the column if it doesn't exist
    await pool.query(`
      ALTER TABLE events
      ADD COLUMN IF NOT EXISTS direction_corrected BOOLEAN DEFAULT FALSE;
    `);

    console.log('✅ Column added successfully');

    // Add an index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_events_direction_corrected
      ON events(direction_corrected)
      WHERE direction_corrected = true;
    `);

    console.log('✅ Index created successfully');

    // Check how many events already exist
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE direction_corrected = true) as corrected_count,
        COUNT(*) as total_count
      FROM events
    `);

    console.log(`\nCurrent status:`);
    console.log(`  Total events: ${result.rows[0].total_count}`);
    console.log(`  Direction corrected: ${result.rows[0].corrected_count}`);
    console.log(`  Not corrected: ${result.rows[0].total_count - result.rows[0].corrected_count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addDirectionCorrectedColumn();
}

module.exports = { addDirectionCorrectedColumn };
