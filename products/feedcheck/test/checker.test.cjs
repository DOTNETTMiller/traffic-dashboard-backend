'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const c = require('../src/checker.js');
const now = '2026-10-17T15:00:00Z';
const options = { now, source: 'Test feed' };
const fresh = () => { const feed = c.sample(Date.parse(now)); feed.features = [feed.features[0]]; return feed; };
const assess = feed => c.analyze(feed, options);
test('clean event and fresh feed produce no findings', () => {
  const r = assess(fresh());
  assert.deepEqual(r.summary, { records: 1, flagged: 0, clear: 1, errors: 0, warnings: 0, feedFindings: 0 });
});
test('sample contains six records and actionable paths', () => {
  const r = assess(c.sample(Date.parse(now)));
  assert.equal(r.summary.records, 6);
  assert.equal(r.summary.flagged, 4);
  assert.equal(r.summary.errors, 2);
  assert.equal(r.summary.warnings, 2);
  assert.ok(r.issues.some(i => i.code === 'GEOMETRY_INVALID' && i.path === '$.features[2].geometry'));
  assert.ok(r.issues.every(i => i.action.length > 10));
});
test('duplicate IDs flag all affected records, including numeric/string collisions', () => {
  const f = fresh(); f.features.push(structuredClone(f.features[0]));
  f.features[0].id = 1; f.features[1].id = '1';
  const r = assess(f);
  assert.equal(r.issues.filter(i => i.code === 'ID_DUPLICATE').length, 2);
  assert.equal(r.summary.flagged, 2);
});
test('zero is a valid ID; zero coordinates are valid', () => {
  const f = fresh(); f.features[0].id = 0; f.features[0].geometry = { type: 'Point', coordinates: [0, 0] };
  assert.equal(assess(f).issues.length, 0);
});
test('malformed records stay counted and are individually reported', () => {
  const f = fresh(); f.features.push(null, 'oops', [], 123);
  const r = assess(f);
  assert.equal(r.summary.records, 5); assert.equal(r.summary.flagged, 4);
  assert.equal(r.issues.filter(i => i.code === 'RECORD_INVALID').length, 4);
});
test('GeoJSON Feature type and properties are verified', () => {
  const f = fresh(); f.features[0].type = 'Point'; f.features[0].properties = null;
  const codes = assess(f).issues.map(i => i.code);
  assert.ok(codes.includes('FEATURE_TYPE')); assert.ok(codes.includes('PROPERTIES_INVALID'));
});
test('empty feed reports a warning, never fabricated event quality', () => {
  const f = fresh(); f.features = [];
  const r = assess(f);
  assert.equal(r.summary.records, 0); assert.equal(r.summary.clear, 0);
  assert.ok(r.issues.some(i => i.code === 'EMPTY_FEED' && i.index === null));
});
test('timestamps reject local time, impossible dates, and offset overflow', () => {
  for (const v of ['2026-10-17', '2026-10-17T12:00:00', '2026-02-30T12:00:00Z', '2026-13-01T00:00:00Z', '2026-10-17T24:00:00Z', '2026-10-17T12:00:00+99:00']) assert.ok(Number.isNaN(c.timestamp(v)), v);
  assert.ok(Number.isFinite(c.timestamp('2024-02-29T12:00:00-05:00')));
  assert.ok(Number.isNaN(c.timestamp('2025-02-29T12:00:00Z')));
});
test('start time is not substituted for missing update time', () => {
  const f = fresh(); delete f.features[0].properties.core_details.update_date;
  const r = assess(f);
  assert.ok(r.issues.some(i => i.code === 'UPDATE_MISSING'));
  assert.ok(!r.issues.some(i => i.code === 'EVENT_STALE'));
});
test('future planned starts are valid; future confirmations trigger review', () => {
  const f = fresh();
  f.features[0].properties.start_date = '2026-10-18T15:00:00Z';
  f.features[0].properties.end_date = '2026-10-19T15:00:00Z';
  assert.equal(assess(f).issues.length, 0);
  f.features[0].properties.core_details.update_date = '2026-10-18T15:00:00Z';
  assert.ok(assess(f).issues.some(i => i.code === 'UPDATE_FUTURE'));
});
test('old update timestamps fire configurable review flags', () => {
  const f = fresh(); f.features[0].properties.core_details.update_date = '2026-10-15T15:00:00Z';
  assert.ok(assess(f).issues.some(i => i.code === 'EVENT_STALE'));
  assert.ok(!c.analyze(f, { ...options, eventHours: 72 }).issues.some(i => i.code === 'EVENT_STALE'));
});
test('ended-event grace accounts for intentionally retained records', () => {
  const f = fresh(); f.features[0].properties.end_date = '2026-10-17T14:30:00Z';
  assert.ok(!assess(f).issues.some(i => i.code === 'EVENT_ENDED'));
  f.features[0].properties.end_date = '2026-10-17T13:30:00Z';
  assert.ok(assess(f).issues.some(i => i.code === 'EVENT_ENDED'));
});
test('invalid feed publication time is an error at feed scope', () => {
  const f = fresh(); f.feed_info.update_date = 'yesterday';
  const r = assess(f); assert.equal(r.summary.clear, 1); assert.equal(r.summary.feedFindings, 1);
  assert.ok(r.issues.some(i => i.code === 'FEED_TIME_INVALID' && i.index === null));
});
test('both WZDx metadata names are recognized without changing input', () => {
  const f = fresh(); f.road_event_feed_info = f.feed_info; delete f.feed_info;
  const before = JSON.stringify(f); assert.equal(assess(f).issues.length, 0); assert.equal(JSON.stringify(f), before);
});
test('geometry validation supports standard GeoJSON types and rejects malformed rings', () => {
  const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
  for (const g of [{ type: 'Point', coordinates: [0, 0, 10] }, { type: 'MultiPoint', coordinates: [[0, 0]] }, { type: 'LineString', coordinates: [[0, 0], [0, 1]] }, { type: 'Polygon', coordinates: [ring] }, { type: 'MultiPolygon', coordinates: [[ring]] }, { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]]] }, { type: 'GeometryCollection', geometries: [{ type: 'Point', coordinates: [1, 1] }] }]) assert.equal(c.geometryError(g), null, g.type);
  for (const g of [null, { type: '__proto__' }, { type: 'constructor' }, { type: 'Point', coordinates: [181, 0] }, { type: 'Point', coordinates: ['0', 0] }, { type: 'Point', coordinates: [0, Infinity] }, { type: 'LineString', coordinates: [[0, 0]] }, { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] }, { type: 'MultiLineString', coordinates: [] }]) assert.ok(c.geometryError(g));
});
test('generic events support documented aliases and actual missing paths', () => {
  const r = assess({ updated: now, events: [{ eventId: 'e1', roadName: 'I-80', type: 'closure', startTime: now, endTime: '2026-10-18T15:00:00Z', lastUpdated: now, latitude: 41.5, longitude: -93.5 }] });
  assert.equal(r.issues.length, 0); assert.equal(r.format, 'Event JSON');
});
test('findings preserve the paths of aliased fields', () => {
  const event = { eventId: 'same', roadName: [], type: 42, startTime: now, lastUpdated: 'bad', latitude: 41.5, longitude: -93.5 };
  const r = assess({ updated: now, events: [event, structuredClone(event)] });
  assert.ok(r.issues.some(i => i.code === 'ID_DUPLICATE' && i.path === '$.events[0].eventId'));
  assert.ok(r.issues.some(i => i.code === 'ROAD_MISSING' && i.path === '$.events[0].roadName'));
  assert.ok(r.issues.some(i => i.code === 'EVENT_TYPE_MISSING' && i.path === '$.events[0].type'));
  assert.ok(r.issues.some(i => i.code === 'TIME_INVALID' && i.path === '$.events[0].lastUpdated'));
});
test('unknown input envelopes, device feeds, and record excess are rejected', () => {
  for (const f of [null, {}, { features: [] }, { type: 'FeatureCollection', features: null }, { events: {} }]) assert.throws(() => assess(f), /Unsupported feed/);
  const f = fresh(); f.features[0].properties.core_details.device_type = 'arrow-board';
  assert.throws(() => assess(f), /device feed/);
  assert.throws(() => assess(Array(c.MAX_RECORDS + 1).fill(null)), /25,000/);
});
test('JSON parser handles BOM and rejects invalid or oversized text', () => {
  assert.deepEqual(c.parse('\uFEFF{"events":[]}'), { events: [] });
  assert.throws(() => c.parse('<html>error</html>'), /not valid JSON/);
  assert.throws(() => c.parse(' '.repeat(c.MAX_BYTES + 1)), /20 MB/);
});
test('invalid configuration is rejected rather than suppressing checks', () => {
  for (const n of [0, -1, 'no', Infinity, 90000]) assert.throws(() => c.analyze(fresh(), { ...options, eventHours: n }), /Thresholds/);
});
test('comparison reports additions, removals, and content changes', () => {
  const a = fresh(); a.features.push({ ...structuredClone(a.features[0]), id: 'removed' });
  const baseline = c.snapshot(assess(a));
  const b = fresh(); b.features[0].properties.core_details.description = 'Changed';
  b.features.push({ ...structuredClone(b.features[0]), id: 'added' });
  const result = c.compare(assess(b), baseline);
  assert.deepEqual(result.added, ['added']); assert.deepEqual(result.removed, ['removed']); assert.deepEqual(result.changed, ['FC-100']);
  assert.equal(result.recordDelta, 0);
});
test('comparison ignores JSON object key order', () => {
  const a = fresh(); const baseline = c.snapshot(assess(a));
  a.features[0] = Object.fromEntries(Object.entries(a.features[0]).reverse());
  assert.equal(c.compare(assess(a), baseline).unchanged, 1);
});
test('comparison refuses unrelated feeds and ambiguous record IDs', () => {
  const a = fresh(), r = assess(a), baseline = c.snapshot(r);
  assert.throws(() => c.compare({ ...r, source: 'other feed' }, baseline), /source differs/);
  a.features.push(structuredClone(a.features[0]));
  assert.throws(() => c.compare(assess(a), baseline), /unique/);
  assert.throws(() => c.validateSnapshot({ entries: [] }), /valid FeedCheck/);
});
test('snapshots omit raw records and retain safe source labels', () => {
  const r = c.analyze(fresh(), { ...options, source: 'https://user:secret@agency.gov/feed?api_key=hidden#fragment' });
  assert.equal(r.source, 'https://agency.gov/feed');
  const s = c.snapshot(r); assert.equal(s.entries.length, 1); assert.ok(!JSON.stringify(s).includes('coordinates'));
});
test('CSV quotes embedded content and neutralizes spreadsheet formulas', () => {
  const r = assess(fresh());
  r.source = '=HYPERLINK("bad")';
  r.issues = [{ severity: 'error', code: 'TEST', recordId: ' +SUM(1)', path: '$.events[0]', message: 'Hello,"world"\nNext', action: '@SUM(1)' }];
  const csv = c.csv(r);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"\' +SUM(1)"')); assert.ok(csv.includes('"\'@SUM(1)"'));
  assert.ok(csv.includes('"Hello,""world""\nNext"'));
});
test('build emits a standalone app without remote runtime assets', () => {
  execFileSync(process.execPath, [path.join(__dirname, '../build.cjs')]);
  const html = fs.readFileSync(path.join(__dirname, '../dist/feedcheck.html'), 'utf8');
  assert.ok(!html.includes('/* INLINE_')); assert.ok(!/<script[^>]+src=/.test(html));
  assert.ok(!/<link[^>]+(?:stylesheet|preload)/.test(html));
  assert.ok(html.includes('No upload to a server'));
});
test('CLI produces reports and snapshots, honors failure codes, and refuses input overwrite', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedcheck-test-'));
  const input = path.join(dir, 'input.json');
  fs.writeFileSync(input, JSON.stringify(c.sample()));
  const cli = path.join(__dirname, '../cli.cjs');
  let r = spawnSync(process.execPath, [cli, '--input', input, '--fail-on', 'error', '--snapshot', path.join(dir, 'snapshot.json')], { encoding: 'utf8' });
  assert.equal(r.status, 1, r.stderr); assert.equal(JSON.parse(r.stdout).summary.records, 6);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'snapshot.json'))).kind, 'purposebuilt-feedcheck-snapshot');
  r = spawnSync(process.execPath, [cli, '--input', input, '--output', input], { encoding: 'utf8' });
  assert.equal(r.status, 2); assert.match(r.stderr, /paths must be different/);
  assert.equal(JSON.parse(fs.readFileSync(input)).features.length, 6);
  r = spawnSync(process.execPath, [cli, '--input', input, '--format', 'invalid'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});
