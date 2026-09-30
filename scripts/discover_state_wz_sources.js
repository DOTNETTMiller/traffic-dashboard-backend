#!/usr/bin/env node
/**
 * Find public work-zone / lane-closure data a state DOT already publishes, for states whose
 * WZDx feed is missing, frozen, or thinner than their own data.
 *
 * This exists because of Utah. UDOT's registered WZDx feed has been frozen since 2023-03-19,
 * and the assumption was that fixing it needed TMDD. It did not: searching ArcGIS Online for
 * UDOT-owned services turned up 'Traffic Events View' (UPlan), carrying encoded polylines,
 * begin/end mileposts and the publisher's own impact classification -- none of which is in
 * Utah's 511 map or its WZDx feed. The best Utah data was simply somewhere nobody had looked.
 *
 * So this automates the looking. For each state it searches ArcGIS Online for candidate
 * services, then PROBES each one's field list and scores it on what a WZDx feed actually
 * needs. Titles lie and descriptions are marketing; the field list is the evidence.
 *
 * Scored on, in rough order of what is hardest to obtain elsewhere:
 *   lanes      - lane-level detail. The one thing Utah has nowhere public, so TMDD-only there.
 *   extent     - a polyline, or begin/end measures. The difference between a work zone and a pin.
 *   milepost   - LRS measures: an exact location with no snapping and no tolerance.
 *   updated    - a per-record timestamp. Without it a frozen feed is indistinguishable
 *                from a live one, which is how Utah went unnoticed for 1,291 days.
 *   impact     - closure/lane-impact classification, which answers vehicle_impact.
 *   direction  - carriageway.
 *
 * It reports candidates; it does not decide. A high score means "worth a look", and the layer
 * still has to be read before anything is built on it -- three of my own errors on the Utah
 * source came from trusting a field's presence instead of measuring how it was populated.
 *
 * Usage:
 *   node scripts/discover_state_wz_sources.js                 # the default target list
 *   node scripts/discover_state_wz_sources.js georgia tennessee
 *   node scripts/discover_state_wz_sources.js --json
 */

const https = require('https');
const zlib = require('zlib');

// Default targets: states with NO registered WZDx feed, or one that is frozen or undated.
// TPF-5(566) members are marked so the output can be read against membership -- a member
// state with no feed is a different conversation from a non-member with no feed.
const MEMBERS = new Set(['california', 'illinois', 'iowa', 'kansas', 'minnesota', 'missouri',
  'nebraska', 'nevada', 'oklahoma', 'pennsylvania', 'texas']);

const TARGETS = {
  // No registered WZDx feed at all
  alabama: { abbr: 'AL', dot: 'ALDOT', why: 'no registered feed' },
  alaska: { abbr: 'AK', dot: 'Alaska DOT&PF', why: 'no registered feed' },
  arkansas: { abbr: 'AR', dot: 'ARDOT', why: 'no registered feed' },
  connecticut: { abbr: 'CT', dot: 'CTDOT', why: 'no registered feed' },
  georgia: { abbr: 'GA', dot: 'GDOT', why: 'no registered feed' },
  montana: { abbr: 'MT', dot: 'MDT', why: 'no registered feed' },
  oregon: { abbr: 'OR', dot: 'ODOT', why: 'registered but key-gated' },
  'rhode island': { abbr: 'RI', dot: 'RIDOT', why: 'no registered feed' },
  'south carolina': { abbr: 'SC', dot: 'SCDOT', why: 'no registered feed' },
  'south dakota': { abbr: 'SD', dot: 'SDDOT', why: 'no registered feed' },
  tennessee: { abbr: 'TN', dot: 'TDOT', why: 'no registered feed' },
  'west virginia': { abbr: 'WV', dot: 'WVDOH', why: 'no registered feed' },
  wyoming: { abbr: 'WY', dot: 'WYDOT', why: 'no registered feed' },
  // Registered but frozen or unverifiable
  utah: { abbr: 'UT', dot: 'UDOT', why: 'frozen 1291d (UPlan found)' },
  washington: { abbr: 'WA', dot: 'WSDOT', why: 'WSDOT-CIA source frozen 851d' },
  arizona: { abbr: 'AZ', dot: 'ADOT', why: 'no update_date on any record' },
  delaware: { abbr: 'DE', dot: 'DelDOT', why: 'no update_date; feed is HaulHub' },
  nevada: { abbr: 'NV', dot: 'NDOT', why: 'no registered feed (MEMBER)' },
  'new mexico': { abbr: 'NM', dot: 'NMDOT', why: 'feed returned HTTP 503' }
};

