'use strict';
// Hosted training beta. Visitors sign in with their PurposeBuilt account (the
// shared Supabase account service that DTCD and StormwaterCheck use), must hold
// a row in public.atms_beta_access, and each get a private, expiring training
// sandbox. Nothing here can reach live data or physical devices.
const fs = require('node:fs');
const path = require('node:path');
const { createPublicKey, createHash } = require('node:crypto');
const jwt = require('jsonwebtoken');

function betaConfig(env = process.env) {
  const url = env.ATMS_BETA_SUPABASE_URL, anonKey = env.ATMS_BETA_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !env.ATMS_BETA_DATA_DIR || !env.ATMS_BETA_SECRET || env.ATMS_BETA_SECRET.length < 32) {
    throw new Error('The beta needs ATMS_BETA_SUPABASE_URL, ATMS_BETA_SUPABASE_ANON_KEY, ATMS_BETA_DATA_DIR and ATMS_BETA_SECRET (32+ characters).');
  }
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search) throw new Error('ATMS_BETA_SUPABASE_URL must be the HTTPS project URL.');
  const count = (name, fallback, min, max) => { const n = Number(env[name] || fallback); if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer from ${min} to ${max}.`); return n; };
  return {
    url: parsed.origin, anonKey, dataDir: env.ATMS_BETA_DATA_DIR, secret: env.ATMS_BETA_SECRET,
    turnstileSiteKey: env.ATMS_BETA_TURNSTILE_SITE_KEY || null,
    maxSandboxes: count('ATMS_BETA_MAX_SANDBOXES', 8, 1, 50),
    idleMinutes: count('ATMS_BETA_IDLE_MINUTES', 60, 5, 480),
    lifetimeHours: count('ATMS_BETA_LIFETIME_HOURS', 8, 1, 24)
  };
}

// Verifies a PurposeBuilt access token against the project's published keys,
// then asks the project (as that user, under row security) for beta access.
function createAccountCheck(config, { fetchImpl = fetch, now = Date.now } = {}) {
  let keys = null, keysAt = 0;
  async function signingKeys(force = false) {
    if (keys && !force && now() - keysAt < 600000) return keys;
    const response = await fetchImpl(config.url + '/auth/v1/.well-known/jwks.json', { signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!response.ok) throw Object.assign(new Error('The PurposeBuilt account service is unavailable.'), { status: 503 });
    const body = await response.json();
    keys = new Map((body.keys || []).filter(k => k.kid && ['ES256', 'RS256'].includes(k.alg)).map(k => [k.kid, { alg: k.alg, key: createPublicKey({ key: k, format: 'jwk' }) }]));
    keysAt = now();
    return keys;
  }
  async function identify(token) {
    const header = jwt.decode(token, { complete: true })?.header;
    if (!header?.kid) throw Object.assign(new Error('Sign in with your PurposeBuilt account.'), { status: 401 });
    let entry = (await signingKeys()).get(header.kid);
    if (!entry) entry = (await signingKeys(true)).get(header.kid);
    if (!entry) throw Object.assign(new Error('Sign in again with your PurposeBuilt account.'), { status: 401 });
    let claims;
    try { claims = jwt.verify(token, entry.key, { algorithms: [entry.alg], issuer: config.url + '/auth/v1', audience: 'authenticated', clockTimestamp: Math.floor(now() / 1000) }); }
    catch { throw Object.assign(new Error('Your PurposeBuilt session has expired. Sign in again.'), { status: 401 }); }
    if (typeof claims.sub !== 'string' || !/^[0-9a-f-]{36}$/i.test(claims.sub)) throw Object.assign(new Error('Sign in with your PurposeBuilt account.'), { status: 401 });
    return { userId: claims.sub.toLowerCase(), email: typeof claims.email === 'string' ? claims.email : null };
  }
  async function access(token) {
    const response = await fetchImpl(config.url + '/rest/v1/atms_beta_access?select=expires_at,revoked_at', {
      headers: { apikey: config.anonKey, Authorization: 'Bearer ' + token, Accept: 'application/json' }, signal: AbortSignal.timeout(10000), redirect: 'error'
    });
    if (!response.ok) throw Object.assign(new Error('Beta access could not be checked. Try again shortly.'), { status: 503 });
    const row = (await response.json())[0];
    const until = row?.expires_at ? Date.parse(row.expires_at) : null;
    if (!row || row.revoked_at || (until !== null && !(until > now()))) throw Object.assign(new Error('This PurposeBuilt account does not have ATMS beta access. Request access from PurposeBuilt.'), { status: 403 });
    return { expiresAt: until ? new Date(until).toISOString() : null };
  }
  return async token => { const who = await identify(token); return { ...who, ...(await access(token)) }; };
}

// One private training workspace per account, created on demand. A sandbox
// ends after its idle period or its lifetime and its database is deleted.
class Sandboxes {
  constructor(config, build, { now = Date.now } = {}) {
    this.config = config; this.build = build; this.now = now;
    this.items = new Map(); this.pending = new Map();
    fs.mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
    for (const file of fs.readdirSync(config.dataDir)) if (/^sandbox-[a-f0-9]{24}\.sqlite(-wal|-shm)?$/.test(file)) fs.rmSync(path.join(config.dataDir, file), { force: true });
    this.timer = setInterval(() => this.sweep().catch(() => {}), 60000); this.timer.unref();
  }
  idFor(userId) { return createHash('sha256').update('atms-beta:' + userId).digest('hex').slice(0, 24); }
  async open(userId) {
    const id = this.idFor(userId);
    const existing = this.items.get(id);
    if (existing) { existing.touchedAt = this.now(); return existing; }
    if (this.pending.has(id)) return this.pending.get(id);
    await this.sweep();
    if (this.items.size + this.pending.size >= this.config.maxSandboxes) throw Object.assign(new Error('The ATMS beta is at capacity. Try again later.'), { status: 503 });
    const started = (async () => {
      const filename = path.join(this.config.dataDir, `sandbox-${id}.sqlite`);
      const parts = await this.build({ id, filename });
      const item = { id, userId, filename, createdAt: this.now(), touchedAt: this.now(), ...parts };
      item.expiresAt = item.createdAt + this.config.lifetimeHours * 3600000;
      this.items.set(id, item);
      return item;
    })();
    this.pending.set(id, started);
    try { return await started; } finally { this.pending.delete(id); }
  }
  get(id) { const item = this.items.get(id); if (item) item.touchedAt = this.now(); return item || null; }
  async close(id) {
    const item = this.items.get(id); if (!item) return false;
    this.items.delete(id);
    try { await item.close(); } finally { for (const s of ['', '-wal', '-shm']) fs.rmSync(item.filename + s, { force: true }); }
    return true;
  }
  async sweep() {
    const t = this.now(), idle = this.config.idleMinutes * 60000;
    for (const item of [...this.items.values()]) if (t - item.touchedAt > idle || t >= item.expiresAt) await this.close(item.id);
  }
  async closeAll() { clearInterval(this.timer); for (const id of [...this.items.keys()]) await this.close(id); }
}

module.exports = { betaConfig, createAccountCheck, Sandboxes };
