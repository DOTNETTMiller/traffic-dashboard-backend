#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, '..', 'states.db');
const db = new Database(dbPath);

// Read the additional states regulations JSON
const regulationsPath = path.join(__dirname, 'additional_states_regulations.json');
const regulations = JSON.parse(fs.readFileSync(regulationsPath, 'utf-8'));

console.log('🚛 Populating Additional States OS/OW Regulations\n');

// Ensure the corridor_regulations table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS corridor_regulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    corridor TEXT NOT NULL,
    state_key TEXT NOT NULL UNIQUE,
    state_name TEXT NOT NULL,
    state_code TEXT NOT NULL,
    bounds TEXT,
    legal_limits TEXT NOT NULL,
    permitted_limits TEXT NOT NULL,
    max_dimensions TEXT NOT NULL,
    permit_costs TEXT,
    color TEXT,
    requirements TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log('✅ Table schema verified\n');

// Prepare insert statement (SQLite doesn't support INSERT ... ON CONFLICT for non-unique columns)
const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO corridor_regulations (
    corridor, state_key, state_name, state_code,
    bounds_start_lat, bounds_start_lng, bounds_end_lat, bounds_end_lng,
    legal_single_axle, legal_tandem_axle, legal_tridem_axle, legal_gvw,
    permitted_single_axle, permitted_tandem_axle, permitted_tridem_axle,
    max_length_ft, max_width_ft, max_height_ft,
    permit_cost_data, color, requirements
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Insert each state's regulations
let inserted = 0;
let updated = 0;

regulations.forEach(reg => {
  const exists = db.prepare('SELECT id FROM corridor_regulations WHERE state_key = ?').get(reg.state_key);

  const result = insertStmt.run(
    reg.corridor,
    reg.state_key,
    reg.state_name,
    reg.state_code,
    reg.bounds?.start_lat || null,
    reg.bounds?.start_lng || null,
    reg.bounds?.end_lat || null,
    reg.bounds?.end_lng || null,
    reg.legal_limits.single_axle,
    reg.legal_limits.tandem_axle,
    reg.legal_limits.tridem_axle || reg.legal_limits.tridem_axle_8ft || null,
    reg.legal_limits.gross_vehicle_weight,
    reg.permitted_limits.single_axle,
    reg.permitted_limits.tandem_axle,
    reg.permitted_limits.tridem_axle,
    reg.max_dimensions.length_ft,
    reg.max_dimensions.width_ft,
    reg.max_dimensions.height_ft,
    JSON.stringify(reg.permit_costs),
    reg.color,
    JSON.stringify(reg.requirements)
  );

  if (exists) {
    console.log(`  ✏️  Updated: ${reg.state_name}`);
    updated++;
  } else {
    console.log(`  ➕ Inserted: ${reg.state_name}`);
    inserted++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`   New records: ${inserted}`);
console.log(`   Updated records: ${updated}`);
console.log(`   Total states in database: ${db.prepare('SELECT COUNT(*) as count FROM corridor_regulations').get().count}\n`);

// Verify the data
console.log('🔍 Verification:');
const allStates = db.prepare('SELECT state_name, state_code, corridor FROM corridor_regulations ORDER BY corridor, state_name').all();
allStates.forEach(state => {
  console.log(`   ${state.corridor.padEnd(12)} - ${state.state_code.padEnd(3)} ${state.state_name}`);
});

db.close();
console.log('\n✅ Additional states regulations populated successfully!');
