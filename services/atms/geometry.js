'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const turf = require('@turf/turf');

const point = p => Array.isArray(p) && p.length >= 2 && p.length <= 3 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
function normalize(input) {
  try {
    if (typeof input === 'string') { if (input.length > 500000) return null; input = JSON.parse(input); }
    if (!input || !['Point', 'LineString', 'MultiLineString'].includes(input.type)) return null;
    const coordinates = input.coordinates;
    const parts = input.type === 'Point' ? [[coordinates]] : input.type === 'LineString' ? [coordinates] : coordinates;
    if (!Array.isArray(parts) || !parts.length || parts.length > 1000) return null;
    let count = 0;
    for (const part of parts) {
      if (!Array.isArray(part) || part.length < (input.type === 'Point' ? 1 : 2)) return null;
      count += part.length; if (count > 10000 || !part.every(point)) return null;
      if (input.type !== 'Point' && !part.some(p => p[0] !== part[0][0] || p[1] !== part[0][1])) return null;
    }
    const clean = parts.map(part => part.map(p => p.slice(0, 2)));
    return { type: input.type, coordinates: input.type === 'Point' ? clean[0][0] : input.type === 'LineString' ? clean[0] : clean };
  } catch { return null; }
}
const first = g => !g ? null : g.type === 'Point' ? g.coordinates : g.type === 'LineString' ? g.coordinates[0] : g.coordinates[0][0];
const hash = geometry => createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
function sourceGeometry(raw, sourceName, observedAt) {
  const geometry = normalize(raw.geometry);
  let tag = raw.geometry_source || raw.geometrySource;
  if (!tag && raw.geometry && typeof raw.geometry === 'object') tag = raw.geometry.geometrySource;
  if (!tag && typeof raw.geometry === 'string' && raw.geometry.length <= 500000) { try { tag = JSON.parse(raw.geometry)?.geometrySource; } catch { /* Invalid geometry stays missing. */ } }
  tag = typeof tag === 'string' ? tag.slice(0, 180) : '';
  const derived = /arnold|all.routes|snap|osrm|offset|straight|interpol|polyline|state_dot/i.test(tag) && !/^feed[_ ]polyline$/i.test(tag);
  return { geometry, geometryEvidence: {
    status: geometry ? derived ? 'derived' : 'source_reported' : 'missing',
    source: String(sourceName).slice(0, 180), method: tag || 'Source-supplied geometry', observedAt,
    fingerprint: hash(geometry), reviewedBy: null, reviewedAt: null,
    sourceClaims: { startPositionVerified: typeof (raw.is_start_position_verified ?? raw.properties?.is_start_position_verified) === 'boolean' ? (raw.is_start_position_verified ?? raw.properties.is_start_position_verified) : null, endPositionVerified: typeof (raw.is_end_position_verified ?? raw.properties?.is_end_position_verified) === 'boolean' ? (raw.is_end_position_verified ?? raw.properties.is_end_position_verified) : null },
    note: geometry ? derived ? 'Road-network-derived location requires operator review.' : 'Source geometry preserved; field verification has not been established by the ATMS.' : 'No valid source geometry. An operator location or road-network segment is required.'
  } };
}
const routeKey = value => String(value || '').toUpperCase().replace(/INTERSTATE/g, 'I').replace(/[^A-Z0-9]/g, '').replace(/^I0+(\d)/, 'I$1');
const direction = value => ({ E: 'eastbound', EB: 'eastbound', EASTBOUND: 'eastbound', W: 'westbound', WB: 'westbound', WESTBOUND: 'westbound', N: 'northbound', NB: 'northbound', NORTHBOUND: 'northbound', S: 'southbound', SB: 'southbound', SOUTHBOUND: 'southbound', BOTH: 'both' })[String(value || '').toUpperCase()] || null;

