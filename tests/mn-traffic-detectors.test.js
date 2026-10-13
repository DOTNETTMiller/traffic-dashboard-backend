const test = require('node:test');
const assert = require('node:assert/strict');
const mn = require('../services/mn-traffic-detectors');
const cwz = require('../services/cwz-roadevent-feed');

const NOW = Date.parse('2026-10-12T22:48:30Z');
const CONFIG = `<tms_config time_stamp="Sun Oct 11 20:00:04 CDT 2026">
 <corridor route="I-35W" dir="NB"><r_node name="n1" station_id="S1" lon="-93.28" lat="44.90" s_limit="65">
 <detector name="D1" lane="1"/><detector name="D2" category="Parking"/>
 <detector name="D3" abandoned="t"/></r_node>
 <r_node name="ramp" n_type="Exit" lon="-93.28" lat="44.90"><detector name="D4"/></r_node></corridor>
 <corridor route="I-35W" dir="SB"><r_node name="n2" station_id="S2" lon="-93.281" lat="44.90"><detector name="D5"/></r_node></corridor>
 <dms name="V1" description="I-35W NB N of Example Rd" lon="-93.28" lat="44.9"/>
 <dms name="V2" description="I-35W SB" lon="-93.281" lat="44.9"/>
 </tms_config>`;
const samples = (rows, at = 'Mon Oct 12 17:48:30 CDT 2026') =>
  `<traffic_sample time_stamp="${at}" period="30">${rows}</traffic_sample>`;
const DETECTORS = samples('<sample sensor="D1" speed="UNKNOWN" flow="0" occ="0"/><sample sensor="D5" speed="50" flow="100"/>');
const STATIONS = samples('<sample sensor="S1" speed="40" flow="720" occ="25"/><sample sensor="S2" speed="50" flow="100"/><sample sensor="UNKNOWN"/>');
const event = extra => ({ id: 'mn-zone', state: 'Minnesota DOT', eventType: 'construction',
  corridor: 'I-35W', direction: 'northbound', coordinates: [-93.28, 44.90],
  startTime: '2026-10-12T20:00:00Z', endTime: '2026-10-13T00:00:00Z', ...extra });

