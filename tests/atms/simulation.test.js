'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { Operations, digest } = require('../../services/atms/core');
const { createRouter } = require('../../services/atms/router');
const { SimulatedWorld } = require('../../services/atms/simulation/world');
const { SimulationDesk } = require('../../services/atms/simulation/desk');
const { CATALOG, actors, runExercise } = require('../../services/atms/simulation/exercises');

test('synthetic external agency models source, camera and recipients independently', () => {
  let clock = Date.parse('2026-10-19T12:00:00Z');
  const world = new SimulatedWorld({ now: () => clock });
  const batch = world.batch();
  assert.equal(batch.events.length, 1); assert.deepEqual(world.snapshot().cad[0].lanesBlocked, [1, 2]);
  const received = world.notify('one', 'incident', 'Synthetic message');
  assert.equal(received.status, 'delivered'); assert.equal(received.acknowledgedAt, null);
  assert.equal(world.notify('one', 'incident', 'Synthetic message').id, received.id);
  assert.throws(() => world.notify('one', 'incident', 'changed'), e => e.status === 409);
  clock += 1000; assert.equal(world.acknowledge('one').acknowledgedAt, new Date(clock).toISOString());
  world.configure({ notificationFault: 'drop', cameraOffline: true, preset: 'upstream' });
  assert.equal(world.snapshot().cameras[0].frameAt, null);
  world.notify('two', 'incident', 'Not received'); assert.throws(() => world.acknowledge('two'), e => e.status === 409);
  const copy = world.snapshot(); copy.notifications[0].status = 'forged'; assert.equal(world.snapshot().notifications[0].status, 'delivered');
  world.configure({ sourceFault: 'outage' }); assert.throws(() => world.batch(), e => e.status === 503);
  world.configure({ sourceFault: 'healthy', scene: 'clear' }); assert.equal(world.batch().events.length, 0); assert.equal(world.snapshot().detectors[0].speedMph, 62);
  assert.throws(() => world.configure({ sourceFault: 'https://external.invalid' }), e => e.status === 400);
});

for (const specification of CATALOG) test('isolated acceptance: ' + specification.title, async () => {
  const report = await runExercise(specification.id);
  assert.equal(report.result, 'passed', report.error);
  assert.ok(report.checks.length >= 3);
  assert.ok(report.checks.every(c => c.result === 'passed'));
  for (const requirement of specification.requirements) assert.ok(report.checks.some(c => c.requirement === requirement));
  const { sha256, ...payload } = report; assert.equal(sha256, digest(payload));
  assert.equal(report.synthetic, true); assert.equal(report.physicalInteroperability, 'not tested');
  assert.equal(report.artifact.auditIntegrity.valid, true);
  assert.ok(report.artifact.controllers.every(c => c.trace.some(t => t.operation === 'GET')));
  if (['corridor-response', 'uncertain-delivery', 'service-recovery'].includes(specification.id)) assert.ok(report.artifact.controllers.some(c => c.trace.some(t => t.operation === 'SET')));
  assert.ok(report.artifact.commands.every(c => c.status !== 'verified' && c.verifiedAt == null));
});

test('simulation jobs are idempotent, isolated, bounded and integrity checked', async t => {
  const ops = new Operations({ mode: 'training' }); t.after(() => ops.close());
  let calls = 0, finish;
  const desk = new SimulationDesk(ops, { execute: async () => { calls++; await new Promise(resolve => { finish = resolve; }); const r = { result: 'passed', checks: [], synthetic: true }; return { ...r, sha256: digest(r) }; } });
  assert.throws(() => desk.start(actors.viewer, { exercise: 'all' }, 'viewer-key'), e => e.status === 403);
  assert.throws(() => desk.snapshot({ ...actors.operator, agency: 'OTHER' }), e => e.status === 403);
  const result = desk.start(actors.operator, { exercise: 'all' }, 'repeatable-key');
  assert.equal(desk.start(actors.operator, { exercise: 'all' }, 'repeatable-key').id, result.id);
  assert.equal(calls, 1); assert.equal(desk.snapshot(actors.viewer).runs[0].status, 'running');
  assert.throws(() => desk.start(actors.operator, { exercise: CATALOG[0].id }, 'another-key'), e => e.status === 409);
  finish(); await desk.close();
  assert.equal(desk.report(actors.viewer, result.id).synthetic, true);
  const stored = ops.need('TRAINING', 'simulation-run', result.id);
  ops.put('TRAINING', 'simulation-run', { ...stored, report: { ...stored.report, synthetic: false } }, stored.version);
  assert.throws(() => desk.report(actors.viewer, result.id), e => e.status === 409);
  assert.equal(ops.list('TRAINING', 'incident').length, 0);
  assert.equal(ops.list('TRAINING', 'command').length, 0);
});

