/**
 * Migration script: Update Texas to use DriveTexas WZDx API
 * This runs automatically on server startup
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./states.db');

console.log('🔧 Running Texas API migration...');

db.run(`
  UPDATE states
  SET
    api_url = 'https://api.drivetexas.org/api/conditions.wzdx.geojson',
    state_name = 'Texas DOT',
    api_type = 'WZDx',
    format = 'geojson'
  WHERE state_key = 'tx'
`, function(err) {
  if (err) {
    console.error('❌ Texas migration failed:', err);
  } else {
    console.log(`✅ Texas migration complete (${this.changes} rows updated)`);
  }
  db.close();
});
