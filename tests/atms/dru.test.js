'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const express = require('express');
const { Operations } = require('../../services/atms/core');
const { createRouter } = require('../../services/atms/router');
const { decodeBundle } = require('../../services/atms/dru');
const actor = { id: 'installer', agency: 'A', role: 'operator' };
const at = '2026-10-20T12:00:00Z', now = Date.parse(at);
const sid = '12345678-1234-1234-1234-123456789abc', fid = '22345678-1234-1234-1234-123456789abc';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=', 'base64');
async function fixture(change = () => {}) {
  const manifest = { schemaVersion: 1, sessionID: sid, projectName: 'TEST ONLY — DRU cabinet capture', featureCount: 1, photoCount: 1, exportedAt: at, exportedFromAppVersion: 'test', nextExpectedStage: 'complete' };
  const session = { id: sid, projectName: manifest.projectName, profile: { crsEPSG: 'EPSG:4326', mode: 'basicPhone' }, features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-93.6, 41.5, 260] }, properties: { assetID: fid, assetType: 'appurtenance', utilityComponent: 'ITS Cabinet', ownerName: 'TEST Agency', collectionMethod: 'Phone GPS', positionalAccuracyHzM: 4, notes: 'TEST ONLY' } }], photos: [{ assetID: fid, localPath: 'cabinet.png', kind: 'overall', exif: { lat: 41.5, lon: -93.6, timestamp: at, source: 'TEST ONLY', hAccM: 4 } }], inspections: [{ assetID: fid, inspector: 'Test collector', condition: 'Good', date: at }], qaReviews: [{ assetID: fid, reviewer: 'Source reviewer', status: 'Approved', date: at }] };
  const zip = new JSZip();
  zip.file('photos/cabinet.png', png);
  change({ manifest, session, zip });
  zip.file('manifest.json', JSON.stringify(manifest)); zip.file('session.json', JSON.stringify(session));
  zip.file('certification.json', JSON.stringify({ collector: { name: 'Collector', date: at }, reviewer: { name: 'Reviewer', date: at }, stampingPE: { name: 'Source declaration', date: at } }));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
function setup(t) { const ops = new Operations({ mode: 'live', now: () => now }); t.after(() => ops.close()); return ops; }
async function stage(ops, bytes) { const decoded = await decodeBundle(bytes, now); return { decoded, bundle: ops.stageDruBundle(actor, bytes, decoded) }; }
const mapping = { sourceAssetId: fid, name: 'TEST ONLY cabinet', type: 'cabinet' };

