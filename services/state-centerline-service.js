/**
 * State Centerline Geometry Enrichment Service  (DRAFT)
 *
 * Enriches work-zone events with road-following geometry from a STATE's OWN
 * authoritative centerline, used as the FIRST tier before FHWA ARNOLD.
 *
 * Why: ARNOLD's per-state schemas are inconsistent (Utah keys routes as '0015',
 * California keys them as county/street-name composites like 'SAC_SAC_11TH ST_P'),
 * so the shared `route_id LIKE '0005%'` query in arnold-geometry-service returns
 * nothing for California/Texas. A state's own centerline uses a consistent
 * route + postmile + direction scheme that matches the source closure data.
 *
 * Order of enrichment (recommended): state centerline -> ARNOLD -> point fallback.
 *
 * California source: State Highway Network Lines (Caltrans GIS Open Data,
 *   dataset 77f2d7ba94e040a78bfbe36feb6279da_0). Confirm the FeatureServer query
 *   URL and the exact field names below against the live service before enabling.
 */

const axios = require('axios');
const turf = require('@turf/turf');

// Per-state centerline configuration. CONFIRM url + field names against the live service.
const STATE_CENTERLINES = {
  // California — Caltrans State Highway Network Lines (verified 2026-08-14; 5,266 segments,
  // small enough to fetch a whole route and cache). Direction = NB/SB/EB/WB.
  ca: {
    url: 'https://caltrans-gis.dot.ca.gov/arcgis/rest/services/CHhighway/SHN_Lines/FeatureServer/0/query',
    dirField: 'Direction',
    outFields: 'Route,Direction',
    buildWhere: (rn) => `Route = ${rn}`,
    useEnvelope: false,
    sourceLabel: 'Caltrans SHN'
  },
  // Texas — TxDOT_Roadways (verified 2026-08-14). Large statewide layer, so query by
  // route + a spatial envelope around the event. Interstates use RTE_PRFX='IH'; exclude
  // ramps/connectors/frontage so only mainline roadbeds remain. Direction = DES_DRCT
  // (Northbound/Southbound/...). Only interstate (IH) events are enriched here.
  tx: {
    url: 'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Roadways/FeatureServer/0/query',
    dirField: 'DES_DRCT',
    outFields: 'RTE_NM,DES_DRCT,RDBD_TYPE',
    buildWhere: (rn) => `RTE_PRFX='IH' AND RTE_NBR='${rn}' AND RDBD_TYPE NOT LIKE '%Ramp%' AND RDBD_TYPE NOT LIKE '%Connector%' AND RDBD_TYPE NOT LIKE '%Frontage%' AND RDBD_TYPE NOT LIKE '%Turnaround%'`,
    useEnvelope: true,
    sourceLabel: 'TxDOT Roadways'
  }
};

// Accept 'ca'/'california', 'tx'/'texas', etc.
const STATE_ALIASES = { california: 'ca', texas: 'tx' };
function cfgFor(stateKey) {
  const k = String(stateKey || '').toLowerCase();
  return STATE_CENTERLINES[k] || STATE_CENTERLINES[STATE_ALIASES[k]] || null;
}

