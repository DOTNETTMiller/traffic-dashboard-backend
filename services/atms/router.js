'use strict';
const express = require('express');
const { requireRole, Fault } = require('./core');
const { verifyGateway } = require('./dispatcher');
const { receiveDtcd } = require('./dtcd');

function createRouter({ ops, authenticate, resolveActor, sourceProvider, gateway = null, dtcd = null, trainingLab = null, simulationDesk = null, publicFeedAgency = null, video = null }) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store, private'); next(); });
  router.use((req, res, next) => {
    if (req.body && Buffer.byteLength(JSON.stringify(req.body)) > (req.path.startsWith('/gateway/') ? 32768 : req.path.startsWith('/dtcd/') ? 262144 : 65536)) return res.status(413).json({ error: 'ATMS request exceeds the permitted size.' });
    next();
  });
  router.post('/gateway/evidence', express.json({ limit: '32kb' }), (req, res, next) => {
    try { res.json(verifyGateway(ops, gateway, req.headers, req.body)); } catch (e) { next(e); }
  });
  // DTCD signs the exact bytes it sends. The host's JSON parser keeps them as
  // req.rawBody; a standalone mount reads them here.
  router.post('/dtcd/closures', express.raw({ type: 'application/json', limit: '256kb' }), (req, res, next) => {
    try { res.json(receiveDtcd(ops, dtcd, req.headers, req.rawBody || (Buffer.isBuffer(req.body) ? req.body : null))); } catch (e) { next(e); }
  });
  const serveFeed = (agency, profile, res) => {
    const publication = ops.publishedFeed(agency, profile);
    res.set({ 'Content-Type': 'application/geo+json', 'ETag': '"' + publication.sha256 + '"', 'X-ATMS-Feed-Valid-Until': publication.validUntil }).json(publication.feed);
  };
  if (ops.mode === 'live' && publicFeedAgency) router.get('/feeds/public/:profile', (req, res, next) => { try { res.set('Access-Control-Allow-Origin', '*'); serveFeed(publicFeedAgency, req.params.profile, res); } catch (e) { next(e); } });
  const videoMedia = async (req, res, next, source, prefix) => {
    const controller = new AbortController();
    const close = () => { if (!res.writableEnded) controller.abort(); }; res.on('close', close);
    try {
      const result = await video.media(req.atmsActor, source, req.params.resource, prefix, req.get('Range'), controller.signal);
      res.set({ 'Content-Type': result.type, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer', 'X-ATMS-Received-At': new Date(video.now()).toISOString() });
      if (result.capturedAt) res.set('X-ATMS-Captured-At', result.capturedAt);
      if (result.status === 206 && result.contentRange) res.set('Content-Range', result.contentRange);
      res.status(result.status).send(result.bytes);
    } catch (e) { if (!res.destroyed) next(e); } finally { res.off('close', close); }
  };
  if (video?.publicEnabled) {
    router.get('/video/public/:shareId', (req, res, next) => { try { const source = video.published(req.params.shareId); res.json(video.metadata({ agency: source.agency }, source, true)); } catch (e) { next(e); } });
    router.get('/video/public/:shareId/media/:resource', (req, res, next) => { try { const source = video.published(req.params.shareId); return videoMedia(req, res, next, source, '/api/atms/video/public/' + req.params.shareId + '/media/'); } catch (e) { next(e); } });
  }
  router.use(authenticate);
  router.use((req, res, next) => { try { req.atmsActor = resolveActor(req); requireRole(req.atmsActor, 'viewer'); next(); } catch (e) { next(e); } });
  router.use(express.json({ limit: '64kb' }));
  router.use((req, res, next) => {
    if (req.method === 'GET') return next();
    // Authenticated requests must be JSON, with an explicit same-site API header.
    // No cookie or shared state-password identity is accepted here.
    const photoUpload = req.method === 'POST' && /^\/architecture\/assets\/[^/]+\/photos$/.test(req.path) && req.is('multipart/form-data');
    const druUpload = req.method === 'POST' && req.path === '/architecture/dru/bundles' && req.is('multipart/form-data');
    if ((!req.is('application/json') && !photoUpload && !druUpload) || req.get('X-ATMS-Client') !== 'workspace') return res.status(415).json({ error: 'Use JSON and the ATMS workspace client header.' });
    next();
  });
  const mutate = (action, fn) => (req, res, next) => {
    try { res.json(ops.mutation(req.atmsActor, req.get('Idempotency-Key'), action + ':' + (req.params.id || req.params.profile || ''), req.body, () => fn(req))); } catch (e) { next(e); }
  };
  router.get('/video/cameras', (req, res, next) => { try { res.json(video ? video.catalog(req.atmsActor) : { cameras: [], unconnectedInventory: ops.list(req.atmsActor.agency, 'device').filter(d => d.type === 'camera').length }); } catch (e) { next(e); } });
  if (video) {
    router.get('/video/cameras/:id/media/:resource', (req, res, next) => { try { return videoMedia(req, res, next, video.source(req.atmsActor, req.params.id), '/api/atms/video/cameras/' + req.params.id + '/media/'); } catch (e) { next(e); } });
    router.post('/video/cameras/:id/settings', mutate('video.settings', req => { if (req.body.public === true && !video.publicEnabled) throw new Fault(409, 'Public video sharing is not enabled on this service.'); return ops.saveVideoCamera(req.atmsActor, video.source(req.atmsActor, req.params.id), req.body); }));
  }
  router.get('/feeds/:profile/preview', (req, res, next) => { try { res.json(ops.previewFeed(req.atmsActor, req.params.profile)); } catch (e) { next(e); } });
  router.get('/feeds/:profile/release', (req, res, next) => { try { const p = ops.get(req.atmsActor.agency, 'feed-publication', req.params.profile); let available = false, reason = 'No released feed.'; try { ops.publishedFeed(req.atmsActor.agency, req.params.profile); available = true; reason = ''; } catch (e) { reason = e.message; } res.json({ publication: p ? { id: p.id, version: p.version, sha256: p.sha256, publishedAt: p.publishedAt, validUntil: p.validUntil, publishedBy: p.publishedBy, withdrawn: p.withdrawn, heldCount: p.heldCount, count: p.included.length } : null, available, reason }); } catch (e) { next(e); } });
  router.get('/feeds/:profile/geojson', (req, res, next) => { try { serveFeed(req.atmsActor.agency, req.params.profile, res); } catch (e) { next(e); } });
  router.post('/feeds/settings', mutate('feed.settings', req => ops.saveFeedConfig(req.atmsActor, req.body)));
  router.post('/incidents/:id/feed-details', mutate('feed.details', req => ops.saveFeedDetails(req.atmsActor, req.params.id, req.body)));
  router.post('/feeds/:profile/publish', mutate('feed.publish', req => { const p = ops.publishFeed(req.atmsActor, req.params.profile, req.body); return { id: p.id, sha256: p.sha256, publishedAt: p.publishedAt, validUntil: p.validUntil, count: p.included.length }; }));
  router.post('/feeds/:profile/withdraw', mutate('feed.withdraw', req => { const p = ops.withdrawFeed(req.atmsActor, req.params.profile, req.body); return { id: p.id, version: p.version, withdrawn: p.withdrawn }; }));
  router.get('/workspace', (req, res, next) => { try { res.json(ops.workspace(req.atmsActor)); } catch (e) { next(e); } });
  router.get('/architecture', (req, res, next) => { try { res.json(ops.architecture(req.atmsActor)); } catch (e) { next(e); } });
  const dru = require('./dru');
  router.get('/architecture/dru/bundles', (req, res, next) => { try { res.json({ bundles: ops.db.prepare('SELECT metadata FROM atms_dru_bundles WHERE agency=? ORDER BY rowid DESC').all(req.atmsActor.agency).map(r => { const b = JSON.parse(r.metadata); return { id: b.id, projectName: b.manifest.projectName, status: b.status, uploadedAt: b.uploadedAt }; }) }); } catch (e) { next(e); } });
  const uploadDru = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: dru.MAX_BUNDLE, files: 1, fields: 0 } }).single('bundle');
  router.post('/architecture/dru/bundles', (req, res, next) => { try { requireRole(req.atmsActor, 'operator'); next(); } catch (e) { next(e); } },
    (req, res, next) => uploadDru(req, res, e => e ? next(new Fault(e.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'Upload one DRU session file up to 50 MB.')) : next()), async (req, res, next) => {
      try {
        if (!req.file) throw new Fault(400, 'Select a .dru-session file.');
        const decoded = await dru.decodeBundle(req.file.buffer, ops.now());
        res.json(ops.mutation(req.atmsActor, req.get('Idempotency-Key'), 'architecture.dru_stage', { sha256: require('node:crypto').createHash('sha256').update(req.file.buffer).digest('hex') }, () => ops.stageDruBundle(req.atmsActor, req.file.buffer, decoded)));
      } catch (e) { next(e); }
    });
  router.get('/architecture/dru/bundles/:id', (req, res, next) => { try { res.json(ops.druBundle(req.atmsActor, req.params.id)); } catch (e) { next(e); } });
  router.get('/architecture/dru/bundles/:id/photos/:index', (req, res, next) => {
    try {
      const photo = ops.druPreviewPhoto(req.atmsActor, req.params.id, /^\d+$/.test(req.params.index) ? Number(req.params.index) : -1);
      res.set({ 'Content-Type': photo.mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" }).send(photo.bytes);
    } catch (e) { next(e); }
  });
  router.get('/architecture/dru/bundles/:id/content', (req, res, next) => {
    try { res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="' + req.params.id.replace(/[^a-z0-9-]/gi, '') + '.dru-session"', 'X-Content-Type-Options': 'nosniff' }).send(ops.druBundle(req.atmsActor, req.params.id, true)); } catch (e) { next(e); }
  });
  router.post('/architecture/dru/bundles/:id/import', async (req, res, next) => {
    try {
      requireRole(req.atmsActor, 'operator');
      const decoded = await dru.decodeBundle(ops.druBundle(req.atmsActor, req.params.id, true), ops.now());
      res.json(ops.mutation(req.atmsActor, req.get('Idempotency-Key'), 'architecture.dru_import:' + req.params.id, req.body, () => ops.commitDruBundle(req.atmsActor, req.params.id, req.body, decoded)));
    } catch (e) { next(e); }
  });
  router.post('/architecture/assets', mutate('architecture.asset', req => ops.saveArchitectureAsset(req.atmsActor, req.body)));
  router.post('/architecture/connections', mutate('architecture.connection', req => ops.saveArchitectureConnection(req.atmsActor, req.body)));
  router.post('/architecture/connections/:id/review', mutate('architecture.review', req => ops.reviewArchitectureConnection(req.atmsActor, req.params.id, req.body)));
  router.get('/architecture/assets/:id/capabilities', (req, res, next) => { try { res.json(ops.architectureCapabilities(req.atmsActor.agency, req.params.id)); } catch (e) { next(e); } });
  router.get('/architecture/connections/:id/impact', (req, res, next) => { try { res.json(ops.architectureImpact(req.atmsActor.agency, req.params.id)); } catch (e) { next(e); } });
  const uploadPhoto = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 3, fieldSize: 2000 } }).single('photo');
  router.post('/architecture/assets/:id/photos', (req, res, next) => {
    try { requireRole(req.atmsActor, 'operator'); ops.need(req.atmsActor.agency, 'architecture-asset', req.params.id); next(); } catch (e) { next(e); }
  }, (req, res, next) => uploadPhoto(req, res, error => error ? next(new Fault(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'Use one JPEG or PNG up to 5 MB with caption and capture time.')) : next()), async (req, res, next) => {
    try {
      if (!req.file || !['image/png', 'image/jpeg'].includes(req.file.mimetype)) throw new Fault(400, 'Use a JPEG or PNG photograph.');
      let metadata;
      try { metadata = await require('sharp')(req.file.buffer, { limitInputPixels: 40000000 }).metadata(); }
      catch { throw new Fault(400, 'The photograph cannot be decoded.'); }
      if (!['png', 'jpeg'].includes(metadata.format) || metadata.pages > 1) throw new Fault(400, 'Use a single JPEG or PNG image.');
      const sha256 = require('node:crypto').createHash('sha256').update(req.file.buffer).digest('hex');
      const result = ops.mutation(req.atmsActor, req.get('Idempotency-Key'), 'architecture.photo:' + req.params.id,
        { ...req.body, sha256 }, () => ops.addArchitecturePhoto(req.atmsActor, req.params.id, req.body, req.file.buffer, req.file.mimetype));
      res.json(result);
    } catch (e) { next(e); }
  });
  router.get('/architecture/photos/:id/content', (req, res, next) => {
    try {
      const photo = ops.architecturePhoto(req.atmsActor.agency, req.params.id);
      res.set({ 'Content-Type': photo.metadata.mime, 'Content-Disposition': 'inline; filename="' + photo.metadata.id + (photo.metadata.mime === 'image/png' ? '.png' : '.jpg') + '"',
        'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" }).send(photo.bytes);
    } catch (e) { next(e); }
  });
  if (ops.mode === 'training' && simulationDesk) {
    router.get('/training/simulation', (req, res, next) => { try { res.json(simulationDesk.snapshot(req.atmsActor)); } catch (e) { next(e); } });
    router.post('/training/simulation/world', mutate('simulation.world', req => simulationDesk.change(req.atmsActor, req.body)));
    router.post('/training/simulation/runs', (req, res, next) => { try { res.json(simulationDesk.start(req.atmsActor, req.body, req.get('Idempotency-Key'))); } catch (e) { next(e); } });
    router.get('/training/simulation/runs/:id', (req, res, next) => { try { res.json(simulationDesk.report(req.atmsActor, req.params.id)); } catch (e) { next(e); } });
  }
  if (ops.mode === 'training' && trainingLab) router.post('/training/devices/:id/scenario', mutate('training.scenario', req => trainingLab.scenario(req.atmsActor, req.params.id, req.body)));
  router.get('/events', (req, res, next) => { try { res.json(ops.eventPage(req.atmsActor.agency, req.query)); } catch (e) { next(e); } });
  router.get('/collections', (req, res, next) => { try { res.json({ streams: ops.list(req.atmsActor.agency, 'collection') }); } catch (e) { next(e); } });
  router.get('/collections/observations', (req, res, next) => { try { res.json(ops.collectionPage(req.atmsActor.agency, req.query)); } catch (e) { next(e); } });
  router.get('/collections/observations/:id/history', (req, res, next) => { try { res.json({ rows: ops.collectionHistory(req.atmsActor.agency, req.params.id, req.query) }); } catch (e) { next(e); } });
  router.get('/collections/batches/:id', (req, res, next) => { try { res.json(ops.collectionBatch(req.atmsActor.agency, req.params.id)); } catch (e) { next(e); } });
  router.post('/collections/batches/:id/replay', (req, res, next) => { try { res.json(ops.replayCollection(req.atmsActor, req.params.id)); } catch (e) { next(e); } });
  router.get('/incidents/:id/report', (req, res, next) => { try { res.json(ops.incidentReport(req.atmsActor, req.params.id)); } catch (e) { next(e); } });
  router.get('/incidents/:id/geometry', (req, res, next) => {
    try {
      const incident = ops.need(req.atmsActor.agency, 'incident', req.params.id);
      const event = incident.sourceKey ? ops.get(req.atmsActor.agency, 'event', incident.sourceKey) : null;
      res.json({ version: incident.version, geometry: incident.geometry || null, evidence: incident.geometryEvidence || null, latestSource: event });
    } catch (e) { next(e); }
  });
  router.get('/audit/integrity', (req, res, next) => { try { res.json(ops.verifyAudit(req.atmsActor.agency)); } catch (e) { next(e); } });
  router.post('/incidents', mutate('incident.create', req => ops.createIncident(req.atmsActor, { title: req.body.title, route: req.body.route, latitude: req.body.latitude, longitude: req.body.longitude, direction: req.body.direction, jurisdiction: req.body.jurisdiction, severity: req.body.severity, kind: req.body.kind, description: req.body.description })));
  router.post('/incidents/:id/geometry', mutate('geometry.action', req => ops.changeGeometry(req.atmsActor, req.params.id, req.body)));
  router.post('/incidents/:id/actions', mutate('incident.action', req => ops.changeIncident(req.atmsActor, req.params.id, req.body)));
  router.post('/events/:id/promote', mutate('event.promote', req => ops.promoteEvent(req.atmsActor, req.params.id)));
  router.post('/messages', mutate('message.send', req => ops.sendMessage(req.atmsActor, req.body)));
  router.post('/messages/:id/acknowledge', mutate('message.acknowledge', req => ops.ackMessage(req.atmsActor, req.params.id, req.body)));
  router.post('/templates', mutate('template.approve', req => ops.saveTemplate(req.atmsActor, req.body)));
  router.post('/devices/:id/installation', mutate('installation.action', req => ops.commission(req.atmsActor, req.params.id, req.body)));
  router.post('/commands', mutate('command.request', req => ops.createCommand(req.atmsActor, req.body)));
  router.post('/commands/:id/actions', mutate('command.action', req => ops.changeCommand(req.atmsActor, req.params.id, req.body)));
  router.post('/alarms/:id/actions', mutate('alarm.action', req => ops.acknowledgeAlarm(req.atmsActor, req.params.id, req.body)));
  router.post('/shifts', mutate('shift.offer', req => ops.createHandoff(req.atmsActor, req.body)));
  router.post('/shifts/:id/accept', mutate('shift.accept', req => ops.acceptShift(req.atmsActor, req.params.id, req.body)));
  let sourceBusy = false;
  router.post('/sources/refresh', async (req, res, next) => {
    try {
      requireRole(req.atmsActor, 'operator');
      if (!sourceProvider) throw new Fault(503, 'Connect the Corridor Communicator source provider first.');
      if (sourceBusy) throw new Fault(409, 'A source import is already running.');
      sourceBusy = true;
      try {
        const batch = await sourceProvider(req.atmsActor);
        if (!batch) throw new Fault(503, 'Corridor Communicator has no current source snapshot.');
        res.json(ops.ingest(req.atmsActor.agency, batch));
      } finally { sourceBusy = false; }
    } catch (e) { next(e); }
  });
  router.use((error, req, res, next) => {
    const status = error.status || (error.type === 'entity.too.large' ? 413 : 500);
    if (status === 500) console.error('ATMS request failed:', error.message);
    res.status(status).json({ error: status === 500 ? 'The operation failed. No success has been confirmed. Refresh and review the audit trail before retrying.' : error.message });
  });
  return router;
}
function actorFromUser(user, { operators = [], supervisors = [], viewers = [], agency } = {}) {
  if (!user?.id && !user?.username) throw new Fault(401, 'Sign in with an individual user account.');
  const id = String(user.username || user.id);
  if (![...operators, ...supervisors, ...viewers].includes(id)) throw new Fault(403, 'This individual account has not been assigned to the ATMS workspace.');
  // Existing admin rights do not automatically grant operational device authority.
  const role = supervisors.includes(id) ? 'supervisor' : operators.includes(id) ? 'operator' : 'viewer';
  return { id, name: String(user.fullName || user.username || user.id), agency: agency || String(user.stateKey || 'UNASSIGNED').toUpperCase(), role };
}
module.exports = { createRouter, actorFromUser };
