#!/usr/bin/env node
/**
 * CWZ 1.0 / WZDx 4.1+ conformance audit, per upstream source.
 *
 * Implements the method in .claude/skills/cwz-conformance: attribute every defect to the
 * source that produced it (§2), check feed-level structure (§3), detect un-migrated pre-4.0
 * schema (§4), classify geometry by what could actually be done about it (§5), and report
 * payload coverage against the population that requires it (§6).
 *
 * It AUDITS ONLY. Nothing is repaired and nothing is written -- the whole point is to see
 * which publisher causes which defect, because in an aggregated feed most defects are
 * inherited rather than authored, and a per-feed number is a work plan where an aggregate
 * number is just "the feed is bad".
 *
 * Three-state reporting throughout: PASS / FAIL / NOT EVALUATED. A feed that could not be
 * reached is NOT EVALUATED and must never be counted as clean -- that distinction is the
 * reason this file prints its own unreachable list at the end.
 *
 * Usage:
 *   node scripts/audit_cwz_conformance.js                 # every configured upstream feed
 *   node scripts/audit_cwz_conformance.js <url|file ...>  # specific feeds
 *   node scripts/audit_cwz_conformance.js --json          # machine-readable
 */

const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

// Pre-4.0 enumerations replaced by boolean verification flags in 4.1 (§4).
const SCHEMA_MIGRATION = [
  ['start_date_accuracy', 'is_start_date_verified'],
  ['end_date_accuracy', 'is_end_date_verified'],
  ['beginning_accuracy', 'is_start_position_verified'],
  ['ending_accuracy', 'is_end_position_verified']
];
// CWZ 1.0 payload fields. These are OBSERVATIONS and may never be synthesized (§7) -- the
// only honest thing to do with an absent one is report its coverage and escalate upstream.
const CWZ_PAYLOAD = ['worker_presence', 'restrictions', 'reduced_speed_limit_kph', 'lanes', 'types_of_work'];
// Required on a WZDx work-zone road event.
const CORE_REQUIRED = ['event_type', 'data_source_id', 'road_names', 'direction', 'update_date'];
const EVENT_REQUIRED = ['start_date', 'end_date', 'vehicle_impact'];

function get(url, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: {
      Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'Mozilla/5.0'
    } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); return get(res.headers.location, timeoutMs).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      const st = enc === 'gzip' ? res.pipe(zlib.createGunzip())
        : enc === 'deflate' ? res.pipe(zlib.createInflate()) : res;
      let d = ''; st.on('data', (c) => (d += c));
      st.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('not JSON')); } });
      st.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Read the upstream feed list out of API_CONFIG rather than keeping a second copy that can
// drift away from what the server actually ingests.
function configuredFeeds() {
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'backend_proxy_server.js'), 'utf8');
  const lines = src.split('\n');
  const out = [];
  let key = null;
  for (const l of lines.slice(570, 919)) {
    const k = l.match(/^  ([A-Za-z_'"-]+): \{/);
    if (k) { key = k[1]; continue; }
    const u = l.match(/^\s*wzdxUrl:\s*'([^']+)'/);
    if (u && key) out.push({ name: key, url: u[1] });
  }
  // Feeds that need a key we do not hold locally cannot be judged; they are reported as
  // NOT EVALUATED rather than quietly dropped.
  return out;
}

function pointsOf(geom) {
  const out = [];
  const isPt = (c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]);
  const walk = (g, d) => {
    if (!g || d > 6) return;
    if (Array.isArray(g)) { if (isPt(g)) { out.push(g); return; } for (const x of g) walk(x, d + 1); return; }
    if (g.type === 'GeometryCollection') { for (const s of (g.geometries || [])) walk(s, d + 1); return; }
    if (g.coordinates) walk(g.coordinates, d + 1);
  };
  walk(geom, 0);
  return out;
}

