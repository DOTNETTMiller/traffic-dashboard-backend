'use strict';
// Hosted ATMS training beta: PurposeBuilt sign-in, beta access check, one
// private expiring training sandbox per account. See BETA.md.
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('node:path');
const { Operations } = require('../../services/atms/core');
const { Dispatcher } = require('../../services/atms/dispatcher');
const { createRouter } = require('../../services/atms/router');
const { TrainingNtcipLab } = require('../../services/atms/ntcip/training-lab');
const { SimulationDesk } = require('../../services/atms/simulation/desk');
const { loadRoadNetwork } = require('../../services/atms/geometry');
const { betaConfig, createAccountCheck, Sandboxes } = require('../../services/atms/beta');

const IDENTITIES = Object.freeze([
  { id: 'training.operator', name: 'Training operator', role: 'operator', agency: 'TRAINING' },
  { id: 'training.supervisor', name: 'Training supervisor', role: 'supervisor', agency: 'TRAINING' },
  { id: 'training.incoming', name: 'Incoming operator', role: 'operator', agency: 'TRAINING' },
  { id: 'training.observer', name: 'Read-only observer', role: 'viewer', agency: 'TRAINING' }
]);
const ROAD_NETWORK = { ATMS_ROAD_NETWORK_PATH: path.join(__dirname, 'fixtures/des-moines-road-alignment.geojson'), ATMS_ROAD_NETWORK_SOURCE: 'Iowa DOT RAMS All Routes · corridor snapshot · simulated operational limits and assets' };
const BETA_TOKEN = { issuer: 'purposebuilt-atms-beta', audience: 'purposebuilt-atms-beta' };
const ROLE_TOKEN = { issuer: 'purposebuilt-atms-beta', audience: 'purposebuilt-atms-training' };

async function buildSandbox({ filename }) {
  const ops = new Operations({ filename, mode: 'training' });
  let lab = null, desk = null, dispatcher = null;
  try {
    ops.seedTraining();
    ops.roadNetwork = loadRoadNetwork(ROAD_NETWORK);
    lab = await new TrainingNtcipLab(ops).start();
    require('../../services/atms/architecture-training').seedArchitecture(ops);
    desk = new SimulationDesk(ops);
    dispatcher = new Dispatcher(ops, { gateway: null, trainingLab: lab }); dispatcher.start();
  } catch (error) { dispatcher?.stop(); await desk?.close(); await lab?.close(); ops.close(); throw error; }
  const router = createRouter({
    ops, authenticate: (req, res, next) => next(), sourceProvider: async () => desk.batch(), trainingLab: lab, simulationDesk: desk,
    resolveActor: req => IDENTITIES.find(a => a.id === req.user.id)
  });
  return {
    router,
    async close() { dispatcher.stop(); await desk.close(); while (dispatcher.busy) await new Promise(r => setTimeout(r, 50)); await lab.close(); ops.close(); }
  };
}

// Small fixed-window limiter for the endpoints that reach the account service.
function limiter(perMinute) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now(), key = req.ip, entry = hits.get(key);
    if (!entry || now - entry.at > 60000) hits.set(key, { at: now, n: 1 });
    else if (++entry.n > perMinute) return res.status(429).json({ error: 'Too many attempts. Wait a minute and try again.' });
    if (hits.size > 10000) hits.clear();
    next();
  };
}

