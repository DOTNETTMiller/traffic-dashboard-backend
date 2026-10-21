'use strict';
// Receives DTCD closure changes pushed by DTCD's feed-webhook-dispatch
// (supabase/WEBHOOK_PUSH.md in the DTCD repository). Each POST carries
// X-DTCD-Timestamp (epoch seconds) and X-DTCD-Signature: sha256=<hex HMAC of
// `${timestamp}.${rawBody}`>. DTCD retries any non-2xx with backoff and reuses
// the stored payload, so duplicates and late retries answer 200 and never
// overwrite a newer change.
const { createHmac, timingSafeEqual } = require('node:crypto');
const { Fault } = require('./core');

const WINDOW_S = 300;
const SOURCE_NAME = 'DTCD';

function configuredDtcd(env) {
  if (!env.ATMS_DTCD_WEBHOOK_SECRET) return null;
  if (env.ATMS_DTCD_WEBHOOK_SECRET.length < 32 || !env.ATMS_AGENCY) throw new Error('DTCD push requires a 32+ character ATMS_DTCD_WEBHOOK_SECRET and ATMS_AGENCY.');
  return { secret: env.ATMS_DTCD_WEBHOOK_SECRET, agency: env.ATMS_AGENCY };
}

function verify(config, headers, raw, nowMs) {
  const timestamp = String(headers['x-dtcd-timestamp'] || '');
  const match = /^sha256=([a-f0-9]{64})$/.exec(String(headers['x-dtcd-signature'] || ''));
  if (!/^\d{10}$/.test(timestamp) || Math.abs(nowMs / 1000 - Number(timestamp)) > WINDOW_S || !match) throw new Fault(401, 'Invalid DTCD signature or timestamp.');
  const expected = createHmac('sha256', config.secret).update(timestamp + '.').update(raw).digest();
  if (!timingSafeEqual(Buffer.from(match[1], 'hex'), expected)) throw new Fault(401, 'Invalid DTCD signature.');
}

// DTCD's work_zone feature, in the shape sourceEvent() reads from any source.
function sourceRecord(envelope) {
  const p = envelope.work_zone?.properties || {};
  const road = typeof p.road_name === 'string' && p.road_name.trim() ? p.road_name.trim() : null;
  const work = typeof p.work_type === 'string' && p.work_type.trim() ? p.work_type.trim() : 'Work zone';
  return {
    description: road ? `${work} — ${road}` : work, road, direction: p.direction || 'unknown',
    eventType: `work zone ${p.vehicle_impact || 'some-lanes-closed'}`.replace('closed', 'closure'),
    geometry: envelope.work_zone?.geometry || null, geometry_source: 'DTCD field-recorded route',
    updated: envelope.update_date, startTime: p.start_time, endTime: p.end_time,
    properties: { vehicle_impact: p.vehicle_impact }
  };
}

function fieldEvidence(envelope) {
  const p = envelope.work_zone?.properties || {};
  const signs = Array.isArray(p.mutcd_signs) ? p.mutcd_signs.slice(0, 50).map(s => ({
    code: String(s?.mutcd_code || '').slice(0, 20), role: s?.role ? String(s.role).slice(0, 40) : null,
    location: Array.isArray(s?.location) && s.location.length === 2 && s.location.every(Number.isFinite) ? s.location : null,
    at: typeof s?.timestamp === 'string' ? s.timestamp : null
  })) : [];
  return { source: SOURCE_NAME, closureId: String(p.closure_id || envelope.closure_id), projectId: p.project_id ? String(p.project_id) : null,
    startTime: p.start_time || null, endTime: p.end_time || null, reducedSpeedLimit: Number.isFinite(p.reduced_speed_limit) ? p.reduced_speed_limit : null, signs };
}

function receiveDtcd(ops, config, headers, raw) {
  if (!config) throw new Fault(503, 'DTCD push is not configured.');
  if (!Buffer.isBuffer(raw) || !raw.length || raw.length > 262144) throw new Fault(400, 'A DTCD JSON body up to 256 KB is required.');
  verify(config, headers, raw, ops.now());
  let envelope;
  try { envelope = JSON.parse(raw.toString('utf8')); } catch { throw new Fault(400, 'DTCD body is not JSON.'); }
  const eventId = envelope?.event_id, closureId = envelope?.closure_id;
  const updated = Date.parse(envelope?.update_date);
  if (typeof eventId !== 'string' || eventId.length < 8 || eventId.length > 120 || typeof closureId !== 'string' || !closureId || closureId.length > 120 ||
      !Number.isFinite(updated) || updated > ops.now() + WINDOW_S * 1000 || !['insert', 'update', 'delete'].includes(envelope.event_type)) {
    throw new Fault(400, 'DTCD event needs event_id, closure_id, a valid update_date and event_type insert, update or delete.');
  }
  if (envelope.event_type !== 'delete' && envelope.work_zone?.type !== 'Feature') throw new Fault(400, 'DTCD insert or update needs a work_zone feature.');
  const agency = config.agency, key = 'DTCD:' + closureId, nonce = 'dtcd:' + eventId;
  return ops.db.transaction(() => {
    if (ops.db.prepare('SELECT nonce FROM atms_gateway_nonces WHERE nonce=?').get(nonce)) return { status: 'duplicate', eventId };
    ops.db.prepare('INSERT INTO atms_gateway_nonces(nonce,at) VALUES (?,?)').run(nonce, ops.now());
    ops.db.prepare('DELETE FROM atms_gateway_nonces WHERE at<?').run(ops.now() - 600000);
    const old = ops.get(agency, 'event', key);
    if (old?.sourceUpdatedAt && Date.parse(old.sourceUpdatedAt) >= updated) return { status: 'older', eventId, id: key };
    const observedAt = new Date(updated).toISOString();
    let event;
    if (envelope.event_type === 'delete' || envelope.work_zone.properties?.is_active === false) {
      if (!old) return { status: 'ignored', eventId };
      event = { ...old, present: false, missingSince: observedAt, sourceUpdatedAt: observedAt };
    } else {
      event = { ...ops.sourceEvent(sourceRecord(envelope), key, closureId, SOURCE_NAME, observedAt, old), pushedBy: 'dtcd', fieldEvidence: fieldEvidence(envelope) };
    }
    ops.put(agency, 'event', event, old?.version);
    ops.audit(ops.system(agency), 'source:dtcd', 'source.dtcd_' + (event.present ? 'event_received' : 'event_ended'), { id: key, eventId, updated: observedAt });
    return { status: event.present ? 'stored' : 'ended', eventId, id: key };
  }).immediate();
}

module.exports = { configuredDtcd, receiveDtcd, sourceRecord };
