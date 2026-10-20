'use strict';
const { randomUUID, createHash } = require('node:crypto');
const { quality } = require('./collections');
const hash = value => createHash('sha256').update(value).digest('hex');
const TYPES = ['dms', 'camera', 'detector', 'rwis', 'sensor', 'cabinet', 'controller', 'switch', 'gateway', 'power', 'center', 'feed', 'other'];
const MEDIA = ['unknown', 'fiber', 'ethernet', 'serial', 'radio', 'cellular', 'power', 'api'];
const profileHash = asset => hash(JSON.stringify(['deviceId', 'type', 'manufacturer', 'model', 'firmware', 'protocol', 'location', 'arcItObject'].map(k => asset[k] ?? null)));

function install(Operations, { Fault, requireRole }) {
  const reject = (status, message) => { throw new Fault(status, message); };
  const text = (value, label, max = 500, required = false) => {
    if (value == null && !required) return '';
    if (typeof value !== 'string' || value.length > max || required && !value.trim()) reject(400, `${label} requires ${required ? '1' : '0'}–${max} characters.`);
    return value.trim();
  };
  const version = (old, input) => { if ((old?.version || 0) !== input.version) reject(409, 'Architecture changed. Refresh before saving.'); };
  const timestamp = value => {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) reject(400, 'A valid evidence observation time is required.');
    return new Date(value).toISOString();
  };
  Operations.prototype.initArchitecture = function () {
    this.db.exec(`CREATE TABLE IF NOT EXISTS atms_architecture_photos (
      agency TEXT NOT NULL,id TEXT NOT NULL,asset_id TEXT NOT NULL,connection_id TEXT,
      metadata TEXT NOT NULL,bytes BLOB NOT NULL,sha256 TEXT NOT NULL,
      PRIMARY KEY(agency,id));
      CREATE INDEX IF NOT EXISTS atms_architecture_photo_asset ON atms_architecture_photos(agency,asset_id);`);
  };
  Operations.prototype.saveArchitectureAsset = function (actor, input) {
    requireRole(actor, 'operator');
    return this.db.transaction(() => {
      const old = input.id ? this.need(actor.agency, 'architecture-asset', input.id) : null;
      version(old, input);
      if (!old && this.list(actor.agency, 'architecture-asset').length >= 2000) reject(409, 'This workspace supports 2,000 architecture assets.');
      const deviceId = input.deviceId ? text(input.deviceId, 'Device ID', 180) : null;
      const device = deviceId ? this.need(actor.agency, 'device', deviceId) : null;
      if (deviceId && this.list(actor.agency, 'architecture-asset').some(a => a.deviceId === deviceId && a.id !== old?.id)) reject(409, 'This device already has an architecture profile.');
      if (!TYPES.includes(input.type)) reject(400, 'Choose a supported asset class.');
      const analysis = {};
      for (const [key, max] of [['referenceSpeedMph', 120], ['segmentLengthMiles', 200]]) {
        const value = input.analysis?.[key];
        if (value == null || value === '') { analysis[key] = null; continue; }
        if (!['string', 'number'].includes(typeof value) || !Number.isFinite(Number(value)) || Number(value) <= 0 || Number(value) > max) reject(400, `Invalid ${key}.`);
        analysis[key] = Number(value);
      }
      const fields = {};
      for (const key of ['manufacturer', 'model', 'firmware', 'owner', 'contact', 'protocol', 'arcItObject', 'location']) fields[key] = text(input[key], key, key === 'location' ? 500 : 180);
      const asset = this.put(actor.agency, 'architecture-asset', {
        id: old?.id || randomUUID(), name: text(input.name, 'Asset name', 180, true), type: input.type, deviceId, ...fields,
        protocol: fields.protocol || 'unknown', arcItMappingStatus: fields.arcItObject ? 'proposed' : 'unknown',
        location: fields.location || device?.route || '', analysis,
        notes: text(input.notes, 'Asset notes', 2000), createdBy: old?.createdBy || actor.id,
        synthetic: this.mode === 'training', ...(old?.fieldEvidence ? { fieldEvidence: old.fieldEvidence } : {})
      }, old?.version);
      this.audit(actor, asset.id, 'architecture.asset_saved', { deviceId, type: asset.type, fingerprint: profileHash(asset), synthetic: asset.synthetic });
      return asset;
    }).immediate();
  };
  Operations.prototype.architectureConnectionFingerprint = function (agency, connection, context) {
    const from = context?.assets.get(connection.from) || this.need(agency, 'architecture-asset', connection.from), to = context?.assets.get(connection.to) || this.need(agency, 'architecture-asset', connection.to);
    return hash(JSON.stringify([connection.from, connection.to, connection.fromPort, connection.toPort, connection.medium, connection.protocol,
      connection.flow, connection.layer, connection.evidenceReference, connection.documentedAt, connection.documentedBy,
      profileHash(from), profileHash(to), (context?.photos || this.architecturePhotos(agency)).filter(p => p.connectionId === connection.id).map(p => [p.id, p.sha256]).sort()]));
  };
  Operations.prototype.architectureConnectionState = function (agency, connection, context) {
    const fingerprint = this.architectureConnectionFingerprint(agency, connection, context);
    return { ...connection, evidenceState: connection.verifiedFingerprint === fingerprint ? 'verified' : connection.verifiedAt ? 'verification-invalidated' : connection.documentedAt ? 'documented' : 'candidate',
      fingerprint, physicalControlAuthorized: false };
  };
  Operations.prototype.saveArchitectureConnection = function (actor, input) {
    requireRole(actor, 'operator');
    return this.db.transaction(() => {
      const old = input.id ? this.need(actor.agency, 'architecture-connection', input.id) : null;
      version(old, input);
      if (!old && this.list(actor.agency, 'architecture-connection').length >= 5000) reject(409, 'This workspace supports 5,000 architecture connections.');
      this.need(actor.agency, 'architecture-asset', input.from); this.need(actor.agency, 'architecture-asset', input.to);
      if (input.from === input.to) reject(400, 'A connection needs two different assets.');
      if (!MEDIA.includes(input.medium) || !['physical', 'information', 'power'].includes(input.layer)) reject(400, 'Choose a connection layer and medium.');
      const result = this.put(actor.agency, 'architecture-connection', {
        id: old?.id || randomUUID(), from: input.from, to: input.to, medium: input.medium, layer: input.layer,
        fromPort: text(input.fromPort, 'Source port', 100), toPort: text(input.toPort, 'Destination port', 100),
        protocol: text(input.protocol, 'Protocol', 180) || 'unknown', flow: text(input.flow, 'Information flow', 300),
        notes: text(input.notes, 'Connection notes', 2000), evidenceReference: text(input.evidenceReference, 'Evidence reference', 1000),
        documentedAt: null, documentedBy: null, verifiedAt: null, verifiedBy: null, verifiedFingerprint: null,
        createdBy: old?.createdBy || actor.id, synthetic: this.mode === 'training'
      }, old?.version);
      this.audit(actor, result.id, 'architecture.connection_saved', { from: result.from, to: result.to, state: 'candidate', synthetic: result.synthetic });
      return this.architectureConnectionState(actor.agency, result);
    }).immediate();
  };
  Operations.prototype.reviewArchitectureConnection = function (actor, id, input) {
    requireRole(actor, 'operator');
    return this.db.transaction(() => {
      const old = this.need(actor.agency, 'architecture-connection', id); version(old, input);
      const note = text(input.note, 'Review evidence', 2000, true);
      const next = { ...old };
      if (input.action === 'document') {
        if (!old.evidenceReference && !this.architecturePhotos(actor.agency).some(p => p.connectionId === id)) reject(409, 'Attach a connection photo or supply an evidence reference first.');
        next.documentedAt = this.iso(); next.documentedBy = actor.id; next.documentationNote = note;
        next.verifiedAt = null; next.verifiedBy = null; next.verifiedFingerprint = null;
      } else if (input.action === 'verify') {
        requireRole(actor, 'supervisor');
        if (!old.documentedAt || old.documentedBy === actor.id || old.createdBy === actor.id) reject(403, 'A separate supervisor must verify documented installer evidence.');
        if (!['field-inspection', 'bench-test'].includes(input.method)) reject(400, 'Verification needs a field inspection or bench-test basis.');
        next.inspectedAt = timestamp(input.observedAt);
        if (Date.parse(next.inspectedAt) > this.now() + 60000) reject(400, 'Inspection time cannot be in the future.');
        next.verificationMethod = input.method; next.verificationNote = note;
        next.verifiedAt = this.iso(); next.verifiedBy = actor.id;
        next.verifiedFingerprint = this.architectureConnectionFingerprint(actor.agency, old);
      } else if (input.action === 'revoke') {
        requireRole(actor, 'supervisor'); next.verifiedAt = null; next.verifiedBy = null; next.verifiedFingerprint = null; next.revocationNote = note;
      } else reject(400, 'Unknown connection review action.');
      const saved = this.put(actor.agency, 'architecture-connection', next, old.version);
      this.audit(actor, id, 'architecture.connection_' + input.action, { note, synthetic: this.mode === 'training', physicalControlAuthorized: false });
      return this.architectureConnectionState(actor.agency, saved);
    }).immediate();
  };
  Operations.prototype.architecturePhotos = function (agency) {
    return this.db.prepare('SELECT metadata FROM atms_architecture_photos WHERE agency=? ORDER BY rowid DESC').all(agency).map(r => JSON.parse(r.metadata));
  };
  Operations.prototype.addArchitecturePhoto = function (actor, assetId, input, bytes, mime) {
    requireRole(actor, 'operator');
    return this.db.transaction(() => {
      this.need(actor.agency, 'architecture-asset', assetId);
      const connectionId = input.connectionId || null;
      if (connectionId) { const c = this.need(actor.agency, 'architecture-connection', connectionId); if (![c.from, c.to].includes(assetId)) reject(400, 'Photo must belong to an endpoint of the connection.'); }
      if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 5 * 1024 * 1024 || !['image/jpeg', 'image/png'].includes(mime)) reject(400, 'Use a JPEG or PNG photo up to 5 MB.');
      const png = bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!(mime === 'image/png' ? png : jpeg)) reject(400, 'Photo encoding does not match its declared type.');
      const used = this.db.prepare('SELECT coalesce(sum(length(bytes)),0) n FROM atms_architecture_photos WHERE agency=?').get(actor.agency).n;
      if (used + bytes.length > 200 * 1024 * 1024) reject(409, 'Agency photo storage has reached its 200 MB local limit.');
      const capturedAt = timestamp(input.capturedAt);
      if (Date.parse(capturedAt) > this.now() + 60000) reject(400, 'Photo capture time cannot be in the future.');
      const photo = { id: randomUUID(), assetId, connectionId, caption: text(input.caption, 'Photo caption', 1000, true),
        capturedAt, uploadedAt: this.iso(), uploadedBy: actor.id, mime, size: bytes.length, sha256: hash(bytes),
        synthetic: this.mode === 'training', evidenceState: 'submitted' };
      this.db.prepare('INSERT INTO atms_architecture_photos VALUES (?,?,?,?,?,?,?)').run(actor.agency, photo.id, assetId, connectionId, JSON.stringify(photo), bytes, photo.sha256);
      this.audit(actor, assetId, 'architecture.photo_added', { photoId: photo.id, connectionId, sha256: photo.sha256, caption: photo.caption, synthetic: photo.synthetic });
      return photo;
    }).immediate();
  };
  Operations.prototype.architecturePhoto = function (agency, id) {
    const row = this.db.prepare('SELECT * FROM atms_architecture_photos WHERE agency=? AND id=?').get(agency, id);
    if (!row) reject(404, 'Photo not found in this agency.');
    if (hash(row.bytes) !== row.sha256) reject(409, 'Photo integrity check failed.');
    return { metadata: JSON.parse(row.metadata), bytes: row.bytes };
  };
  Operations.prototype.architectureCapabilities = function (agency, assetId) {
    const asset = this.need(agency, 'architecture-asset', assetId);
    const device = asset.deviceId ? this.get(agency, 'device', asset.deviceId) : null;
    const raw = device?.observationId ? this.get(agency, 'observation', device.observationId) : null;
    const observation = raw ? quality(raw, this.now()) : null;
    const report = { assetId, deviceId: device?.id || null, at: this.iso(), synthetic: this.mode === 'training' || !!observation?.synthetic,
      observation, observedFields: observation?.measurements || [], declaredProtocol: asset.protocol,
      reportedState: device && !device.inventory ? { observedAt: device.observedAt || null, message: typeof device.displayedMessage === 'string' ? device.displayedMessage : null,
        provenance: device.driver === 'simulator' ? 'controller-lab' : device.driver === 'gateway' ? 'gateway-observation' : 'source-feed', establishesPhysicalPixels: false } : null,
      protocolEvidence: 'Operator-entered declaration; no protocol support is inferred from asset class.', derived: [] };
    const blocked = observation?.inventory ? 'Inventory attributes are not measurements.' : !observation ? 'No linked source observation.' :
      observation.flags.some(f => f !== 'synthetic') ? 'Observation requires review: ' + observation.flags.join(', ') :
      observation.synthetic && this.mode !== 'training' ? 'Synthetic observations cannot support live calculations.' : null;
    const speed = observation?.measurements.find(m => m.name === 'speed' && m.unit === 'mph')?.value;
    const basis = { recordId: raw?.id || null, batchId: raw?.batchId || null, observedAt: raw?.observedAt || null,
      collectedAt: raw?.collectedAt || null, referenceSpeedMph: asset.analysis.referenceSpeedMph, segmentLengthMiles: asset.analysis.segmentLengthMiles };
    for (const recipe of ['speed-reduction', 'segment-travel-time', 'segment-delay']) {
      let reason = blocked || (!Number.isFinite(speed) ? 'A speed observation in mph is required.' : null);
      if (!reason && recipe !== 'segment-travel-time' && !asset.analysis.referenceSpeedMph) reason = 'Enter a reference speed assumption.';
      if (!reason && recipe !== 'speed-reduction' && (!asset.analysis.segmentLengthMiles || speed <= 0)) reason = 'A positive speed and a segment-length assumption are required.';
      const minutes = !reason && asset.analysis.segmentLengthMiles ? asset.analysis.segmentLengthMiles / speed * 60 : null;
      const value = reason ? null : recipe === 'speed-reduction' ? Math.max(0, (1 - speed / asset.analysis.referenceSpeedMph) * 100) : recipe === 'segment-travel-time' ? minutes : Math.max(0, minutes - asset.analysis.segmentLengthMiles / asset.analysis.referenceSpeedMph * 60);
      report.derived.push({ recipe, version: 1, status: reason ? 'blocked' : 'available', value: value === null ? null : Math.round(value * 100) / 100,
        unit: recipe === 'speed-reduction' ? '%' : 'minutes', reason, inputs: basis,
        assumptions: recipe === 'speed-reduction' ? ['Reference speed is an entered assumption.'] : ['Point speed represents the entire entered segment.', 'This is a single-speed estimate, not a measured corridor travel time.'],
        accuracy: 'Not independently calibrated', operationalAction: 'none' });
    }
    report.derived.push({ recipe: 'queue-length', version: 1, status: 'blocked', value: null, reason: 'Requires calibrated spatial observations; a single detector speed does not establish queue length.' });
    return report;
  };
  Operations.prototype.architectureImpact = function (agency, connectionId) {
    const failed = this.need(agency, 'architecture-connection', connectionId);
    const links = this.list(agency, 'architecture-connection').filter(c => c.id !== connectionId);
    const reachable = start => {
      const seen = new Set([start]), queue = [start];
      while (queue.length) { const id = queue.shift(); for (const c of links) if (c.from === id && !seen.has(c.to)) { seen.add(c.to); queue.push(c.to); } }
      return seen;
    };
    const alternatives = reachable(failed.from), downstream = reachable(failed.to);
    const assets = this.list(agency, 'architecture-asset').filter(a => downstream.has(a.id));
    const upstream = new Set([failed.from]), queue = [failed.from];
    while (queue.length) { const id = queue.shift(); for (const c of links) if (c.to === id && !upstream.has(c.from)) { upstream.add(c.from); queue.push(c.from); } }
    const dataDependencies = this.list(agency, 'architecture-asset').filter(a => upstream.has(a.id) && a.deviceId).map(a => {
      const report = this.architectureCapabilities(agency, a.id);
      return { assetId: a.id, name: a.name, deviceId: a.deviceId, observationTime: report.observation?.observedAt || report.reportedState?.observedAt || null,
        fields: report.observedFields.map(m => m.name), derivedOutputs: report.derived.filter(r => r.status === 'available').map(r => r.recipe) };
    });
    return { connectionId, mode: 'hypothetical-dependency-analysis', synthetic: this.mode === 'training', actualOutageAsserted: false,
      alternateDeclaredPath: alternatives.has(failed.to),
      dataDependencies,
      affected: assets.map(a => ({ id: a.id, name: a.name, type: a.type, deviceId: a.deviceId, alternateDeclaredPath: alternatives.has(a.id) })),
      limitations: 'Potential impact follows declared directed dependencies, including candidate links. Redundancy, routing, power and actual field health require confirmation.' };
  };
  Operations.prototype.architecture = function (actor) {
    requireRole(actor, 'viewer');
    const assets = this.list(actor.agency, 'architecture-asset').map(a => ({ ...a, device: a.deviceId ? (() => { const d = this.get(actor.agency, 'device', a.deviceId); return d ? { id: d.id, name: d.name, type: d.type, inventory: d.inventory, observedAt: d.observedAt, latitude: d.latitude, longitude: d.longitude } : null; })() : null }));
    const photos = this.architecturePhotos(actor.agency), context = { assets: new Map(assets.map(a => [a.id, a])), photos };
    return { mode: this.mode, at: this.iso(), assets, connections: this.list(actor.agency, 'architecture-connection').map(c => this.architectureConnectionState(actor.agency, c, context)), photos, types: TYPES, media: MEDIA };
  };
}
module.exports = { install, TYPES, MEDIA, profileHash };
