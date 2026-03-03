#!/usr/bin/env node

/**
 * Clear Corrupted Geometries Script
 *
 * Deletes all geometries from event_geometries table to force fresh enrichment
 */

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:SqymvRjWoiitTNUpEyHZoJOKRPcVHusW@nozomi.proxy.rlwy.net:48537/railway";

async function clearCorruptedGeometries() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');

    // Get count before deletion
    const countResult = await pool.query('SELECT COUNT(*) FROM event_geometries');
    const beforeCount = parseInt(countResult.rows[0].count);
    console.log(`Found ${beforeCount} geometries in database`);

    // Delete all geometries
    console.log('\nDeleting all geometries to force fresh enrichment...');
    const deleteResult = await pool.query('DELETE FROM event_geometries');
    console.log(`✅ Deleted ${deleteResult.rowCount} geometries`);

    // Verify deletion
    const verifyResult = await pool.query('SELECT COUNT(*) FROM event_geometries');
    const afterCount = parseInt(verifyResult.rows[0].count);
    console.log(`Remaining geometries: ${afterCount}`);

    console.log('\n✅ Database cleared successfully!');
    console.log('Restart the Railway service to force fresh enrichment.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  clearCorruptedGeometries();
}
