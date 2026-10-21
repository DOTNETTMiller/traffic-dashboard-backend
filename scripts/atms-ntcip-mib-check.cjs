'use strict';
// Checks every NTCIP 1203 object the ATMS adapter reads or writes against the
// standard's own definitions: the object exists at that identifier, writes go
// only to read-write objects, and the values and enumerations the adapter
// relies on are the ones the standard defines.
//
// By default it reads products/atms/mibs/NTCIP1203-Dms.mib, the official MIB
// ITE publishes at github.com/ite-org/NTCIP-1203 (redistributable unedited).
// It also reads the text of the v02 standard, which is copyrighted and not
// stored here:
//   pdftotext -layout NTCIP1203v02-35a.pdf 1203.txt
//   node scripts/atms-ntcip-mib-check.cjs 1203.txt
const fs = require('node:fs');
const path = require('node:path');
const { OID, cell } = require('../services/atms/ntcip/protocol');

// What the adapter does with each object, taken from services/atms/ntcip/adapter.js.
// `values` are the integers the adapter writes or tests for; each must be a
// defined enumeration (or in range) with the meaning given.
const USES = [
  { oid: OID.characterHeight, use: 'get', why: 'discover lines' },
  { oid: OID.characterWidth, use: 'get', why: 'discover columns' },
  { oid: OID.height, use: 'get', why: 'discover lines' },
  { oid: OID.width, use: 'get', why: 'discover columns' },
  { oid: OID.maxMulti, use: 'get', why: 'message length limit' },
  { oid: OID.slots, use: 'get', why: 'reserved slot exists' },
  { oid: OID.endDuration, use: 'get', why: 'expiry goes to blank' },
  { oid: OID.controlMode, use: 'get', why: 'central mode required', values: { 4: 'central', 2: 'local' } },
  { oid: OID.source, use: 'get', why: 'which message is displayed' },
  { oid: OID.remaining, use: 'get', why: 'minutes remaining' },
  { oid: OID.sourceMode, use: 'get', why: 'activation came from central', values: { 8: 'central' } },
  { oid: OID.activationState ?? null, use: 'get', why: 'activation finished', values: {} },
  { oid: OID.activateError, use: 'get', why: 'activation result', values: { 2: 'none' } },
  { oid: OID.validateError, use: 'get', why: 'validation result (emulator)' },
  { oid: OID.activate, use: 'set', why: 'activate message', octets: 12 },
  { oid: cell(3, 5), use: 'get', why: 'current buffer MULTI', index: 'currentBuffer' },
  { oid: cell(4, 5), use: 'get', why: 'current buffer owner', index: 'currentBuffer' },
  { oid: cell(8, 5), use: 'get', why: 'current buffer priority', index: 'currentBuffer' },
  { oid: cell(3, 4, 1), use: 'set', why: 'write MULTI to reserved slot' },
  { oid: cell(4, 4, 1), use: 'set', why: 'claim slot owner' },
  { oid: cell(5, 4, 1), use: 'get', why: 'validated CRC' },
  { oid: cell(6, 4, 1), use: 'set', why: 'beacon off', values: { 0: 'off' } },
  { oid: cell(7, 4, 1), use: 'set', why: 'pixel service off', values: { 0: 'off' } },
  { oid: cell(8, 4, 1), use: 'set', why: 'run-time priority', range: [1, 255] },
  { oid: cell(9, 4, 1), use: 'set', why: 'slot status workflow', values: { 1: 'notUsed', 2: 'modifying', 4: 'valid', 5: 'error', 6: 'modifyReq', 7: 'validateReq' } }
];
// Message identifiers the adapter builds: memory type in the first octet.
const MEMORY_TYPES = { 4: 'volatile', 5: 'currentBuffer', 7: 'blank' };