// §5 — classify by what a remediation pass could actually do, not by whether it is "bad".
function geometryClass(f) {
  const p = f.properties || {};
  const pts = pointsOf(f.geometry);
  if (pts.length === 0) return 'no-geometry';
  if (pts.length > 2) return 'already-valid';
  const bm = p.beginning_milepost ?? p.begin_milepost ?? null;
  const em = p.ending_milepost ?? p.end_milepost ?? null;
  if (pts.length === 1) return 'not-correctable';           // zero extent, publisher fix
  const haveM = Number.isFinite(Number(bm)) && Number.isFinite(Number(em));
  if (haveM && Number(bm) !== Number(em)) return 'correctable-by-measure';
  if (haveM && Number(bm) === Number(em)) return 'not-correctable';
  return 'correctable-by-snap';
}

function auditFeed(name, url, doc) {
  const info = doc.road_event_feed_info || doc.feed_info || null;
  const declared = new Set(((info && info.data_sources) || []).map((s) => s.data_source_id).filter(Boolean));
  const feats = Array.isArray(doc.features) ? doc.features : [];
  const perSource = new Map();
  const extBad = new Map();

  for (const f of feats) {
    const p = f.properties || {};
    const c = p.core_details || {};
    const sid = c.data_source_id || p.data_source_id || '(none)';
    let s = perSource.get(sid);
    if (!s) perSource.set(sid, s = {
      n: 0, types: {}, geom: {}, legacy: 0, legacyFields: {}, coreMissing: {}, eventMissing: {},
      payload: {}, workZones: 0, updateDates: 0, newest: null, oldest: null, undated: 0, malformed: 0
    });
    s.n++;
    const et = c.event_type || p.event_type || '(none)';
    s.types[et] = (s.types[et] || 0) + 1;
    const g = geometryClass(f);
    s.geom[g] = (s.geom[g] || 0) + 1;
    // Freshness. A feed can return HTTP 200, a well-formed document and a full set of
    // event_status:'active' zones while having stopped updating years ago -- Utah's
    // registered feed has served the same 2023-03-19 snapshot ever since, and FHWA's
    // registry still lists it active on a 15-minute cycle. Liveness is not implied by
    // registry membership, by HTTP 200, or by the events calling themselves active, so it
    // has to be measured from the data.
    const rawTs = c.update_date || p.update_date;
    if (rawTs) {
      s.updateDates++;
      const t = Date.parse(rawTs);
      // Year 0001 and other unparseable stamps are a defect, not an age: NE-Compass emits
      // 0001-01-01, which would otherwise read as the stalest feed in the country.
      if (!Number.isFinite(t) || t < Date.parse('2000-01-01')) s.malformed++;
      else {
        if (s.newest === null || t > s.newest) s.newest = t;
        if (s.oldest === null || t < s.oldest) s.oldest = t;
      }
    } else s.undated++;

    for (const [legacy, modern] of SCHEMA_MIGRATION) {
      if (p[legacy] !== undefined && p[modern] === undefined) {
        s.legacy++; s.legacyFields[legacy] = (s.legacyFields[legacy] || 0) + 1;
      }
    }
    for (const k of CORE_REQUIRED) {
      const v = c[k] !== undefined ? c[k] : p[k];
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
      if (empty) s.coreMissing[k] = (s.coreMissing[k] || 0) + 1;
    }
    // §6 — work-zone requirements only apply to work zones.
    if (et === 'work-zone') {
      s.workZones++;
      for (const k of EVENT_REQUIRED) {
        const v = p[k];
        if (v === undefined || v === null || v === '') s.eventMissing[k] = (s.eventMissing[k] || 0) + 1;
      }
      for (const k of CWZ_PAYLOAD) {
        const v = p[k];
        const has = !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)
          || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length));
        if (has) s.payload[k] = (s.payload[k] || 0) + 1;
      }
    }
    // §3 — extension members must use the x_ prefix.
    for (const k of Object.keys(p)) {
      if (/^(_|[A-Z])/.test(k) && !k.startsWith('x_')) extBad.set(k, (extBad.get(k) || 0) + 1);
    }
  }

  const referenced = new Set(perSource.keys());
  const dangling = [...referenced].filter((r) => r !== '(none)' && declared.size && !declared.has(r));

  return {
    name, url,
    feedLevel: {
      hasRoadEventFeedInfo: !!doc.road_event_feed_info,
      hasFeedInfoOnly: !doc.road_event_feed_info && !!doc.feed_info,
      version: info ? info.version : null,
      publisher: info ? info.publisher : null,
      declaredSources: declared.size,
      danglingReferences: dangling
    },
    features: feats.length,
    perSource: [...perSource.entries()].map(([id, s]) => ({ id, ...s })),
    badExtensionSpellings: [...extBad.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  };
}

