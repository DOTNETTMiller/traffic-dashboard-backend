/**
 * Automatic Interstate Polyline Update System
 *
 * This script:
 * 1. Checks if polylines are older than 90 days
 * 2. Automatically updates them if needed
 * 3. Can be run as a scheduled cron job
 *
 * Usage:
 *   Manual: node scripts/auto_update_polylines.js
 *   Cron (monthly): 0 0 1 * * node scripts/auto_update_polylines.js
 */

const { Pool } = require('pg');
const { spawn } = require('child_process');
const path = require('path');

const UPDATE_THRESHOLD_DAYS = 90;

async function runScript(scriptPath, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔄 Running: ${description}...`);

    const scriptName = path.basename(scriptPath);
    const child = spawn('node', [scriptPath], {
      env: { ...process.env },
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptName} completed successfully\n`);
        resolve();
      } else {
        console.log(`⚠️  ${scriptName} exited with code ${code}\n`);
        reject(new Error(`Script failed with code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.error(`❌ Failed to run ${scriptName}:`, err.message);
      reject(err);
    });
  });
}

async function checkAndUpdate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  AUTOMATIC INTERSTATE POLYLINE UPDATE SYSTEM                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  try {
    // Check I-80 polylines age
    console.log('📅 Checking polyline ages...\n');

    const i80Result = await pool.query(`
      SELECT id, updated_at,
             EXTRACT(DAY FROM (CURRENT_TIMESTAMP - updated_at)) as days_old
      FROM corridors
      WHERE id IN ('i-80-eb', 'i-80-wb')
      ORDER BY id
    `);

    const i35Result = await pool.query(`
      SELECT id, updated_at,
             EXTRACT(DAY FROM (CURRENT_TIMESTAMP - updated_at)) as days_old
      FROM corridors
      WHERE id IN ('i-35-nb', 'i-35-sb')
      ORDER BY id
    `);

    let needsUpdate = false;
    const updates = [];

    // Check I-80
    for (const row of i80Result.rows) {
      const daysOld = Math.floor(row.days_old);
      console.log(`  ${row.id}: ${daysOld} days old`);

      if (daysOld > UPDATE_THRESHOLD_DAYS) {
        console.log(`    ⚠️  Exceeds ${UPDATE_THRESHOLD_DAYS}-day threshold`);
        needsUpdate = true;
        if (!updates.includes('i-80')) updates.push('i-80');
      } else {
        console.log(`    ✅ Within threshold`);
      }
    }

    console.log('');

    // Check I-35
    for (const row of i35Result.rows) {
      const daysOld = Math.floor(row.days_old);
      console.log(`  ${row.id}: ${daysOld} days old`);

      if (daysOld > UPDATE_THRESHOLD_DAYS) {
        console.log(`    ⚠️  Exceeds ${UPDATE_THRESHOLD_DAYS}-day threshold`);
        needsUpdate = true;
        if (!updates.includes('i-35')) updates.push('i-35');
      } else {
        console.log(`    ✅ Within threshold`);
      }
    }

    console.log('\n────────────────────────────────────────────────────────────────\n');

    if (!needsUpdate) {
      console.log('✅ All polylines are up to date (less than 90 days old)');
      console.log('   No updates needed at this time.\n');
      await pool.end();
      return;
    }

    console.log('🔧 UPDATES NEEDED:');
    updates.forEach(corridor => console.log(`   • ${corridor.toUpperCase()}`));
    console.log('');

    // Update I-80 if needed
    if (updates.includes('i-80')) {
      console.log('════════════════════════════════════════════════════════════════');
      console.log('UPDATING I-80 POLYLINES');
      console.log('════════════════════════════════════════════════════════════════');

      try {
        await runScript(
          path.join(__dirname, 'build_interstate_polylines.js'),
          'Building I-80 polylines from OSM'
        );

        await runScript(
          path.join(__dirname, 'fix_i80_wb_sequence.js'),
          'Fixing I-80 WB sequence'
        );

        console.log('✅ I-80 update complete!\n');
      } catch (err) {
        console.error('❌ I-80 update failed:', err.message);
      }
    }

    // Update I-35 if needed
    if (updates.includes('i-35')) {
      console.log('════════════════════════════════════════════════════════════════');
      console.log('UPDATING I-35 POLYLINES');
      console.log('════════════════════════════════════════════════════════════════');

      try {
        await runScript(
          path.join(__dirname, 'fetch_i35_via_nominatim.js'),
          'Fetching I-35 base polylines'
        );

        await runScript(
          path.join(__dirname, 'complete_i35_iowa_minnesota.js'),
          'Adding Iowa and Minnesota segments'
        );

        console.log('✅ I-35 update complete!\n');
      } catch (err) {
        console.error('❌ I-35 update failed:', err.message);
      }
    }

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('✅ AUTOMATIC UPDATE COMPLETE');
    console.log('════════════════════════════════════════════════════════════════\n');

    await pool.end();

  } catch (err) {
    console.error('❌ Error during automatic update:', err.message);
    console.error(err);
    await pool.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  checkAndUpdate();
}

module.exports = { checkAndUpdate };
