'use strict';
const turf = require('@turf/turf');
const road = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '../../../products/atms/fixtures/des-moines-road-alignment.geojson'), 'utf8'));
function routeLine(route, direction) {
  const feature = road.features.find(f => f.properties.route === route && f.properties.direction === direction);
  if (!feature) throw new Error('Missing simulation road alignment.');
  return feature;
}
function station(route, direction, fraction) {
  const line = routeLine(route, direction);
  return turf.along(line, turf.length(line) * fraction).geometry.coordinates;
}
function affectedGeometry() {
  const line = routeLine('I-80', 'eastbound'), length = turf.length(line);
  return turf.lineSliceAlong(line, length * .62, length * .82).geometry;
}
const signLocations = [
  ['TRAIN-DMS-01', 'I-80', 'eastbound', .18],
  ['TRAIN-DMS-02', 'I-35', 'southbound', .23],
  ['TRAIN-DMS-03', 'I-80', 'westbound', .12]
].map(([id, route, direction, fraction]) => ({ id, route, direction, location: station(route, direction, fraction), simulatedPlacement: true }));
module.exports = { road, station, affectedGeometry, signLocations };