function parseStandard(text) {
  const objects = new Map();
  const enums = new Map();
  const blocks = text.split(/\n(?=\s*[a-zA-Z][A-Za-z0-9]*\s+OBJECT-TYPE\b)/);
  for (const block of blocks) {
    const head = block.match(/^\s*([a-zA-Z][A-Za-z0-9]*)\s+OBJECT-TYPE/);
    if (!head) continue;
    const body = block.split(/::=\s*\{/)[0];
    const oid = body.match(/<Object Identifier>\s*([0-9.]+)/);
    const access = body.match(/\bACCESS\s+([a-z-]+)/);
    const syntax = body.match(/\bSYNTAX\s+([^\n]+)/);
    if (!oid) continue;
    const entry = { name: head[1], oid: oid[1].replace(/\.$/, ''), access: access && access[1], syntax: syntax && syntax[1].trim() };
    // Enumerations: "name (n)" lines inside the SYNTAX braces, skipping retired (commented) ones.
    const braces = body.match(/SYNTAX\s+INTEGER\s*\{([\s\S]*?)\}/);
    if (braces) {
      const map = {};
      for (const line of braces[1].split('\n')) {
        if (/^\s*--/.test(line)) continue;
        for (const m of line.matchAll(/([a-zA-Z][A-Za-z0-9]*)\s*\((\d+)\)/g)) map[m[2]] = m[1];
      }
      entry.enum = map;
    }
    const range = syntax && syntax[1].match(/\((\d+)\.\.(\d+)\)/);
    if (range) entry.range = [Number(range[1]), Number(range[2])];
    objects.set(entry.oid, entry);
    if (entry.name === 'dmsMessageMemoryType' && entry.enum) enums.set('memoryType', entry.enum);
  }
  return { objects, enums };
}

function main() {
  const file = process.argv[2] || path.join(__dirname, '../products/atms/mibs/NTCIP1203-Dms.mib');
  console.log(`Reading ${path.relative(process.cwd(), file)}`);
  const { objects, enums } = parseStandard(fs.readFileSync(file, 'utf8'));
  if (objects.size < 100) throw new Error(`Only ${objects.size} definitions found; is this the NTCIP 1203 text?`);
  const findings = [];
  const report = (level, msg) => { findings.push({ level, msg }); console.log(`${level.padEnd(4)} ${msg}`); };
  console.log(`${objects.size} object definitions read from the standard.\n`);
  for (const u of USES) {
    if (!u.oid) { report('FAIL', `${u.why}: no identifier configured`); continue; }
    // Scalars end in .0; table cells end in .<memory>.<slot>. Strip the instance.
    const parts = u.oid.split('.');
    const base = u.oid.endsWith('.0') ? parts.slice(0, -1).join('.') : parts.slice(0, -2).join('.');
    const def = objects.get(base);
    if (!def) { report('FAIL', `${u.oid} (${u.why}): no object at ${base} in the standard`); continue; }
    const label = `${def.name} ${u.oid} (${u.why})`;
    if (u.use === 'set' && def.access !== 'read-write') report('FAIL', `${label}: adapter writes it, standard says ${def.access}`);
    if (u.values) for (const [n, meaning] of Object.entries(u.values)) {
      if (def.enum) {
        if (!(n in def.enum)) report('FAIL', `${label}: value ${n} (${meaning}) is not a defined enumeration`);
        else if (def.enum[n].toLowerCase() !== meaning.toLowerCase()) report('WARN', `${label}: adapter treats ${n} as ${meaning}, standard names it ${def.enum[n]}`);
      } else if (def.range && (Number(n) < def.range[0] || Number(n) > def.range[1])) report('FAIL', `${label}: value ${n} outside ${def.range.join('..')}`);
    }
    if (u.range && def.range && (u.range[0] < def.range[0] || u.range[1] > def.range[1])) report('FAIL', `${label}: adapter range ${u.range.join('..')} exceeds standard ${def.range.join('..')}`);
    if (u.oid === OID.activationState && def.enum) report('INFO', `${label}: standard values ${JSON.stringify(def.enum)}; adapter waits for 1 or 2, fails on 3`);
    if (!findings.some(f => f.msg.startsWith(label))) report('OK', `${label}: ${def.access}${def.enum ? ' ' + JSON.stringify(def.enum) : def.range ? ' ' + def.range.join('..') : ''}`);
  }
  const memory = enums.get('memoryType');
  if (!memory) report('WARN', 'dmsMessageMemoryType enumeration not found; memory types unchecked');
  else for (const [n, meaning] of Object.entries(MEMORY_TYPES)) {
    if (memory[n] !== meaning) report('FAIL', `message memory type ${n}: adapter means ${meaning}, standard says ${memory[n] || 'undefined'}`);
    else report('OK', `message memory type ${n} = ${meaning}`);
  }
  const fails = findings.filter(f => f.level === 'FAIL').length;
  const warns = findings.filter(f => f.level === 'WARN').length;
  console.log(`\n${fails} failure(s), ${warns} warning(s).`);
  if (fails) process.exitCode = 1;
}
main();
