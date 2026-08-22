/**
 * Regular-event (non-work-zone) ingest adapters.
 *
 * Pulls incidents / closures / conditions / special events from each state's own
 * feed and normalizes them to the internal event shape the map/cache already use.
 * Complements the WZDx work-zone feeds (which stay in API_CONFIG). Filtered to
 * INTERSTATE events only (the platform is interstate-focused) to keep the payload
 * and egress lean. Every adapter is fail-safe: a bad/slow feed yields [] and never
 * breaks the refresh. See docs/REGULAR_EVENT_FEED_STATE_SURVEY.md.
 */

const https = require('https');

function getJSON(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('parse')); } });
    }).on('error', reject).setTimeout(timeoutMs, function () { this.destroy(); reject(new Error('timeout')); });
  });
}

// Interstate route from a road string, else null (non-interstate events are dropped).
function interstate(s) {
  const m = String(s || '').toUpperCase().match(/\bI[-\s]?(\d{1,3})\b/);
  return m ? `I-${parseInt(m[1], 10)}` : null;
}
const toISO = (v) => (typeof v === 'number' ? new Date(v).toISOString() : (v || null));

function mkEvent(o) {
  const lon = parseFloat(o.lon), lat = parseFloat(o.lat);
  const hasPos = Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lon === 0 && lat === 0);
  return {
    id: String(o.id),
    state: o.state,
    source: o.source,
    corridor: o.corridor,
    eventType: o.eventType || 'Incident',
    type: (o.eventType || 'incident').toLowerCase(),
    description: o.description || '',
    location: o.location || o.corridor || '',
    direction: o.direction || null,
    severity: o.severity || null,
    roadStatus: o.closed ? 'Closed' : undefined,
    ...(hasPos ? { latitude: lat, longitude: lon, coordinates: [lon, lat], geometry: { type: 'Point', coordinates: [lon, lat] } } : {}),
    startTime: toISO(o.start),
    endTime: toISO(o.end),
    created: new Date().toISOString(),
    updated: new Date().toISOString()
  };
}

// Generic ArcGIS FeatureServer query → interstate events via a per-source mapper.
async function arcgisEvents(url, map) {
  const j = await getJSON(`${url}${url.includes('?') ? '&' : '?'}where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=json&resultRecordCount=3000`);
  const out = [];
  for (const f of (j.features || [])) {
    const a = f.attributes || {};
    const g = f.geometry || {};
    const e = map(a, g);
    if (e && e.corridor) out.push(mkEvent(e));
  }
  return out;
}

// ---- per-state adapters -----------------------------------------------------

async function newyork() {
  const rows = await getJSON('https://511ny.org/api/getevents?format=json');
  const out = [];
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const et = String(r.EventType || '');
    if (/roadwork|transit/i.test(et)) continue;              // work zones come from WZDx
    const corridor = interstate(r.RoadwayName);
    if (!corridor) continue;
    out.push(mkEvent({
      id: `NY-EV-${r.ID || r.Id}`, state: 'New York', source: '511NY', corridor,
      eventType: /closure/i.test(et) ? 'Closure' : /special/i.test(et) ? 'Special Event' : 'Incident',
      description: r.Description, location: r.RoadwayName, direction: r.DirectionOfTravel || r.Direction,
      severity: r.Severity, lon: r.Longitude, lat: r.Latitude, start: r.StartDate, end: r.PlannedEndDate
    }));
  }
  return out;
}

function ncMap(a, g) {
  const corridor = interstate(a.Road || a.RouteType);
  if (!corridor) return null;
  return {
    id: `NC-${a.Id || a.OBJECTID}`, state: 'North Carolina', source: 'NCDOT TIMS', corridor,
    eventType: /closure/i.test(a.EventType || '') ? 'Closure' : 'Incident',
    description: a.Location || a.Reason || a.EventSubType, location: a.Road,
    direction: a.DirectionOfTravel, closed: a.IsFullClosure === 'Yes' || a.IsFullClosure === true,
    lon: a.Longitude ?? g.x, lat: a.Latitude ?? g.y, start: a.StartDateTime, end: a.EndDateTime
  };
}
const northcarolina = () => arcgisEvents('https://services.arcgis.com/NuWFvHYDMVmmxMeM/ArcGIS/rest/services/NCDOT_TIMS_Incidents/FeatureServer/0/query', ncMap);

function waMap(a, g) {
  const corridor = interstate(a.Road);
  if (!corridor) return null;
  return {
    id: `WA-${a.AlertID || a.OBJECTID}`, state: 'Washington', source: 'WSDOT', corridor,
    eventType: a.RoadClosedFlag ? 'Closure' : (a.EventCategoryDescription || 'Incident'),
    description: a.HeadlineMessage || a.TypeDescription, location: a.Road, direction: a.RoadDirection,
    closed: !!a.RoadClosedFlag, lon: g.x, lat: g.y, start: a.StartTime, end: a.EndTime
  };
}
const washington = () => arcgisEvents('https://data.wsdot.wa.gov/arcgis/rest/services/TravelInformation/TravelInfoRoadAlerts/FeatureServer/0/query', waMap);

function flMap(a, g) {
  const corridor = interstate(a.highway || a.roadwayName);
  if (!corridor) return null;
  return {
    id: `FL-${a.id || a.OBJECTID}`, state: 'Florida', source: 'FDOT SunGuide', corridor,
    eventType: /closure|closed/i.test(a.type || '') ? 'Closure' : 'Incident',
    description: a.description, location: a.highway, direction: a.direction, severity: a.severity,
    lon: a.longitude ?? g.x, lat: a.latitude ?? g.y, start: a.starttime, end: a.endtime
  };
}
const florida = () => arcgisEvents('https://gis.fdot.gov/arcgis/rest/services/DIVAS_GetEvent/FeatureServer/0/query', flMap);

async function colorado() {
  const key = process.env.COLORADO_API_KEY;
  if (!key) return [];
  const j = await getJSON(`https://data.cotrip.org/api/v1/incidents?apiKey=${encodeURIComponent(key)}`);
  const out = [];
  for (const f of (j.features || [])) {
    const p = f.properties || {};
    const corridor = interstate(p.routeName || p.name || (p.travelerInformationMessage || ''));
    if (!corridor) continue;
    const g = f.geometry || {};
    const c = g.type === 'Point' ? g.coordinates : (Array.isArray(g.coordinates) ? g.coordinates[0] : null);
    out.push(mkEvent({
      id: `CO-${p.id || f.id}`, state: 'Colorado', source: 'COtrip', corridor,
      eventType: /closure|closed/i.test(p.type || '') ? 'Closure' : 'Incident',
      description: p.travelerInformationMessage || p.type, location: p.routeName || corridor,
      direction: p.direction, lon: c && c[0], lat: c && c[1],
      start: p.startTime, end: p.clearTime || p.estimatedClearTime
    }));
  }
  return out;
}

const ADAPTERS = { newyork, northcarolina, washington, florida, colorado };

// Run all adapters concurrently; never throws. Returns { events, errors, counts }.
async function fetchAll() {
  const names = Object.keys(ADAPTERS);
  const results = await Promise.all(names.map((n) =>
    ADAPTERS[n]().catch((e) => { console.error(`event-adapter ${n}:`, e.message); return { __err: e.message }; })));
  const events = [], errors = [], counts = {};
  results.forEach((r, i) => {
    if (Array.isArray(r)) { events.push(...r); counts[names[i]] = r.length; }
    else errors.push(`${names[i]}: ${r.__err}`);
  });
  return { events, errors, counts };
}

module.exports = { fetchAll, ADAPTERS, interstate };
