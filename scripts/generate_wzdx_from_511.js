#!/usr/bin/env node
/**
 * Gather -> Translate -> Broadcast: a conformant WZDx 4.2 RoadEvent feed built from a state's
 * OWN public 511 platform, for states whose WZDx feed is missing, frozen, or thinner than the
 * data they already publish.
 *
 * Utah is why this exists. UDOT is a registered WZDx publisher, its feed returns HTTP 200, and
 * FHWA's registry lists it active on a 15-minute cycle -- but it has served the same
 * 2023-03-19 snapshot for roughly 1,290 days, so its real live work-zone count through WZDx is
 * zero. Meanwhile the same agency's 511 platform is current: 275 construction records, one of
 * them updated yesterday, plus 2,081 cameras and 221 message signs, all keyless and public.
 *
 * Nothing here needs UDOT to deploy anything, sign anything, or give anyone a key. It reads
 * only what the state already publishes to its own public map, and the state can take this
 * over and publish it themselves -- which is the point. The same shape works for any
 * one.network/IBI 511 platform, so Georgia, Nevada, Idaho and Louisiana are the same code
 * with a different base URL.
 *
 * TMDD note: UDOT exposes no public TMDD endpoint (every path probed returns 404), and the
 * CARS-style api/v2/get/* endpoints want a key. The 511 platform is fed by the same ATMS that
 * would populate a TMDD feed, so this reaches the same operational data by the route that is
 * already open. A member state sharing TMDD directly would improve it -- TMDD carries lane
 * detail and event classification this layer flattens -- but TMDD is not required to get them
 * current, and that is worth being precise about rather than overselling.
 *
 * WHAT THIS DOES NOT DO (§7 of the cwz-conformance method): it never invents an observation.
 * No worker_presence, no lane counts, no speed limits, no geometry extent beyond what the
 * source gives. Absent stays absent, and every field that had to be derived rather than read
 * is recorded in x_derived_from so a reviewer can audit the translation.
 *
 * Usage:
 *   node scripts/generate_wzdx_from_511.js utah            # write to stdout
 *   node scripts/generate_wzdx_from_511.js utah -o ut.json
 *   node scripts/generate_wzdx_from_511.js --list
 */

const https = require('https');
const zlib = require('zlib');
const fs = require('fs');

const STATES = {
  // Utah has a SECOND, richer public source than its 511 map, found by searching ArcGIS
  // Online for UDOT-owned services: 'Traffic Events View' (UPlan) carries everything the 511
  // layer does AND the two things the 511 layer cannot give -- MPStart/MPEnd and an
  // EncodedPolyline of the closure itself. Measured 2026-09-30 over 279 records:
  //   EncodedPolyline populated 71, of which 57 decode to multi-vertex extents
  //                   (median 27 vertices, max 522), all inside Utah's bbox
  //   MPStart/MPEnd   populated 71, of which 59 have start != end -> exact LRS location,
  //                   the best geometry class there is: no snapping, no tolerance
  //   Direction       208/279 (the 511 layer gives 135/267)
  //   LastUpdated     279/279
  // So Utah is built from this and the 511 path is kept only as a fallback.
  //
  // What it still does NOT give, and this is worth stating precisely because it is the
  // pooled-fund ask: LaneImpact and LanesAffected are populated on every record with the
  // literal string 'No Data'. There is no lane detail in any public UDOT source. That one
  // genuinely needs TMDD or direct ATMS access.
  utah:      { base: 'https://udottraffic.utah.gov', state: 'Utah', abbr: 'UT', tz: -7,
               org: 'Utah Department of Transportation', sourceId: 'UDOT-UPlan-TrafficEvents',
               arcgis: 'https://services.arcgis.com/pA2nEVnB6tquxgOW/arcgis/rest/services/Traffic_Events_View/FeatureServer/0' },
  georgia:   { base: 'https://511ga.org', state: 'Georgia', abbr: 'GA', tz: -4,
               org: 'Georgia Department of Transportation', sourceId: 'GDOT-511-Construction' },
  nevada:    { base: 'https://www.nvroads.com', state: 'Nevada', abbr: 'NV', tz: -7,
               org: 'Nevada Department of Transportation', sourceId: 'NDOT-511-Construction' },
  idaho:     { base: 'https://511.idaho.gov', state: 'Idaho', abbr: 'ID', tz: -6,
               org: 'Idaho Transportation Department', sourceId: 'ITD-511-Construction' },
  louisiana: { base: 'https://www.511la.org', state: 'Louisiana', abbr: 'LA', tz: -5,
               org: 'Louisiana DOTD', sourceId: 'LADOTD-511-Construction' }
};