// Field-name patterns, deliberately loose: every agency spells these differently
// (LanesAffected / LaneImpact / lane_closure / NUM_LANES_CLOSED ...).
const SIGNALS = {
  lanes: /lane(s)?(_|\s)?(affected|impact|closed|closure|count|status)|num.*lane|lanes?_?blocked/i,
  extent: /polyline|shape|geometry|path|segment|from.?to|begin.*end|linear/i,
  milepost: /mile.?(post|point|marker)|\bmp(_|\s)?(start|end|begin|from|to)\b|\bbeg(in)?.?mp\b|reference.?post|\brp(_|\s)?(start|end)\b|measure/i,
  updated: /last.?updat|update.?(date|time)|modified|edit.?date|timestamp|report.?(date|time)/i,
  impact: /closure|impact|restrict|blocked|severity|condition/i,
  direction: /direction|bound|travel.?dir|dir(_|\s)?of/i,
  dates: /start.?(date|time)|end.?(date|time)|begin.?date|expir/i,
  route: /route|road|street|highway|corridor|rte/i
};
const WEIGHT = { lanes: 5, extent: 4, milepost: 4, updated: 3, impact: 2, direction: 1, dates: 1, route: 1 };

function readBody(res) {
  const enc = String(res.headers['content-encoding'] || '').toLowerCase();
  const st = enc === 'gzip' ? res.pipe(zlib.createGunzip())
    : enc === 'deflate' ? res.pipe(zlib.createInflate()) : res;
  return new Promise((resolve, reject) => {
    let d = ''; st.on('data', (c) => (d += c));
    st.on('end', () => resolve(d)); st.on('error', reject);
  });
}
function get(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: {
      Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'Mozilla/5.0'
    } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); return get(res.headers.location, timeoutMs).then(resolve, reject);
      }
      readBody(res).then((d) => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('not JSON')); } }, reject);
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Reject the obvious noise up front. County parcel layers and trail plans dominate an
// unfiltered search for "<state> DOT work zone" and burn the probe budget.
const NOISE = /parcel|trail|bike|survey|zoning|school|park(s)?\b|cadastr|address|building|census|land ?use|wetland|soil|voting|precinct|fiber|aeronaut|airport|transit stop/i;
const WANTED = /work.?zone|lane.?closure|road.?(event|closure|work|way ?event)|closure|construction|restriction|incident|traffic.?event|roadwork|detour/i;

async function searchState(name, cfg) {
  const queries = [
    `${cfg.dot} work zone`, `${cfg.dot} lane closure`, `${cfg.dot} road events`,
    `${name} DOT construction closure`, `${name} roadway closure`
  ];
  const seen = new Map();
  for (const q of queries) {
    let res;
    try {
      res = await get(`https://www.arcgis.com/sharing/rest/search?q=${encodeURIComponent(q)}`
        + `&f=json&num=20&sortField=numviews&sortOrder=desc`);
    } catch (_) { continue; }
    for (const r of (res.results || [])) {
      if (r.type !== 'Feature Service' && r.type !== 'Map Service') continue;
      const title = String(r.title || '');
      if (NOISE.test(title)) continue;
      if (!WANTED.test(title)) continue;
      if (!r.url) continue;
      if (!seen.has(r.url)) seen.set(r.url, { title, owner: r.owner, url: r.url, modified: r.modified });
    }
  }
  return [...seen.values()];
}

async function probe(cand) {
  // Try layer 0, then the service root's first layer, since numbering is not a standard.
  let fields = null, layerUrl = null, geomType = null, count = null, layerName = null;
  for (const suffix of ['/0', '/1']) {
    try {
      const d = await get(`${cand.url}${suffix}?f=pjson`);
      if (d && Array.isArray(d.fields) && d.fields.length) {
        fields = d.fields.map((f) => f.name);
        geomType = d.geometryType || null;
        layerName = d.name || null;
        layerUrl = `${cand.url}${suffix}`;
        break;
      }
    } catch (_) { /* try next */ }
  }
  if (!fields) return null;
  try {
    const c = await get(`${layerUrl}/query?where=1%3D1&returnCountOnly=true&f=json`);
    count = Number.isFinite(c && c.count) ? c.count : null;
  } catch (_) { /* count optional */ }

  const joined = fields.join(' ');
  const hits = {};
  let score = 0;
  for (const [k, re] of Object.entries(SIGNALS)) {
    // A LineString layer has an extent whether or not it names a polyline field.
    const geomExtent = k === 'extent' && /Polyline|Line/i.test(String(geomType || ''));
    if (re.test(joined) || geomExtent) { hits[k] = true; score += WEIGHT[k]; }
  }
  return { ...cand, layerUrl, layerName, geomType, count, fields, hits, score };
}


