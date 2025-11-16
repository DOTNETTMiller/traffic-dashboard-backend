const Database = require('better-sqlite3');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Determine which database to use
const USE_POSTGRES = process.env.DATABASE_URL ? true : false;

async function populateInterchanges() {
  console.log('🛣️  Populating interstate interchanges database...\n');

  // Load intersection data
  const dataPath = path.join(__dirname, 'interstate_intersections.json');
  const intersections = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log(`📊 Loaded ${intersections.length} interstate intersections\n`);

  if (USE_POSTGRES) {
    await populatePostgres(intersections);
  } else {
    await populateSQLite(intersections);
  }
}

async function populateSQLite(intersections) {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');
  const db = new Database(dbPath);

  try {
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='interchanges'
    `).get();

    if (!tableExists) {
      console.log('❌ Interchanges table does not exist in SQLite database');
      console.log('Please run database initialization first');
      return;
    }

    // Clear existing data - delete detour_alerts first to avoid foreign key constraint
    db.prepare('DELETE FROM detour_alerts').run();
    const deleteStmt = db.prepare('DELETE FROM interchanges');
    const deleteResult = deleteStmt.run();
    console.log(`🗑️  Cleared ${deleteResult.changes} existing interchanges\n`);

    // Prepare insert statement
    const insertStmt = db.prepare(`
      INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert all intersections
    const insert = db.transaction((intersections) => {
      for (const intersection of intersections) {
        insertStmt.run(
          intersection.name,
          intersection.state_key,
          intersection.corridor,
          intersection.latitude,
          intersection.longitude,
          intersection.watch_radius_km,
          intersection.notify_states,
          intersection.detour_message
        );
      }
    });

    insert(intersections);

    console.log(`✅ Successfully inserted ${intersections.length} interstate intersections into SQLite\n`);

    // Show summary by corridor
    const summary = db.prepare(`
      SELECT corridor, COUNT(*) as count
      FROM interchanges
      GROUP BY corridor
      ORDER BY count DESC
    `).all();

    console.log('📊 Intersection Summary by Corridor:');
    summary.forEach(row => {
      console.log(`   ${row.corridor}: ${row.count}`);
    });

    // Show summary by state
    const stateSummary = db.prepare(`
      SELECT state_key, COUNT(*) as count
      FROM interchanges
      GROUP BY state_key
      ORDER BY count DESC
    `).all();

    console.log('\n📍 By State:');
    stateSummary.forEach(row => {
      console.log(`   ${row.state_key}: ${row.count}`);
    });

    db.close();

  } catch (error) {
    console.error('❌ Error populating SQLite database:', error);
    db.close();
    throw error;
  }
}

async function populatePostgres(intersections) {
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
        WHERE table_name = 'interchanges'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Interchanges table does not exist in PostgreSQL database');
      console.log('Please run database initialization first');
      return;
    }

    // Clear existing data - delete detour_alerts first to avoid foreign key constraint
    await client.query('DELETE FROM detour_alerts');
    const deleteResult = await client.query('DELETE FROM interchanges');
    console.log(`🗑️  Cleared ${deleteResult.rowCount} existing interchanges\n`);

    // Insert all intersections
    let insertCount = 0;
    for (const intersection of intersections) {
      await client.query(`
        INSERT INTO interchanges (name, state_key, corridor, latitude, longitude, watch_radius_km, notify_states, detour_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        intersection.name,
        intersection.state_key,
        intersection.corridor,
        intersection.latitude,
        intersection.longitude,
        intersection.watch_radius_km,
        intersection.notify_states,
        intersection.detour_message
      ]);
      insertCount++;
    }

    console.log(`✅ Successfully inserted ${insertCount} interstate intersections into PostgreSQL\n`);

    // Show summary by corridor
    const summary = await client.query(`
      SELECT corridor, COUNT(*) as count
      FROM interchanges
      GROUP BY corridor
      ORDER BY count DESC
    `);

    console.log('📊 Intersection Summary by Corridor:');
    summary.rows.forEach(row => {
      console.log(`   ${row.corridor}: ${row.count}`);
    });

    // Show summary by state
    const stateSummary = await client.query(`
      SELECT state_key, COUNT(*) as count
      FROM interchanges
      GROUP BY state_key
      ORDER BY count DESC
    `);

    console.log('\n📍 By State:');
    stateSummary.rows.forEach(row => {
      console.log(`   ${row.state_key}: ${row.count}`);
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
  populateInterchanges()
    .then(() => {
      console.log('\n✅ Interchange population complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { populateInterchanges };
