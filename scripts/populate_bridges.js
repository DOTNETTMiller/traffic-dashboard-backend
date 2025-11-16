const Database = require('better-sqlite3');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Determine which database to use
const USE_POSTGRES = process.env.DATABASE_URL ? true : false;

async function populateBridges() {
  console.log('🌉 Populating bridge clearance database...\n');

  // Load bridge data
  const dataPath = path.join(__dirname, 'bridge_clearances.json');
  const bridges = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log(`📊 Loaded ${bridges.length} bridge clearances\n`);

  if (USE_POSTGRES) {
    await populatePostgres(bridges);
  } else {
    await populateSQLite(bridges);
  }
}

async function populateSQLite(bridges) {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');
  const db = new Database(dbPath);

  try {
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='bridge_clearances'
    `).get();

    if (!tableExists) {
      console.log('❌ Bridge clearances table does not exist in SQLite database');
      console.log('Please restart the server to initialize the schema');
      return;
    }

    // Clear existing data - delete warnings first to avoid foreign key constraint
    db.prepare('DELETE FROM bridge_clearance_warnings').run();
    const deleteStmt = db.prepare('DELETE FROM bridge_clearances');
    const deleteResult = deleteStmt.run();
    console.log(`🗑️  Cleared ${deleteResult.changes} existing bridge clearances\n`);

    // Prepare insert statement
    const insertStmt = db.prepare(`
      INSERT INTO bridge_clearances (
        bridge_name, route, state_key, latitude, longitude,
        clearance_feet, clearance_meters, direction, restriction_type,
        watch_radius_km, warning_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert all bridges
    const insert = db.transaction((bridges) => {
      for (const bridge of bridges) {
        insertStmt.run(
          bridge.bridge_name,
          bridge.route,
          bridge.state_key,
          bridge.latitude,
          bridge.longitude,
          bridge.clearance_feet,
          bridge.clearance_meters,
          bridge.direction,
          bridge.restriction_type,
          bridge.watch_radius_km,
          bridge.warning_message
        );
      }
    });

    insert(bridges);

    console.log(`✅ Successfully inserted ${bridges.length} bridge clearances into SQLite\n`);

    // Show summary by route
    const summary = db.prepare(`
      SELECT route, COUNT(*) as count, MIN(clearance_feet) as min_clearance
      FROM bridge_clearances
      GROUP BY route
      ORDER BY count DESC
    `).all();

    console.log('📊 Bridge Summary by Route:');
    summary.forEach(row => {
      console.log(`   ${row.route}: ${row.count} bridges (lowest: ${row.min_clearance}')`);
    });

    // Show summary by state
    const stateSummary = db.prepare(`
      SELECT state_key, COUNT(*) as count, MIN(clearance_feet) as min_clearance
      FROM bridge_clearances
      GROUP BY state_key
      ORDER BY count DESC
    `).all();

    console.log('\n📍 By State:');
    stateSummary.forEach(row => {
      console.log(`   ${row.state_key}: ${row.count} bridges (lowest: ${row.min_clearance}')`);
    });

    // Show critically low bridges (under 13'8")
    const lowBridges = db.prepare(`
      SELECT bridge_name, route, state_key, clearance_feet
      FROM bridge_clearances
      WHERE clearance_feet < 13.67
      ORDER BY clearance_feet ASC
    `).all();

    console.log('\n⚠️  CRITICAL Low Clearances (< 13\'8\"):');
    lowBridges.forEach(bridge => {
      console.log(`   ${bridge.bridge_name} (${bridge.route}, ${bridge.state_key}): ${bridge.clearance_feet}'`);
    });

    db.close();

  } catch (error) {
    console.error('❌ Error populating SQLite database:', error);
    db.close();
    throw error;
  }
}

async function populatePostgres(bridges) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();

    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'bridge_clearances'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Bridge clearances table does not exist in PostgreSQL database');
      console.log('Please restart the server to initialize the schema');
      return;
    }

    // Clear existing data - delete warnings first to avoid foreign key constraint
    await client.query('DELETE FROM bridge_clearance_warnings');
    const deleteResult = await client.query('DELETE FROM bridge_clearances');
    console.log(`🗑️  Cleared ${deleteResult.rowCount} existing bridge clearances\n`);

    // Insert all bridges
    let insertCount = 0;
    for (const bridge of bridges) {
      await client.query(`
        INSERT INTO bridge_clearances (
          bridge_name, route, state_key, latitude, longitude,
          clearance_feet, clearance_meters, direction, restriction_type,
          watch_radius_km, warning_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        bridge.bridge_name,
        bridge.route,
        bridge.state_key,
        bridge.latitude,
        bridge.longitude,
        bridge.clearance_feet,
        bridge.clearance_meters,
        bridge.direction,
        bridge.restriction_type,
        bridge.watch_radius_km,
        bridge.warning_message
      ]);
      insertCount++;
    }

    console.log(`✅ Successfully inserted ${insertCount} bridge clearances into PostgreSQL\n`);

    // Show summary by route
    const summary = await client.query(`
      SELECT route, COUNT(*) as count, MIN(clearance_feet) as min_clearance
      FROM bridge_clearances
      GROUP BY route
      ORDER BY count DESC
    `);

    console.log('📊 Bridge Summary by Route:');
    summary.rows.forEach(row => {
      console.log(`   ${row.route}: ${row.count} bridges (lowest: ${row.min_clearance}')`);
    });

    // Show summary by state
    const stateSummary = await client.query(`
      SELECT state_key, COUNT(*) as count, MIN(clearance_feet) as min_clearance
      FROM bridge_clearances
      GROUP BY state_key
      ORDER BY count DESC
    `);

    console.log('\n📍 By State:');
    stateSummary.rows.forEach(row => {
      console.log(`   ${row.state_key}: ${row.count} bridges (lowest: ${row.min_clearance}')`);
    });

    // Show critically low bridges (under 13'8")
    const lowBridges = await client.query(`
      SELECT bridge_name, route, state_key, clearance_feet
      FROM bridge_clearances
      WHERE clearance_feet < 13.67
      ORDER BY clearance_feet ASC
    `);

    console.log('\n⚠️  CRITICAL Low Clearances (< 13\'8\"):');
    lowBridges.rows.forEach(bridge => {
      console.log(`   ${bridge.bridge_name} (${bridge.route}, ${bridge.state_key}): ${bridge.clearance_feet}'`);
    });

    await client.end();

  } catch (error) {
    console.error('❌ Error populating PostgreSQL database:', error);
    await client.end();
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  populateBridges()
    .then(() => {
      console.log('\n✅ Bridge clearance population complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { populateBridges };
