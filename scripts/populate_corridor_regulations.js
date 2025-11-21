const Database = require('better-sqlite3');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Determine which database to use
const USE_POSTGRES = process.env.DATABASE_URL ? true : false;

async function populateCorridorRegulations() {
  console.log('🛣️  Populating corridor regulations database...\n');

  // Load regulation data
  const dataPath = path.join(__dirname, 'i35_corridor_regulations.json');
  const regulations = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log(`📊 Loaded ${regulations.length} corridor regulation entries\n`);

  if (USE_POSTGRES) {
    await populatePostgres(regulations);
  } else {
    await populateSQLite(regulations);
  }
}

async function populateSQLite(regulations) {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');
  const db = new Database(dbPath);

  try {
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='corridor_regulations'
    `).get();

    if (!tableExists) {
      console.log('❌ Corridor regulations table does not exist in SQLite database');
      console.log('Please restart the server to initialize the schema');
      return;
    }

    // Clear existing data
    const deleteStmt = db.prepare('DELETE FROM corridor_regulations');
    const deleteResult = deleteStmt.run();
    console.log(`🗑️  Cleared ${deleteResult.changes} existing corridor regulations\n`);

    // Prepare insert statement
    const insertStmt = db.prepare(`
      INSERT INTO corridor_regulations (
        corridor, state_key, state_name, state_code,
        bounds_start_lat, bounds_start_lng, bounds_end_lat, bounds_end_lng,
        legal_single_axle, legal_tandem_axle, legal_tridem_axle, legal_gvw,
        permitted_single_axle, permitted_tandem_axle, permitted_tridem_axle,
        max_length_ft, max_width_ft, max_height_ft,
        permit_cost_data, requirements, color
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert all regulations
    const insert = db.transaction((regulations) => {
      for (const reg of regulations) {
        insertStmt.run(
          reg.corridor,
          reg.state_key,
          reg.state_name,
          reg.state_code,
          reg.bounds.start_lat,
          reg.bounds.start_lng,
          reg.bounds.end_lat,
          reg.bounds.end_lng,
          reg.legal_limits.single_axle,
          reg.legal_limits.tandem_axle,
          reg.legal_limits.tridem_axle,
          reg.legal_limits.gross_vehicle_weight,
          reg.permitted_limits.single_axle,
          reg.permitted_limits.tandem_axle,
          reg.permitted_limits.tridem_axle,
          reg.max_dimensions.length_ft,
          reg.max_dimensions.width_ft,
          reg.max_dimensions.height_ft,
          JSON.stringify(reg.permit_costs),
          JSON.stringify(reg.requirements),
          reg.color
        );
      }
    });

    insert(regulations);

    console.log(`✅ Successfully inserted ${regulations.length} corridor regulations into SQLite\n`);

    // Show summary
    const summary = db.prepare(`
      SELECT corridor, state_name, max_height_ft, max_width_ft
      FROM corridor_regulations
      ORDER BY id ASC
    `).all();

    console.log('📊 Corridor Regulations Summary:');
    summary.forEach(row => {
      console.log(`   ${row.corridor} - ${row.state_name}: ${row.max_height_ft}' H × ${row.max_width_ft}' W`);
    });

    db.close();

  } catch (error) {
    console.error('❌ Error populating SQLite database:', error);
    db.close();
    throw error;
  }
}

async function populatePostgres(regulations) {
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
        WHERE table_name = 'corridor_regulations'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Corridor regulations table does not exist in PostgreSQL database');
      console.log('Please restart the server to initialize the schema');
      return;
    }

    // Clear existing data
    const deleteResult = await client.query('DELETE FROM corridor_regulations');
    console.log(`🗑️  Cleared ${deleteResult.rowCount} existing corridor regulations\n`);

    // Insert all regulations
    let insertCount = 0;
    for (const reg of regulations) {
      await client.query(`
        INSERT INTO corridor_regulations (
          corridor, state_key, state_name, state_code,
          bounds_start_lat, bounds_start_lng, bounds_end_lat, bounds_end_lng,
          legal_single_axle, legal_tandem_axle, legal_tridem_axle, legal_gvw,
          permitted_single_axle, permitted_tandem_axle, permitted_tridem_axle,
          max_length_ft, max_width_ft, max_height_ft,
          permit_cost_data, requirements, color
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      `, [
        reg.corridor,
        reg.state_key,
        reg.state_name,
        reg.state_code,
        reg.bounds.start_lat,
        reg.bounds.start_lng,
        reg.bounds.end_lat,
        reg.bounds.end_lng,
        reg.legal_limits.single_axle,
        reg.legal_limits.tandem_axle,
        reg.legal_limits.tridem_axle,
        reg.legal_limits.gross_vehicle_weight,
        reg.permitted_limits.single_axle,
        reg.permitted_limits.tandem_axle,
        reg.permitted_limits.tridem_axle,
        reg.max_dimensions.length_ft,
        reg.max_dimensions.width_ft,
        reg.max_dimensions.height_ft,
        JSON.stringify(reg.permit_costs),
        JSON.stringify(reg.requirements),
        reg.color
      ]);
      insertCount++;
    }

    console.log(`✅ Successfully inserted ${insertCount} corridor regulations into PostgreSQL\n`);

    // Show summary
    const summary = await client.query(`
      SELECT corridor, state_name, max_height_ft, max_width_ft
      FROM corridor_regulations
      ORDER BY id ASC
    `);

    console.log('📊 Corridor Regulations Summary:');
    summary.rows.forEach(row => {
      console.log(`   ${row.corridor} - ${row.state_name}: ${row.max_height_ft}' H × ${row.max_width_ft}' W`);
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
  populateCorridorRegulations()
    .then(() => {
      console.log('\n✅ Corridor regulations population complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

module.exports = { populateCorridorRegulations };
