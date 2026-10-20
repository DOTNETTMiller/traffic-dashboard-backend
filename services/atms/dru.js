'use strict';
// DRU schema 1: SessionBundleFormat.swift / SessionBundleExporter.swift.
// Read archives entirely in bounded memory; never extract user paths to disk.
const { createHash, randomUUID } = require('node:crypto');
const { inflateRawSync } = require('node:zlib');
const sharp = require('sharp');
const MAX_FILE = 5 * 1024 * 1024, MAX_BUNDLE = 50 * 1024 * 1024;
const sha = b => createHash('sha256').update(b).digest('hex');
const bad = message => { const error = new Error(message); error.status = 400; throw error; };
const crcTable = Array.from({ length: 256 }, (_, i) => { for (let n = 0; n < 8; n++) i = i & 1 ? 0xedb88320 ^ (i >>> 1) : i >>> 1; return i >>> 0; });
function crc32(bytes) { let crc = 0xffffffff; for (const b of bytes) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
function unzip(bytes, onlyName = null) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 22 || bytes.length > MAX_BUNDLE) bad('Use a DRU session bundle up to 50 MB.');
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (bytes.readUInt32LE(p) === 0x06054b50 && p + 22 + bytes.readUInt16LE(p + 20) === bytes.length) { end = p; break; }
  }
  if (end < 0) bad('The DRU ZIP directory is missing.');
  const count = bytes.readUInt16LE(end + 10), size = bytes.readUInt32LE(end + 12), offset = bytes.readUInt32LE(end + 16);
  if (bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6) || count !== bytes.readUInt16LE(end + 8) || count > 1100 || offset + size !== end) bad('Unsupported multipart, ZIP64 or oversized archive.');
  const files = new Map(), names = new Set(); let p = offset, total = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || bytes.readUInt32LE(p) !== 0x02014b50) bad('Invalid ZIP directory.');
    const flags = bytes.readUInt16LE(p + 8), method = bytes.readUInt16LE(p + 10), crc = bytes.readUInt32LE(p + 16);
    const compressed = bytes.readUInt32LE(p + 20), expanded = bytes.readUInt32LE(p + 24);
    const nameSize = bytes.readUInt16LE(p + 28), extra = bytes.readUInt16LE(p + 30), comment = bytes.readUInt16LE(p + 32), local = bytes.readUInt32LE(p + 42);
    const next = p + 46 + nameSize + extra + comment;
    if (next > end || flags & 1 || ![0, 8].includes(method) || bytes.readUInt16LE(p + 34)) bad('Unsupported or encrypted ZIP entry.');
    const name = bytes.subarray(p + 46, p + 46 + nameSize).toString('utf8');
    if (!/^(manifest\.json|session\.json|certification\.json|photos\/[A-Za-z0-9_. -]+|signatures\/[A-Za-z0-9_. -]+|photos\/|signatures\/)$/.test(name) || name.includes('..') || names.has(name)) bad('The archive contains an unsafe, duplicate or unsupported path.');
    names.add(name);
    if ((bytes.readUInt32LE(p + 38) >>> 16 & 0xf000) === 0xa000) bad('ZIP symbolic links are not supported.');
    total += expanded;
    if (expanded > MAX_FILE || total > 100 * 1024 * 1024) bad('Expanded bundle exceeds the 5 MB per file or 100 MB total limit.');
    if (local + 30 > offset || bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 8) !== method || bytes.readUInt16LE(local + 6) !== flags) bad('Invalid ZIP entry header.');
    const localNameSize = bytes.readUInt16LE(local + 26), start = local + 30 + localNameSize + bytes.readUInt16LE(local + 28);
    if (start + compressed > offset || !bytes.subarray(local + 30, local + 30 + localNameSize).equals(Buffer.from(name))) bad('ZIP entry names or lengths do not match.');
    if (onlyName && name !== onlyName) { p = next; continue; }
    let value;
    try { value = method === 0 ? bytes.subarray(start, start + compressed) : inflateRawSync(bytes.subarray(start, start + compressed), { maxOutputLength: MAX_FILE }); }
    catch { bad('A ZIP entry cannot be safely decompressed.'); }
    if (value.length !== expanded || crc32(value) !== crc) bad('ZIP content failed its size or checksum check.');
    files.set(name, value); p = next;
  }
  if (p !== end) bad('Invalid ZIP directory length.');
  return files;
}
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const str = (v, max = 500) => typeof v === 'string' ? v.slice(0, max) : '';
const suggestedType = p => {
  const value = [p.utilityComponent, p.component, p.utilitySubtype].filter(Boolean).join(' ').toLowerCase();
  return /cabinet/.test(value) ? 'cabinet' : /camera/.test(value) ? 'camera' : /\bdms\b|message sign/.test(value) ? 'dms' : /controller/.test(value) ? 'controller' : /detector/.test(value) ? 'detector' : 'other';
};
async function decodeBundle(bytes, now = Date.now()) {
  const files = unzip(bytes);
  const json = name => { try { if (!files.has(name)) bad('Missing ' + name); const obj = JSON.parse(files.get(name).toString('utf8')); if (!obj || typeof obj !== 'object' || Array.isArray(obj)) bad('Invalid ' + name); return obj; } catch { bad('Missing or malformed ' + name); } };
  const manifest = json('manifest.json'), session = json('session.json'), certification = json('certification.json');
  if (manifest.schemaVersion !== 1) bad('This importer supports DRU session schema 1.');
  if (!uuid(session.id) || session.id.toLowerCase() !== String(manifest.sessionID).toLowerCase() || typeof session.projectName !== 'string' || session.projectName.length > 500) bad('The DRU manifest and session identity do not match.');
  if (manifest.projectName !== session.projectName) bad('The DRU project names do not match.');
  if (!Array.isArray(session.features) || !Array.isArray(session.photos) || session.features.length > 500 || session.photos.length > 500 || manifest.featureCount !== session.features.length || manifest.photoCount !== session.photos.length) bad('DRU counts must match the session, with up to 500 features and 500 photos.');
  const warnings = [], ids = new Set(), photoPaths = new Set(), photos = [];
  if (![session.inspections, session.qaReviews].every(v => v === undefined || Array.isArray(v) && v.every(i => i && typeof i === 'object' && !Array.isArray(i)))) bad('DRU inspection and QA records must be arrays of records.');
  const features = session.features.map(feature => {
    const p = feature?.properties;
    if (!p || !uuid(p.assetID) || ids.has(p.assetID.toLowerCase()) || !feature.geometry || typeof feature.geometry !== 'object') bad('Each DRU feature requires a unique asset UUID and geometry.');
    if (typeof p.assetType !== 'string' || ['utilityComponent', 'component', 'utilitySubtype'].some(k => p[k] != null && typeof p[k] !== 'string')) bad('DRU feature type declarations must be text.');
    ids.add(p.assetID.toLowerCase());
    return { sourceAssetId: p.assetID.toLowerCase(), name: str(p.utilityComponent || p.component || p.utilitySubtype || p.assetType || 'DRU asset', 130) + ' · ' + p.assetID.slice(0, 8), suggestedType: suggestedType(p),
      geometry: feature.geometry, properties: p, inspections: (session.inspections || []).filter(i => String(i.assetID).toLowerCase() === p.assetID.toLowerCase()), qaReviews: (session.qaReviews || []).filter(i => String(i.assetID).toLowerCase() === p.assetID.toLowerCase()) };
  });
  for (const photo of session.photos) {
    if (!photo || typeof photo.localPath !== 'string' || !/^[A-Za-z0-9_. -]+$/.test(photo.localPath) || photo.localPath.includes('..') || photoPaths.has(photo.localPath)) bad('Photo filenames must be unique and contain no directories.');
    photoPaths.add(photo.localPath);
    const data = files.get('photos/' + photo.localPath), sourceAssetId = String(photo.assetID).toLowerCase(), capturedAt = photo.exif?.timestamp;
    if (!data) { warnings.push('Missing photo: ' + photo.localPath); continue; }
    if (!ids.has(sourceAssetId)) { warnings.push('Unlinked photo retained only in source bundle: ' + photo.localPath); continue; }
    if (typeof capturedAt !== 'string' || !Number.isFinite(Date.parse(capturedAt)) || Date.parse(capturedAt) > now + 60000) bad('Photo ' + photo.localPath + ' needs a valid, nonfuture capture time.');
    let metadata;
    try { metadata = await sharp(data, { limitInputPixels: 40000000 }).metadata(); } catch { bad('Photo cannot be decoded: ' + photo.localPath); }
    if (!['png', 'jpeg'].includes(metadata.format) || metadata.pages > 1) bad('Use single JPEG or PNG photos: ' + photo.localPath);
    photos.push({ sourceAssetId, localPath: photo.localPath, kind: str(photo.kind), capturedAt: new Date(capturedAt).toISOString(), exif: photo.exif, sha256: sha(data), size: data.length, mime: metadata.format === 'png' ? 'image/png' : 'image/jpeg' });
  }
  warnings.push('Source identities, coordinates, accuracy claims and sign-offs are supplied by DRU; ATMS has not independently verified them.', 'Photo bytes are preserved as exported. DRU compact exports may contain resized copies.');
  return { preview: { manifest, certification, features, photos, warnings, profile: session.profile || null }, files };
}

