/**
 * Export bridge clearances to a STATIC JSON file for hosting off Railway
 * (e.g. Cloudflare Pages/R2, where egress is free). The frontend's bridge layer
 * can fetch this file directly (set VITE_BRIDGES_URL at build time) and does the
 * construction correlation client-side, so the bridge feature costs $0 egress
 * on Railway.
 *
 * Source of truth: the bridge_clearances DB table when reachable
 * (DATABASE_URL or DATABASE_PATH), otherwise the curated scripts/bridge_clearances.json.
 *
 *   node scripts/export_bridges_static.js
 *
 * Writes:
 *   cloudflare-static/bridges.json   { success:true, bridges:[...] }  (same shape as /api/bridges/all)
 *   cloudflare-static/_headers       CORS + cache headers for Cloudflare Pages
 *
 * Then deploy (one-time auth required — only you can do this):
 *   wrangler login
 *   wrangler pages deploy cloudflare-static --project-name=corridor-bridges
 * and rebuild the frontend with VITE_BRIDGES_URL=https://<project>.pages.dev/bridges.json
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'cloudflare-static');

async function loadFromDB() {
  if (process.env.DATABASE_URL) {
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
    await client.connect();
    try {
      const r = await client.query('SELECT * FROM bridge_clearances WHERE active = true ORDER BY clearance_feet ASC');
      return r.rows;
    } finally { await client.end(); }
  }
  const dbPath = process.env.DATABASE_PATH;
  if (dbPath && fs.existsSync(dbPath)) {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    try { return db.prepare('SELECT * FROM bridge_clearances WHERE active = 1 ORDER BY clearance_feet ASC').all(); }
    finally { db.close(); }
  }
  return null;
}

function loadFromJSON() {
  const p = path.join(__dirname, 'bridge_clearances.json');
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  // Give each a stable id so the frontend has a React key / click target.
  return raw.map((b, i) => ({ id: i + 1, ...b }));
}

async function main() {
  let bridges = await loadFromDB();
  let source = 'database';
  if (!bridges || bridges.length === 0) {
    bridges = loadFromJSON();
    source = 'curated JSON (no DB reachable)';
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const payload = { success: true, generated_at: null, count: bridges.length, bridges };
  fs.writeFileSync(path.join(OUT_DIR, 'bridges.json'), JSON.stringify(payload));

  // Cloudflare Pages headers: allow the app origin to fetch cross-origin, and
  // cache for an hour (data is static-ish — NBI updates yearly).
  const headers = [
    '/bridges.json',
    '  Access-Control-Allow-Origin: *',
    '  Cache-Control: public, max-age=3600, must-revalidate',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, '_headers'), headers);

  console.log(`✅ Wrote cloudflare-static/bridges.json (${bridges.length} bridges from ${source})`);
  console.log('   + cloudflare-static/_headers');
  console.log('\nNext (one-time, requires your Cloudflare auth):');
  console.log('   wrangler login');
  console.log('   wrangler pages deploy cloudflare-static --project-name=corridor-bridges');
  console.log('   then rebuild frontend with VITE_BRIDGES_URL=https://<project>.pages.dev/bridges.json');
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error('❌', e.message); process.exit(1); });
}

module.exports = { main };
