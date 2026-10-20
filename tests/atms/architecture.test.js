'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Operations } = require('../../services/atms/core');
const { createRouter } = require('../../services/atms/router');
const { seedArchitecture } = require('../../services/atms/architecture-training');
const ARCITSConverter = require('../../utils/arc-its-converter');
const operator = { id: 'installer', role: 'operator', agency: 'A' }, supervisor = { id: 'reviewer', role: 'supervisor', agency: 'A' };
const at = '2026-10-20T12:00:00.000Z';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=', 'base64');
function setup(t, mode = 'live') {
  let now = Date.parse(at);
  const ops = new Operations({ mode, now: () => now }); t.after(() => ops.close());
  return { ops, advance: ms => { now += ms; } };
}
function asset(ops, name = 'Test cabinet', extra = {}, actor = operator) { return ops.saveArchitectureAsset(actor, { version: 0, name, type: 'cabinet', ...extra }); }
function link(ops, a, b, extra = {}) { return ops.saveArchitectureConnection(operator, { version: 0, from: a.id, to: b.id, layer: 'information', medium: 'ethernet', fromPort: 'Port 1', toPort: 'LAN 1', flow: 'Device status', ...extra }); }

test('asset profiles use explicit unknown protocols and preserve agency and device boundaries', t => {
  const { ops } = setup(t);
  ops.registerDevice('A', { id: 'D1', name: 'Public inventory', type: 'camera', driver: 'readonly', controlEnabled: false, inventory: true });
  const a = asset(ops, 'Camera', { type: 'camera', deviceId: 'D1', manufacturer: 'Manufacturer', firmware: '1.0' });
  assert.equal(a.protocol, 'unknown'); assert.equal(a.synthetic, false);
  assert.equal(ops.get('A', 'device', 'D1').driver, 'readonly');
  assert.throws(() => asset(ops, 'Duplicate', { deviceId: 'D1' }), e => e.status === 409);
  assert.throws(() => asset(ops, 'Cross agency', { deviceId: 'D1' }, { ...operator, agency: 'B' }), e => e.status === 404);
  assert.throws(() => asset(ops, 'Viewer', {}, { ...operator, role: 'viewer' }), e => e.status === 403);
  assert.throws(() => ops.saveArchitectureAsset(operator, { ...a, version: 0 }), e => e.status === 409);
  assert.equal(ops.architecture({ ...operator, agency: 'B' }).assets.length, 0);
});
test('connections require valid endpoints, ports and explicit media without inferred verification', t => {
  const { ops } = setup(t), a = asset(ops), b = asset(ops, 'Switch', { type: 'switch' });
  const c = link(ops, a, b);
  assert.equal(c.protocol, 'unknown'); assert.equal(c.evidenceState, 'candidate');
  assert.equal(c.physicalControlAuthorized, false);
  assert.throws(() => link(ops, a, a), e => e.status === 400);
  assert.throws(() => link(ops, a, b, { medium: 'auto-discovered' }), e => e.status === 400);
  assert.throws(() => ops.reviewArchitectureConnection(operator, c.id, { version: c.version, action: 'document', note: 'No evidence exists.' }), e => e.status === 409);
});
test('independent connection verification invalidates after firmware, port or photo changes', t => {
  const { ops } = setup(t);
  let a = asset(ops), b = asset(ops, 'Gateway'), c = link(ops, a, b, { evidenceReference: 'Field drawing A-101' });
  c = ops.reviewArchitectureConnection(operator, c.id, { version: c.version, action: 'document', note: 'Installer documented the physical connection.' });
  assert.equal(c.evidenceState, 'documented');
  assert.throws(() => ops.reviewArchitectureConnection({ ...operator, role: 'supervisor' }, c.id, { version: c.version, action: 'verify', method: 'field-inspection', observedAt: at, note: 'Self review rejected.' }), e => e.status === 403);
  c = ops.reviewArchitectureConnection(supervisor, c.id, { version: c.version, action: 'verify', method: 'field-inspection', observedAt: at, note: 'Independently witnessed the installed wiring.' });
  assert.equal(c.evidenceState, 'verified');
  a = ops.saveArchitectureAsset(operator, { ...a, firmware: '2.0' });
  assert.equal(ops.architecture(operator).connections[0].evidenceState, 'verification-invalidated');
  c = ops.reviewArchitectureConnection(supervisor, c.id, { version: c.version, action: 'verify', method: 'bench-test', observedAt: at, note: 'Rechecked after the firmware change.' });
  ops.addArchitecturePhoto(operator, a.id, { connectionId: c.id, caption: 'Additional connection evidence', capturedAt: at }, png, 'image/png');
  assert.equal(ops.architecture(operator).connections[0].evidenceState, 'verification-invalidated');
  c = ops.saveArchitectureConnection(operator, { ...c, toPort: 'LAN 2' });
  assert.equal(c.evidenceState, 'candidate'); assert.equal(c.documentedAt, null);
  assert.equal(ops.list('A', 'installation').length, 0);
});
test('photo attachments retain hashes and capture time and cannot cross agency or unrelated connections', t => {
  const { ops } = setup(t), a = asset(ops), b = asset(ops, 'B'), c = asset(ops, 'C');
  const connection = link(ops, b, c);
  assert.throws(() => ops.addArchitecturePhoto(operator, a.id, { connectionId: connection.id, caption: 'Wrong connection', capturedAt: at }, png, 'image/png'), e => e.status === 400);
  const photo = ops.addArchitecturePhoto(operator, a.id, { caption: 'Cabinet terminal photograph', capturedAt: at }, png, 'image/png');
  assert.equal(photo.evidenceState, 'submitted'); assert.equal(photo.capturedAt, at);
  assert.deepEqual(ops.architecturePhoto('A', photo.id).bytes, png);
  assert.throws(() => ops.architecturePhoto('B', photo.id), e => e.status === 404);
  assert.throws(() => ops.addArchitecturePhoto(operator, a.id, { caption: 'Wrong encoding', capturedAt: at }, png, 'image/jpeg'), e => e.status === 400);
  ops.db.prepare('UPDATE atms_architecture_photos SET sha256=? WHERE id=?').run('tampered', photo.id);
  assert.throws(() => ops.architecturePhoto('A', photo.id), e => e.status === 409);
});
test('derived outputs preserve source lineage and block stale, inventory, zero-speed and missing inputs', t => {
  const { ops, advance } = setup(t);
  function collect(speed, inventory = false) {
    ops.recordCollections('A', [{ sourceId: 'test-detector', kind: 'traffic', status: 'ok', collectedAt: ops.iso(), sourceObservedAt: ops.iso(), payload: { rows: [{ id: 'D', state: 'IA', kind: 'detector', coordinates: [-93, 41], speedMph: speed, observedAt: ops.iso(), inventory }] } }]);
  }
  collect(30);
  const device = ops.list('A', 'device')[0];
  let a = asset(ops, 'Detector', { type: 'detector', deviceId: device.id, analysis: { referenceSpeedMph: 60, segmentLengthMiles: 1 } });
  let report = ops.architectureCapabilities('A', a.id);
  assert.equal(report.derived[0].value, 50); assert.equal(report.derived[1].value, 2); assert.equal(report.derived[2].value, 1);
  assert.ok(report.derived[0].inputs.batchId); assert.equal(report.derived[0].inputs.observedAt, at);
  assert.equal(report.derived[3].status, 'blocked');
  advance(300001); report = ops.architectureCapabilities('A', a.id);
  assert.ok(report.derived.every(r => r.status === 'blocked'));
  collect(0); report = ops.architectureCapabilities('A', a.id);
  assert.equal(report.derived[0].value, 100); assert.equal(report.derived[1].status, 'blocked');
  a = ops.saveArchitectureAsset(operator, { ...a, analysis: {} });
  assert.ok(ops.architectureCapabilities('A', a.id).derived.every(r => r.status === 'blocked'));
  const inv = asset(ops, 'Unlinked inventory', { type: 'rwis' });
  assert.ok(ops.architectureCapabilities('A', inv.id).derived.every(r => r.status === 'blocked'));
});
test('dependency exploration is bounded through cycles and recognizes alternate declared paths without asserting an outage', t => {
  const { ops } = setup(t), a = asset(ops, 'Source'), b = asset(ops, 'Switch'), c = asset(ops, 'Center'), d = asset(ops, 'Redundant path');
  const failed = link(ops, a, b); link(ops, b, c); link(ops, c, b);
  let impact = ops.architectureImpact('A', failed.id);
  assert.equal(impact.actualOutageAsserted, false); assert.equal(impact.alternateDeclaredPath, false); assert.equal(impact.affected.length, 2);
  link(ops, a, d); link(ops, d, b);
  impact = ops.architectureImpact('A', failed.id); assert.equal(impact.alternateDeclaredPath, true);
  assert.ok(impact.affected.every(a => a.alternateDeclaredPath));
});
test('synthetic architecture cannot seed live workspaces and remains unverified after restart-safe seeding', t => {
  const { ops } = setup(t, 'training'); ops.seedTraining(); seedArchitecture(ops);
  const actor = { ...operator, agency: 'TRAINING' }, graph = ops.architecture(actor);
  assert.equal(graph.assets.length, 6); assert.equal(graph.connections.length, 5);
  assert.ok(graph.assets.every(a => a.synthetic)); assert.ok(graph.connections.every(c => c.evidenceState === 'candidate'));
  const detector = graph.assets.find(a => a.type === 'detector');
  assert.equal(ops.architectureCapabilities('TRAINING', detector.id).derived[0].value, 66.15);
  const centerLink = graph.connections.find(c => graph.assets.find(a => a.id === c.to)?.type === 'center');
  const dependencies = ops.architectureImpact('TRAINING', centerLink.id).dataDependencies;
  assert.ok(dependencies.some(d => d.assetId === detector.id && d.derivedOutputs.includes('segment-delay')));
  seedArchitecture(ops); assert.equal(ops.architecture(actor).assets.length, 6);
  const live = new Operations(); t.after(() => live.close()); assert.throws(() => seedArchitecture(live));
});
test('architecture and photo evidence survive SQLite backup and reopening', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atms-architecture-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'operations.sqlite'), backup = path.join(dir, 'backup.sqlite');
  let ops = new Operations({ filename, now: () => Date.parse(at) });
  const a = asset(ops), p = ops.addArchitecturePhoto(operator, a.id, { caption: 'Test-only PNG attachment', capturedAt: at }, png, 'image/png');
  await ops.db.backup(backup); ops.close();
  ops = new Operations({ filename: backup }); t.after(() => ops.close());
  assert.equal(ops.architecture(operator).assets[0].id, a.id); assert.deepEqual(ops.architecturePhoto('A', p.id).bytes, png);
  assert.equal(ops.verifyAudit('A').valid, true);
});
test('converter no longer invents protocol support or standards compliance from equipment class', () => {
  const converter = new ARCITSConverter();
  assert.deepEqual(JSON.parse(converter.standardizeProtocols(null)), []);
  const result = converter.convertToARCITS({ equipmentType: 'camera', stateKey: 'ia', latitude: 41, longitude: -93 });
  assert.equal(result.arcItsInterface, 'Unknown — not verified'); assert.equal(result.metadata.arcItsCompliant, null);
  assert.ok(Object.values(result.metadata.standardsCompliance).every(v => v === null));
});
test('HTTP photo upload is authenticated, idempotent, agency-scoped and rejects undecodable files', async t => {
  const { ops } = setup(t), a = asset(ops);
  const app = express(); app.use('/api/atms', createRouter({ ops,
    authenticate: (req, res, next) => req.get('Authorization') ? next() : res.sendStatus(401),
    resolveActor: req => ({ ...operator, agency: req.get('X-Agency') || 'A', role: req.get('X-Role') || 'operator' }) }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/atms';
  const headers = { Authorization: 'test', 'X-ATMS-Client': 'workspace', 'Idempotency-Key': 'architecture-photo-test-0001' };
  const form = (bytes = png) => { const f = new FormData(); f.append('photo', new Blob([bytes], { type: 'image/png' }), 'test-only.png'); f.append('caption', 'TEST-ONLY fixture photo'); f.append('capturedAt', at); return f; };
  assert.equal((await fetch(base + '/architecture')).status, 401);
  assert.equal((await fetch(base + '/architecture/assets/' + a.id + '/photos', { method: 'POST', headers: { ...headers, 'X-Role': 'viewer' }, body: form() })).status, 403);
  let response = await fetch(base + '/architecture/assets/' + a.id + '/photos', { method: 'POST', headers, body: form() });
  assert.equal(response.status, 200, await response.clone().text()); const photo = await response.json();
  response = await fetch(base + '/architecture/assets/' + a.id + '/photos', { method: 'POST', headers, body: form() });
  assert.equal((await response.json()).id, photo.id); assert.equal(ops.architecturePhotos('A').length, 1);
  response = await fetch(base + '/architecture/photos/' + photo.id + '/content', { headers });
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  assert.equal((await fetch(base + '/architecture/photos/' + photo.id + '/content', { headers: { ...headers, 'X-Agency': 'B' } })).status, 404);
  response = await fetch(base + '/architecture/assets/' + a.id + '/photos', { method: 'POST', headers: { ...headers, 'Idempotency-Key': 'architecture-photo-bad-0001' }, body: form(Buffer.from('<svg>not a photograph</svg>')) });
  assert.equal(response.status, 400);
});
