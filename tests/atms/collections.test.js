'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Operations } = require('../../services/atms/core');
const { createSourceProvider } = require('../../services/atms/source-provider');
const { normalize, quality } = require('../../services/atms/collections');
const express = require('express');
const { createRouter } = require('../../services/atms/router');
const at = '2026-10-20T12:00:00.000Z';
const clock = Date.parse(at);
const actor = { id: 'operator', agency: 'A', role: 'operator' };
const device = extra => ({ id: 'SIGN-1', state: 'IA', deviceType: 'dms', route: 'I-80', coordinates: [-93, 41], updated: at, mode: { displaying: true, pattern: 'TEST ONLY' }, ...extra });
const collection = (rows, extra = {}) => ({ sourceId: 'corridor-devices', kind: 'devices', status: rows.length ? 'ok' : 'empty', collectedAt: at, sourceObservedAt: at, payload: { devices: rows }, ...extra });
function setup(t) { const ops = new Operations({ now: () => clock }); t.after(() => ops.close()); return ops; }

test('collections preserve timestamps, units, zero readings and unknown quality', () => {
  const c = { ...collection([]), kind: 'traffic' };
  const r = normalize({ id: 'D1', kind: 'detector', state: 'MN', lane: 2, coordinates: [-93, 45], speedMph: 0, flowVph: 0, occupancyPct: 0, observedAt: at }, c);
  assert.deepEqual(r.measurements.map(m => [m.value, m.unit]), [[0, 'mph'], [0, 'vehicles/hour'], [0, '%']]);
  assert.equal(quality(r, clock).quality, 'current');
  const invalid = normalize({ id: 'D2', speedMph: '', occupancyPct: 101, coordinates: ['', null] }, c);
  assert.equal(invalid.coordinates, null); assert.equal(invalid.observedAt, null); assert.equal(invalid.measurements.length, 0);
  assert.ok(invalid.flags.includes('unknown-observation-time')); assert.ok(invalid.flags.includes('invalid-occupancy'));
  assert.ok(quality(r, clock + 300001).flags.includes('stale'));
  assert.ok(quality(r, clock - 60001).flags.includes('future-observation-time'));
});
test('inventory and untimestamped signs never acquire a measurement time or inferred blank', t => {
  const ops = setup(t);
  ops.recordCollections('A', [collection([device({ inventory: true }), device({ id: 'NO-TIME', updated: null, mode: { pattern: null } })])]);
  const rows = ops.collectionPage('A').rows;
  assert.ok(rows.every(r => r.observedAt === null));
  assert.equal(rows.find(r => r.inventory).quality, 'review');
  assert.equal(rows.find(r => r.sourceRecordId === 'NO-TIME').message, null);
  assert.ok(ops.list('A', 'device').every(d => d.driver === 'readonly' && !d.controlEnabled));
});
test('duplicates are idempotent and history retains changed observations', t => {
  const ops = setup(t), c = collection([device()]);
  ops.recordCollections('A', [c]); ops.recordCollections('A', [c]);
  const row = ops.collectionPage('A').rows[0];
  assert.equal(ops.collectionHistory('A', row.id).length, 1);
  const later = new Date(clock + 1000).toISOString();
  ops.recordCollections('A', [collection([device({ updated: later, mode: { pattern: 'NEW MESSAGE' } })], { collectedAt: later, sourceObservedAt: later })]);
  assert.equal(ops.collectionPage('A').rows[0].message, 'NEW MESSAGE');
  assert.equal(ops.collectionHistory('A', row.id).length, 2);
});
test('duplicate IDs and partial or failed feeds never retire previous assets', t => {
  const ops = setup(t);
  ops.recordCollections('A', [collection([device()])]);
  ops.recordCollections('A', [collection([device({ id: 'OTHER' }), device({ id: 'OTHER' })])]);
  assert.equal(ops.get('A', 'collection', 'corridor-devices').status, 'partial');
  assert.equal(ops.collectionPage('A').rows.find(r => r.sourceRecordId === 'SIGN-1').present, true);
  ops.recordCollections('A', [collection([], { status: 'unavailable', payload: null })]);
  assert.equal(ops.collectionPage('A').rows.length, 2);
  assert.ok(ops.collectionPage('A').rows.every(r => r.present));
});
test('complete empty snapshot marks absence while retaining the last reported display', t => {
  const ops = setup(t);
  ops.recordCollections('A', [collection([device()])]); ops.recordCollections('A', [collection([])]);
  const row = ops.collectionPage('A').rows[0];
  assert.equal(row.present, false); assert.equal(row.message, 'TEST ONLY');
  assert.equal(ops.get('A', 'device', 'source:IA:SIGN-1').displayedMessage, 'TEST ONLY');
  assert.equal(ops.get('A', 'device', 'source:IA:SIGN-1').present, false);
});
test('older publisher snapshots are archived without regressing current state or presence', t => {
  const ops = setup(t);
  ops.recordCollections('A', [collection([device()])]);
  const earlier = new Date(clock - 60000).toISOString();
  ops.recordCollections('A', [collection([device({ updated: earlier, mode: { pattern: 'OLD' } })], { sourceObservedAt: earlier })]);
  assert.equal(ops.collectionPage('A').rows[0].message, 'TEST ONLY');
  assert.equal(ops.get('A', 'collection', 'corridor-devices').sourceObservedAt, at);
  assert.equal(ops.collectionHistory('A', ops.collectionPage('A').rows[0].id).length, 2);
});
test('source data cannot replace commissioned gateway devices or verify commands', t => {
  const ops = setup(t);
  ops.registerDevice('A', { id: 'source:IA:SIGN-1', name: 'Commissioned', driver: 'gateway', controlEnabled: true, observedAt: at });
  ops.recordCollections('A', [collection([device()])]);
  const saved = ops.get('A', 'device', 'source:IA:SIGN-1');
  assert.equal(saved.driver, 'gateway'); assert.equal(saved.name, 'Commissioned');
  assert.equal(ops.list('A', 'command').length, 0);
});
test('captured payload integrity, agency isolation and replay without writes', t => {
  const ops = setup(t), original = collection([device()]);
  ops.recordCollections('A', [original]);
  const row = ops.collectionPage('A').rows[0], before = ops.db.prepare('SELECT count(*) n FROM atms_observations').get().n;
  assert.deepEqual(ops.collectionBatch('A', row.batchId).payload, original.payload);
  const replay = ops.replayCollection(actor, row.batchId);
  assert.equal(replay.writes, false); assert.equal(replay.rows[0].observedAt, at); assert.equal(replay.originalCollectedAt, at);
  assert.equal(ops.db.prepare('SELECT count(*) n FROM atms_observations').get().n, before);
  assert.throws(() => ops.replayCollection({ ...actor, role: 'viewer' }, row.batchId), e => e.status === 403);
  assert.equal(ops.collectionPage('B').total, 0);
  assert.throws(() => ops.collectionBatch('B', row.batchId), e => e.status === 404);
  assert.throws(() => ops.collectionHistory('B', row.id), e => e.status === 404);
  ops.db.prepare('UPDATE atms_collection_batches SET sha256=? WHERE id=?').run('corrupted', row.batchId);
  assert.throws(() => ops.collectionBatch('A', row.batchId), e => e.status === 409);
});
test('collection errors roll back the complete import and retained history is bounded', t => {
  const ops = setup(t);
  assert.throws(() => ops.recordCollections('A', [collection([device()]), { sourceId: 'bad' }]));
  assert.equal(ops.collectionPage('A').total, 0);
  for (let i = 0; i < 30; i++) ops.recordCollections('A', [collection([device({ updated: new Date(clock + i * 1000).toISOString() })])]);
  assert.equal(ops.db.prepare('SELECT count(*) n FROM atms_collection_batches').get().n, 24);
  assert.equal(ops.collectionHistory('A', ops.collectionPage('A').rows[0].id).length, 24);
});
test('SQLite restart preserves observations and captured payloads', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atms-collection-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'operations.db');
  let ops = new Operations({ filename, now: () => clock });
  ops.recordCollections('A', [collection([device()])]); ops.close();
  ops = new Operations({ filename, now: () => clock }); t.after(() => ops.close());
  const r = ops.collectionPage('A').rows[0];
  assert.equal(r.message, 'TEST ONLY'); assert.equal(ops.collectionBatch('A', r.batchId).payload.devices.length, 1);
});

