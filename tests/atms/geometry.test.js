'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { Operations } = require('../../services/atms/core');
const { normalize, sourceGeometry, loadRoadNetwork, deriveSegment } = require('../../services/atms/geometry');
const actor = { id: 'operator', agency: 'A', role: 'operator' };
const coords = [[-93.63, 41.628], [-93.61, 41.629], [-93.59, 41.633], [-93.57, 41.638]];
const line = { type: 'LineString', coordinates: coords };
const catalog = () => ({ source: 'Synthetic test catalog', revision: 'test-v1', features: [{ type: 'Feature', geometry: line, properties: { id: 'segment', route: 'I-80', direction: 'eastbound' } }] });
function setup(t) { const ops = new Operations(); ops.roadNetwork = catalog(); t.after(() => ops.close()); return ops; }
function reported(ops, geometry = line) { ops.ingest('A', { observedAt: ops.iso(), events: [{ id: 'one', state: 'IA', route: 'I-80', direction: 'eastbound', eventType: 'closure', geometry }] }); let i = ops.promoteEvent(actor, 'IA:one'); return ops.changeIncident(actor, i.id, { version: i.version, action: 'claim', note: 'Claimed for geometry review.' }); }
function action(ops, i, body) { return ops.changeGeometry(actor, i.id, { version: i.version, note: 'Checked roadway, travel direction, and affected limits.', ...body }); }
test('bounded geometry validation preserves legitimate two-point lines and separate carriageways', () => {
  assert.equal(normalize({ type: 'LineString', coordinates: coords.slice(0, 2) }).type, 'LineString');
  const g = normalize({ type: 'MultiLineString', coordinates: [coords, coords.map(([x, y]) => [x, y + .001])] });
  assert.equal(g.coordinates.length, 2); assert.deepEqual(g.coordinates[0], coords);
  for (const bad of [{ type: 'Point', coordinates: ['', 1] }, { type: 'Point', coordinates: [181, 0] }, { type: 'Point', coordinates: [0, NaN] }, { type: 'LineString', coordinates: [[0, 0], [0, 0]] }, { type: 'Polygon', coordinates: [coords] }, { type: 'MultiLineString', coordinates: [coords, []] }, { type: 'LineString', coordinates: Array(10001).fill([0, 0]) }]) assert.equal(normalize(bad), null);
  const g3 = normalize({ type: 'Point', coordinates: [-93, 41, 200] }); assert.deepEqual(g3.coordinates, [-93, 41]);
});
test('source-derived geometry is labeled independently of field-verification claims', () => {
  const raw = { geometry: JSON.stringify({ ...line, geometrySource: 'FHWA ARNOLD' }), geometryEvidence: { status: 'operator_reviewed', reviewedBy: 'forged' }, is_start_position_verified: true };
  const spatial = sourceGeometry(raw, 'Agency feed', '2026-10-18T00:00:00Z');
  assert.equal(spatial.geometryEvidence.status, 'derived'); assert.equal(spatial.geometryEvidence.reviewedBy, null); assert.equal(spatial.geometryEvidence.sourceClaims.startPositionVerified, true);
  assert.equal(sourceGeometry({ geometry: line }, 'Feed', '').geometryEvidence.status, 'source_reported');
});
test('source import and incident promotion retain full geometry even without a separate latitude field', t => {
  const ops = setup(t), i = reported(ops);
  assert.deepEqual(i.geometry, line); assert.equal(i.longitude, coords[0][0]); assert.equal(i.latitude, coords[0][1]);
  assert.equal(i.geometryEvidence.status, 'source_reported');
  assert.ok(ops.alarms('A').some(a => a.id === 'geometry:' + i.id));
  const reviewed = action(ops, i, { action: 'review' });
  assert.equal(reviewed.geometryEvidence.status, 'operator_reviewed');
  assert.equal(reviewed.geometryEvidence.reviewedBy, actor.id);
  assert.equal(ops.alarms('A').some(a => a.id === 'geometry:' + i.id), false);
  assert.deepEqual(ops.incidentReport(actor, i.id).incident.geometry, line);
});
test('invalid geometry does not manufacture limits; valid source coordinates remain a point', t => {
  const ops = setup(t);
  ops.ingest('A', { observedAt: ops.iso(), events: [{ id: 'invalid', state: 'IA', geometry: { type: 'LineString', coordinates: [['x', 1], [2, 3]] }, latitude: 41, longitude: -93 }] });
  const e = ops.get('A', 'event', 'IA:invalid'); assert.equal(e.geometry.type, 'Point'); assert.equal(e.geometryEvidence.reviewedBy, null);
  const i = reported(ops, { type: 'Point', coordinates: coords[0] });
  assert.throws(() => action(ops, i, { action: 'review' }), /point does not establish/);
});
test('unique matching segment is clipped to limits, ordered from beginning to end, and stays unreviewed', t => {
  const ops = setup(t); let i = reported(ops);
  const start = coords[1], end = coords[2];
  i = action(ops, i, { action: 'derive', start, end });
  assert.equal(i.geometryEvidence.status, 'derived'); assert.equal(i.geometryEvidence.segmentId, 'segment');
  assert.ok(Math.abs(i.geometry.coordinates[0][0] - start[0]) < .00001);
  assert.ok(Math.abs(i.geometry.coordinates.at(-1)[0] - end[0]) < .00001);
  const reverse = deriveSegment(catalog(), { route: 'Interstate 80', direction: 'EB', start: end, end: start });
  assert.ok(Math.abs(reverse.geometry.coordinates[0][0] - end[0]) < .00001);
  assert.equal(action(ops, i, { action: 'review' }).geometryEvidence.status, 'operator_reviewed');
});
test('competing carriageways are rejected and wrong direction, off-network endpoints, and gaps do not fabricate a path', () => {
  const input = { route: 'I-80', direction: 'eastbound', start: coords[0], end: coords.at(-1) };
  const network = catalog(); network.features.push({ ...network.features[0], properties: { ...network.features[0].properties, id: 'competing' } });
  assert.match(deriveSegment(network, input).error, /Multiple/);
  assert.match(deriveSegment(catalog(), { ...input, direction: 'westbound' }).error, /No continuous/);
  assert.match(deriveSegment(catalog(), { ...input, end: [-90, 40] }).error, /No continuous/);
  assert.match(deriveSegment(catalog(), { ...input, end: input.start }).error, /distinct/);
  assert.match(deriveSegment(null, input).error, /No agency/);
  const gaps = catalog(); gaps.features = [0, 2].map((n, i) => ({ ...gaps.features[0], properties: { id: String(i), route: 'I-80', direction: 'eastbound' }, geometry: { type: 'LineString', coordinates: coords.slice(n, n + 2) } }));
  assert.match(deriveSegment(gaps, input).error, /No continuous/);
});
test('source changes raise review alarms without overwriting incident geometry; adoption clears prior acceptance', t => {
  const ops = setup(t); let i = action(ops, reported(ops), { action: 'review' });
  const updated = { type: 'LineString', coordinates: coords.slice(1) };
  ops.ingest('A', { observedAt: ops.iso(), events: [{ id: 'one', state: 'IA', route: 'I-80', direction: 'eastbound', eventType: 'closure', geometry: updated }] });
  assert.deepEqual(ops.get('A', 'incident', i.id).geometry, line);
  assert.ok(ops.alarms('A').some(a => a.id === 'geometry-changed:' + i.id));
  i = action(ops, i, { action: 'adopt_source' }); assert.deepEqual(i.geometry, updated); assert.equal(i.geometryEvidence.reviewedAt, null);
  assert.equal(action(ops, i, { action: 'review' }).geometryEvidence.status, 'operator_reviewed');
  assert.equal(ops.alarms('A').some(a => a.id === 'geometry-changed:' + i.id), false);
  assert.equal(ops.verifyAudit('A').valid, true);
});
test('geometry edits enforce agency, ownership, identity role, revision, and closure state', t => {
  const ops = setup(t); let i = reported(ops);
  const payload = { version: i.version, action: 'review', note: 'Checked geometry' };
  assert.throws(() => ops.changeGeometry({ ...actor, agency: 'B' }, i.id, payload), /not found/);
  assert.throws(() => ops.changeGeometry({ ...actor, id: 'other' }, i.id, payload), /Claim/);
  assert.throws(() => ops.changeGeometry({ ...actor, role: 'viewer' }, i.id, payload), /operator/);
  assert.throws(() => action(ops, i, { action: 'review', version: 1 }), /changed/);
  assert.throws(() => action(ops, i, { action: 'review', note: '' }), /note/);
  i = ops.put('A', 'incident', { ...i, status: 'closed' }, i.version);
  assert.throws(() => action(ops, i, { action: 'review' }), /locked/);
});
test('configured road catalogs fail closed on duplicate IDs, missing attribution, and malformed geometry', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atms-roads-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'roads.json'), env = { ATMS_ROAD_NETWORK_PATH: file, ATMS_ROAD_NETWORK_SOURCE: 'Agency source v1' };
  const data = { type: 'FeatureCollection', features: catalog().features }; fs.writeFileSync(file, JSON.stringify(data));
  assert.equal(loadRoadNetwork(env).features.length, 1); assert.equal(loadRoadNetwork({}), null);
  assert.throws(() => loadRoadNetwork({ ATMS_ROAD_NETWORK_PATH: file }), /SOURCE/);
  fs.writeFileSync(file, JSON.stringify({ ...data, features: [...data.features, ...data.features] })); assert.throws(() => loadRoadNetwork(env), /unique/);
});