test('interrupted and failed jobs never appear as passing reports', async t => {
  const ops = new Operations({ mode: 'training' }); t.after(() => ops.close());
  ops.put('TRAINING', 'simulation-run', { id: 'interrupted', status: 'running', report: null });
  const desk = new SimulationDesk(ops, { execute: async () => { throw new Error('Injected runner failure'); } });
  assert.equal(ops.need('TRAINING', 'simulation-run', 'interrupted').status, 'interrupted');
  const job = desk.start(actors.operator, { exercise: 'all' }, 'failure-key'); await desk.close();
  assert.equal(ops.need('TRAINING', 'simulation-run', job.id).status, 'failed');
  assert.throws(() => desk.report(actors.viewer, job.id), e => e.status === 409);
  assert.equal(ops.verifyAudit('TRAINING').valid, true);
  const live = new Operations({ mode: 'live' }); t.after(() => live.close());
  assert.throws(() => new SimulationDesk(live), /restricted/);
});

test('HTTP simulation routes enforce identity, role, training mode and source outage behavior', async t => {
  const ops = new Operations({ mode: 'training' }), live = new Operations({ mode: 'live' });
  t.after(() => { ops.close(); live.close(); });
  const desk = new SimulationDesk(ops);
  const auth = (req, res, next) => { req.user = Object.values(actors).find(a => a.id === req.get('X-Test-Actor')); if (!req.user) return res.status(401).json({ error: 'Individual session required.' }); next(); };
  const app = express();
  app.use('/training', createRouter({ ops, authenticate: auth, resolveActor: r => r.user, simulationDesk: desk, sourceProvider: async () => desk.batch() }));
  app.use('/live', createRouter({ ops: live, authenticate: auth, resolveActor: r => r.user, simulationDesk: desk }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (url, actor, body) => { const r = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { ...(actor ? { 'X-Test-Actor': actor.id } : {}), ...(body ? { 'Content-Type': 'application/json', 'X-ATMS-Client': 'workspace', 'Idempotency-Key': require('node:crypto').randomUUID() } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, value: r.headers.get('content-type')?.includes('json') ? await r.json() : null }; };
  assert.equal((await call('/training/training/simulation')).status, 401);
  const read = await call('/training/training/simulation', actors.viewer); assert.equal(read.status, 200);
  assert.equal((await call('/training/training/simulation/world', actors.viewer, { action: 'configure', version: read.value.version, scene: 'clear' })).status, 403);
  assert.equal((await call('/training/training/simulation/runs', actors.viewer, { exercise: 'all' })).status, 403);
  assert.equal((await call('/live/training/simulation', actors.operator)).status, 404);
  assert.equal((await call('/training/sources/refresh', actors.operator, {})).status, 200);
  const prior = ops.get('TRAINING', 'source', 'corridor-communicator').observedAt;
  assert.equal((await call('/training/training/simulation/world', actors.operator, { action: 'configure', version: read.value.version, sourceFault: 'outage' })).status, 200);
  assert.equal((await call('/training/sources/refresh', actors.operator, {})).status, 503);
  assert.equal(ops.get('TRAINING', 'source', 'corridor-communicator').observedAt, prior);
});
