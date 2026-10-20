'use strict';
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const { Operations } = require('../../services/atms/core');
const { Dispatcher } = require('../../services/atms/dispatcher');
const { createRouter, actorFromUser } = require('../../services/atms/router');
const { configuredGateway, provisionDevices, names } = require('../../services/atms/bootstrap');
const { TrainingNtcipLab } = require('../../services/atms/ntcip/training-lab');
const { SimulationDesk } = require('../../services/atms/simulation/desk');

const mode = process.env.ATMS_MODE || 'training';
const host = process.env.ATMS_HOST || '127.0.0.1';
if (!['training', 'live'].includes(mode)) throw new Error('ATMS_MODE must be training or live.');
if (mode === 'training' && host !== '127.0.0.1') throw new Error('The training service binds only to 127.0.0.1.');
if (mode === 'live' && (!process.env.ATMS_JWT_SECRET || process.env.ATMS_JWT_SECRET.length < 32 || !process.env.ATMS_DB_PATH || !process.env.ATMS_AGENCY)) throw new Error('Live ATMS requires ATMS_JWT_SECRET (32+ characters), ATMS_DB_PATH, and ATMS_AGENCY.');
const secret = mode === 'training' ? randomBytes(48).toString('hex') : process.env.ATMS_JWT_SECRET;
const ops = new Operations({ filename: process.env.ATMS_DB_PATH || path.join(__dirname, 'runtime/training.sqlite'), mode });
const video = require('../../services/atms/video').configuredVideo(ops);
const identities = [
  { id: 'training.operator', name: 'Training operator', role: 'operator', agency: 'TRAINING' },
  { id: 'training.supervisor', name: 'Training supervisor', role: 'supervisor', agency: 'TRAINING' },
  { id: 'training.incoming', name: 'Incoming operator', role: 'operator', agency: 'TRAINING' },
  { id: 'training.observer', name: 'Read-only observer', role: 'viewer', agency: 'TRAINING' }
];
if (mode === 'training') ops.seedTraining();
const app = express(); app.disable('x-powered-by');
app.use(require('compression')());
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' });
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store, private');
  next();
});
app.get('/api/atms/runtime', (req, res) => res.json({ mode, trainingProtocol: mode === 'training' ? 'ntcip-snmp-emulator' : null, trainingIdentities: mode === 'training' ? identities : [], authentication: mode === 'training' ? 'local-training-session' : 'individual-jwt' }));
app.post('/api/atms/training/session', express.json({ limit: '1kb' }), (req, res) => {
  if (mode !== 'training' || req.socket.remoteAddress !== '127.0.0.1' || req.get('X-ATMS-Client') !== 'workspace') return res.status(403).json({ error: 'Training sessions are available only on the local training service.' });
  const origin = req.get('Origin');
  if (origin && !/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/.test(origin)) return res.status(403).json({ error: 'Training session requests must originate from the local workspace.' });
  const actor = identities.find(a => a.id === req.body.id);
  if (!actor) return res.status(400).json({ error: 'Choose a training identity.' });
  res.json({ token: jwt.sign(actor, secret, { algorithm: 'HS256', expiresIn: '8h', issuer: 'purposebuilt-atms-training', audience: 'purposebuilt-atms-training' }), actor });
});
function authenticate(req, res, next) {
  try {
    const token = req.get('Authorization');
    if (!token?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in with an individual operator account.' });
    req.user = jwt.verify(token.slice(7), secret, { algorithms: ['HS256'], ...(mode === 'training' ? { issuer: 'purposebuilt-atms-training', audience: 'purposebuilt-atms-training' } : {}) });
    next();
  } catch (_) { res.status(401).json({ error: 'Your operator session has expired or is invalid.' }); }
}
const simulationDesk = mode === 'training' ? new SimulationDesk(ops) : null;
let sourceProvider = mode === 'training' ? async () => simulationDesk.batch() : null;
if (mode === 'live') {
  sourceProvider = require('../../services/atms/source-provider').createSourceProvider({ baseUrl: process.env.ATMS_SOURCE_URL || 'http://127.0.0.1:3001' });
}
ops.roadNetwork = require('../../services/atms/geometry').loadRoadNetwork(mode === 'training' && !process.env.ATMS_ROAD_NETWORK_PATH ? { ATMS_ROAD_NETWORK_PATH: path.join(__dirname, 'fixtures/des-moines-road-alignment.geojson'), ATMS_ROAD_NETWORK_SOURCE: 'Iowa DOT RAMS All Routes · corridor snapshot · simulated operational limits and assets' } : process.env);
const gateway = mode === 'live' ? configuredGateway(process.env) : null;
ops.gatewayAvailable = !!gateway;
if (mode === 'live') provisionDevices(ops, process.env, gateway);
let dispatcher, trainingLab, server;
async function start() {
trainingLab = mode === 'training' ? await new TrainingNtcipLab(ops).start() : null;
if (mode === 'training') require('../../services/atms/architecture-training').seedArchitecture(ops);
dispatcher = new Dispatcher(ops, { gateway, trainingLab }); dispatcher.start();
app.use('/api/atms', createRouter({ ops, authenticate, sourceProvider, gateway, video, trainingLab, simulationDesk, publicFeedAgency: process.env.ATMS_PUBLIC_FEED_ENABLED === 'true' ? process.env.ATMS_AGENCY : null, resolveActor: req => mode === 'training' ? identities.find(a => a.id === req.user.id) : actorFromUser(req.user, { agency: process.env.ATMS_AGENCY, operators: names(process.env.ATMS_OPERATOR_USERS), supervisors: names(process.env.ATMS_SUPERVISOR_USERS), viewers: names(process.env.ATMS_VIEWER_USERS) }) }));
const dist = path.resolve(__dirname, '../../frontend/dist');
app.get('/', (req, res) => res.redirect('/atms.html'));
app.use(express.static(dist, { etag: true, index: false }));
server = app.listen(Number(process.env.ATMS_PORT || 4432), host, () => console.log(`PurposeBuilt ATMS ${mode}: http://${host}:${server.address().port}/atms.html`));
server.on('error', async error => { console.error(error.message); dispatcher.stop(); await trainingLab?.close(); ops.close(); process.exitCode = 1; });
}
let shuttingDown = false;
async function shutdown() { if (shuttingDown) return; shuttingDown = true; dispatcher?.stop(); server?.close(); await simulationDesk?.close(); while (dispatcher?.busy) await new Promise(resolve => setTimeout(resolve, 50)); await trainingLab?.close(); ops.close(); process.exit(0); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
start().catch(async error => { console.error('ATMS startup:', error.message); await trainingLab?.close(); ops.close(); process.exitCode = 1; });
