#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, '..', 'states.db');
const db = new Database(dbPath);

// Read the all states regulations JSON
const regulationsPath = path.join(__dirname, 'all_states_osow_regulations.json');
const regulations = JSON.parse(fs.readFileSync(regulationsPath, 'utf-8'));

console.log('🚛 Populating All 36 Remaining States OS/OW Regulations\n');

// Prepare insert statement
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
    console.log(`  ✏️  Updated: ${reg.state_name.padEnd(20)} (${reg.state_code})`);
    updated++;
  } else {
    console.log(`  ➕ Inserted: ${reg.state_name.padEnd(20)} (${reg.state_code})`);
    inserted++;
  }
});

console.log(`\n📊 Summary:`);
console.log(`   New records: ${inserted}`);
console.log(`   Updated records: ${updated}`);
console.log(`   Total states in database: ${db.prepare('SELECT COUNT(*) as count FROM corridor_regulations').get().count}\n`);

// Verify the data by corridor
console.log('🔍 Verification by Corridor:');
const byCorridor = db.prepare(`
  SELECT corridor, COUNT(*) as count
  FROM corridor_regulations
  GROUP BY corridor
  ORDER BY corridor
`).all();

byCorridor.forEach(c => {
  console.log(`   ${c.corridor.padEnd(15)}: ${c.count} states`);
});

console.log('\n📋 All States:');
const allStates = db.prepare('SELECT state_code, state_name, corridor FROM corridor_regulations ORDER BY state_name').all();
allStates.forEach((state, idx) => {
  if (idx % 3 === 0) process.stdout.write('\n   ');
  process.stdout.write(`${state.state_code.padEnd(3)} ${state.state_name.padEnd(20)}`);
});
console.log('\n');

db.close();
console.log('✅ All 36 states regulations populated successfully!');
