/**
 * nbi-clearance.js — server-side bridge-clearance enrichment for DTCD.
 *
 * Ports the builders' validated over/under-route logic to the backend so ANY work zone flowing into
 * the DTCD / CWZ feed can be annotated with the overhead structures that actually restrict it — the ones
 * the route passes UNDER — each with its clearance, over/under relation, and NBI inspection date. Works
 * regardless of whether the source feed carried clearance data. Server-side, so CORS is irrelevant.
 *
 * A structure only restricts YOUR clearance when your route passes UNDER it (it crosses over you). If it
 * CARRIES your route over something, its underclearance is for the traffic below — not you.
 */
const https = require('https');

const NBI_QUERY = 'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_National_Bridge_Inventory/FeatureServer/0/query';
const M2FT = 3.28084;

// Normalize a road string (NBI carries/crosses OR the WZ route) to a comparable key.
function roadKey(s) {
  s = String(s || '').toUpperCase();
  let m = s.match(/\b(?:IH|INTERSTATE|I)[-\s]?0*(\d+)/); if (m) return 'I' + m[1];
  m = s.match(/\b(?:USH|US|U\.?S\.?)[-\s]?0*(\d+)/); if (m) return 'US' + m[1];
  m = s.match(/\b(?:STATE\s*(?:ROUTE|RT|HWY|HIGHWAY)|SR|SH|RTE|ROUTE|HWY)[-\s]?0*(\d+)/); if (m) return 'S' + m[1];
  return null;
}
// True if road string s references route `key` anywhere (handles multi-route crossings like "I-35 & I-80").
function roadHas(s, key) {
  if (!key) return false; s = String(s || '').toUpperCase();
  const re = /\b(?:IH|INTERSTATE|I)[-\s]?0*(\d+)|\b(?:USH|US|U\.?S\.?)[-\s]?0*(\d+)|\b(?:STATE\s*(?:ROUTE|RT|HWY|HIGHWAY)|SR|SH|RTE|ROUTE|HWY)[-\s]?0*(\d+)/g;
  let m; while ((m = re.exec(s))) { const k = m[1] != null ? 'I' + m[1] : m[2] != null ? 'US' + m[2] : 'S' + m[3]; if (k === key) return true; }
  return false;
}
// NBI item 90 inspection date is MMYY ("323"=03/2023) — the date the clearance was last recorded.
function nbiDate(x) {
  x = String(x == null ? '' : x).trim(); if (!/^\d{3,4}$/.test(x)) return null;
  const yy = +x.slice(-2), mm = x.slice(0, -2); return (mm.length < 2 ? '0' + mm : mm) + '/' + (yy > 60 ? 1900 + yy : 2000 + yy);
}
function ftIn(ft) { const f = Math.floor(ft), inch = Math.round((ft - f) * 12); return inch ? (f + "'" + inch + '"') : (f + "'"); }

// The national NBI layer often returns slow/error on the first spatial query then works warm — retry once.
function jget(url) {
  return new Promise((resolve) => {
    let done = false; const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const req = https.get(url, { timeout: 20000 }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { finish(JSON.parse(d)); } catch (e) { finish({ error: 1 }); } }); });
    req.on('timeout', () => { req.destroy(); finish({ error: 1 }); });
    req.on('error', () => finish({ error: 1 }));
  });
}
async function jgetRetry(url) {
  let j = await jget(url);
  if (j && !j.error) return j;
  await new Promise(r => setTimeout(r, 700));
  return jget(url);
}

async function fetchNBI(bbox) {   // bbox = [W, S, E, N]
  const url = NBI_QUERY + '?where=' + encodeURIComponent('VERT_CLR_UND_054B>0')
    + '&geometry=' + bbox.join(',') + '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects'
    + '&outFields=VERT_CLR_UND_054B,LAT_UND_MT_055B,HORR_CLR_MT_047,FEATURES_DESC_006A,FACILITY_CARRIED_007,DATE_OF_INSPECT_090'
    + '&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=json';
  const j = await jgetRetry(url); if (!j || j.error) return [];
  return (j.features || []).map(f => {
    const a = f.attributes, g = f.geometry; if (!g || g.x == null) return null;
    const clr = +a.VERT_CLR_UND_054B * M2FT; if (!(clr > 0) || clr > 30) return null;   // >30ft = effectively unrestricted
    let w = null; if (+a.LAT_UND_MT_055B > 0) w = +a.LAT_UND_MT_055B * M2FT; else if (+a.HORR_CLR_MT_047 > 0 && +a.HORR_CLR_MT_047 < 30) w = +a.HORR_CLR_MT_047 * M2FT;
    const carries = (a.FACILITY_CARRIED_007 || '').trim(), crosses = (a.FEATURES_DESC_006A || '').trim();
    return { lon: g.x, lat: g.y, clearance_ft: +clr.toFixed(1), width_ft: w ? +w.toFixed(1) : null, carries, crosses, recorded: nbiDate(a.DATE_OF_INSPECT_090) };
  }).filter(Boolean);
}

