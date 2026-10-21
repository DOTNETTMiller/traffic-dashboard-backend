'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomUUID } = require('node:crypto');
const express = require('express');
const { Operations } = require('../../services/atms/core');
const { createRouter } = require('../../services/atms/router');
const { configuredDtcd } = require('../../services/atms/dtcd');

const SECRET = 'a'.repeat(64);
const T0 = Date.parse('2026-10-21T15:00:00Z');

// Exactly what DTCD's signAndPost sends (supabase/functions/_shared/webhook-delivery.ts).
function signed(payload, { secret = SECRET, at = T0, tamper = false } = {}) {
  const body = JSON.stringify(payload);
  const ts = String(Math.floor(at / 1000));
  const signature = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return { body: tamper ? body.replace('I-80', 'I-35') : body, headers: { 'Content-Type': 'application/json', 'X-DTCD-Timestamp': ts, 'X-DTCD-Signature': `sha256=${signature}`, 'User-Agent': 'DTCD-FeedWebhook/1.0' } };
}
function closure(overrides = {}, props = {}) {
  return {
    event_id: randomUUID(), event_type: 'insert', closure_id: 'c0ffee00-0000-4000-8000-000000000001', update_date: new Date(T0).toISOString(),
    work_zone: { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-93.70, 41.60], [-93.65, 41.60]] },
      properties: { type: 'work_zone', closure_id: 'fb-123', project_id: 'P-9', road_name: 'I-80', direction: 'eastbound', work_type: 'Bridge deck repair',
        vehicle_impact: 'some-lanes-closed', reduced_speed_limit: 55, start_time: '2026-10-21T12:00:00Z', end_time: '2026-10-22T02:00:00Z', is_active: true,
        mutcd_signs: [{ mutcd_code: 'W20-1', role: 'advance', message: 'Road work ahead', location: [-93.71, 41.60], timestamp: '2026-10-21T12:05:00Z' }], ...props } },
    ...overrides
  };
}

async function serve(t, { hostParser, configured = true }) {
  const ops = new Operations({ mode: 'live', now: () => T0 + 1000 }); t.after(() => ops.close());
  const app = express();
  // The Corridor backend parses JSON globally and keeps DTCD's bytes; a standalone mount does not.
  if (hostParser) app.use(express.json({ limit: '50mb', verify: (req, res, buf) => { if (req.url.startsWith('/api/atms/dtcd/')) req.rawBody = buf; } }));
  const dtcd = configured ? configuredDtcd({ ATMS_DTCD_WEBHOOK_SECRET: SECRET, ATMS_AGENCY: 'IA' }) : null;
  app.use('/api/atms', createRouter({ ops, dtcd, authenticate: (req, res, next) => next(), resolveActor: () => null, sourceProvider: async () => ({}) }));
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); }); t.after(() => server.close());
  const post = async ({ body, headers }) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/atms/dtcd/closures`, { method: 'POST', headers, body });
    return { status: res.status, body: await res.json() };
  };
  return { ops, post };
}

for (const hostParser of [true, false]) {
  test(`DTCD closure pushes become ATMS events (${hostParser ? 'Corridor host' : 'standalone'})`, async t => {
    const { ops, post } = await serve(t, { hostParser });
    const first = closure();
    let r = await post(signed(first));
    assert.equal(r.status, 200, JSON.stringify(r.body)); assert.equal(r.body.status, 'stored');
    const event = ops.get('IA', 'event', 'DTCD:' + first.closure_id);
    assert.equal(event.present, true); assert.equal(event.kind, 'closure'); assert.equal(event.route, 'I-80'); assert.equal(event.sourceName, 'DTCD');
    assert.equal(event.geometry.type, 'LineString'); assert.equal(event.pushedBy, 'dtcd');
    assert.deepEqual(event.fieldEvidence.signs.map(s => s.code), ['W20-1']); assert.equal(event.fieldEvidence.closureId, 'fb-123');

    // DTCD retries reuse the event_id: acknowledged, not reapplied.
    r = await post(signed(first)); assert.equal(r.status, 200); assert.equal(r.body.status, 'duplicate');

    // A late retry of an older change never overwrites a newer one.
    r = await post(signed(closure({ update_date: new Date(T0 - 60000).toISOString() }, { road_name: 'OLD ROAD' })));
    assert.equal(r.body.status, 'older'); assert.equal(ops.get('IA', 'event', event.id).route, 'I-80');

    // A Corridor snapshot import does not retire an event DTCD pushed.
    ops.ingest('IA', { events: [], observedAt: new Date(T0 + 500).toISOString() });
    assert.equal(ops.get('IA', 'event', event.id).present, true);

    // Delete (also sent for training or voided closures) ends the event.
    r = await post(signed(closure({ event_type: 'delete', work_zone: null, update_date: new Date(T0 + 1000).toISOString() })));
    assert.equal(r.body.status, 'ended'); assert.equal(ops.get('IA', 'event', event.id).present, false);
  });
}

test('DTCD pushes with a bad signature, stale timestamp or altered body are refused', async t => {
  const { ops, post } = await serve(t, { hostParser: true });
  for (const attempt of [
    signed(closure(), { secret: 'b'.repeat(64) }),
    signed(closure(), { at: T0 - 10 * 60000 }),
    signed(closure(), { tamper: true }),
    { ...signed(closure()), headers: { ...signed(closure()).headers, 'X-DTCD-Signature': 'deadbeef' } }
  ]) assert.equal((await post(attempt)).status, 401);
  assert.equal(ops.list('IA', 'event').length, 0);
  assert.equal((await post(signed({ ...closure(), event_type: 'upsert' }))).status, 400);
});

test('DTCD push is off unless a secret is configured', async t => {
  const { post } = await serve(t, { hostParser: true, configured: false });
  assert.equal((await post(signed(closure()))).status, 503);
  assert.throws(() => configuredDtcd({ ATMS_DTCD_WEBHOOK_SECRET: 'short', ATMS_AGENCY: 'IA' }));
  assert.equal(configuredDtcd({}), null);
});
