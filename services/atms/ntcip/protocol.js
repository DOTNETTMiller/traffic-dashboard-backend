'use strict';
// Numeric object identifiers and wire encodings from NTCIP 1203 v02, sections
// 5.3, 5.5, 5.6 and 5.7. This is a deliberately limited text-message profile.
const root = '1.3.6.1.4.1.1206.4.2.3';
const OID = Object.freeze({
  characterHeight: root + '.2.1.0', characterWidth: root + '.2.2.0',
  height: root + '.2.3.0', width: root + '.2.4.0', maxMulti: root + '.4.16.0',
  slots: root + '.5.6.0', validateError: root + '.5.9.0',
  controlMode: root + '.6.1.0', activate: root + '.6.3.0', remaining: root + '.6.4.0',
  source: root + '.6.5.0', sourceMode: root + '.6.7.0', endDuration: root + '.6.15.0',
  activateError: root + '.6.17.0', activationState: root + '.6.25.0'
});
const cell = (column, memory = 4, slot = 1) => `${root}.5.8.1.${column}.${memory}.${slot}`;
const PRIORITIES = Object.freeze({ 1: 255, 2: 200, 3: 150, 4: 100, 5: 50 });
function toMulti(message) {
  if (typeof message !== 'string' || /[^\x20-\x5A\x5C\x5E-\x7E\n]/.test(message) || /[\[\]]/.test(message)) throw new Error('The text profile supports printable ASCII without MULTI tags or brackets.');
  return message.replaceAll('\n', '[nl]');
}
function fromMulti(multi) {
  const plain = String(multi).replaceAll('[nl]', '\n');
  toMulti(plain); // Never discard unsupported formatting and falsely claim a match.
  return plain;
}
// Reads any MULTI an agency sign may already be displaying (NTCIP 1203 v02,
// section 6.4). Layout tags (justification, fonts, page timing, spacing,
// colors) do not change the words and are dropped. Tags that substitute
// content the controller fills in or draws (fields, graphics, moving text,
// manufacturer-specific) cannot be known from the string, so they are listed
// in `unrenderable` and the text is marked incomplete. This is for display and
// evidence only; command verification still compares the strict profile text.
const LAYOUT_TAGS = /^(\/?(jl|jp|fo|pt|sc|cf|cb|pb|tr|cr|fl|nl|np|spacing|sp))/i;
function decodeMulti(multi) {
  const pages = [[]];
  const unrenderable = [];
  let line = '';
  const s = String(multi);
  for (let i = 0; i < s.length;) {
    if (s.startsWith('[[', i) || s.startsWith(']]', i)) { line += s[i]; i += 2; continue; }
    if (s[i] !== '[') { line += s[i++]; continue; }
    const end = s.indexOf(']', i);
    if (end < 0) { unrenderable.push(s.slice(i)); break; }
    const tag = s.slice(i + 1, end);
    i = end + 1;
    if (/^nl\d*$/i.test(tag)) { pages[pages.length - 1].push(line); line = ''; }
    else if (/^np$/i.test(tag)) { pages[pages.length - 1].push(line); line = ''; pages.push([]); }
    else if (!LAYOUT_TAGS.test(tag)) unrenderable.push(`[${tag}]`);
  }
  pages[pages.length - 1].push(line);
  const clean = pages.map(p => p.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)).filter(p => p.length);
  return { pages: clean, text: clean.map(p => p.join('\n')).join('\n\n'), complete: unrenderable.length === 0, unrenderable };
}
function messageId(memory, slot, crc) {
  const b = Buffer.alloc(5); b[0] = memory; b.writeUInt16BE(slot, 1); b.writeUInt16BE(crc, 3); return b;
}
function activation({ minutes, priority, memory, slot, crc, sourceAddress = '127.0.0.1' }) {
  const ip = sourceAddress.split('.').map(Number);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60 || !Number.isInteger(priority) || priority < 1 || priority > 255 || ip.length !== 4 || ip.some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw new Error('Invalid message activation parameters.');
  const b = Buffer.alloc(12); b.writeUInt16BE(minutes); b[2] = priority; messageId(memory, slot, crc).copy(b, 3); Buffer.from(ip).copy(b, 8); return b;
}
function decodeActivation(b) {
  if (!Buffer.isBuffer(b) || b.length !== 12) throw new Error('Activation requires exactly 12 octets.');
  return { minutes: b.readUInt16BE(0), priority: b[2], memory: b[3], slot: b.readUInt16BE(4), crc: b.readUInt16BE(6) };
}
function crc16(multi, beacon = 0, pixelService = 0) {
  let crc = 0xffff;
  for (const byte of Buffer.concat([Buffer.from(multi, 'ascii'), Buffer.from([beacon, pixelService])])) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc & 1) ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
  }
  crc = (crc ^ 0xffff) & 0xffff;
  return ((crc & 255) << 8) | (crc >>> 8);
}
module.exports = { OID, cell, PRIORITIES, toMulti, fromMulti, decodeMulti, messageId, activation, decodeActivation, crc16 };