function readBody(res) {
  const enc = String(res.headers['content-encoding'] || '').toLowerCase();
  const st = enc === 'gzip' ? res.pipe(zlib.createGunzip())
    : enc === 'deflate' ? res.pipe(zlib.createInflate()) : res;
  return new Promise((resolve, reject) => {
    let d = ''; st.on('data', (c) => (d += c));
    st.on('end', () => resolve(d)); st.on('error', reject);
  });
}
function post(url, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers: {
      'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest',
      'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'Mozilla/5.0', 'Content-Length': Buffer.byteLength(body)
    } }, (res) => readBody(res).then((d) => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('parse')); } }, reject));
    req.on('error', reject);
    req.setTimeout(timeoutMs, function () { this.destroy(); reject(new Error('timeout')); });
    req.write(body); req.end();
  });
}
function get(url, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: {
      Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest',
      'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'Mozilla/5.0'
    } }, (res) => readBody(res).then((d) => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('parse')); } }, reject));
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// The platform stamps dates as local wall-clock with a 2-digit year: "9/28/26, 10:49 AM".
// There is no offset in the string, so one has to be applied, and applying the WRONG one
// silently shifts every timestamp -- which for a freshness comparison is the entire point.
// The state's standard offset is used and RECORDED in the feed, rather than pretending the
// source told us. DST is not modelled: an hour of error is immaterial to a work zone's
// start date and inventing precision we do not have would be worse.
function toISO(s, tzHours) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s*(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) { const t = Date.parse(s); return Number.isFinite(t) ? new Date(t).toISOString() : null; }
  let [, mo, d, y, hh, mi, ap] = m;
  y = Number(y); if (y < 100) y += 2000;
  hh = Number(hh);
  if (ap) { const up = ap.toUpperCase(); if (up === 'PM' && hh !== 12) hh += 12; if (up === 'AM' && hh === 12) hh = 0; }
  const utc = Date.UTC(y, Number(mo) - 1, Number(d), hh - tzHours, Number(mi));
  return Number.isFinite(utc) ? new Date(utc).toISOString() : null;
}

