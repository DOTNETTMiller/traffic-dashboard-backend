#!/usr/bin/env node
/**
 * Measure ghost rows in the validation ledger: zones recorded as validated whose event_id is no
 * longer in any feed.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS. Three properties of the current design compose badly:
 *
 *   1. Iowa's WZDx ids embed the feed's current segmentation, so re-segmenting REPLACES every id.
 *      Verified over 13 snapshots: one 18-hour run saw 6 events re-identified and 39 ids
 *      destroyed. It is one-way and persistent, not flapping.
 *   2. `validation_ledger` keys on event_id and is POSITIVE-ONLY and STICKY by design: once a
 *      zone is corroborated it stays corroborated, deliberately, so credit accumulates across
 *      refreshes instead of being re-won each time.
 *   3. Nothing deletes a row when an id leaves the feed. The only removal is a 180-day prune.
 *
 * Together: when an id is destroyed, its validation credit stays in the ledger forever (a GHOST),
 * and the SAME physical zone returns under a new id with no credit at all. So the ledger drifts
 * in both directions at once — it over-claims on zones that no longer exist and under-claims on
 * the ones that do. The camera ledger garbage-collects; this one does not, and the asymmetry
 * looks unintentional.
 *
 * x_verification_count is the platform's central claim. This is the one number that says whether
 * it can be trusted, and it has never been measured in production.
 *
 * Deliberately READ-ONLY. It prunes nothing and writes nothing: the right remediation depends on
 * what the numbers say, and deleting evidence before reading it is how you lose the ability to
 * tell drift from a bug.
 *
 * Needs the production store, so run it where DATABASE_URL is set:
 *   railway run node scripts/measure_validation_ghosts.js
 *   DATABASE_URL=... node scripts/measure_validation_ghosts.js --events https://<host>/api/events
 *
 * --events defaults to http://localhost:3001/api/events. Without a reachable event list the
 * ledger cannot be judged, and the script says so rather than reporting a comforting zero.
 *
 * NOTE: requiring the database module runs its normal init, which writes an auto-backup (~26 MB
 * on the SQLite path). Harmless, but do not loop this script -- it is a manual measurement, not
 * a scheduled check. scripts/feed_health_check.js is the one built to run on a timer.
 */

const http = require('http');
const https = require('https');
const zlib = require('zlib');

function fetchJSON(url, timeoutMs = 120000) {
  const mod = url.startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.get(url, { headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); return fetchJSON(res.headers.location, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      const st = enc === 'gzip' ? res.pipe(zlib.createGunzip()) : res;
      let d = ''; st.on('data', (c) => (d += c));
      st.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('unparseable')); } });
      st.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

(async () => {
  const args = process.argv.slice(2);
  const ei = args.indexOf('--events');
  const eventsUrl = ei >= 0 ? args[ei + 1] : 'http://localhost:3001/api/events';

  const store = process.env.DATABASE_URL ? 'postgres' : 'sqlite';
  console.log(`store: ${store}${store === 'sqlite' ? '  (local file — NOT production)' : ''}`);

  let rows;
  try {
    const db = require('../database');
    if (db.init) await db.init();
    rows = await db.db.prepare('SELECT event_id, source, first_at, last_at FROM validation_ledger').all();
  } catch (e) {
    console.error(`NOT EVALUATED — could not read validation_ledger: ${e.message}`);
    process.exit(3);
  }
  console.log(`ledger rows: ${rows.length}`);
  if (!rows.length) { console.log('nothing to measure'); return; }

  let live;
  try {
    const doc = await fetchJSON(eventsUrl);
    const evs = doc.events || doc.data?.events || [];
    live = new Set(evs.map((e) => e.id || e.road_event_id).filter(Boolean));
    if (!live.size) throw new Error('event list was empty');
  } catch (e) {
    // The whole point of three-state reporting: an unreadable event list means the ledger is
    // UNJUDGEABLE. Reporting 0 ghosts here would be the exact failure this codebase keeps hitting.
    console.error(`NOT EVALUATED — could not read the live event list from ${eventsUrl}: ${e.message}`);
    console.error('The ledger cannot be judged without it. This is not a clean result.');
    process.exit(3);
  }
  console.log(`live event ids: ${live.size}`);

  const bySource = new Map();
  const ghostAges = [];
  let ghosts = 0;
  for (const r of rows) {
    const src = r.source || '(none)';
    let s = bySource.get(src);
    if (!s) bySource.set(src, s = { total: 0, ghost: 0 });
    s.total++;
    if (!live.has(r.event_id)) {
      s.ghost++; ghosts++;
      const t = Date.parse(r.last_at || r.first_at || '');
      if (Number.isFinite(t)) ghostAges.push(Math.round((Date.now() - t) / 86400000));
    }
  }

  console.log(`\nGHOSTS — credited as validated, id no longer in any feed`);
  console.log('  source'.padEnd(16) + 'rows'.padStart(8) + 'ghosts'.padStart(9) + '  share');
  for (const [src, s] of [...bySource].sort((a, b) => b[1].ghost - a[1].ghost)) {
    console.log('  ' + src.padEnd(14) + String(s.total).padStart(8) + String(s.ghost).padStart(9)
      + '  ' + (s.total ? Math.round((100 * s.ghost) / s.total) + '%' : '—'));
  }
  console.log(`\n  TOTAL ghosts: ${ghosts} / ${rows.length} (${Math.round((100 * ghosts) / rows.length)}%)`);
  if (ghostAges.length) {
    ghostAges.sort((a, b) => a - b);
    const med = ghostAges[Math.floor(ghostAges.length / 2)];
    console.log(`  ghost age (days since last seen): min ${ghostAges[0]}  median ${med}  max ${ghostAges[ghostAges.length - 1]}`);
    console.log(`  older than the 180-day prune: ${ghostAges.filter((a) => a > 180).length}`);
  }
  console.log('\nRead this alongside the other direction of the same drift: the physical zones whose');
  console.log('ids were destroyed are back in the feed with NO credit, so the true validated count');
  console.log('is understated by roughly the same churn that produced these ghosts.');
  console.log('Nothing was modified. STABLE_EVENT_KEY=' + (process.env.STABLE_EVENT_KEY || 'unset'));
})();