test('joins location metadata, excludes ramps/parking/abandoned sensors, and prefers station readings', async () => {
  const c = await mn.parseConfig(CONFIG);
  assert.deepEqual([...c.detectors.keys()], ['D1', 'D5']);
  const rows = mn.join(c, await mn.parseSamples(DETECTORS), await mn.parseSamples(STATIONS), NOW);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'S1');
  assert.equal(rows[0].flowVph, 720);
  assert.equal(rows[0].route, 'I-35W');
});
test('missing readings remain null and measured zeros remain zero', async () => {
  const s = await mn.parseSamples(DETECTORS);
  assert.deepEqual([s.rows[0].speedMph, s.rows[0].flowVph, s.rows[0].occupancyPct], [null, 0, 0]);
  const c = await mn.parseConfig(CONFIG);
  const rows = mn.join(c, s, { rows: [] }, NOW);
  assert.equal(rows[0].kind, 'detector');
});
test('timestamps use published Central offsets regardless of server timezone', () => {
  assert.equal(mn.timestamp('Mon Oct 12 17:48:30 CDT 2026'), '2026-10-12T22:48:30.000Z');
  assert.equal(mn.timestamp('Mon Jan 12 17:48:30 CST 2026'), '2026-01-12T23:48:30.000Z');
  assert.equal(mn.timestamp('UNKNOWN'), null);
});
test('evidence matching requires the same route, carriageway and recent time, and never promotes a zone', async () => {
  const c = await mn.parseConfig(CONFIG);
  const rows = mn.join(c, await mn.parseSamples(DETECTORS), await mn.parseSamples(STATIONS), NOW);
  const yes = event(), otherRoad = event({ corridor: 'I-35' }), unknownDir = event({ direction: 'both' }),
    elsewhere = event({ coordinates: [-94, 45] }), future = event({ startTime: '2026-10-14T00:00:00Z' }),
    ended = event({ endTime: '2026-10-11T00:00:00Z' });
  mn.annotate([yes, otherRoad, unknownDir, elsewhere, future, ended], rows, { now: NOW });
  assert.equal(yes.x_traffic_measurements.length, 1);
  assert.equal(yes.x_traffic_measurements[0].id, 'S1');
  assert.equal(yes.x_cwz_connected, undefined);
  for (const ev of [otherRoad, unknownDir, elsewhere, future, ended]) assert.equal(ev.x_traffic_measurements, undefined);
  mn.annotate([yes], rows, { now: NOW + mn.MAX_AGE + 1 });
  assert.equal(yes.x_traffic_measurements, undefined);
});
test('measurements export with freshness checks without increasing validation counts', () => {
  const ev = event({ x_camera_verified: true, x_traffic_measurements: [{ id: 'S1', observedAt: new Date(NOW).toISOString() }] });
  const p = cwz.buildFeed([ev], { now: NOW }).features[0].properties;
  assert.equal(p.x_traffic_measurements.length, 1);
  assert.deepEqual(p.x_verification, ['camera']);
  assert.equal(p.x_verification_count, 1);
  assert.equal(cwz.buildFeed([ev], { now: NOW + mn.MAX_AGE + 1 }).features[0].properties.x_traffic_measurements, undefined);
});
test('overlapping requests share fetches, samples refresh, and source errors expire evidence', async () => {
  let now = NOW, calls = 0, fail = false;
  const client = mn.createClient({ clock: () => now, fetcher: async url => {
    calls++;
    await Promise.resolve();
    if (fail) throw new Error('feed unavailable');
    return url === mn.URLS.config ? CONFIG : url === mn.URLS.detectors ? DETECTORS : STATIONS;
  } });
  const out = await Promise.all([client.snapshot(), client.snapshot()]);
  assert.equal(calls, 3);
  assert.equal(out[0].status, 'ok');
  now += 31000; fail = true;
  const degraded = await client.snapshot();
  assert.equal(degraded.status, 'degraded');
  assert.equal(degraded.rows.length, 2);
  assert.equal(calls, 5); // configuration stays cached
  await client.snapshot(); assert.equal(calls, 5); // retry backoff
  now += mn.MAX_AGE;
  const stale = await client.snapshot();
  assert.equal(stale.rows.length, 0);
  assert.equal(stale.status, 'unavailable');
});
test('a malformed or timestamp-free feed is rejected rather than becoming current evidence', async () => {
  await assert.rejects(mn.parseSamples('<traffic_sample><sample sensor="D1" flow="1"/></traffic_sample>'), /timestamp/);
  await assert.rejects(mn.parseSamples('<traffic_sample>'));
  assert.equal(mn.fresh({ observedAt: new Date(NOW + 120000).toISOString() }, NOW), false);
});
test('live sign messages join to coordinates; inactive messages do not become displaying signs', async () => {
  let now = NOW;
  const signs = `<sign_messages time_stamp="Mon Oct 12 17:48:30 CDT 2026">
    <sign_message dms="V1" status="All, Active, Scheduled" multi="LANE CLOSED[nl]MERGE RIGHT"/>
    <sign_message dms="V2" status="Inactive" multi="OLD MESSAGE"/>
    <sign_message dms="missing-location" status="Active" multi="ROAD WORK"/>
    </sign_messages>`;
  const client = mn.createClient({ clock: () => now, fetcher: async url => url === mn.URLS.config ? CONFIG : signs });
  const rows = await client.fetchSigns();
  assert.equal(rows.length, 2);
  assert.equal(rows[0].mode.pattern, 'LANE CLOSED / MERGE RIGHT');
  assert.deepEqual(rows[0].coordinates, [-93.28, 44.9]);
  assert.equal(rows[0].direction, 'N');
  assert.equal(rows[1].mode.displaying, false);
  assert.equal(rows[1].mode.pattern, null);
  now += mn.MAX_AGE + 1;
  assert.deepEqual(await client.fetchSigns(), []);
});
test('a precise signed route overrides a broad corridor label when attaching measurements', async () => {
  const c = await mn.parseConfig(CONFIG);
  const rows = mn.join(c, await mn.parseSamples(DETECTORS), await mn.parseSamples(STATIONS), NOW);
  const ev = event({ corridor: 'I-35', route: 'I-35W' });
  assert.equal(mn.annotate([ev], rows, { now: NOW }).matchedZones, 1);
});