function pct(a, b) { return b ? Math.round((100 * a) / b) + '%' : '—'; }

function printReport(results, unreachable) {
  const GEOM_ORDER = ['already-valid', 'correctable-by-measure', 'correctable-by-snap', 'not-correctable', 'no-geometry'];
  console.log('\n================ CWZ 1.0 / WZDx conformance — per source ================\n');

  // §3 feed-level
  console.log('FEED-LEVEL STRUCTURE');
  console.log('  feed'.padEnd(16) + 'ver'.padEnd(6) + 'road_event_feed_info'.padEnd(22) + 'declared sources'.padEnd(18) + 'dangling refs');
  for (const r of results) {
    const fl = r.feedLevel;
    const k = fl.hasRoadEventFeedInfo ? 'PASS' : (fl.hasFeedInfoOnly ? 'FAIL (feed_info only)' : 'FAIL (absent)');
    console.log('  ' + r.name.padEnd(14) + String(fl.version || '?').padEnd(6) + k.padEnd(22)
      + String(fl.declaredSources).padEnd(18) + (fl.danglingReferences.length ? fl.danglingReferences.join(',') : 'none'));
  }

  const agg = { n: 0, geom: {}, legacy: 0, wz: 0, payload: {} };
  console.log('\nGEOMETRY BY RECOVERABILITY (work zones and all other events)');
  console.log('  source'.padEnd(34) + 'n'.padEnd(7) + GEOM_ORDER.map((g) => g.replace('correctable-by-', 'by-').padEnd(15)).join(''));
  for (const r of results) {
    for (const s of r.perSource) {
      agg.n += s.n; agg.legacy += s.legacy; agg.wz += s.workZones;
      for (const g of GEOM_ORDER) agg.geom[g] = (agg.geom[g] || 0) + (s.geom[g] || 0);
      for (const k of CWZ_PAYLOAD) agg.payload[k] = (agg.payload[k] || 0) + (s.payload[k] || 0);
      console.log('  ' + `${r.name}/${s.id}`.slice(0, 32).padEnd(34) + String(s.n).padEnd(7)
        + GEOM_ORDER.map((g) => String(s.geom[g] || 0).padEnd(15)).join(''));
    }
  }

  console.log('\nFRESHNESS — is the publisher still updating? (measured from event update_date)');
  console.log('  source'.padEnd(34) + 'n'.padEnd(7) + 'newest event'.padEnd(22) + 'age'.padEnd(9) + 'undated'.padEnd(9) + 'malformed');
  const NOW = Date.now(), DAY = 86400000;
  for (const r of results) for (const s of r.perSource) {
    const age = s.newest ? Math.round((NOW - s.newest) / DAY) : null;
    const verdict = age === null ? (s.malformed ? 'NOT EVALUATED (bad dates)' : 'NOT EVALUATED (undated)')
      : (age > 30 ? `STALE ${age}d` : `${age}d`);
    console.log('  ' + `${r.name}/${s.id}`.slice(0, 32).padEnd(34) + String(s.n).padEnd(7)
      + (s.newest ? new Date(s.newest).toISOString().slice(0, 19) : '(none)').padEnd(22)
      + verdict.padEnd(9 + (verdict.length > 9 ? verdict.length - 9 : 0)).slice(0, 26).padEnd(9)
      + String(s.undated).padEnd(9) + String(s.malformed));
  }

  console.log('\nUN-MIGRATED PRE-4.0 SCHEMA (legacy *_accuracy present, 4.1 boolean absent)');
  let anyLegacy = false;
  for (const r of results) for (const s of r.perSource) {
    if (!s.legacy) continue;
    anyLegacy = true;
    console.log(`  ${r.name}/${s.id}: ${s.legacy} field instances — ${JSON.stringify(s.legacyFields)}`);
  }
  if (!anyLegacy) console.log('  none — every publisher audited is on the 4.1 boolean flags');

  console.log('\nREQUIRED-FIELD GAPS');
  let anyGap = false;
  for (const r of results) for (const s of r.perSource) {
    const cm = Object.keys(s.coreMissing).length ? JSON.stringify(s.coreMissing) : null;
    const em = Object.keys(s.eventMissing).length ? JSON.stringify(s.eventMissing) : null;
    if (!cm && !em) continue;
    anyGap = true;
    console.log(`  ${r.name}/${s.id} (n=${s.n}, work zones=${s.workZones})`);
    if (cm) console.log(`      core_details missing: ${cm}`);
    if (em) console.log(`      work-zone required missing: ${em}`);
  }
  if (!anyGap) console.log('  none');

  console.log('\nCWZ 1.0 PAYLOAD COVERAGE — over work zones only (never synthesizable; §7)');
  console.log('  source'.padEnd(34) + 'work zones'.padEnd(12) + CWZ_PAYLOAD.map((k) => k.slice(0, 13).padEnd(15)).join(''));
  for (const r of results) for (const s of r.perSource) {
    if (!s.workZones) continue;
    console.log('  ' + `${r.name}/${s.id}`.slice(0, 32).padEnd(34) + String(s.workZones).padEnd(12)
      + CWZ_PAYLOAD.map((k) => pct(s.payload[k] || 0, s.workZones).padEnd(15)).join(''));
  }

  const badExt = results.flatMap((r) => r.badExtensionSpellings.map(([k, n]) => `${r.name}:${k}(${n})`));
  console.log('\nNON-CONFORMING EXTENSION SPELLINGS (should be x_*)');
  console.log(badExt.length ? '  ' + badExt.slice(0, 12).join('  ') : '  none');

  console.log('\nTOTALS');
  console.log(`  features audited: ${agg.n}   work zones: ${agg.wz}`);
  console.log('  geometry: ' + GEOM_ORDER.map((g) => `${g}=${agg.geom[g] || 0}`).join('  '));
  console.log('  payload coverage over work zones: ' + CWZ_PAYLOAD.map((k) => `${k}=${pct(agg.payload[k] || 0, agg.wz)}`).join('  '));

  console.log('\nNOT EVALUATED — these were NOT judged conformant, they could not be read');
  if (!unreachable.length) console.log('  none');
  for (const u of unreachable) console.log(`  ${u.name}: ${u.reason}`);
  console.log('');
}

(async () => {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const targets = args.filter((a) => !a.startsWith('--'));
  const feeds = targets.length
    ? targets.map((t) => ({ name: require('path').basename(t).slice(0, 14), url: t }))
    : configuredFeeds();

  const results = [], unreachable = [];
  await Promise.all(feeds.map(async (f) => {
    try {
      const doc = f.url.startsWith('http') ? await get(f.url) : JSON.parse(fs.readFileSync(f.url, 'utf8'));
      if (!doc || !Array.isArray(doc.features)) throw new Error('no features array');
      results.push(auditFeed(f.name, f.url, doc));
    } catch (e) {
      // A feed needing a key we do not hold is unevaluable, not compliant and not broken.
      const needsKey = /key=|api_key|app_key|token=/i.test(f.url) ? ' (feed requires a key)' : '';
      unreachable.push({ name: f.name, reason: e.message + needsKey });
    }
  }));
  results.sort((a, b) => b.features - a.features);
  if (asJson) console.log(JSON.stringify({ results, unreachable }, null, 2));
  else printReport(results, unreachable);
})();