// ---- Esri "Road Closures" solution sweep -------------------------------------------------
// A separate channel, found while looking for state DOT sources and worth keeping even though
// it answered a different question. Iowa's closure layer is `RoadClosures_public`, and so is
// DC's HSEMA layer, and Tennessee's -- because it is an Esri Solutions template, which means
// it is DISCOVERABLE BY NAME across every agency that deployed it.
//
// Measured 2026-09-30: 603 distinct feature services. A 40-service sample probed live:
//   33/40 responded with the template schema (street, direction, starttime, endtime,
//         description, altroute, activeincid, subtype ...)
//   33/33 POLYLINE geometry -- real extents, not pins
//   24/33 had at least one live record; 812 closures across the sample
//
// The catch, and it is the important part: ZERO of the 603 are state DOTs. They are cities and
// counties -- Guilford County NC, Raleigh, King County WA, Worcester, Manatee County FL, even
// Moose Jaw. So this does NOT fill a state's missing WZDx feed. What it is instead is the layer
// WZDx structurally does not cover: LOCAL road closures, on one uniform schema, keyless, with
// geometry and times. Roughly 9-12k closures nationally if the sample holds.
async function sweepRoadClosures(limit = 600) {
  const seen = new Map();
  for (const q of ['RoadClosures_public', 'RoadClosures type:"Feature Service"']) {
    let start = 1;
    for (let page = 0; page < 6 && seen.size < limit; page++) {
      let d;
      try {
        d = await get(`https://www.arcgis.com/sharing/rest/search?f=json&num=100&start=${start}`
          + `&q=${encodeURIComponent(q)}`, 40000);
      } catch (_) { break; }
      const res = d.results || [];
      if (!res.length) break;
      for (const r of res) {
        if (r.type !== 'Feature Service' || !r.url) continue;
        if (!/roadclosure/i.test((r.title || '') + r.url)) continue;
        if (!seen.has(r.url)) seen.set(r.url, { title: r.title, owner: r.owner, url: r.url });
      }
      if (!(d.nextStart > 0)) break;
      start = d.nextStart;
    }
  }
  return [...seen.values()];
}

(async () => {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  if (args.includes('--roadclosures')) {
    const found = await sweepRoadClosures();
    if (asJson) console.log(JSON.stringify(found, null, 2));
    else {
      console.log(`Esri Road Closures solution deployments found: ${found.length}`);
      console.log('These are LOCAL agencies (city/county), not state DOTs — see the note above.');
      for (const f of found.slice(0, 25)) console.log(`  ${String(f.owner).slice(0, 30).padEnd(30)} ${f.url}`);
    }
    return;
  }
  const picked = args.filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase());
  const states = picked.length
    ? Object.fromEntries(Object.entries(TARGETS).filter(([k]) => picked.includes(k)))
    : TARGETS;

  const out = [];
  for (const [name, cfg] of Object.entries(states)) {
    const cands = await searchState(name, cfg);
    const probed = [];
    for (const c of cands.slice(0, 8)) {
      const p = await probe(c);
      if (p && p.score >= 6) probed.push(p);       // below this it is almost always noise
    }
    probed.sort((a, b) => b.score - a.score);
    out.push({ state: name, ...cfg, member: MEMBERS.has(name), candidates: probed });
    const tag = MEMBERS.has(name) ? ' [MEMBER]' : '';
    if (!asJson) {
      console.log(`\n=== ${name.toUpperCase()} (${cfg.abbr})${tag} — ${cfg.why}`);
      if (!probed.length) { console.log('    no promising public service found by this search'); continue; }
      for (const p of probed.slice(0, 4)) {
        const sig = Object.keys(p.hits).join(',');
        console.log(`    [${String(p.score).padStart(2)}] ${p.title.slice(0, 52)}`);
        console.log(`         ${p.layerName || '?'} | ${p.geomType || '?'} | records=${p.count ?? '?'} | owner=${p.owner}`);
        console.log(`         signals: ${sig}`);
        console.log(`         ${p.layerUrl}`);
      }
    }
  }
  if (asJson) console.log(JSON.stringify(out, null, 2));
  else {
    const withAny = out.filter((o) => o.candidates.length);
    console.log(`\n${withAny.length}/${out.length} states returned a candidate worth reading.`);
    console.log('A score is a prompt to look, not a verdict: field presence is not field population.');
  }
})();
