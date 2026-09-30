#!/usr/bin/env node
/**
 * Scheduled health check for every upstream work-zone feed. Built to be run by a scheduler and
 * to say nothing when nothing is wrong.
 *
 * WHY THIS EXISTS. On 2026-09-30 a single audit pass found, all of it long-standing:
 *   - North Carolina's configured endpoint answering 404, so the state contributed ZERO zones
 *     while reading as a healthy configured feed. 6,243 zones were recovered by repointing it.
 *   - Utah's registered feed serving the same 2023-03-19 snapshot for ~1,291 days -- HTTP 200,
 *     617 KB, every event still event_status 'active', and FHWA's registry still listing it
 *     active on a 15-minute cycle.
 *   - WSDOT-CIA frozen 851 days while its sibling source in the SAME feed was current.
 *   - 7,534 zones carrying no update_date at all.
 * None of it was detected by anything. All of it was months or years old. A feed that is up but
 * not updating is invisible in every other metric we collect, which is the gap this closes.
 *
 * THREE-STATE, ALWAYS. OK / PROBLEM / NOT EVALUATED. A feed that could not be reached is never
 * reported as healthy, and a feed with no timestamps is "cannot be judged", not "fine" -- that
 * distinction is the only reason the Utah and NC failures were visible at all.
 *
 * Freshness is judged per data_source_id, never per feed. Washington is the proof: judged at
 * feed level its two sources average to "fresh" and the 851-day one disappears.
 *
 * Exit codes, for the scheduler:
 *   0  everything reachable and fresh (or explicitly unjudgeable)
 *   1  WARN     — a source went stale, or a feed's count dropped sharply
 *   2  CRITICAL — a feed is unreachable or unparseable, or a source's zones vanished
 *
 * Usage:
 *   node scripts/feed_health_check.js
 *   node scripts/feed_health_check.js --state /data/feed_health.json   # enables drop detection
 *   node scripts/feed_health_check.js --json
 *   STALE_SOURCE_DAYS=30 DROP_PCT=40 node scripts/feed_health_check.js
 */

const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const STALE_DAYS = Number(process.env.STALE_SOURCE_DAYS || 30);
const DROP_PCT = Number(process.env.DROP_PCT || 40);      // % fall in a source's count that warns
const DAY = 86400000;

function readBody(res) {
  const enc = String(res.headers['content-encoding'] || '').toLowerCase();
  const st = enc === 'gzip' ? res.pipe(zlib.createGunzip())
    : enc === 'deflate' ? res.pipe(zlib.createInflate()) : res;
  return new Promise((resolve, reject) => {
    let d = ''; st.on('data', (c) => (d += c));
    st.on('end', () => resolve(d)); st.on('error', reject);
  });
}
function get(url, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: {
      Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'Mozilla/5.0'
    } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); return get(res.headers.location, timeoutMs).then(resolve, reject);
      }
      // A 200 is not success. Several state 511 hosts answer 200 with an HTML error page, which
      // reads as healthy to anything that only checks the status code.
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      readBody(res).then((d) => {
        const head = d.slice(0, 200).trimStart().toLowerCase();
        if (head.startsWith('<')) return reject(new Error('HTML, not JSON (soft 404)'));
        try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('unparseable')); }
      }, reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Read the feed list from API_CONFIG so this can never drift from what the server ingests.
