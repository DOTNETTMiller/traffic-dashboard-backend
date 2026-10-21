'use strict';
const { Operations, stable } = require('./core');
const { Dispatcher } = require('./dispatcher');
const { createRouter, actorFromUser } = require('./router');
const fs = require('node:fs');
const { loadRoadNetwork } = require('./geometry');
const { createHash } = require('node:crypto');

const names = value => String(value || '').split(',').map(s => s.trim()).filter(Boolean);
function configuredGateway(env) {
  if (!env.ATMS_GATEWAY_URL) return null;
  const url = new URL(env.ATMS_GATEWAY_URL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !env.ATMS_GATEWAY_SECRET || env.ATMS_GATEWAY_SECRET.length < 32 || !env.ATMS_AGENCY) throw new Error('Live gateway requires HTTPS, a 32+ character secret, and ATMS_AGENCY.');
  return { url: url.href, secret: env.ATMS_GATEWAY_SECRET, agency: env.ATMS_AGENCY };
}
function provisionDevices(ops, env, gateway) {
  const retireMissing = ids => {
    for (const old of ops.list?.(gateway?.agency || env.ATMS_AGENCY, 'device') || []) {
      if (old.driver === 'gateway' && old.controlEnabled && !ids.has(old.id)) ops.registerDevice(gateway?.agency || env.ATMS_AGENCY, { ...old, controlEnabled: false });
    }
  };
  if (!env.ATMS_DEVICE_CONFIG) { retireMissing(new Set()); return; }
  if (!gateway) throw new Error('Control-device configuration requires a live gateway.');
  const devices = JSON.parse(fs.readFileSync(env.ATMS_DEVICE_CONFIG, 'utf8'));
  if (!Array.isArray(devices) || devices.length > 10000) throw new Error('ATMS_DEVICE_CONFIG must contain an array of devices.');
  const ids = new Set(devices.map(d => d?.id));
  if (ids.size !== devices.length) throw new Error('Control-device IDs must be unique.');
  for (const d of devices) {
    if (!d.id || !d.name || d.type !== 'dms' || !Number.isInteger(d.columns) || d.columns < 1 || d.columns > 128 || !Number.isInteger(d.lines) || d.lines < 1 || d.lines > 20 || !Number.isFinite(d.latitude) || !Number.isFinite(d.longitude) || Math.abs(d.latitude) > 90 || Math.abs(d.longitude) > 180) throw new Error('Invalid control-device configuration.');
    const previous = ops.get(gateway.agency, 'device', d.id);
    // Configuration is not telemetry: never invent an observation timestamp.
    ops.registerDevice(gateway.agency, { ...d, provisioningRevision: createHash('sha256').update(stable(d)).digest('hex'), gatewayRevision: createHash('sha256').update(gateway.url + gateway.secret).digest('hex'), driver: 'gateway', controlEnabled: d.controlEnabled === true, observedAt: previous?.observedAt || null, displayedMessage: previous?.displayedMessage || '', inventory: false });
  }
  retireMissing(ids);
}
function mountATMS(app, { authenticate, sourceProvider, env = process.env }) {
  if (env.ATMS_ENABLED !== 'true') {
    app.use('/api/atms', (req, res) => res.status(503).json({ error: 'ATMS operations are not enabled on this server. Run the local training workspace or configure the ATMS service.' }));
    return null;
  }
  if (!env.ATMS_DB_PATH || !env.JWT_SECRET || env.JWT_SECRET.length < 32 || !env.ATMS_AGENCY) throw new Error('Live ATMS requires ATMS_DB_PATH on persistent storage, JWT_SECRET (32+ characters), and ATMS_AGENCY.');
  const ops = new Operations({ filename: env.ATMS_DB_PATH, mode: 'live' });
  const video = require('./video').configuredVideo(ops, env);
  ops.roadNetwork = loadRoadNetwork(env);
  const gateway = configuredGateway(env);
  ops.gatewayAvailable = !!gateway;
  provisionDevices(ops, env, gateway);
  const dispatcher = new Dispatcher(ops, { gateway }); dispatcher.start();
  const dtcd = require('./dtcd').configuredDtcd(env);
  const router = createRouter({ ops, authenticate, sourceProvider, gateway, dtcd, video, publicFeedAgency: env.ATMS_PUBLIC_FEED_ENABLED === 'true' ? env.ATMS_AGENCY : null, resolveActor: req => actorFromUser(req.user, { agency: env.ATMS_AGENCY, operators: names(env.ATMS_OPERATOR_USERS), supervisors: names(env.ATMS_SUPERVISOR_USERS), viewers: names(env.ATMS_VIEWER_USERS) }) });
  app.use('/api/atms', router);
  return { ops, dispatcher };
}
module.exports = { mountATMS, configuredGateway, provisionDevices, names };
