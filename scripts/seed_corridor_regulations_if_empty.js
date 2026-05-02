/**
 * Idempotent seed for corridor_regulations table.
 * Only runs the full populate script if the table is empty — so deploys
 * don't repeatedly wipe and rewrite the same data, and any manual edits
 * to existing rows are preserved.
 */

const { Client } = require('pg');
const Database = require('better-sqlite3');
const path = require('path');

async function seedCorridorRegulationsIfEmpty() {
  const usePostgres = !!process.env.DATABASE_URL;

  try {
    if (usePostgres) {
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();

      // Does the table exist? (Schema initialization runs during server boot;
      // if we're called before that, just bail — the next deploy will catch up.)
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'corridor_regulations'
        )
      `);
      if (!tableExists.rows[0].exists) {
        await client.end();
        console.log('⏭️  corridor_regulations table not yet created — skipping NASCO seed');
        return;
      }

      const countRes = await client.query('SELECT COUNT(*) FROM corridor_regulations');
      const count = parseInt(countRes.rows[0].count, 10);
      await client.end();

      if (count > 0) {
        console.log(`⏭️  corridor_regulations already has ${count} rows — skipping NASCO seed`);
        return;
      }
    } else {
      // SQLite — quick check.
      const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'states.db');
      let db;
      try { db = new Database(dbPath, { readonly: true, fileMustExist: true }); }
      catch { console.log('⏭️  SQLite db not found — skipping NASCO seed'); return; }

      try {
        const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='corridor_regulations'`).get();
        if (!row) { db.close(); console.log('⏭️  corridor_regulations table not yet created — skipping NASCO seed'); return; }

        const count = db.prepare('SELECT COUNT(*) AS c FROM corridor_regulations').get().c;
        db.close();
        if (count > 0) {
          console.log(`⏭️  corridor_regulations already has ${count} rows — skipping NASCO seed`);
          return;
        }
      } catch (err) {
        try { db.close(); } catch {}
        console.log('⏭️  Could not query corridor_regulations — skipping NASCO seed:', err.message);
        return;
      }
    }

    // Table exists and is empty → run the full populate script.
    console.log('🌱 corridor_regulations is empty — seeding NASCO I-35 regulations…');
    const { populateCorridorRegulations } = require('./populate_corridor_regulations.js');
    await populateCorridorRegulations();
  } catch (error) {
    // Never let a seed failure prevent the server from starting.
    console.error('⚠️  NASCO seed step failed (non-fatal):', error.message);
  }
}

module.exports = { seedCorridorRegulationsIfEmpty };

if (require.main === module) {
  seedCorridorRegulationsIfEmpty().then(() => process.exit(0));
}