test('existing collector endpoints import independently with their original source clocks', async t => {
  const ops = setup(t);
  const payloads = {
    '/api/events': { timestamp: at, events: [{ id: 'E1', state: 'IA', description: 'Crash', latitude: 41, longitude: -93, updated: at }] },
    '/api/devices': { timestamp: at, devices: [device()], sources: [{ id: 'ia', status: 'ok' }] },
    '/api/traffic/mn/detectors': { timestamps: { detectors: at, stations: at }, status: 'ok', count: 1, rows: [{ id: 'D1', kind: 'detector', coordinates: [-93, 45], speedMph: 22, observedAt: at }] }
  };
  let failEvents = false;
  const provider = createSourceProvider({ baseUrl: 'http://127.0.0.1:3001', now: () => clock,
    fetchImpl: async url => new Response(JSON.stringify(payloads[url.pathname]), { status: failEvents && url.pathname === '/api/events' ? 503 : 200 }) });
  let batch = await provider(); ops.ingest('A', batch);
  assert.equal(ops.collectionPage('A').total, 3); assert.equal(ops.list('A', 'device').length, 2);
  assert.equal(ops.collectionPage('A', { type: 'detector' }).rows[0].measurements[0].unit, 'mph');
  failEvents = true; batch = await provider(); ops.ingest('A', batch);
  assert.equal(batch.eventsAvailable, false);
  assert.equal(ops.get('A', 'event', 'IA:E1').present, true);
  assert.equal(ops.get('A', 'source', 'corridor-communicator').observedAt, at);
  assert.equal(ops.get('A', 'collection', 'corridor-events').status, 'unavailable');
});
test('malformed and truncated upstream responses remain failed or partial, not empty success', async () => {
  const provider = createSourceProvider({ baseUrl: 'http://127.0.0.1:3001', now: () => clock,
    fetchImpl: async url => new Response(JSON.stringify(url.pathname === '/api/traffic/mn/detectors' ? { rows: [], count: 20, timestamps: { detectors: at } } : { devices: [] })) });
  const batch = await provider();
  assert.equal(batch.eventsAvailable, false);
  assert.equal(batch.collections[1].status, 'partial');
  assert.equal(batch.collections[2].status, 'partial');
  assert.throws(() => createSourceProvider({ baseUrl: 'https://username:password@example.com' }));
});
test('collection HTTP endpoints enforce agency, viewer access and operator-only replay', async t => {
  const ops = setup(t);
  ops.recordCollections('A', [collection([device()])]);
  const row = ops.collectionPage('A').rows[0];
  const app = express();
  app.use('/api/atms', createRouter({ ops, authenticate: (req, res, next) => req.get('Authorization') ? next() : res.sendStatus(401),
    resolveActor: req => ({ id: 'test-user', agency: req.get('X-Test-Agency') || 'A', role: req.get('X-Test-Role') || 'viewer' }) }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/atms';
  assert.equal((await fetch(base + '/collections')).status, 401);
  const headers = { Authorization: 'test', 'X-ATMS-Client': 'workspace', 'Content-Type': 'application/json' };
  const observed = await fetch(base + '/collections/observations', { headers });
  assert.equal(observed.status, 200); assert.equal((await observed.json()).total, 1);
  assert.equal((await fetch(base + '/collections/batches/' + row.batchId, { headers: { ...headers, 'X-Test-Agency': 'B' } })).status, 404);
  assert.equal((await fetch(base + '/collections/batches/' + row.batchId + '/replay', { method: 'POST', headers, body: '{}' })).status, 403);
  const replay = await fetch(base + '/collections/batches/' + row.batchId + '/replay', { method: 'POST', headers: { ...headers, 'X-Test-Role': 'operator' }, body: '{}' });
  assert.equal(replay.status, 200); assert.equal((await replay.json()).writes, false);
});
test('GIS-derived ITS rows retain asset classes and attributes without becoming live telemetry', t => {
  const ops = setup(t);
  const equipment = [
    { id: 'GIS-CAMERA', state_key: 'ia', equipment_type: 'camera', latitude: 41, longitude: -93, location_description: 'I-80 camera', status: 'active', stream_url: 'https://example.invalid/historical-camera', updated_at: at, notes: '{"historical_message":"OLD"}' },
    { id: 'GIS-RWIS', state_key: 'ia', equipment_type: 'sensor', equipment_subtype: 'rwis', latitude: 41, longitude: -93, manufacturer: 'Recorded manufacturer', model: 'Recorded model' },
    { id: 'GIS-DETECTOR', state_key: 'ia', equipment_type: 'sensor', equipment_subtype: 'traffic', latitude: 41, longitude: -93 },
    { id: 'GIS-SIGN', state_key: 'ia', equipment_type: 'dms', equipment_subtype: 'active', latitude: 41, longitude: -93, status: 'active', notes: '{"current_message_text":"OLD MESSAGE"}' }
  ];
  const input = { sourceId: 'iowa-its-inventory', kind: 'inventory', status: 'ok', collectedAt: at, sourceObservedAt: null, payload: { equipment } };
  ops.recordCollections('A', [input]);
  const page = ops.collectionPage('A');
  assert.deepEqual(page.rows.map(r => r.kind).sort(), ['camera', 'detector', 'dms', 'rwis']);
  assert.ok(page.rows.every(r => r.inventory && r.observedAt === null && r.message === null && r.flags.includes('inventory-only')));
  assert.equal(page.rows.find(r => r.kind === 'camera').inventoryDetails.reportedStatus, 'active');
  assert.equal(page.rows.find(r => r.kind === 'rwis').inventoryDetails.model, 'Recorded model');
  assert.ok(ops.list('A', 'device').every(d => d.id.startsWith('inventory:') && !d.controlEnabled && d.driver === 'readonly'));
  const raw = ops.collectionBatch('A', page.rows[0].batchId).payload;
  assert.deepEqual(raw.equipment, equipment);
  assert.ok(ops.replayCollection(actor, page.rows[0].batchId).rows.every(r => r.inventory && r.observedAt === null));
});
test('Iowa ITS endpoint is collected as inventory with no inferred observation clock', async () => {
  const provider = createSourceProvider({ baseUrl: 'http://127.0.0.1:3001', now: () => clock,
    fetchImpl: async url => new Response(JSON.stringify(url.pathname === '/api/its-equipment' ? {
      success: true, total: 1, equipment: [{ id: 'GIS1', state_key: 'ia', equipment_type: 'camera', latitude: 41, longitude: -93, updated_at: at }]
    } : { error: 'unavailable' }), { status: url.pathname === '/api/its-equipment' ? 200 : 503 }) });
  const batch = await provider(), inventory = batch.collections.find(c => c.kind === 'inventory');
  assert.equal(inventory.status, 'ok'); assert.equal(inventory.sourceObservedAt, null);
  assert.equal(batch.eventsAvailable, false); assert.equal(inventory.payload.equipment.length, 1);
});