function routeNumber(corridor) {
  if (!corridor) return null;
  const m = String(corridor).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function densify(line, spacingMeters = 15) {
  // line: turf LineString feature (WGS84). Insert points so gaps <= spacing, keep vertices.
  try {
    const out = [];
    const coords = line.geometry.coordinates;
    for (let i = 0; i < coords.length - 1; i++) {
      out.push(coords[i]);
      const seg = turf.lineString([coords[i], coords[i + 1]]);
      const len = turf.length(seg, { units: 'meters' });
      if (len > spacingMeters) {
        const n = Math.floor(len / spacingMeters);
        for (let k = 1; k <= n; k++) {
          out.push(turf.along(seg, k * spacingMeters, { units: 'meters' }).geometry.coordinates);
        }
      }
    }
    out.push(coords[coords.length - 1]);
    return out;
  } catch (_) {
    return line.geometry.coordinates;
  }
}

class StateCenterlineService {
  /** Fetch centerline segments for a route (whole route, or within an envelope for large layers). */
  async fetchLines(cfg, routeNum, begin) {
    const params = {
      where: cfg.buildWhere(routeNum),
      outFields: cfg.outFields,
      returnGeometry: true, f: 'geojson', outSR: 4326
    };
    if (cfg.useEnvelope && begin) {
      const d = 0.08; // ~9 km envelope for large statewide layers
      params.geometry = JSON.stringify({
        xmin: begin[0] - d, ymin: begin[1] - d, xmax: begin[0] + d, ymax: begin[1] + d,
        spatialReference: { wkid: 4326 }
      });
      params.geometryType = 'esriGeometryEnvelope';
      params.spatialRel = 'esriSpatialRelIntersects';
    }
    const resp = await axios.get(cfg.url, { params, timeout: 15000 });
    const feats = (resp.data && resp.data.features) || [];
    const lines = [];
    for (const f of feats) {
      const dir = String((f.properties || {})[cfg.dirField] || '');
      if (!f.geometry) continue;
      if (f.geometry.type === 'LineString') lines.push({ line: turf.lineString(f.geometry.coordinates), dir });
      else if (f.geometry.type === 'MultiLineString') f.geometry.coordinates.forEach(c => lines.push({ line: turf.lineString(c), dir }));
    }
    return lines;
  }

  /** Build road-following geometry for one event from pre-fetched route lines. */
  enrichFromLines(event, lines) {
    const begin = event.coordinates || (event.longitude != null ? [event.longitude, event.latitude] : null);
    if (!begin || !lines || !lines.length) return null;
    let candidates = lines;
    if (event.direction) {
      const want = String(event.direction).charAt(0).toUpperCase();
      const f2 = lines.filter(l => l.dir.charAt(0).toUpperCase() === want);
      if (f2.length) candidates = f2;
    }
    const beginPt = turf.point(begin);
    let best = null, bestDist = Infinity;
    for (const c of candidates) {
      const d = turf.pointToLineDistance(beginPt, c.line, { units: 'meters' });
      if (d < bestDist) { bestDist = d; best = c.line; }
    }
    if (!best || bestDist > 300) return null; // begin not near this route/carriageway
    let out = best;
    if (event.endCoordinates) {
      try {
        const s = turf.nearestPointOnLine(best, beginPt);
        const e = turf.nearestPointOnLine(best, turf.point(event.endCoordinates));
        const a = Math.min(s.properties.location, e.properties.location);
        const b = Math.max(s.properties.location, e.properties.location);
        if (b - a > 0.01) out = turf.lineSliceAlong(best, a, b, { units: 'kilometers' });
      } catch (_) { /* keep best */ }
    }
    return { type: 'LineString', coordinates: densify(out) };
  }

  /** Single-event convenience (fetches its route; no cross-event cache). */
  async enrichEventGeometry(event, stateKey) {
    const cfg = cfgFor(stateKey);
    if (!cfg) return null;
    const rn = routeNumber(event.corridor || event.route || event.location);
    if (!rn) return null;
    const begin = event.coordinates || (event.longitude != null ? [event.longitude, event.latitude] : null);
    try {
      const geom = this.enrichFromLines(event, await this.fetchLines(cfg, rn, begin));
      return geom ? { geometry: geom, geometry_source: cfg.sourceLabel } : null;
    } catch (_) { return null; }
  }

  /**
   * Enrich a batch. Leaves good (>2-point) line geometries untouched, caches route
   * segments (per route, or per route+area for envelope-based large layers) so many
   * events cost few API calls, and never throws (event returned unchanged on failure).
   */
  async enrichEvents(events, stateKey) {
    const cfg = cfgFor(stateKey);
    if (!cfg) return events;
    const cache = new Map();
    const out = [];
    let enriched = 0;
    for (const ev of events) {
      const hasLine = ev.geometry && ev.geometry.type === 'LineString' &&
        Array.isArray(ev.geometry.coordinates) && ev.geometry.coordinates.length > 2;
      const rn = routeNumber(ev.corridor || ev.route || ev.location);
      const begin = ev.coordinates || (ev.longitude != null ? [ev.longitude, ev.latitude] : null);
      if (hasLine || !rn || !begin) { out.push(ev); continue; }
      // cache key: whole-route for small layers; route + ~0.05deg cell for envelope layers
      const key = cfg.useEnvelope
        ? `${rn}:${Math.round(begin[0] * 20) / 20}:${Math.round(begin[1] * 20) / 20}`
        : `${rn}`;
      try {
        if (!cache.has(key)) cache.set(key, await this.fetchLines(cfg, rn, begin));
        const geom = this.enrichFromLines(ev, cache.get(key));
        if (geom) { out.push({ ...ev, geometry: geom, geometry_source: cfg.sourceLabel }); enriched++; }
        else out.push(ev);
      } catch (_) { out.push(ev); }
    }
    if (enriched) console.log(`✅ State centerline enrichment: ${enriched}/${events.length} events (${String(stateKey).toUpperCase()} centerline)`);
    return out;
  }
}

module.exports = new StateCenterlineService();
