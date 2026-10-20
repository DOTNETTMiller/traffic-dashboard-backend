'use strict';
const { createHash } = require('node:crypto');
const { gzipSync, gunzipSync } = require('node:zlib');
const { inventoryRecord } = require('./its-inventory');
const hash = value => createHash('sha256').update(value).digest('hex');
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const numeric = value => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const MAX_PAYLOAD = 30 * 1024 * 1024;
const RETAIN_BATCHES = 24, RETAIN_ROWS = 100000;

function rowsOf(collection) {
  const p = collection.payload;
  return collection.kind === 'inventory' ? p?.equipment : collection.kind === 'devices' ? p?.devices : collection.kind === 'traffic' ? p?.rows : p?.events;
}
function normalize(row, collection) {
  if (collection.kind === 'inventory') row = inventoryRecord(row);
  if (collection.kind === 'events' && row && row.id == null) row = { ...row, id: row.road_event_id };
  if (!row || typeof row !== 'object' || row.id == null || String(row.id).trim() === '' || String(row.id).length > 160) return null;
  const state = String(row.state || (collection.kind === 'traffic' ? 'MN' : 'unknown'));
  const kind = collection.kind === 'traffic' ? String(row.kind || 'detector') : ['inventory', 'devices'].includes(collection.kind) ? String(row.deviceType || 'dms') : 'event';
  const key = state + ':' + String(row.id) + ':' + kind;
  const coordinates = Array.isArray(row.coordinates) ? row.coordinates : [row.longitude, row.latitude];
  const lon = numeric(coordinates[0]), lat = numeric(coordinates[1]);
  const location = lon !== null && lat !== null && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 && (lon !== 0 || lat !== 0) ? [lon, lat] : null;
  const inventory = row.inventory === true;
  const reportedTimestamp = row.observedAt ?? row.updated ?? row.lastUpdated ?? null;
  const observedAt = inventory ? null : iso(reportedTimestamp);
  const flags = [];
  const synthetic = collection.synthetic === true || row.synthetic === true || collection.payload?.synthetic === true || state === 'TRAINING';
  if (synthetic) flags.push('synthetic');
  if (inventory) flags.push('inventory-only');
  if (!observedAt && !inventory) flags.push(reportedTimestamp ? 'invalid-observation-time' : 'unknown-observation-time');
  if (!location) flags.push('unknown-location');
  const measurements = [];
  for (const [field, name, unit, max] of [['speedMph', 'speed', 'mph', Infinity], ['flowVph', 'flow', 'vehicles/hour', Infinity], ['occupancyPct', 'occupancy', '%', 100]]) {
    if (row[field] == null) continue;
    const value = numeric(row[field]);
    if (value === null || value < 0 || value > max) flags.push('invalid-' + name);
    else measurements.push({ name, value, unit });
  }
  const message = typeof row.mode?.pattern === 'string' ? row.mode.pattern : null;
  return { key, sourceId: collection.sourceId, sourceRecordId: String(row.id), state, kind,
    synthetic, name: String(row.name || row.label || row.description || row.headline || row.id).slice(0, 180), route: String(row.route || row.rawRoute || row.corridor || '').slice(0, 100),
    direction: row.direction || null, lane: row.lane ?? null, coordinates: location, inventory,
    observedAt, reportedTimestamp, collectedAt: collection.collectedAt, sourceObservedAt: iso(collection.sourceObservedAt),
    message, displaying: typeof row.mode?.displaying === 'boolean' ? row.mode.displaying : null,
    sourceAdapter: row.sourceAdapter || null, sourceStatus: collection.status,
    inventoryDetails: row.inventoryDetails || null,
    measurements, periodSeconds: numeric(row.periodSeconds), flags, present: true };
}
function quality(record, now) {
  const flags = [...record.flags];
  const ageMs = record.observedAt ? now - Date.parse(record.observedAt) : null;
  if (ageMs !== null && ageMs < -60000) flags.push('future-observation-time');
  if (ageMs !== null && ageMs > (record.kind === 'detector' || record.kind === 'station' ? 300000 : 900000)) flags.push('stale');
  if (!record.present) flags.push('absent-from-latest-snapshot');
  if (record.sourceStatus === 'partial') flags.push('partial-source');
  return { ...record, flags, ageMs, quality: flags.length ? 'review' : 'current' };
}
function install(Operations, { Fault, requireRole }) {
  Operations.prototype.initCollections = function () {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS atms_collection_batches (
        agency TEXT NOT NULL, id TEXT NOT NULL, source_id TEXT NOT NULL,
        collected_at TEXT NOT NULL, metadata TEXT NOT NULL, payload BLOB NOT NULL,
        sha256 TEXT NOT NULL, PRIMARY KEY(agency,id));
      CREATE INDEX IF NOT EXISTS atms_collection_batch_source ON atms_collection_batches(agency,source_id,collected_at);
      CREATE TABLE IF NOT EXISTS atms_observations (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, agency TEXT NOT NULL, source_id TEXT NOT NULL,
        batch_id TEXT NOT NULL, record_key TEXT NOT NULL, observed_at TEXT, data TEXT NOT NULL,
        FOREIGN KEY(agency,batch_id) REFERENCES atms_collection_batches(agency,id) ON DELETE CASCADE);
      CREATE INDEX IF NOT EXISTS atms_observation_history ON atms_observations(agency,source_id,record_key,seq);
    `);
  };
  Operations.prototype.recordCollections = function (agency, collections) {
    if (!Array.isArray(collections) || collections.length > 16) throw new Fault(400, 'At most 16 collection streams are accepted per import.');
    const summaries = [];
    for (const input of collections) {
      if (!input || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.sourceId || '') || !['devices', 'traffic', 'events', 'inventory'].includes(input.kind) || !['ok', 'empty', 'partial', 'unavailable'].includes(input.status) || !iso(input.collectedAt) || Date.parse(input.collectedAt) > this.now() + 60000) throw new Fault(400, 'Invalid collection identity, kind, status or collection time.');
      const rows = rowsOf(input);
      if (input.status !== 'unavailable' && (!Array.isArray(rows) || rows.length > 25000)) throw new Fault(400, 'A collection needs up to 25,000 source records.');
      const raw = JSON.stringify(input.payload ?? null);
      if (Buffer.byteLength(raw) > MAX_PAYLOAD) throw new Fault(413, 'Collection exceeds 30 MB.');
      const sha256 = hash(raw);
      const id = hash(JSON.stringify([input.sourceId, input.kind, input.status, input.sourceObservedAt || null, sha256]));
      const prior = this.get(agency, 'collection', input.sourceId);
      const duplicate = !!this.db.prepare('SELECT 1 FROM atms_collection_batches WHERE agency=? AND id=?').get(agency, id);
      let accepted = 0, rejected = 0, outOfOrder = 0;
      const seen = new Set(), records = [];
      for (const row of rows || []) {
        const record = normalize(row, { ...input, synthetic: this.mode === 'training' });
        if (!record || seen.has(record.key)) { rejected++; continue; }
        seen.add(record.key); records.push(record);
      }
      const status = rejected && input.status !== 'unavailable' ? 'partial' : input.status;
      for (const record of records) record.sourceStatus = status;
      const metadata = { normalizerVersion: 1, synthetic: this.mode === 'training', sourceId: input.sourceId, kind: input.kind, status, collectedAt: input.collectedAt, sourceObservedAt: iso(input.sourceObservedAt), error: input.error ? 'Upstream collection unavailable.' : null };
      if (!duplicate) {
        this.db.prepare('INSERT INTO atms_collection_batches VALUES (?,?,?,?,?,?,?)').run(agency, id, input.sourceId, input.collectedAt, JSON.stringify(metadata), gzipSync(raw), sha256);
        const insert = this.db.prepare('INSERT INTO atms_observations(agency,source_id,batch_id,record_key,observed_at,data) VALUES (?,?,?,?,?,?)');
        for (const record of records) insert.run(agency, input.sourceId, id, record.key, record.observedAt, JSON.stringify({ ...record, batchId: id }));
      }
      // A late cache response must be archived without replacing newer state.
      const late = prior && (Date.parse(input.collectedAt) < Date.parse(prior.lastCollectedAt) ||
        (input.sourceObservedAt && prior.sourceObservedAt && Date.parse(input.sourceObservedAt) < Date.parse(prior.sourceObservedAt)));
      if (!late && !duplicate) {
        for (const record of records) {
          const entityId = hash(input.sourceId + ':' + record.key);
          const old = this.get(agency, 'observation', entityId);
          if (old?.observedAt && (!record.observedAt || Date.parse(record.observedAt) < Date.parse(old.observedAt))) { outOfOrder++; continue; }
          const latest = this.put(agency, 'observation', { ...record, id: entityId, batchId: id }, old?.version);
          accepted++;
          if (['inventory', 'devices', 'traffic'].includes(input.kind)) {
            const deviceId = input.kind === 'inventory' ? 'inventory:' + input.sourceId + ':' + record.sourceRecordId : input.kind === 'devices' ? 'source:' + record.state + ':' + record.sourceRecordId : 'source:' + input.sourceId + ':' + record.key;
            const existing = this.get(agency, 'device', deviceId);
            // Imported data can neither replace a commissioned driver nor provide
            // field evidence for commands, even if IDs happen to collide.
            if (!existing || existing.driver === 'readonly') this.registerDevice(agency, {
              id: deviceId, name: record.name, type: record.kind, route: record.route,
              direction: record.direction, lane: record.lane, latitude: record.coordinates?.[1] ?? null, longitude: record.coordinates?.[0] ?? null,
              driver: 'readonly', controlEnabled: false, inventory: record.inventory, displayedMessage: record.message,
              observedAt: record.observedAt, ingestedAt: input.collectedAt, sourceName: input.sourceId, observationId: latest.id,
              measurements: record.measurements, dataFlags: quality(record, this.now()).flags, present: true
            });
          }
        }
        const previousRows = this.db.prepare("SELECT data FROM atms_entities WHERE agency=? AND kind='observation' AND json_extract(data,'$.sourceId')=? AND json_extract(data,'$.present')=1").all(agency, input.sourceId).map(r => JSON.parse(r.data));
        const sourceDevices = new Map(this.db.prepare("SELECT data FROM atms_entities WHERE agency=? AND kind='device' AND json_extract(data,'$.driver')='readonly' AND json_extract(data,'$.sourceName')=?").all(agency, input.sourceId).map(r => { const d = JSON.parse(r.data); return [d.observationId, d]; }));
        if (['ok', 'empty'].includes(status)) for (const old of previousRows) {
          if (old.sourceId === input.sourceId && old.present && !seen.has(old.key)) {
            this.put(agency, 'observation', { ...old, present: false, missingSince: input.collectedAt }, old.version);
            // Preserve the last reading; absence is never an inferred blank.
            const device = sourceDevices.get(old.id);
            if (device) this.put(agency, 'device', { ...device, present: false, missingSince: input.collectedAt }, device.version);
          }
        }
      }
      if (!late) {
        const stream = this.put(agency, 'collection', { id: input.sourceId, kind: input.kind, status, lastCollectedAt: input.collectedAt,
          sourceObservedAt: iso(input.sourceObservedAt), lastSuccessfulAt: ['ok', 'empty'].includes(status) ? input.collectedAt : prior?.lastSuccessfulAt || null,
          batchId: id, sha256, count: records.length, rejected, outOfOrder, duplicate,
          error: metadata.error }, prior?.version);
        summaries.push(stream);
      }
      // Bounded local history. Latest observations remain available independently.
      const batches = this.db.prepare('SELECT id FROM atms_collection_batches WHERE agency=? AND source_id=? ORDER BY collected_at DESC,rowid DESC').all(agency, input.sourceId);
      const protectedId = late ? prior.batchId : id;
      const remaining = batches.filter(b => b.id !== protectedId);
      for (const batch of remaining.slice(RETAIN_BATCHES - 1)) this.db.prepare('DELETE FROM atms_collection_batches WHERE agency=? AND id=?').run(agency, batch.id);
      let count = this.db.prepare('SELECT count(*) n FROM atms_observations WHERE agency=? AND source_id=?').get(agency, input.sourceId).n;
      for (const batch of remaining.slice(0, RETAIN_BATCHES - 1).reverse()) {
        if (count <= RETAIN_ROWS) break;
        const n = this.db.prepare('SELECT count(*) n FROM atms_observations WHERE agency=? AND batch_id=?').get(agency, batch.id).n;
        this.db.prepare('DELETE FROM atms_collection_batches WHERE agency=? AND id=?').run(agency, batch.id); count -= n;
      }
    }
    return summaries;
  };
  const recordCollections = Operations.prototype.recordCollections;
  Operations.prototype.recordCollections = function (agency, collections) {
    return this.db.transaction(() => recordCollections.call(this, agency, collections)).immediate();
  };
  Operations.prototype.collectionPage = function (agency, query = {}) {
    const limit = Number(query.limit ?? 50), offset = Number(query.offset ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0) throw new Fault(400, 'Invalid observation pagination.');
    const conditions = ["agency=?", "kind='observation'"], params = [agency];
    for (const [key, field] of [['sourceId', 'sourceId'], ['type', 'kind']]) if (query[key]) { conditions.push(`json_extract(data,'$.${field}')=?`); params.push(String(query[key])); }
    const where = conditions.join(' AND ');
    const total = this.db.prepare('SELECT count(*) n FROM atms_entities WHERE ' + where).get(...params).n;
    const rows = this.db.prepare('SELECT data FROM atms_entities WHERE ' + where + ' ORDER BY rowid DESC LIMIT ? OFFSET ?').all(...params, limit, offset).map(r => quality(JSON.parse(r.data), this.now()));
    return { total, limit, offset, rows };
  };
  Operations.prototype.collectionBatch = function (agency, id) {
    const row = this.db.prepare('SELECT * FROM atms_collection_batches WHERE agency=? AND id=?').get(agency, id);
    if (!row) throw new Fault(404, 'Collection batch is unavailable or outside retained history.');
    const raw = gunzipSync(row.payload, { maxOutputLength: MAX_PAYLOAD }).toString('utf8');
    if (hash(raw) !== row.sha256) throw new Fault(409, 'Collection payload integrity check failed.');
    return { id, ...JSON.parse(row.metadata), sha256: row.sha256, payload: JSON.parse(raw), rawScope: 'JSON received at the ATMS boundary; upstream collectors may already have normalized vendor data' };
  };
  Operations.prototype.collectionHistory = function (agency, observationId, query = {}) {
    const observation = this.need(agency, 'observation', observationId);
    const limit = Number(query.limit ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Fault(400, 'Invalid history limit.');
    return this.db.prepare('SELECT data FROM atms_observations WHERE agency=? AND source_id=? AND record_key=? ORDER BY seq DESC LIMIT ?').all(agency, observation.sourceId, observation.key, limit).map(row => quality(JSON.parse(row.data), this.now()));
  };
  Operations.prototype.replayCollection = function (actor, id) {
    requireRole(actor, 'operator');
    const batch = this.collectionBatch(actor.agency, id);
    const seen = new Set();
    const records = (rowsOf(batch) || []).map(row => normalize(row, batch)).filter(record => {
      if (!record || seen.has(record.key)) return false;
      seen.add(record.key); return true;
    });
    return { batchId: id, mode: 'normalization-preview', writes: false, originalCollectedAt: batch.collectedAt, total: records.length,
      rows: records.slice(0, 200).map(record => quality(record, this.now())) };
  };
}
module.exports = { install, normalize, quality, rowsOf };
