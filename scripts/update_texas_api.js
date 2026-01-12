/**
 * Update Texas DOT API configuration to use DriveTexas WZDx feed
 * Run with: node scripts/update_texas_api.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'states.db');
const db = new sqlite3.Database(dbPath);

const TXDOT_API_URL = 'https://api.drivetexas.org/api/conditions.wzdx.geojson?key=e0f2b200-e528-48a8-97a9-a6adf7d12238';

console.log('🔧 Updating Texas DOT API configuration...');

db.run(`
  UPDATE states
  SET
    api_url = ?,
    state_name = 'Texas DOT',
    api_type = 'WZDx',
    format = 'geojson'
  WHERE state_key = 'tx'
`, [TXDOT_API_URL], function(err) {
  if (err) {
    console.error('❌ Error updating Texas configuration:', err);
    process.exit(1);
  }

  console.log(`✅ Updated ${this.changes} row(s)`);

  // Verify the update
  db.get('SELECT state_key, state_name, api_type FROM states WHERE state_key = ?', ['tx'], (err, row) => {
    if (err) {
      console.error('❌ Error verifying update:', err);
      db.close();
      process.exit(1);
    }

    console.log('📊 Current Texas configuration:', row);
    console.log('✅ Texas DOT API successfully configured');
    console.log('📍 Expected: 460+ interstate events (I-10, I-35, I-20, etc.)');

    db.close();
  });
});