// A server-provisioned catalog avoids remote lookups inside SQLite transactions.
// Features must name their agency route, direction, and stable segment ID.
function loadRoadNetwork(env = process.env) {
  if (!env.ATMS_ROAD_NETWORK_PATH) return null;
  const file = env.ATMS_ROAD_NETWORK_PATH;
  if (fs.statSync(file).size > 20 * 1024 * 1024) throw new Error('ATMS road network exceeds 20 MB. Provision a corridor-sized catalog.');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length || data.features.length > 10000) throw new Error('Road network must be a GeoJSON FeatureCollection of 1–10,000 segments.');
  const ids = new Set(); let vertices = 0;
  const features = data.features.map(f => {
    const geometry = normalize(f.geometry), p = f.properties || {};
    if (!geometry || geometry.type !== 'LineString' || typeof p.id !== 'string' || !p.id.trim() || p.id.length > 180 || ids.has(p.id) || typeof p.route !== 'string' || !routeKey(p.route) || !direction(p.direction)) throw new Error('Road segments require unique string id, route, direction, and a valid LineString.');
    ids.add(p.id); vertices += geometry.coordinates.length;
    if (vertices > 250000) throw new Error('Road network exceeds 250,000 vertices.');
    return { type: 'Feature', geometry, properties: { id: p.id, route: p.route.slice(0, 100), direction: direction(p.direction) } };
  });
  if (!env.ATMS_ROAD_NETWORK_SOURCE || env.ATMS_ROAD_NETWORK_SOURCE.length > 500) throw new Error('Set ATMS_ROAD_NETWORK_SOURCE to the agency dataset URL/version or attribution.');
  return { features, source: env.ATMS_ROAD_NETWORK_SOURCE, revision: hash(features) };
}
function deriveSegment(network, { route, direction: requestedDirection, start, end }) {
  if (!network) return { error: 'No agency road network is configured. Preserve source geometry or provide a verified operator location.' };
  if (!point(start) || !point(end) || turf.distance(start, end, { units: 'meters' }) < 2) return { error: 'Provide distinct beginning and ending coordinates for the affected roadway.' };
  const dir = direction(requestedDirection);
  if (!dir) return { error: 'Specify the affected travel direction before deriving a road segment.' };
  const matches = [];
  for (const feature of network.features) {
    if (routeKey(feature.properties.route) !== routeKey(route) || feature.properties.direction !== dir) continue;
    const a = turf.nearestPointOnLine(feature, start, { units: 'meters' }), b = turf.nearestPointOnLine(feature, end, { units: 'meters' });
    if (a.properties.dist > 75 || b.properties.dist > 75 || Math.abs(a.properties.location - b.properties.location) < 2) continue;
    let geometry = normalize(turf.lineSlice(a, b, feature).geometry);
    if (!geometry) continue;
    if (a.properties.location > b.properties.location) geometry.coordinates.reverse();
    if (turf.length(geometry, { units: 'kilometers' }) > 200) continue;
    matches.push({ geometry, segmentId: feature.properties.id, startDistanceM: a.properties.dist, endDistanceM: b.properties.dist, score: a.properties.dist + b.properties.dist });
  }
  matches.sort((a, b) => a.score - b.score);
  if (!matches.length) return { error: 'No continuous segment matches the route, direction, and both endpoints within 75 metres. Review the limits or provision the missing road geometry.' };
  if (matches.length > 1 && matches[1].score - matches[0].score < 25) return { error: 'Multiple road segments match these limits. Refine the endpoints or agency catalog before deriving the affected segment.' };
  return { ...matches[0], source: network.source, revision: network.revision };
}

function install(Operations, { requireRole, Fault }) {
  Operations.prototype.changeGeometry = function (actor, id, input) {
    requireRole(actor, 'operator');
    const incident = this.need(actor.agency, 'incident', id); this.owned(actor, incident);
    if (['resolved', 'closed'].includes(incident.status)) throw new Fault(409, 'Geometry is locked after incident resolution.');
    if (input.version !== incident.version) throw new Fault(409, 'Incident changed. Refresh before reviewing geometry.');
    if (typeof input.note !== 'string' || input.note.trim().length < 3 || input.note.length > 2000) throw new Fault(400, 'Provide a geometry review note of 3–2000 characters.');
    const note = input.note.trim();
    if (input.action === 'derive') {
      const result = deriveSegment(this.roadNetwork, { route: incident.route, direction: incident.direction, start: input.start, end: input.end });
      if (result.error) throw new Fault(409, result.error);
      incident.geometry = result.geometry;
      incident.geometryEvidence = { status: 'derived', source: result.source, method: 'Agency road-network segment clipped between supplied limits', segmentId: result.segmentId, networkRevision: result.revision, startDistanceM: result.startDistanceM, endDistanceM: result.endDistanceM, fingerprint: hash(result.geometry), observedAt: this.iso(), reviewedBy: null, reviewedAt: null, note };
    } else if (input.action === 'adopt_source') {
      if (!incident.sourceKey) throw new Fault(409, 'This incident has no source observation.');
      const event = this.need(actor.agency, 'event', incident.sourceKey);
      if (!event.present || this.now() - Date.parse(event.observedAt) > this.sourceMaxAgeMs) throw new Fault(409, 'Import a current source observation before adopting its geometry.');
      if (!normalize(event.geometry)) throw new Fault(409, 'The source has no usable geometry.');
      incident.geometry = event.geometry;
      incident.geometryEvidence = { ...event.geometryEvidence, note, reviewedBy: null, reviewedAt: null };
    } else if (input.action === 'review') {
      const geometry = normalize(incident.geometry);
      if (!geometry) throw new Fault(409, 'There is no valid geometry to review.');
      if (incident.kind === 'closure' && geometry.type === 'Point') throw new Fault(409, 'A point does not establish closure limits. Derive or provide the affected road segment.');
      incident.geometryEvidence = { ...incident.geometryEvidence, fingerprint: hash(geometry), status: 'operator_reviewed', reviewedBy: actor.id, reviewedAt: this.iso(), reviewNote: note, reviewedSourceFingerprint: incident.sourceKey ? this.get(actor.agency, 'event', incident.sourceKey)?.geometryEvidence?.fingerprint || null : null };
    } else if (input.action === 'replace') {
      const geometry = normalize(input.geometry);
      if (!geometry) throw new Fault(400, 'Provide valid WGS84 Point, LineString, or MultiLineString GeoJSON with at most 10,000 vertices.');
      incident.geometry = geometry;
      incident.geometryEvidence = { status: 'operator_supplied', source: actor.id, method: 'Operator-supplied GeoJSON', fingerprint: hash(geometry), observedAt: this.iso(), reviewedBy: null, reviewedAt: null, note };
    } else throw new Fault(400, 'Unknown geometry action.');
    const anchor = first(incident.geometry); incident.longitude = anchor[0]; incident.latitude = anchor[1];
    const result = this.put(actor.agency, 'incident', incident, input.version);
    this.audit(actor, id, 'geometry.' + input.action, { note, geometry: incident.geometry, evidence: incident.geometryEvidence }); return result;
  };
}
module.exports = { normalize, first, hash, sourceGeometry, loadRoadNetwork, deriveSegment, install };