function install(Operations, { Fault, requireRole }) {
  Operations.prototype.initDru = function () {
    this.db.exec(`CREATE TABLE IF NOT EXISTS atms_dru_bundles (agency TEXT NOT NULL,id TEXT NOT NULL,sha256 TEXT NOT NULL,metadata TEXT NOT NULL,bytes BLOB NOT NULL,PRIMARY KEY(agency,id),UNIQUE(agency,sha256));`);
  };
  Operations.prototype.druBundle = function (actor, id, content = false) {
    requireRole(actor, 'viewer');
    const row = this.db.prepare('SELECT * FROM atms_dru_bundles WHERE agency=? AND id=?').get(actor.agency, id);
    if (!row) throw new Fault(404, 'DRU bundle not found in this agency.');
    if (sha(row.bytes) !== row.sha256) throw new Fault(409, 'DRU source bundle integrity check failed.');
    return content ? row.bytes : JSON.parse(row.metadata);
  };
  Operations.prototype.druPreviewPhoto = function (actor, id, index) {
    const bundle = this.druBundle(actor, id), photo = bundle.photos[index];
    if (!Number.isInteger(index) || index < 0 || !photo) throw new Fault(404, 'DRU photograph not found.');
    const bytes = unzip(this.druBundle(actor, id, true), 'photos/' + photo.localPath).get('photos/' + photo.localPath);
    if (!bytes || sha(bytes) !== photo.sha256) throw new Fault(409, 'DRU photograph integrity check failed.');
    return { bytes, mime: photo.mime };
  };
  Operations.prototype.stageDruBundle = function (actor, bytes, decoded) {
    requireRole(actor, 'operator');
    return this.db.transaction(() => {
      const digest = sha(bytes), old = this.db.prepare('SELECT metadata FROM atms_dru_bundles WHERE agency=? AND sha256=?').get(actor.agency, digest);
      if (old) return JSON.parse(old.metadata);
      const usage = this.db.prepare('SELECT count(*) n,coalesce(sum(length(bytes)),0) size FROM atms_dru_bundles WHERE agency=?').get(actor.agency);
      if (usage.n >= 50 || usage.size + bytes.length > 500 * 1024 * 1024) throw new Fault(409, 'Agency DRU storage limit reached (50 bundles / 500 MB).');
      const bundle = { id: randomUUID(), sha256: digest, uploadedAt: this.iso(), uploadedBy: actor.id, status: 'preview', ...decoded.preview };
      this.db.prepare('INSERT INTO atms_dru_bundles VALUES (?,?,?,?,?)').run(actor.agency, bundle.id, digest, JSON.stringify(bundle), bytes);
      this.audit(actor, bundle.id, 'architecture.dru_staged', { sha256: digest, sessionID: bundle.manifest.sessionID });
      return bundle;
    }).immediate();
  };
  Operations.prototype.commitDruBundle = function (actor, id, input, decoded) {
    requireRole(actor, 'operator');
    return this.db.transaction(() => {
      const bundle = this.druBundle(actor, id);
      if (bundle.status === 'imported') throw new Fault(409, 'This exact DRU bundle has already been imported.');
      if (!Array.isArray(input.mappings) || !input.mappings.length || input.mappings.length > 500) throw new Fault(400, 'Select 1–500 DRU features to import.');
      // Validate all target versions against one snapshot before attaching any records.
      for (const map of input.mappings) {
        if (!map || typeof map !== 'object') throw new Fault(400, 'Invalid feature mapping.');
        if (map.assetId && this.need(actor.agency, 'architecture-asset', map.assetId).version !== map.version) throw new Fault(409, 'A target asset changed. Refresh the DRU preview before importing.');
      }
      const used = new Set(), assets = [], photoIds = [];
      for (const map of input.mappings) {
        const feature = bundle.features.find(f => f.sourceAssetId === map.sourceAssetId);
        if (!feature || used.has(feature.sourceAssetId)) throw new Fault(400, 'Select each source feature only once.');
        used.add(feature.sourceAssetId);
        let asset;
        if (map.assetId) {
          asset = this.need(actor.agency, 'architecture-asset', map.assetId);
        } else asset = this.saveArchitectureAsset(actor, { version: 0, name: map.name, type: map.type, owner: str(feature.properties.ownerName, 180), protocol: 'unknown', analysis: {} });
        if (map.connectionId) { const c = this.need(actor.agency, 'architecture-connection', map.connectionId); if (![c.from, c.to].includes(asset.id)) throw new Fault(400, 'Photo connection must belong to the target asset.'); }
        const evidence = { source: 'DRU', bundleId: id, bundleSha256: bundle.sha256, sessionId: bundle.manifest.sessionID, sourceAssetId: feature.sourceAssetId, importedAt: this.iso(), importedBy: actor.id, evidenceState: 'submitted', synthetic: this.mode === 'training', ...feature, profile: bundle.profile };
        asset = this.put(actor.agency, 'architecture-asset', { ...asset, fieldEvidence: [...(asset.fieldEvidence || []), evidence] }, asset.version);
        for (const photo of bundle.photos.filter(p => p.sourceAssetId === feature.sourceAssetId)) {
          const saved = this.addArchitecturePhoto(actor, asset.id, { caption: ('DRU · ' + (photo.kind || photo.localPath)).slice(0, 1000), capturedAt: photo.capturedAt, connectionId: map.connectionId || null }, decoded.files.get('photos/' + photo.localPath), photo.mime);
          const metadata = { ...saved, sourceEvidence: { source: 'DRU', bundleId: id, sourceAssetId: feature.sourceAssetId, localPath: photo.localPath, exif: photo.exif } };
          this.db.prepare('UPDATE atms_architecture_photos SET metadata=? WHERE agency=? AND id=?').run(JSON.stringify(metadata), actor.agency, saved.id);
          photoIds.push(saved.id);
        }
        assets.push({ sourceAssetId: feature.sourceAssetId, assetId: asset.id });
        this.audit(actor, asset.id, 'architecture.dru_evidence_attached', { bundleId: id, sourceAssetId: feature.sourceAssetId, state: 'submitted' });
      }
      const result = { ...bundle, status: 'imported', importedAt: this.iso(), importedBy: actor.id, result: { assets, photoIds } };
      this.db.prepare('UPDATE atms_dru_bundles SET metadata=? WHERE agency=? AND id=?').run(JSON.stringify(result), actor.agency, id);
      this.audit(actor, id, 'architecture.dru_imported', result.result);
      return result;
    }).immediate();
  };
}
module.exports = { install, decodeBundle, MAX_BUNDLE };