// Geometry / route extraction from a WZDx RoadEventFeature (or a bare {coordinates, route}).
function coordsFrom(x) {
  const g = x && x.geometry ? x.geometry : x;
  if (g && g.type === 'LineString' && Array.isArray(g.coordinates)) return g.coordinates;
  if (Array.isArray(g) && Array.isArray(g[0])) return g;
  if (x && Array.isArray(x.coordinates) && Array.isArray(x.coordinates[0])) return x.coordinates;
  return null;
}
function routeFrom(x) {
  const cd = x && x.properties && x.properties.core_details;
  if (cd && Array.isArray(cd.road_names) && cd.road_names.length) return cd.road_names[0];
  return (x && x.route) || null;
}
function bboxOf(coords, pad) { let W = 180, S = 90, E = -180, N = -90; coords.forEach(c => { if (c[0] < W) W = c[0]; if (c[0] > E) E = c[0]; if (c[1] < S) S = c[1]; if (c[1] > N) N = c[1]; }); return [W - pad, S - pad, E + pad, N + pad]; }
function minDistM(pt, coords) {   // pt {lon,lat}; planar approx → meters
  const k = Math.cos(pt.lat * Math.PI / 180); let best = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const A = coords[i - 1], B = coords[i], ax = A[0] * k, ay = A[1], bx = B[0] * k, by = B[1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-12;
    let t = ((pt.lon * k - ax) * dx + (pt.lat - ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
    const fx = ax + t * dx, fy = ay + t * dy, dDeg = Math.hypot(pt.lon * k - fx, pt.lat - fy);
    if (dDeg < best) best = dDeg;
  }
  return best * 111320;
}

/**
 * clearancesForRoute(coords, route, opts) → { route, structures, restricting, governing, governing_clearance_ft }
 * `structures` = every NBI bridge within opts.thresholdM (default 1000) of the geometry, classified
 * rel = 'under' (route passes under it → restricts) | 'over' (carries the route → n/a) | 'unknown'.
 * `restricting` / `governing` = only the ones that actually limit the route (rel !== 'over').
 */
async function clearancesForRoute(coords, route, opts = {}) {
  if (!coords || coords.length < 2) return { route: route || null, structures: [], restricting: [], governing: null, governing_clearance_ft: null, note: 'no usable geometry' };
  const TH = opts.thresholdM || 1000;
  const bridges = await fetchNBI(bboxOf(coords, 0.015));
  const wk = roadKey(route);
  const near = [];
  for (const b of bridges) {
    const d = minDistM({ lon: b.lon, lat: b.lat }, coords); if (d > TH) continue;
    const rel = (wk && roadHas(b.crosses, wk)) ? 'under' : (wk && roadHas(b.carries, wk)) ? 'over' : 'unknown';
    near.push({ ...b, rel, distance_m: Math.round(d) });
  }
  near.sort((a, b) => a.clearance_ft - b.clearance_ft);
  const restricting = near.filter(b => b.rel !== 'over');
  const governing = restricting[0] || null;
  return { route: route || null, structures: near, restricting, governing, governing_clearance_ft: governing ? governing.clearance_ft : null };
}

/**
 * enrichFeature(feature, opts) → a copy of the WZDx RoadEventFeature with:
 *   - properties.x_bridge_clearances : { source, governing_clearance_ft, restricting:[{carries,crosses,clearance_ft,relation,recorded,coordinates}] }
 *   - a merged WZDx reduced-height restriction from the governing clearance.
 * This is what DTCD ingest calls per work zone so the served /cwz feed carries clearance intelligence.
 */
async function enrichFeature(feature, opts = {}) {
  const res = await clearancesForRoute(coordsFrom(feature), routeFrom(feature), opts);
  const f = JSON.parse(JSON.stringify(feature)); f.properties = f.properties || {};
  f.properties.x_bridge_clearances = {
    source: 'NBI (NTAD)',
    checked_at: opts.now || new Date().toISOString(),
    governing_clearance_ft: res.governing_clearance_ft,
    restricting: res.restricting.map(b => ({ carries: b.carries, crosses: b.crosses, clearance_ft: b.clearance_ft, relation: b.rel, recorded: b.recorded, coordinates: [b.lon, b.lat] }))
  };
  if (res.governing) {
    const ft = res.governing.clearance_ft;
    f.properties.restrictions = (f.properties.restrictions || []).filter(r => r.type !== 'reduced-height');
    f.properties.restrictions.push({ type: 'reduced-height', value: ftIn(ft), unit: 'feet', value_ft: ft });
  }
  return f;
}

module.exports = { clearancesForRoute, enrichFeature, fetchNBI, roadKey, roadHas, nbiDate, ftIn };
