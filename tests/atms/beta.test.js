'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateKeyPairSync, randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { createAccountCheck, Sandboxes, betaConfig } = require('../../services/atms/beta');
const { createBetaApp } = require('../../products/atms/beta-server.cjs');

const URL_ = 'https://example-project.supabase.co';
function config(t, extra = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atms-beta-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  return { url: URL_, anonKey: 'anon', dataDir, secret: 's'.repeat(48), turnstileSiteKey: null, maxSandboxes: 2, idleMinutes: 60, lifetimeHours: 8, ...extra };
}

// The account service: ES256 keys published as JWKS, beta rows behind row security.
function accountService({ rows = {} } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'ES256', use: 'sig' };
  const sign = (sub, opts = {}) => jwt.sign({ sub, email: 'tester@example.gov', role: 'authenticated' }, privateKey, { algorithm: 'ES256', keyid: 'k1', issuer: URL_ + '/auth/v1', audience: 'authenticated', expiresIn: 3600, ...opts });
  const fetchImpl = async (url, init = {}) => {
    if (url === URL_ + '/auth/v1/.well-known/jwks.json') return new Response(JSON.stringify({ keys: [jwk] }));
    if (url.startsWith(URL_ + '/rest/v1/atms_beta_access')) {
      const sub = jwt.decode(init.headers.Authorization.slice(7)).sub;
      return new Response(JSON.stringify(rows[sub] ? [rows[sub]] : []));
    }
    return new Response('{}', { status: 404 });
  };
  return { sign, fetchImpl };
}

test('account check accepts signed-in accounts with beta access and refuses the rest', async t => {
  const granted = randomUUID(), revoked = randomUUID(), expired = randomUUID(), none = randomUUID();
  const service = accountService({ rows: { [granted]: { expires_at: null, revoked_at: null }, [revoked]: { expires_at: null, revoked_at: '2026-10-01T00:00:00Z' }, [expired]: { expires_at: '2020-01-01T00:00:00Z', revoked_at: null } } });
  const check = createAccountCheck(config(t), { fetchImpl: service.fetchImpl });
  assert.equal((await check(service.sign(granted))).userId, granted);
  for (const id of [revoked, expired, none]) await assert.rejects(check(service.sign(id)), e => e.status === 403);
  await assert.rejects(check(service.sign(granted, { issuer: 'https://other.supabase.co/auth/v1' })), e => e.status === 401);
  await assert.rejects(check(service.sign(granted, { expiresIn: -10 })), e => e.status === 401);
  const forged = jwt.sign({ sub: granted }, 'not-the-key', { algorithm: 'HS256', keyid: 'k1', issuer: URL_ + '/auth/v1', audience: 'authenticated' });
  await assert.rejects(check(forged), e => e.status === 401);
});

test('sandboxes are per account, capped, and deleted when they expire', async t => {
  let now = Date.parse('2026-10-21T12:00:00Z'); const closed = [];
  const cfg = config(t);
  const boxes = new Sandboxes(cfg, async ({ id, filename }) => { fs.writeFileSync(filename, 'x'); return { close: async () => closed.push(id) }; }, { now: () => now });
  t.after(() => boxes.closeAll());
  const a = await boxes.open('user-a'); assert.equal((await boxes.open('user-a')).id, a.id);
  await boxes.open('user-b');
  await assert.rejects(boxes.open('user-c'), e => e.status === 503);
  now += 61 * 60000; await boxes.sweep();
  assert.deepEqual(closed.sort(), [a.id, boxes.idFor('user-b')].sort());
  assert.equal(fs.readdirSync(cfg.dataDir).length, 0);
  await boxes.open('user-c');
});

test('the beta serves each account its own training workspace', { timeout: 60000 }, async t => {
  const alice = randomUUID(), bob = randomUUID(), outsider = randomUUID();
  const service = accountService({ rows: { [alice]: { expires_at: null, revoked_at: null }, [bob]: { expires_at: null, revoked_at: null } } });
  const cfg = config(t);
  const { app, sandboxes } = createBetaApp(cfg, { accountCheck: createAccountCheck(cfg, { fetchImpl: service.fetchImpl }) });
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(async () => { server.close(); await sandboxes.closeAll(); });
  const base = `http://127.0.0.1:${server.address().port}/api/atms`;
  const call = async (p, { method = 'GET', token, beta, body } = {}) => {
    const res = await fetch(base + p, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(beta ? { 'X-ATMS-Beta': beta } : {}), ...(body ? { 'Content-Type': 'application/json', 'X-ATMS-Client': 'workspace', 'Idempotency-Key': randomUUID() } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() };
  };
  const runtime = await call('/runtime');
  assert.equal(runtime.body.beta, true); assert.equal(runtime.body.account.url, URL_);

  assert.equal((await call('/beta/session', { method: 'POST', token: service.sign(outsider) })).status, 403);
  assert.equal((await call('/workspace', { token: 'nonsense' })).status, 401);

  const session = async user => {
    const beta = (await call('/beta/session', { method: 'POST', token: service.sign(user) })).body.token;
    const role = await call('/training/session', { method: 'POST', beta, body: { id: 'training.operator' } });
    assert.equal(role.status, 200, JSON.stringify(role.body));
    return { beta, token: role.body.token };
  };
  const a = await session(alice), b = await session(bob);
  const before = await call('/workspace', { token: b.token });
  assert.equal(before.status, 200, JSON.stringify(before.body));
  const created = await call('/incidents', { method: 'POST', token: a.token, body: { title: 'Alice only', route: 'I-80', direction: 'eastbound', jurisdiction: 'TRAINING', severity: 'major', kind: 'incident', latitude: 41.6, longitude: -93.6, description: 'Isolation check' } });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.ok((await call('/workspace', { token: a.token })).body.incidents.some(i => i.title === 'Alice only'));
  assert.ok(!(await call('/workspace', { token: b.token })).body.incidents.some(i => i.title === 'Alice only'));

  // A role token from one sandbox cannot be replayed against another account's sandbox.
  const forged = jwt.sign({ ...jwt.decode(a.token), sub: bob }, 'wrong', { algorithm: 'HS256' });
  assert.equal((await call('/workspace', { token: forged })).status, 401);

  assert.equal((await call('/beta/reset', { method: 'POST', beta: a.beta })).status, 200);
  assert.equal((await call('/workspace', { token: a.token })).status, 401);
});

test('beta configuration is required and bounded', () => {
  assert.throws(() => betaConfig({}));
  assert.throws(() => betaConfig({ ATMS_BETA_SUPABASE_URL: 'http://x.supabase.co', ATMS_BETA_SUPABASE_ANON_KEY: 'a', ATMS_BETA_DATA_DIR: '/tmp/x', ATMS_BETA_SECRET: 's'.repeat(40) }));
  assert.throws(() => betaConfig({ ATMS_BETA_SUPABASE_URL: URL_, ATMS_BETA_SUPABASE_ANON_KEY: 'a', ATMS_BETA_DATA_DIR: '/tmp/x', ATMS_BETA_SECRET: 's'.repeat(40), ATMS_BETA_MAX_SANDBOXES: '500' }));
  assert.equal(betaConfig({ ATMS_BETA_SUPABASE_URL: URL_ + '/', ATMS_BETA_SUPABASE_ANON_KEY: 'a', ATMS_BETA_DATA_DIR: '/tmp/x', ATMS_BETA_SECRET: 's'.repeat(40) }).maxSandboxes, 8);
});