function createBetaApp(config, { accountCheck = createAccountCheck(config), build = buildSandbox, now = Date.now } = {}) {
  const sandboxes = new Sandboxes(config, build, { now });
  const app = express(); app.disable('x-powered-by'); app.set('trust proxy', 1);
  app.use(require('compression')());
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Strict-Transport-Security': 'max-age=31536000' });
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store, private');
    next();
  });
  const fail = (res, error) => res.status(error.status || 500).json({ error: error.status ? error.message : 'The beta service could not complete the request.' });
  const bearer = req => { const h = req.get('Authorization') || ''; return h.startsWith('Bearer ') ? h.slice(7) : null; };
  const verify = (token, options) => { try { return jwt.verify(token || '', config.secret, { algorithms: ['HS256'], ...options }); } catch { return null; } };

  app.get('/api/atms/runtime', (req, res) => res.json({
    mode: 'training', beta: true, authentication: 'purposebuilt-beta', trainingProtocol: 'ntcip-snmp-emulator', trainingIdentities: IDENTITIES,
    account: { url: config.url, anonKey: config.anonKey, turnstileSiteKey: config.turnstileSiteKey },
    sandbox: { idleMinutes: config.idleMinutes, lifetimeHours: config.lifetimeHours }
  }));
  // PurposeBuilt access token in, beta token for this account's sandbox out.
  app.post('/api/atms/beta/session', limiter(10), async (req, res) => {
    try {
      const token = bearer(req);
      if (!token) return res.status(401).json({ error: 'Sign in with your PurposeBuilt account.' });
      const account = await accountCheck(token);
      const sandbox = await sandboxes.open(account.userId);
      const ttl = Math.max(60, Math.min(2 * 3600, Math.floor((sandbox.expiresAt - now()) / 1000), account.expiresAt ? Math.floor((Date.parse(account.expiresAt) - now()) / 1000) : Infinity));
      res.json({ token: jwt.sign({ sandbox: sandbox.id }, config.secret, { algorithm: 'HS256', expiresIn: ttl, subject: account.userId, ...BETA_TOKEN }), email: account.email, sandboxExpiresAt: new Date(sandbox.expiresAt).toISOString() });
    } catch (error) { fail(res, error); }
  });
  const beta = (req, res, next) => {
    const claims = verify(req.get('X-ATMS-Beta'), BETA_TOKEN);
    const sandbox = claims && sandboxes.get(claims.sandbox);
    if (!sandbox || sandbox.userId !== claims.sub) return res.status(401).json({ error: 'Your beta session has ended. Sign in again.' });
    req.beta = { claims, sandbox }; next();
  };
  app.post('/api/atms/training/session', express.json({ limit: '1kb' }), beta, (req, res) => {
    const actor = IDENTITIES.find(a => a.id === req.body?.id);
    if (!actor) return res.status(400).json({ error: 'Choose a training identity.' });
    const left = Math.max(60, req.beta.claims.exp - Math.floor(now() / 1000));
    res.json({ token: jwt.sign({ ...actor, sandbox: req.beta.sandbox.id }, config.secret, { algorithm: 'HS256', expiresIn: left, subject: req.beta.claims.sub, ...ROLE_TOKEN }), actor });
  });
  app.post('/api/atms/beta/reset', beta, async (req, res) => {
    try { await sandboxes.close(req.beta.sandbox.id); res.json({ reset: true }); } catch (error) { fail(res, error); }
  });
  app.use('/api/atms', (req, res, next) => {
    const claims = verify(bearer(req), ROLE_TOKEN);
    const sandbox = claims && sandboxes.get(claims.sandbox);
    if (!sandbox || sandbox.userId !== claims.sub) return res.status(401).json({ error: 'Your beta session has ended. Sign in again.' });
    req.user = claims; sandbox.router(req, res, next);
  });
  const dist = path.resolve(__dirname, '../../frontend/dist');
  app.get('/', (req, res) => res.redirect('/atms.html'));
  app.use(express.static(dist, { etag: true, index: false }));
  return { app, sandboxes };
}

if (require.main === module) {
  const config = betaConfig();
  const { app, sandboxes } = createBetaApp(config);
  const server = app.listen(Number(process.env.PORT || 4433), process.env.ATMS_BETA_HOST || '0.0.0.0', () => console.log(`PurposeBuilt ATMS beta on port ${server.address().port}`));
  const shutdown = async () => { server.close(); await sandboxes.closeAll(); process.exit(0); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
module.exports = { createBetaApp, buildSandbox, IDENTITIES };
