'use strict';
const snmp = require('net-snmp');
const { createControllerSession } = require('./session');
const { OID, cell, PRIORITIES, toMulti, fromMulti, activation } = require('./protocol');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
class NtcipError extends Error {
  constructor(message, { notApplied = false } = {}) { super(message); this.notApplied = notApplied; }
}
class NtcipAdapter {
  constructor(config, { now = Date.now } = {}) {
    if (!config.host || !Number.isInteger(config.slot) || config.slot < 1 || config.slot > 65535) throw new Error('Explicit controller host and reserved volatile slot are required.');
    const maxVarbinds = config.maxVarbinds ?? (config.snmpVersion === '1' ? 1 : 16);
    if (!Number.isInteger(maxVarbinds) || maxVarbinds < 1 || maxVarbinds > 16) throw new Error('maxVarbinds must be 1–16.');
    this.config = config; this.now = now; this.busy = false;
    this.maxVarbinds = maxVarbinds;
    this.session = createControllerSession(config);
  }
  async request(method, values) {
    return new Promise((resolve, reject) => this.session[method](values, (error, vars) => {
      if (error) return reject(new NtcipError('SNMP request failed: ' + error.message));
      if (!Array.isArray(vars) || vars.length !== values.length) return reject(new NtcipError('Incomplete controller response.'));
      if (vars.some(snmp.isVarbindError)) return reject(new NtcipError('Controller rejected an SNMP object.'));
      if (vars.some((v, i) => v.oid !== (method === 'get' ? values[i] : values[i].oid))) return reject(new NtcipError('Unexpected readback object.'));
      resolve(vars.map(v => v.value));
    }));
  }
  async get(...oids) {
    const values = [];
    // Small sequential GETs accommodate older controllers with limited buffers.
    for (let i = 0; i < oids.length; i += this.maxVarbinds) values.push(...await this.request('get', oids.slice(i, i + this.maxVarbinds)));
    return values;
  }
  async set(oid, value, type = snmp.ObjectType.Integer) { await this.request('set', [{ oid, type, value }]); }
  async discover() {
    const [ch, cw, h, w, maxMulti, slots, endDuration] = await this.get(OID.characterHeight, OID.characterWidth, OID.height, OID.width, OID.maxMulti, OID.slots, OID.endDuration);
    if (![ch, cw, h, w, maxMulti, slots].every(Number.isInteger) || ch <= 0 || cw <= 0 || h % ch || w % cw || h <= 0 || w <= 0 || maxMulti < 1 || slots < this.config.slot) throw new NtcipError('Unsupported sign capabilities: this profile requires a character-matrix sign and a reserved volatile slot.', { notApplied: true });
    if (!Buffer.isBuffer(endDuration) || endDuration.length !== 5 || endDuration[0] !== 7 || endDuration.readUInt16BE(3) !== 0) throw new NtcipError('Controller end-duration policy must be commissioned to a blank message.', { notApplied: true });
    return { lines: h / ch, columns: w / cw, maxMulti, slots, profile: 'NTCIP 1203 character-matrix text', snmpVersion: this.config.snmpVersion ?? '2c', maxVarbinds: this.maxVarbinds };
  }
  async read() {
    const [multi, owner, source, priority, mode, remaining, activationState, sourceMode] = await this.get(cell(3, 5), cell(4, 5), OID.source, cell(8, 5), OID.controlMode, OID.remaining, OID.activationState, OID.sourceMode);
    if (!Buffer.isBuffer(multi) || !Buffer.isBuffer(owner) || !Buffer.isBuffer(source) || source.length !== 5 || ![priority, mode, remaining, activationState, sourceMode].every(Number.isInteger)) throw new NtcipError('Malformed controller readback.');
    return { message: fromMulti(multi.toString('latin1')), multi: multi.toString('latin1'), owner: owner.toString(), source: source.toString('hex'), priority, mode, remaining, activationState, sourceMode, observedAt: new Date(this.now()).toISOString() };
  }
  async waitFor(oid, success, failure) {
    const deadline = Date.now() + (this.config.validationTimeout || 3000);
    do {
      const [value] = await this.get(oid);
      if (success.includes(value)) return value;
      if (failure.includes(value)) throw new NtcipError('Controller state rejected the operation (' + value + ').');
      await pause(25);
    } while (Date.now() < deadline);
    throw new NtcipError('Controller state transition timed out.');
  }
  async execute(command) {
    if (this.busy) throw new NtcipError('A controller operation is already in progress.', { notApplied: true });
    this.busy = true;
    let activationAttempted = false;
    try {
      const caps = await this.discover();
      const current = await this.read();
      const priority = PRIORITIES[command.priority];
      if (!priority || !['message', 'blank'].includes(command.operation) || (command.operation === 'blank' && command.message !== '') || (command.operation === 'message' && !command.message)) throw new Error('Invalid sign command.');
      const multi = toMulti(command.message);
      if (command.message.split('\n').length > caps.lines || command.message.split('\n').some(line => line.length > caps.columns) || Buffer.byteLength(multi) > caps.maxMulti) throw new Error('Message exceeds discovered sign dimensions.');
      if (current.mode !== 4) throw new Error('Controller is not in central mode; local control is preserved.');
      if (current.priority > priority) throw new Error('A higher-priority controller message is active.');
      let crc = 0, memory = 7, slot = priority;
      if (command.operation === 'message') {
        memory = 4; slot = this.config.slot;
        // Never overwrite the slot currently on display, or a slot owned by another manager.
        const [owner, status] = await this.get(cell(4, memory, slot), cell(9, memory, slot));
        if (current.source.slice(0, 6) === Buffer.from([4, slot >> 8, slot & 255]).toString('hex')) throw new Error('Reserved slot is currently active. Blank or use another commissioned slot before replacing it.');
        if (status !== 1 && owner.toString() && !owner.toString().startsWith('PB:')) throw new Error('Reserved slot is owned by another manager.');
        await this.set(cell(9, memory, slot), 6);
        await this.waitFor(cell(9, memory, slot), [2], [5]);
        await this.set(cell(3, memory, slot), Buffer.from(multi, 'ascii'), snmp.ObjectType.OctetString);
        await this.set(cell(4, memory, slot), Buffer.from('PB:' + command.id), snmp.ObjectType.OctetString);
        await this.set(cell(6, memory, slot), 0); await this.set(cell(7, memory, slot), 0);
        await this.set(cell(8, memory, slot), priority);
        await this.set(cell(9, memory, slot), 7);
        await this.waitFor(cell(9, memory, slot), [4], [5]);
        [crc] = await this.get(cell(5, memory, slot));
        if (!Number.isInteger(crc) || crc < 0 || crc > 65535) throw new Error('Invalid validated message CRC.');
      }
      // Floor instead of round-up: never silently extend the absolute validity.
      const minutes = Math.floor((Date.parse(command.expiresAt) - this.now()) / 60000);
      if (minutes < 1 || minutes > 60) throw new Error('At least one full minute of command validity must remain.');
      const wire = activation({ minutes, priority, memory, slot, crc, sourceAddress: this.config.sourceAddress });
      activationAttempted = true;
      await this.set(OID.activate, wire, snmp.ObjectType.OctetString);
      await this.waitFor(OID.activationState, [1, 2], [3]);
      const [error] = await this.get(OID.activateError);
      if (error !== 2) throw new NtcipError('Controller activation error ' + error + '.');
      const observation = await this.read();
      const expectedSource = wire.subarray(3, 8).toString('hex');
      if (observation.message !== command.message || observation.source !== expectedSource || observation.priority !== priority || observation.mode !== 4 || observation.sourceMode !== 8 || (memory === 4 && observation.owner !== 'PB:' + command.id)) throw new NtcipError('Controller readback does not match this activation.');
      return { ...observation, capabilities: caps, activation: wire.toString('hex'), controllerDurationMinutes: minutes };
    } catch (e) {
      throw new NtcipError(e.message, { notApplied: !activationAttempted });
    } finally { this.busy = false; }
  }
  close() { this.session.close(); }
}
module.exports = { NtcipAdapter, NtcipError };