function configuredFeeds() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'backend_proxy_server.js'), 'utf8');
  const out = [];
  let key = null;
  for (const l of src.split('\n').slice(570, 930)) {
    const k = l.match(/^  ([A-Za-z_'"-]+): \{/);
    if (k) { key = k[1]; continue; }
    const u = l.match(/^\s*wzdxUrl:\s*'([^']+)'/);
    if (u && key) out.push({ name: key, url: u[1] });
  }
  return out;
}

function perSource(doc) {
  const out = new Map();
  for (const f of (doc.features || [])) {
    const p = f.properties || {};
    const c = p.core_details || {};
    const sid = c.data_source_id || p.data_source_id || '(none)';
    let s = out.get(sid);
    if (!s) out.set(sid, s = { n: 0, newest: null, undated: 0, malformed: 0 });
    s.n++;
    const raw = c.update_date || p.update_date;
    if (!raw) { s.undated++; continue; }
    const t = Date.parse(raw);
    // Year 0001 and friends are a defect, not an age. NE-Compass emits 0001-01-01, which would
    // otherwise be reported as the stalest publisher in the country every single night.
    if (!Number.isFinite(t) || t < Date.parse('2000-01-01')) { s.malformed++; continue; }
    if (s.newest === null || t > s.newest) s.newest = t;
  }
  return out;
}

(async () => {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const si = args.indexOf('--state');
  const statePath = si >= 0 ? args[si + 1] : null;

  let prev = {};
  let havePrev = false;
  if (statePath) {
    try { prev = JSON.parse(fs.readFileSync(statePath, 'utf8')); havePrev = true; } catch (_) { havePrev = false; }
  }

  const feeds = configuredFeeds();
  const critical = [], warn = [], notEvaluated = [];
  const snapshot = {};

  await Promise.all(feeds.map(async (f) => {
    let doc;
    try {
      doc = await get(f.url);
      if (!doc || !Array.isArray(doc.features)) throw new Error('no features array');
    } catch (e) {
      // A feed we lack credentials for cannot be judged, and that is NOT the same as broken.
      // Conflating them is how a real outage hides among expected noise -- and a nightly job
      // that cries wolf is a nightly job nobody reads. 401/403 means authentication, so it is
      // unjudgeable here whatever the URL looks like (Texas takes its key as a request param,
      // so sniffing the URL for 'key=' misses it and reported a false CRITICAL).
      const authFail = /HTTP (401|403)/.test(e.message);
      const keyed = authFail
        || /[?&](key|api_key|apikey|api-key|app_key|token|access_token)=/i.test(f.url);
      (keyed ? notEvaluated : critical).push({
        feed: f.name,
        reason: authFail ? `${e.message} — needs credentials, not judged` : e.message,
        keyed
      });
      return;
    }
    for (const [sid, s] of perSource(doc)) {
      const id = `${f.name}/${sid}`;
      snapshot[id] = { n: s.n, newest: s.newest };
      const ageD = s.newest ? Math.round((Date.now() - s.newest) / DAY) : null;
      if (ageD === null) {
        notEvaluated.push({ feed: id, reason: s.malformed ? `${s.malformed} malformed timestamps` : `${s.undated} records with no update_date`, n: s.n });
      } else if (ageD > STALE_DAYS) {
        warn.push({ feed: id, reason: `FROZEN ${ageD}d (newest ${new Date(s.newest).toISOString().slice(0, 10)})`, n: s.n });
      }
      if (havePrev && prev[id] && prev[id].n > 0) {
        const drop = Math.round(100 * (1 - s.n / prev[id].n));
        if (s.n === 0) critical.push({ feed: id, reason: `zones went to ZERO (was ${prev[id].n})`, n: 0 });
        else if (drop >= DROP_PCT) warn.push({ feed: id, reason: `count fell ${drop}% (${prev[id].n} -> ${s.n})`, n: s.n });
      }
    }
  }));

  if (statePath) {
    try {
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify(snapshot, null, 2));
    } catch (e) { notEvaluated.push({ feed: '(snapshot)', reason: `could not write ${statePath}: ${e.message}` }); }
  }

  const code = critical.length ? 2 : (warn.length ? 1 : 0);
  if (asJson) {
    console.log(JSON.stringify({ code, critical, warn, notEvaluated, sources: Object.keys(snapshot).length }, null, 2));
  } else {
    // Quiet when healthy: a nightly job that always prints is a nightly job nobody reads.
    if (critical.length) {
      console.log('CRITICAL');
      for (const c of critical) console.log(`  ${c.feed}: ${c.reason}`);
    }
    if (warn.length) {
      // Biggest first. A frozen publisher with 1,815 zones and one with 2 are both findings,
      // but only one of them changes what a traveller sees, and an alphabetical list buries it.
      console.log('WARN');
      for (const w of warn.slice().sort((a, b) => (b.n || 0) - (a.n || 0))) {
        console.log(`  ${w.feed}: ${w.reason}${w.n !== undefined ? `  [${w.n} zones]` : ''}`);
      }
    }
    if (notEvaluated.length) {
      console.log('NOT EVALUATED (not healthy — just unjudgeable)');
      for (const n of notEvaluated) console.log(`  ${n.feed}: ${n.reason}`);
    }
    if (!critical.length && !warn.length) console.log(`OK — ${Object.keys(snapshot).length} sources reachable and fresh`);
    if (!havePrev && statePath) console.log('(first run: count-drop detection starts next run)');
  }
  process.exit(code);
})();
