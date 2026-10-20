'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { Operations } = require('../../services/atms/core');
const { validator, PROFILES } = require('../../services/atms/feed-publisher');
const a = { id: 'operator', agency: 'A', role: 'operator' }, s = { ...a, id: 'supervisor', role: 'supervisor' }, v = { ...a, id: 'viewer', role: 'viewer' };
function setup(t, filename = ':memory:') { let clock = Date.parse('2026-10-18T14:00:00Z'); const ops = new Operations({ mode: 'training', filename, now: () => clock }); t.after(() => ops.close()); return { ops, advance: ms => { clock += ms; } }; }
function config(ops, extra = {}) { return ops.saveFeedConfig(s, { version: ops.get('A', 'feed-config', 'publisher')?.version || 0, publisher: 'Synthetic test agency', contactName: 'Test desk', contactEmail: 'test@example.invalid', license: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceOrganization: 'Synthetic test agency', dataSourceId: 'test-agency', updateFrequency: 300, ...extra }); }
function incident(ops, eventType = 'work-zone', extra = {}) {
 let i = ops.createIncident(a, { title: 'Test work zone', route: 'I-80', direction: 'eastbound', kind: 'closure', latitude: 41, longitude: -93 });
 i = ops.changeIncident(a, i.id, { action: 'claim', version: i.version, note: 'Assigned synthetic test incident.' });
 i = ops.changeIncident(a, i.id, { action: 'transition', status: 'verified', version: i.version, note: 'Verified test scenario.' });
 i = ops.changeGeometry(a, i.id, { action: 'replace', version: i.version, geometry: { type: 'LineString', coordinates: [[-93, 41], [-92.99, 41]] }, note: 'Synthetic roadway limits.' });
 i = ops.changeGeometry(a, i.id, { action: 'review', version: i.version, note: 'Reviewed synthetic roadway and limits.' });
 const d = ops.saveFeedDetails(a, i.id, { version: 0, incidentVersion: i.version, eventType, startDate: new Date(ops.now() - 3600000).toISOString(), endDate: new Date(ops.now() + 3600000).toISOString(), observedAt: ops.iso(), vehicleImpact: 'all-lanes-closed', locationMethod: 'sign-method', uniformSegmentConfirmed: true, publicDescription: 'Road work ahead.', note: 'Explicit synthetic classification and observation.', ...extra });
 return { i, d };
}
function publish(ops, profile, extra = {}) { const p = ops.previewFeed(s, profile); return ops.publishFeed(s, profile, { previewHash: p.previewHash, note: 'Approved synthetic feed snapshot.', ...extra }); }
test('both released profiles validate against the exact pinned schemas with honest verification flags', t => {
 const { ops, advance } = setup(t); config(ops); const { i } = incident(ops);
 for (const profile of PROFILES) {
  const preview = ops.previewFeed(v, profile); assert.equal(preview.readyCount, 1, JSON.stringify(preview)); assert.deepEqual(preview.globalIssues, []);
  advance(1000); const p = ops.publishFeed(s, profile, { previewHash: preview.previewHash, note: 'Reviewed synthetic release.' });
  assert.equal(validator(profile)(p.feed), true); assert.equal(ops.publishedFeed('A', profile).feed.features[0].id, i.id);
  assert.equal(p.feed.features[0].properties.is_start_position_verified, false); assert.equal(p.feed.features[0].properties.is_end_date_verified, false);
  assert.equal(p.feed.x_training, true); assert.equal(JSON.stringify(p.feed).includes('preparedBy'), false); assert.equal(JSON.stringify(p.feed).includes('Explicit synthetic classification'), false);
 }
 assert.equal(ops.verifyAudit('A').valid, true);
});
test('ordinary incidents are not silently classified as work zones, and empty publication requires actual observation', t => {
 const { ops } = setup(t); config(ops); ops.createIncident(a, { title: 'Disabled vehicle', route: 'I-80', latitude: 41, longitude: -93 });
 assert.equal(ops.previewFeed(s, PROFILES[0]).selectedCount, 0);
 assert.throws(() => publish(ops, PROFILES[0], { allowEmpty: true }), /empty-inventory/);
 config(ops, { emptyObservedAt: ops.iso() });
 assert.throws(() => publish(ops, PROFILES[0]), /empty-feed/);
 for (const profile of PROFILES) assert.equal(publish(ops, profile, { allowEmpty: true }).feed.features.length, 0);
});
test('missing publisher identity blocks release and another agency cannot read the snapshot', t => {
 const { ops } = setup(t); incident(ops);
 assert.throws(() => publish(ops, PROFILES[0]), /publisher/);
 config(ops); publish(ops, PROFILES[0]); assert.throws(() => ops.publishedFeed('B', PROFILES[0]), /No released/);
 assert.throws(() => ops.saveFeedConfig(a, {}), /supervisor/);
 assert.throws(() => ops.publishFeed(a, PROFILES[0], {}), /supervisor/);
 assert.throws(() => ops.saveFeedDetails(v, ops.list('A', 'incident')[0].id, {}), /operator/);
});
test('lane coverage, ordering, segmentation, UTC dates, and actual observation freshness are enforced', t => {
 const { ops, advance } = setup(t); config(ops);
 const { i, d } = incident(ops, 'work-zone', { uniformSegmentConfirmed: false, lanes: [{ order: 2, type: 'driving', status: 'closed' }], totalLanes: 2, laneOrderConfirmed: false, startDate: '2026-10-18T09:00:00-05:00' });
 let row = ops.previewFeed(s, PROFILES[0]).rows.find(r => r.incidentId === i.id);
 assert.ok(row.issues.some(x => x.includes('uniform'))); assert.ok(row.issues.some(x => x.includes('every lane'))); assert.ok(row.issues.some(x => x.includes('leftmost'))); assert.ok(row.issues.some(x => x.includes('UTC')));
 advance(16 * 60000); row = ops.previewFeed(s, PROFILES[0]).rows[0]; assert.ok(row.issues.some(x => x.includes('observation time')));
 assert.throws(() => ops.saveFeedDetails(a, i.id, { ...d, version: 0, incidentVersion: i.version, note: 'Attempt stale draft' }), /details changed/);
});
test('partial releases require an explicit decision; optional payload is never invented or required on detours', t => {
 const { ops } = setup(t); config(ops); incident(ops); incident(ops, 'work-zone', { endDate: '' }); incident(ops, 'detour');
 const p = ops.previewFeed(s, PROFILES[0]); assert.equal(p.readyCount, 2); assert.equal(p.heldCount, 1);
 assert.equal(p.rows.find(r => r.details.eventType === 'detour').warnings.length, 0);
 assert.equal(p.sources[0].workZones, 2);
 assert.throws(() => publish(ops, PROFILES[0]), /partial feed/);
 const release = publish(ops, PROFILES[0], { allowPartial: true }); assert.equal(release.feed.features.length, 2);
 assert.equal(Object.hasOwn(release.feed.features.find(f => f.properties.core_details.event_type === 'work-zone').properties, 'worker_presence'), false);
});
test('a verification claim needs separate evidence and schema-invalid observations are held', t => {
 const { ops } = setup(t); config(ops); incident(ops, 'work-zone', { is_start_position_verified: true, worker_presence: { are_workers_present: 'probably' } });
 const row = ops.previewFeed(s, PROFILES[0]).rows[0];
 assert.ok(row.issues.some(x => x.includes('explicit physical-position'))); assert.ok(row.issues.some(x => x.includes('must be boolean')));
});
test('expired snapshots and withdrawn snapshots never become a misleading empty 200 feed', t => {
 const { ops, advance } = setup(t); config(ops); incident(ops); const p = publish(ops, PROFILES[0]);
 ops.withdrawFeed(s, PROFILES[0], { version: p.version, note: 'Withdraw test release.' }); assert.throws(() => ops.publishedFeed('A', PROFILES[0]), /No released/);
 publish(ops, PROFILES[0]); advance(301000); assert.throws(() => ops.publishedFeed('A', PROFILES[0]), /stale/);
});
test('geometry or publication changes invalidate release and stale preview approvals cannot publish', t => {
 const { ops } = setup(t); config(ops); const { i, d } = incident(ops); const preview = ops.previewFeed(s, PROFILES[0]); publish(ops, PROFILES[0]);
 ops.saveFeedDetails(a, i.id, { ...d, version: d.version, incidentVersion: i.version, publicDescription: 'Updated public notice.', note: 'Updated test description.' });
 assert.throws(() => ops.publishedFeed('A', PROFILES[0]), /event changed/);
 assert.throws(() => ops.publishFeed(s, PROFILES[0], { previewHash: preview.previewHash, note: 'Stale approval' }), /preview changed/);
 publish(ops, PROFILES[0]); ops.changeGeometry(a, i.id, { action: 'replace', version: i.version, geometry: { type: 'LineString', coordinates: [[-93, 41], [-92.98, 41]] }, note: 'New synthetic geometry' });
 assert.throws(() => ops.publishedFeed('A', PROFILES[0]), /event changed/);
});
test('publisher configuration changes invalidate snapshots and credentials cannot be substituted for metadata', t => {
 const { ops } = setup(t); config(ops); incident(ops); publish(ops, PROFILES[0]); config(ops, { publisher: 'Updated agency name' });
 assert.throws(() => ops.publishedFeed('A', PROFILES[0]), /configuration changed/);
 assert.throws(() => config(ops, { contactEmail: 'not-an-email' }), /actual public feed contact/);
 assert.throws(() => config(ops, { license: 'javascript:alert(1)' }), /license URL/);
});
test('schema validator rejects wrong geometry, invalid enums, and invalid timestamps independently of publication checks', t => {
 const { ops } = setup(t); config(ops); incident(ops);
 for (const profile of PROFILES) {
  const feed = ops.previewFeed(s, profile).feed;
  let bad = structuredClone(feed); bad.features[0].geometry.type = 'Polygon'; assert.equal(validator(profile)(bad), false);
  bad = structuredClone(feed); bad.features[0].properties.vehicle_impact = 'made-up'; assert.equal(validator(profile)(bad), false);
  bad = structuredClone(feed); bad.features[0].properties.start_date = '2026-02-31T00:00:00Z'; assert.equal(validator(profile)(bad), false);
 }
});
test('released artifacts survive database reopen and retain schema-valid payload and audit proof', t => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atms-feed-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
 const { ops } = setup(t, path.join(dir, 'ops.sqlite')); config(ops); incident(ops); const first = publish(ops, PROFILES[0]);
 const restored = new Operations({ filename: path.join(dir, 'ops.sqlite'), mode: 'training', now: ops.now }); t.after(() => restored.close());
 assert.equal(restored.publishedFeed('A', PROFILES[0]).sha256, first.sha256); assert.equal(restored.verifyAudit('A').valid, true);
});
test('source observations are preserved for explicit review without manufacturing update time or classification', t => {
 const { ops } = setup(t);
 const raw = { id: 'source', state: 'IA', route: 'I-80', latitude: 41, longitude: -93, worker_presence: { are_workers_present: false }, startTime: '2026-10-18T13:00:00Z', endTime: '2026-10-18T15:00:00Z' };
 ops.ingest('A', { observedAt: ops.iso(), events: [raw] });
 const source = ops.get('A', 'event', 'IA:source').feedSource;
 assert.deepEqual(source.worker_presence, raw.worker_presence); assert.equal(source.startDate, raw.startTime);
 assert.equal(Object.hasOwn(source, 'observedAt'), false); assert.equal(Object.hasOwn(source, 'eventType'), false);
});
test('published artifact corruption fails closed and archived releases retain their original hashes', t => {
 const { ops, advance } = setup(t); config(ops); incident(ops); const first = publish(ops, PROFILES[0]); advance(1000); publish(ops, PROFILES[0]);
 assert.deepEqual(ops.get('A', 'feed-artifact', first.sha256).feed, first.feed);
 const current = ops.get('A', 'feed-publication', PROFILES[0]); current.feed.features[0].properties.core_details.road_names = ['TAMPERED']; ops.put('A', 'feed-publication', current, current.version);
 assert.throws(() => ops.publishedFeed('A', PROFILES[0]), /integrity/);
});
test('public endpoints require explicit live-mode configuration and never expose internal previews', async t => {
 const express = require('express'); const { createRouter } = require('../../services/atms/router');
 const ops = new Operations({ mode: 'live' }); t.after(() => ops.close()); config(ops); const { i } = incident(ops); publish(ops, PROFILES[0]);
 async function server(publicFeedAgency) {
  const app = express(); app.use('/api/atms', createRouter({ ops, publicFeedAgency, authenticate: (req, res) => res.status(401).json({ error: 'Individual sign-in required.' }), resolveActor: () => a }));
  const http = await new Promise(resolve => { const current = app.listen(0, '127.0.0.1', () => resolve(current)); }); t.after(() => new Promise(resolve => http.close(resolve)));
  return 'http://127.0.0.1:' + http.address().port + '/api/atms';
 }
 const disabled = await server(null); assert.equal((await fetch(disabled + '/feeds/public/wzdx-4.2')).status, 401);
 const enabled = await server('A'); let response = await fetch(enabled + '/feeds/public/wzdx-4.2?agency=B');
 assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/geo\+json/); assert.equal(response.headers.get('access-control-allow-origin'), '*');
 const body = await response.json(); assert.equal(body.features[0].id, i.id); assert.equal(JSON.stringify(body).includes('reviewedBy'), false);
 assert.equal((await fetch(enabled + '/feeds/wzdx-4.2/preview')).status, 401);
 ops.put('A', 'incident', { ...i, status: 'resolved' }, i.version);
 response = await fetch(enabled + '/feeds/public/wzdx-4.2'); assert.equal(response.status, 503); assert.equal((await response.json()).type, undefined);
});
