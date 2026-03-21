/**
 * Setup script for IPAWS audit log table
 * Creates the table if it doesn't exist (works with both SQLite and PostgreSQL)
 */

const db = require('./database');

async function setupIPAWSTable() {
  console.log('\n🔧 Setting up IPAWS audit log table...');

  try {
    // Check if we're using PostgreSQL or SQLite
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      console.log('  Using PostgreSQL database');

      // PostgreSQL version
      const sql = `
        -- IPAWS Alert Audit Log (LIGHTWEIGHT VERSION - PostgreSQL)
        CREATE TABLE IF NOT EXISTS ipaws_alert_log_lite (
          id SERIAL PRIMARY KEY,
          alert_id TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          alert_data JSONB NOT NULL,
          geofence_data JSONB,
          channels TEXT DEFAULT 'WEA',
          status TEXT DEFAULT 'draft',
          issued_at TIMESTAMP,
          cancelled_at TIMESTAMP,
          cancellation_reason TEXT,
          duration_minutes INTEGER,
          sop_version TEXT DEFAULT '2024-v1'
        );

        CREATE INDEX IF NOT EXISTS idx_ipaws_lite_alert_id ON ipaws_alert_log_lite(alert_id);
        CREATE INDEX IF NOT EXISTS idx_ipaws_lite_status ON ipaws_alert_log_lite(status);
        CREATE INDEX IF NOT EXISTS idx_ipaws_lite_created ON ipaws_alert_log_lite(created_at);
      `;

      await db.db.execAsync(sql);
    } else {
      console.log('  Using SQLite database');

      // SQLite version
      const sql = `
        CREATE TABLE IF NOT EXISTS ipaws_alert_log_lite (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alert_id TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          alert_data TEXT NOT NULL,
          geofence_data TEXT,
          channels TEXT DEFAULT 'WEA',
          status TEXT DEFAULT 'draft',
          issued_at DATETIME,
          cancelled_at DATETIME,
          cancellation_reason TEXT,
          duration_minutes INTEGER,
          sop_version TEXT DEFAULT '2024-v1'
        );

        CREATE INDEX IF NOT EXISTS idx_ipaws_lite_alert_id ON ipaws_alert_log_lite(alert_id);
        CREATE INDEX IF NOT EXISTS idx_ipaws_lite_status ON ipaws_alert_log_lite(status);
        CREATE INDEX IF NOT EXISTS idx_ipaws_lite_created ON ipaws_alert_log_lite(created_at);
      `;

      db.db.exec(sql);
    }

    console.log('✅ IPAWS audit log table ready');
    return true;
  } catch (err) {
    console.error('❌ Failed to setup IPAWS table:', err.message);
    console.warn('⚠️  IPAWS audit logging may not work, but the application will continue');
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  setupIPAWSTable()
    .then(() => {
      console.log('\n✅ Setup complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Setup failed:', err);
      process.exit(1);
    });
}

module.exports = setupIPAWSTable;