// Measured, not assumed: UDOT writes 'NB' / 'SB', not 'north' or 'northbound'. A word-only
// map silently turned all 53 populated directions in the first page into 'unknown', which is
// the same class of quiet loss this whole exercise is about. Abbreviations, words and bare
// compass letters are all accepted; anything else stays 'unknown', which is a real WZDx value.
const DIRS = {
  n: 'northbound', s: 'southbound', e: 'eastbound', w: 'westbound',
  nb: 'northbound', sb: 'southbound', eb: 'eastbound', wb: 'westbound',
  north: 'northbound', south: 'southbound', east: 'eastbound', west: 'westbound',
  northbound: 'northbound', southbound: 'southbound', eastbound: 'eastbound', westbound: 'westbound'
};
function direction(raw) {
  const t = String(raw || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  return DIRS[t] || 'unknown';
}

// WZDx restrictions, read straight from the platform's own restriction fields. Only emitted
// when a value is actually present and non-zero -- several publishers write 0 to mean "none",
// and passing that through would assert a zero-foot clearance.
function restrictions(r) {
  const out = [];
  const add = (type, v, unit) => {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out.push({ type, value: n, unit });
  };
  add('reduced-height', r.heightRestriction, 'feet');
  add('reduced-width', r.widthRestriction, 'feet');
  add('reduced-length', r.lengthRestriction, 'feet');
  add('gross-weight-limit', r.weightRestriction, 'pounds');
  return out;
}

function build(cfg, rows, coords, now) {
  const features = [];
  const derivedTally = {};
  const note = (k) => { derivedTally[k] = (derivedTally[k] || 0) + 1; };

  for (const r of rows) {
    const id = String(r.DT_RowId != null ? r.DT_RowId : r.id);
    const ll = coords.get(id);
    if (!ll) { note('skipped_no_position'); continue; }   // no position, no usable road event

    const road = String(r.roadwayName || '').trim();
    if (!road) { note('skipped_no_road_name'); continue; }

    const derived = [];
    const dir = direction(r.direction);
    if (dir === 'unknown') { derived.push('direction:unknown-in-source'); note('direction_unknown'); }
    else note('direction_known');

    const start = toISO(r.startDate, cfg.tz);
    const end = toISO(r.endDate, cfg.tz);
    const updated = toISO(r.lastUpdated, cfg.tz) || null;
    if (!updated) derived.push('update_date:absent-in-source');

    const desc = [r.description, r.locationDescription].map((x) => String(x || '').trim())
      .filter(Boolean).join(' — ').replace(/\s*\n+\s*/g, ' ').slice(0, 1000) || null;

    const core = {
      event_type: 'work-zone',
      data_source_id: cfg.sourceId,
      road_names: [road],
      direction: dir,
      description: desc,
      name: `${cfg.abbr}-511-${id}`
    };
    if (updated) core.update_date = updated;

    const props = {
      core_details: core,
      // isFullClosure is a boolean, so full closure is knowable and anything else is not:
      // the platform does not say how many lanes are affected, and 'some-lanes-closed' would
      // be a guess. 'unknown' is the honest WZDx value.
      vehicle_impact: r.isFullClosure === true || r.isFullClosure === 'true' ? 'all-lanes-closed' : 'unknown',
      // Position comes from the platform's own map pin, which is a single point. A point is
      // not an extent, so both verification flags are false -- the source never published a
      // start and end, and claiming otherwise is the defect this whole exercise is about.
      is_start_position_verified: false,
      is_end_position_verified: false,
      is_start_date_verified: false,
      is_end_date_verified: false,
      x_source_record_id: id,
      x_source_system: String(r.source || '511'),
      x_derived_from: derived.length ? derived : undefined
    };
    if (start) props.start_date = start;
    if (end) props.end_date = end;
    if (r.county) props.x_county = r.county;
    if (r.detourDescription) props.x_detour_description = String(r.detourDescription).slice(0, 500);
    if (r.laneDescription) props.x_lane_description = String(r.laneDescription).slice(0, 500);
    const rest = restrictions(r);
    if (rest.length) props.restrictions = rest;
    if (r.isFullClosure === true || r.isFullClosure === 'true') note('full_closure');
    if (rest.length) note('with_restrictions');
    if (updated) note('with_update_date');

    features.push({
      id: `${cfg.abbr}-511-${id}`,
      type: 'Feature',
      properties: props,
      geometry: { type: 'Point', coordinates: ll }
    });
  }

  // Feed metadata. update_date is the NEWEST event timestamp we actually observed, never the
  // clock: stamping "now" on a feed is precisely how a frozen publisher goes on looking live.
  const newest = features
    .map((f) => f.properties.core_details.update_date)
    .filter(Boolean).sort().pop() || null;

  const feedInfo = {
    update_date: newest || new Date(now).toISOString(),
    publisher: cfg.org,
    version: '4.2',
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    contact_name: 'see publisher',
    update_frequency: 300,
    data_sources: [{
      data_source_id: cfg.sourceId,
      organization_name: cfg.org,
      update_date: newest || new Date(now).toISOString()
    }],
    // Say where this came from and what was assumed. A translated feed that hides its
    // provenance is harder to trust than one that states it.
    x_translation: {
      built_from: `${cfg.base}/List/GetData/Construction + /map/mapIcons/Construction`,
      built_at: new Date(now).toISOString(),
      timezone_assumed: `UTC${cfg.tz >= 0 ? '+' : ''}${cfg.tz} (source timestamps carry no offset; DST not modelled)`,
      feed_update_date_is: 'the newest observed event update_date, not generation time',
      never_synthesized: ['worker_presence', 'lanes', 'reduced_speed_limit_kph', 'types_of_work', 'geometry extent']
    }
  };

  return {
    doc: { road_event_feed_info: feedInfo, feed_info: feedInfo, type: 'FeatureCollection', features },
    tally: derivedTally,
    newest
  };
}

function vehicleImpactFrom(a) {
  if (String(a.IsFullClosure) === 'true' || a.IsFullClosure === true) return 'all-lanes-closed';
  const cat = String(a.EventCategory || '');
  if (/road closure|bridge closure|full closure/i.test(cat)) return 'all-lanes-closed';
  if (/lane closure|one-way|shoulder/i.test(cat)) return 'some-lanes-closed';
  return 'unknown';
}

// Build from an ArcGIS event service that carries mileposts and an encoded polyline.
// Geometry preference is deliberate and ordered by what the publisher actually asserted:
//   1. decoded EncodedPolyline  -> a real extent the publisher drew
//   2. distinct MPStart/MPEnd   -> an exact LRS span, recorded for the correction cascade
//   3. the service's own point  -> position only, and both verification flags stay false
// A polyline that fails to decode falls through to the point rather than being dropped: 14 of
// the 71 do not decode, and losing a real closure to a bad string would be the wrong trade.
function buildFromArcgis(cfg, feats, now) {
  const poly = require('@mapbox/polyline');
  const features = [];
  const tally = {};
  const note = (k) => { tally[k] = (tally[k] || 0) + 1; };

  for (const f of feats) {
    const a = f.properties || {};
    // Filter on Reason, not EventCategory. EventCategory is a MIX -- measured over 279
    // records: Road Maintenance 91, Lane Closure 85, Construction 81, Road Closure 12,
    // One-Way Traffic 4, Alert 3, Bridge Closure 2 -- and all of those except Alert are work
    // zones. Keying the filter on it kept only the 82 literally labelled 'Construction' and
    // silently discarded 197 real work zones. `Reason` is 'roadwork' on all 279, which is the
    // signal that actually means "this is roadwork".
    const reason = String(a.Reason || '');
    const subType = String(a.EventSubType || '');
    if (!/roadwork|construction|maintenance/i.test(reason + ' ' + subType)) { note('skipped_not_roadwork'); continue; }
    const road = String(a.StreetName || '').trim();
    if (!road) { note('skipped_no_road_name'); continue; }
    const id = String(a.ClosureID || a.OBJECTID || a.ID);

    let geometry = null;
    let geomSrc = null;
    if (a.EncodedPolyline) {
      try {
        const pts = poly.decode(String(a.EncodedPolyline));            // [[lat,lon], ...]
        const coords = pts.filter((q) => Math.abs(q[0]) <= 90 && Math.abs(q[1]) <= 180).map((q) => [q[1], q[0]]);
        if (coords.length > 1) { geometry = { type: 'LineString', coordinates: coords }; geomSrc = 'encoded-polyline'; note('extent_from_polyline'); }
        else note('polyline_undecodable');
      } catch (_) { note('polyline_undecodable'); }
    }
    if (!geometry) {
      const g = f.geometry || {};
      const c = g.coordinates;
      if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
        geometry = { type: 'Point', coordinates: [c[0], c[1]] }; geomSrc = 'service-point'; note('point_only');
      }
    }
    if (!geometry) { note('skipped_no_position'); continue; }

    // Mileposts arrive as text ('MP 323'), so the number is pulled out rather than cast.
    const mp = (v) => { const m = String(v == null ? '' : v).match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
    const mps = mp(a.MPStart), mpe = mp(a.MPEnd);
    const exactSpan = mps !== null && mpe !== null && mps !== mpe;
    if (exactSpan) note('exact_lrs_span');

    const dir = direction(a.Direction || a.DirectionOfTravel);
    if (dir === 'unknown') note('direction_unknown'); else note('direction_known');
    note('impact_' + vehicleImpactFrom(a).replace(/-/g, '_'));
    const updated = toISO(a.LastUpdated, cfg.tz);
    if (updated) note('with_update_date');

    const core = {
      event_type: 'work-zone',
      data_source_id: cfg.sourceId,
      road_names: [road],
      direction: dir,
      description: String(a.Description || a.Location || '').replace(/\s*\n+\s*/g, ' ').slice(0, 1000) || null,
      name: `${cfg.abbr}-${id}`
    };
    if (updated) core.update_date = updated;

    const props = {
      core_details: core,
      // EventCategory is the publisher's own impact classification, so it answers
      // vehicle_impact -- which was being thrown away while the field was hardcoded
      // 'unknown'. A full/bridge closure closes all lanes; a lane closure or one-way
      // restriction closes some. Road Maintenance and Construction say nothing about lanes
      // on their own and stay 'unknown', which is a real WZDx value and the honest one.
      vehicle_impact: vehicleImpactFrom(a),
      // Only a polyline the publisher drew justifies claiming the position is verified, and
      // even then only its start. A point never does.
      is_start_position_verified: geomSrc === 'encoded-polyline',
      is_end_position_verified: geomSrc === 'encoded-polyline',
      is_start_date_verified: false,
      is_end_date_verified: false,
      x_source_record_id: id,
      x_geometry_source: geomSrc,
      x_source_system: String(a.Organization || 'UDOT')
    };
    if (mps !== null) props.beginning_milepost = mps;
    if (mpe !== null) props.ending_milepost = mpe;
    if (a.County) props.x_county = a.County;
    if (a.Reason) props.types_of_work = [{ type_name: /roadwork|construction/i.test(String(a.Reason)) ? 'maintenance' : 'other' }];
    if (a.DetourInstructions) props.x_detour_description = String(a.DetourInstructions).slice(0, 500);
    // LaneImpact is the literal string 'No Data' on every record, so it is NOT emitted as
    // lane information. Recording the absence is the honest move; inventing lanes is not.
    if (a.LaneImpact && !/^no data$/i.test(String(a.LaneImpact))) props.x_lane_impact = String(a.LaneImpact);
    else note('lane_data_absent_in_source');

    features.push({ id: `${cfg.abbr}-${id}`, type: 'Feature', properties: props, geometry });
  }

  const newest = features.map((f) => f.properties.core_details.update_date).filter(Boolean).sort().pop() || null;
  const feedInfo = {
    update_date: newest || new Date(now).toISOString(),
    publisher: cfg.org, version: '4.2',
    license: 'https://creativecommons.org/publicdomain/zero/1.0/',
    update_frequency: 300,
    data_sources: [{ data_source_id: cfg.sourceId, organization_name: cfg.org, update_date: newest || new Date(now).toISOString() }],
    x_translation: {
      built_from: cfg.arcgis,
      built_at: new Date(now).toISOString(),
      timezone_assumed: `UTC${cfg.tz >= 0 ? '+' : ''}${cfg.tz} (source timestamps carry no offset; DST not modelled)`,
      feed_update_date_is: 'the newest observed event update_date, not generation time',
      never_synthesized: ['worker_presence', 'lanes', 'reduced_speed_limit_kph', 'geometry extent beyond the published polyline']
    }
  };
  return { doc: { road_event_feed_info: feedInfo, feed_info: feedInfo, type: 'FeatureCollection', features }, tally, newest };
}

async function fetchArcgis(cfg) {
  const url = `${cfg.arcgis}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=geojson`;
  const j = await get(url, 45000);
  return (j && j.features) || [];
}

async function fetchAll(cfg) {
  const icons = await get(`${cfg.base}/map/mapIcons/Construction`);
  const coords = new Map();
  for (const it of ((icons && icons.item2) || [])) {
    const L = it.location;                                   // [lat, lon] — reversed vs GeoJSON
    if (Array.isArray(L) && L.length >= 2) coords.set(String(it.itemId), [L[1], L[0]]);
  }
  const rows = [];
  let start = 0, total = Infinity;
  while (start < total && start < 20000) {
    const j = await post(`${cfg.base}/List/GetData/Construction`, `draw=1&start=${start}&length=1000`);
    const page = (j && j.data) || [];
    if (j && j.recordsTotal) total = j.recordsTotal;
    if (!page.length) break;
    rows.push(...page);
    start += page.length;                                    // the RETURNED count; pages cap at 100
  }
  return { rows, coords };
}

(async () => {
  const args = process.argv.slice(2);
  if (args.includes('--list') || !args.length) {
    console.log('states: ' + Object.keys(STATES).join(', '));
    if (!args.length) process.exit(1);
    process.exit(0);
  }
  const name = args[0].toLowerCase();
  const cfg = STATES[name];
  if (!cfg) { console.error(`unknown state '${name}' — try --list`); process.exit(1); }
  const oi = args.indexOf('-o');
  const outPath = oi >= 0 ? args[oi + 1] : null;

  let doc, tally, newest, sourceLabel;
  if (cfg.arcgis) {
    const feats = await fetchArcgis(cfg);
    ({ doc, tally, newest } = buildFromArcgis(cfg, feats, Date.now()));
    sourceLabel = `${feats.length} ArcGIS event records`;
  } else {
    const { rows, coords } = await fetchAll(cfg);
    ({ doc, tally, newest } = build(cfg, rows, coords, Date.now()));
    sourceLabel = `${rows.length} 511 source records`;
  }

  const json = JSON.stringify(doc, null, 2);
  if (outPath) fs.writeFileSync(outPath, json); else console.log(json);

  const ageD = newest ? Math.round((Date.now() - Date.parse(newest)) / 86400000) : null;
  console.error(`\n${cfg.state}: ${sourceLabel} -> ${doc.features.length} WZDx work zones`);
  console.error(`  newest update_date: ${newest || '(none)'}${ageD !== null ? `  (${ageD}d old)` : ''}`);
  console.error(`  ${JSON.stringify(tally)}`);
  if (outPath) console.error(`  written to ${outPath}`);
})();