test('DRU schema 1 preserves source geometry, original photo bytes, accuracy, reviews and bundle hash', async t => {
  const ops = setup(t), bytes = await fixture(), { bundle, decoded } = await stage(ops, bytes);
  assert.equal(bundle.status, 'preview'); assert.equal(ops.architecture(actor).assets.length, 0);
  assert.equal(bundle.features[0].suggestedType, 'cabinet');
  assert.equal(bundle.features[0].inspections[0].inspector, 'Test collector');
  const result = ops.commitDruBundle(actor, bundle.id, { mappings: [mapping] }, decoded), a = ops.need('A', 'architecture-asset', result.result.assets[0].assetId);
  assert.equal(a.protocol, 'unknown'); assert.equal(a.deviceId, null); assert.equal(a.fieldEvidence[0].evidenceState, 'submitted');
  assert.deepEqual(a.fieldEvidence[0].geometry.coordinates, [-93.6, 41.5, 260]);
  assert.equal(a.fieldEvidence[0].properties.positionalAccuracyHzM, 4);
  assert.equal(a.fieldEvidence[0].qaReviews[0].status, 'Approved');
  const photo = ops.architecturePhoto('A', result.result.photoIds[0]);
  assert.deepEqual(photo.bytes, png); assert.equal(photo.metadata.sourceEvidence.exif.source, 'TEST ONLY');
  assert.deepEqual(ops.druBundle(actor, bundle.id, true), bytes);
  assert.equal(ops.verifyAudit('A').valid, true);
  const edited = ops.saveArchitectureAsset(actor, { ...a, name: 'Renamed cabinet' }); assert.equal(edited.fieldEvidence.length, 1);
});
test('DRU source access and import enforce agency and operator boundaries', async t => {
  const ops = setup(t), bytes = await fixture(), { bundle, decoded } = await stage(ops, bytes);
  assert.throws(() => ops.druBundle({ ...actor, agency: 'B' }, bundle.id), e => e.status === 404);
  assert.throws(() => ops.stageDruBundle({ ...actor, role: 'viewer' }, bytes, decoded), e => e.status === 403);
  assert.throws(() => ops.commitDruBundle({ ...actor, role: 'viewer' }, bundle.id, { mappings: [mapping] }, decoded), e => e.status === 403);
  assert.equal(ops.stageDruBundle(actor, bytes, decoded).id, bundle.id);
  ops.commitDruBundle(actor, bundle.id, { mappings: [mapping] }, decoded);
  assert.throws(() => ops.commitDruBundle(actor, bundle.id, { mappings: [mapping] }, decoded), e => e.status === 409);
  assert.equal(ops.architecture(actor).assets.length, 1);
});
test('DRU existing asset attachment preserves equipment settings and requires current version', async t => {
  const ops = setup(t), a = ops.saveArchitectureAsset(actor, { version: 0, type: 'cabinet', name: 'Existing', model: 'Known model', protocol: 'Declared serial', location: 'Existing location' });
  const { bundle, decoded } = await stage(ops, await fixture());
  assert.throws(() => ops.commitDruBundle(actor, bundle.id, { mappings: [{ sourceAssetId: fid, assetId: a.id, version: 0 }] }, decoded), e => e.status === 409);
  ops.commitDruBundle(actor, bundle.id, { mappings: [{ sourceAssetId: fid, assetId: a.id, version: a.version }] }, decoded);
  const saved = ops.need('A', 'architecture-asset', a.id); assert.equal(saved.model, 'Known model'); assert.equal(saved.protocol, 'Declared serial'); assert.equal(saved.location, 'Existing location');
  const revision = await stage(ops, await fixture(({ session }) => { session.features[0].properties.notes = 'Revised field visit'; }));
  ops.commitDruBundle(actor, revision.bundle.id, { mappings: [{ sourceAssetId: fid, assetId: saved.id, version: saved.version }] }, revision.decoded);
  assert.equal(ops.need('A', 'architecture-asset', a.id).fieldEvidence.length, 2);
  assert.equal(ops.need('A', 'architecture-asset', a.id).fieldEvidence[0].properties.notes, 'TEST ONLY');
});
test('DRU failure rolls back assets, photos, bundle state and audit together', async t => {
  const ops = setup(t), { bundle, decoded } = await stage(ops, await fixture());
  const before = ops.timeline('A').length;
  assert.throws(() => ops.commitDruBundle(actor, bundle.id, { mappings: [mapping, mapping] }, decoded), e => e.status === 400);
  assert.equal(ops.architecture(actor).assets.length, 0); assert.equal(ops.architecturePhotos('A').length, 0); assert.equal(ops.druBundle(actor, bundle.id).status, 'preview'); assert.equal(ops.timeline('A').length, before);
});
test('DRU connection photos invalidate existing verification without granting control', async t => {
  const ops = setup(t), a = ops.saveArchitectureAsset(actor, { version: 0, name: 'Cabinet', type: 'cabinet' }), b = ops.saveArchitectureAsset(actor, { version: 0, name: 'Switch', type: 'switch' });
  let c = ops.saveArchitectureConnection(actor, { version: 0, from: a.id, to: b.id, layer: 'physical', medium: 'ethernet', evidenceReference: 'TEST inspection' });
  c = ops.reviewArchitectureConnection(actor, c.id, { version: c.version, action: 'document', note: 'Documented' });
  c = ops.reviewArchitectureConnection({ ...actor, id: 'independent', role: 'supervisor' }, c.id, { version: c.version, action: 'verify', method: 'field-inspection', observedAt: at, note: 'Inspected' });
  const { bundle, decoded } = await stage(ops, await fixture());
  ops.commitDruBundle(actor, bundle.id, { mappings: [{ sourceAssetId: fid, assetId: a.id, version: a.version, connectionId: c.id }] }, decoded);
  const saved = ops.architecture(actor).connections[0]; assert.equal(saved.evidenceState, 'verification-invalidated'); assert.equal(saved.physicalControlAuthorized, false);
});
test('DRU missing photo is disclosed; malformed records, future timestamps and unknown schema reject', async () => {
  const decoded = await decodeBundle(await fixture(({ zip }) => zip.remove('photos/cabinet.png')), now);
  assert.equal(decoded.preview.photos.length, 0); assert.ok(decoded.preview.warnings.some(w => w.includes('Missing photo')));
  for (const change of [({ manifest }) => manifest.schemaVersion = 2, ({ session }) => session.photos[0].exif.timestamp = '2099-01-01T00:00:00Z', ({ session }) => session.inspections = [null], ({ manifest }) => manifest.featureCount = 2, ({ session }) => session.photos[0].localPath = '../cabinet.png', ({ manifest }) => manifest.projectName = {}, ({ session }) => session.features[0].properties.utilityComponent = {}]) {
    await assert.rejects(decodeBundle(await fixture(change), now), e => e.status === 400);
  }
});
test('DRU archive rejects traversal, corrupted CRC, expanded bombs and encrypted entries', async () => {
  await assert.rejects(decodeBundle(await fixture(({ zip }) => zip.file('../evil.txt', 'bad')), now), e => e.status === 400);
  await assert.rejects(decodeBundle(await fixture(({ zip }) => zip.file('photos/bomb.png', Buffer.alloc(6 * 1024 * 1024))), now), e => e.status === 400);
  const bytes = await fixture(); let p = bytes.indexOf(Buffer.from('504b0102', 'hex'));
  const crc = Buffer.from(bytes); crc.writeUInt32LE((crc.readUInt32LE(p + 16) ^ 1) >>> 0, p + 16); await assert.rejects(decodeBundle(crc, now), e => e.status === 400);
  const encrypted = Buffer.from(bytes); encrypted.writeUInt16LE(1, p + 8); await assert.rejects(decodeBundle(encrypted, now), e => e.status === 400);
});
test('DRU HTTP preview, import retries, download and authorization work end to end', async t => {
  const ops = setup(t), app = express();
  app.use('/api/atms', createRouter({ ops, authenticate: (req, res, next) => req.get('Authorization') ? next() : res.sendStatus(401), resolveActor: req => ({ ...actor, agency: req.get('X-Agency') || 'A', role: req.get('X-Role') || 'operator' }) }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/atms/architecture/dru/bundles';
  const bytes = await fixture(), headers = { Authorization: 'test', 'X-ATMS-Client': 'workspace', 'Idempotency-Key': 'dru-upload-0001' };
  const form = () => { const f = new FormData(); f.append('bundle', new Blob([bytes]), 'test.dru-session'); return f; };
  assert.equal((await fetch(base, { method: 'POST', body: form() })).status, 401);
  assert.equal((await fetch(base, { method: 'POST', headers: { ...headers, 'X-Role': 'viewer' }, body: form() })).status, 403);
  const response = await fetch(base, { method: 'POST', headers, body: form() }); assert.equal(response.status, 200, await response.clone().text()); const bundle = await response.json();
  const path = base + '/' + bundle.id;
  assert.equal((await fetch(path, { headers: { ...headers, 'X-Agency': 'B' } })).status, 404);
  const previewPhoto = await fetch(path + '/photos/0', { headers: { ...headers, 'X-Role': 'viewer' } });
  assert.equal(previewPhoto.status, 200); assert.equal(previewPhoto.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await previewPhoto.arrayBuffer()), png);
  assert.equal((await fetch(path + '/photos/0', { headers: { ...headers, 'X-Agency': 'B' } })).status, 404);
  assert.equal((await fetch(path + '/photos/-1', { headers })).status, 404);
  assert.equal((await fetch(path + '/photos/99', { headers })).status, 404);
  assert.equal(ops.architecture(actor).assets.length, 0);
  const options = { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': 'dru-import-0001' }, body: JSON.stringify({ mappings: [mapping] }) };
  const imported = await fetch(path + '/import', options); assert.equal(imported.status, 200, await imported.clone().text());
  assert.equal((await fetch(path + '/import', options)).status, 200); assert.equal(ops.architecture(actor).assets.length, 1);
  const download = await fetch(path + '/content', { headers }); assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  assert.equal((await (await fetch(base, { headers })).json()).bundles.length, 1);
});
