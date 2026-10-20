'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const turf = require('@turf/turf');
const { road, station, signLocations } = require('../../services/atms/simulation/road-alignment');
const { SimulatedWorld } = require('../../services/atms/simulation/world');

test('offline DOT alignment retains curves, directional carriageways and source provenance', () => {
  assert.match(road.metadata.sourceUrl, /^https:\/\/gis\.iowadot\.gov\//);
  assert.ok(Number.isFinite(Date.parse(road.metadata.retrievedAt)));
  const expected = ['I-80:eastbound', 'I-80:westbound', 'I-35:northbound', 'I-35:southbound'];
  assert.deepEqual(road.features.map(f => f.properties.route + ':' + f.properties.direction).sort(), expected.sort());
  for (const f of road.features) {
    assert.ok(f.geometry.coordinates.length > 30, 'Keep detailed mainline curves');
    for (const [x, y] of f.geometry.coordinates) { assert.ok(x >= road.metadata.bbox[0] && x <= road.metadata.bbox[2]); assert.ok(y >= road.metadata.bbox[1] && y <= road.metadata.bbox[3]); }
    for (let i = 1; i < f.geometry.coordinates.length; i++) assert.ok(turf.distance(f.geometry.coordinates[i - 1], f.geometry.coordinates[i]) < 2, 'No long fabricated connectors');
  }
});

test('simulated signs, camera, responder, CAD and affected limits use the actual route alignment', () => {
  const world = new SimulatedWorld(), snapshot = world.snapshot();
  const onRoute = (p, route, direction) => {
    const line = road.features.find(f => f.properties.route === route && f.properties.direction === direction);
    assert.ok(turf.nearestPointOnLine(line, p, { units: 'meters' }).properties.dist < .1);
  };
  for (const sign of signLocations) onRoute(sign.location, sign.route, sign.direction);
  for (const asset of [...snapshot.cameras, ...snapshot.responders]) onRoute([asset.longitude, asset.latitude], 'I-80', 'eastbound');
  onRoute(snapshot.cad[0].location, 'I-80', 'eastbound');
  const geometry = world.batch().events[0].geometry;
  assert.deepEqual(geometry, snapshot.affectedGeometry);
  for (const p of geometry.coordinates) onRoute(p, 'I-80', 'eastbound');
  assert.ok(turf.nearestPointOnLine(geometry, snapshot.cad[0].location, { units: 'meters' }).properties.dist < .1);
  assert.notDeepEqual(station('I-80', 'eastbound', .2), station('I-80', 'westbound', .8));
  world.configure({ scene: 'clear' }); assert.equal(world.snapshot().affectedGeometry, null);
});

test('corridor projection fits every vertex, preserves local scale and keeps separate parts separate', async () => {
  const { corridorProjection, lineParts } = await import('../../frontend/src/atms/simulationGeometry.mjs');
  const project = corridorProjection(road.features);
  for (const f of road.features) for (const p of f.geometry.coordinates) {
    const [x, y] = project(p); assert.ok(x >= 61.9 && x <= 898.1); assert.ok(y >= 61.9 && y <= 448.1);
  }
  const a = project([-93.6, 41.7]), east = project([-93.599, 41.7]), north = project([-93.6, 41.701]);
  assert.ok(east[0] > a[0]); assert.ok(north[1] < a[1]);
  assert.ok(Math.abs((east[0] - a[0]) / (a[1] - north[1]) - Math.cos(41.7 * Math.PI / 180)) < .001);
  const parts = [[[0, 0], [1, 1]], [[10, 10], [11, 11]]];
  assert.deepEqual(lineParts({ type: 'MultiLineString', coordinates: parts }), parts);
});
