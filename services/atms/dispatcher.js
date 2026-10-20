'use strict';
const { createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const { stable, Fault } = require('./core');

function signature(secret, timestamp, body) {
  return createHmac('sha256', secret).update(timestamp + '.' + stable(body)).digest('hex');
}
function verifyGateway(ops, config, headers, body) {
  if (ops.mode !== 'live' || !config?.secret || config.secret.length < 32 || !config.agency) throw new Fault(503, 'No live gateway is configured.');
  const timestamp = String(headers['x-atms-timestamp'] || '');
  const received = String(headers['x-atms-signature'] || '');
  if (!/^\d{13}$/.test(timestamp) || Math.abs(ops.now() - Number(timestamp)) > 300000 || !/^[a-f0-9]{64}$/.test(received)) throw new Fault(401, 'Invalid gateway signature or timestamp.');
  if (!timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(signature(config.secret, timestamp, body), 'hex'))) throw new Fault(401, 'Invalid gateway signature.');
  if (typeof body.nonce !== 'string' || body.nonce.length < 16 || body.nonce.length > 120) throw new Fault(400, 'A unique gateway nonce is required.');
  return ops.db.transaction(() => {
    if (ops.db.prepare('SELECT nonce FROM atms_gateway_nonces WHERE nonce=?').get(body.nonce)) throw new Fault(409, 'Gateway event already received.');
    let result;
    if (body.kind === 'telemetry') {
      const device = ops.need(config.agency, 'device', body.deviceId);
      if (device.driver !== 'gateway') throw new Fault(403, 'Telemetry is limited to gateway-provisioned devices.');
      const at = Date.parse(body.observedAt);
      if (!Number.isFinite(at) || at > ops.now() + 300000 || ops.now() - at > 300000 || (device.observedAt && at < Date.parse(device.observedAt)) || typeof body.message !== 'string' || body.message.length > 2000) throw new Fault(400, 'Provide a recent device observation and its displayed message.');
      result = ops.put(config.agency, 'device', { ...device, observedAt: body.observedAt, displayedMessage: body.message }, device.version);
      for (const command of ops.list(config.agency, 'command')) {
        if (command.deviceId === device.id && command.status === 'verified' && command.message !== body.message) ops.serviceCommand(config.agency, command, { status: 'unknown', failure: 'New signed device telemetry no longer matches the verified message. Reconcile the actual field override.', observedMessage: body.message }, 'command.field_override_detected');
      }
      if (device.displayedMessage !== body.message) ops.audit(ops.system(config.agency), device.id, 'device.observed_message_changed', { message: body.message, observedAt: body.observedAt });
    } else result = ops.gatewayEvent(config.agency, body);
    ops.db.prepare('INSERT INTO atms_gateway_nonces(nonce,at) VALUES (?,?)').run(body.nonce, ops.now());
    ops.db.prepare('DELETE FROM atms_gateway_nonces WHERE at<?').run(ops.now() - 600000);
    return result;
  }).immediate();
}
class Dispatcher {
  constructor(ops, { gateway = null, send = null, trainingLab = null } = {}) {
    this.ops = ops; this.gateway = gateway; this.customSend = send; this.trainingLab = trainingLab; this.busy = false;
    ops.recoverDispatches();
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      if (this.ops.mode === 'training' && this.trainingLab) await this.trainingLab.poll();
      if (this.ops.mode === 'training' && !this.trainingLab) {
        for (const row of this.ops.db.prepare("SELECT agency,data FROM atms_entities WHERE kind='device'").all()) {
          const d = JSON.parse(row.data);
          if (d.driver === 'simulator' && !d.trainingOffline && (!d.observedAt || this.ops.now() - Date.parse(d.observedAt) > 15000)) this.ops.put(row.agency, 'device', { ...d, observedAt: this.ops.iso() }, d.version);
        }
      }
      for (const item of this.ops.takeDispatches()) {
        const { agency, command, device } = item;
        try {
          if (this.ops.mode === 'training') {
            if (device.driver !== 'simulator') throw new Error('Training commands cannot leave the simulator.');
            const result = this.trainingLab ? await this.trainingLab.execute(command, device) : { message: command.message, observedAt: this.ops.iso() };
            this.ops.gatewayEvent(agency, { commandId: command.id, deviceId: device.id, status: 'acknowledged', observedAt: this.ops.iso() }, { simulation: true });
            this.ops.gatewayEvent(agency, { commandId: command.id, deviceId: device.id, status: 'readback', evidence: 'device-readback', message: result.message, observedAt: this.ops.iso() }, { simulation: true });
          } else {
            if (!this.gateway || this.gateway.agency !== agency) throw new Error('No authorized gateway is registered for this agency.');
            const body = { id: command.id, deviceId: device.id, address: device.gatewayDeviceId || device.id, operation: command.operation, message: command.message, priority: command.priority, expiresAt: command.expiresAt, nonce: randomUUID() };
            if (this.customSend) await this.customSend(body);
            else {
              const timestamp = String(this.ops.now());
              const result = await fetch(this.gateway.url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json', 'X-ATMS-Timestamp': timestamp, 'X-ATMS-Signature': signature(this.gateway.secret, timestamp, body), 'Idempotency-Key': command.id }, body: stable(body) });
              if (!result.ok) throw new Error('Gateway returned HTTP ' + result.status + '; verify actual device state.');
            }
            // HTTP acceptance is not a field-device acknowledgement. Only the signed
            // gateway evidence path may advance acknowledged/verified state.
          }
        } catch (error) {
          const current = this.ops.need(agency, 'command', command.id);
          if (['dispatching', 'acknowledged'].includes(current.status)) this.ops.db.transaction(() => this.ops.serviceCommand(agency, current, { status: this.ops.mode === 'training' && error.notApplied ? 'failed' : 'unknown', failure: String(error.message).slice(0, 500) }, 'command.delivery_uncertain')).immediate();
        }
      }
    } finally { this.busy = false; }
  }
  start() { this.timer = setInterval(() => this.tick().catch(error => console.error('ATMS dispatcher:', error.message)), 1000); this.timer.unref(); }
  stop() { clearInterval(this.timer); }
}
module.exports = { Dispatcher, signature, verifyGateway };
