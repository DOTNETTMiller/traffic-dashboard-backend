'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const matcher = import('../../frontend/src/atms/dru-matching.mjs');
const feature = { sourceAssetId: 'ABC', name: 'North cabinet', suggestedType: 'cabinet', properties: { horizontalDatum: 'EPSG:4326' }, geometry: { type: 'point', coordinates: [-93.6, 41.5] } };
test('DRU equipment suggestions rank source identity above name and proximity', async () => {
  const { suggestDruMatches } = await matcher;
  const assets = [{ id: 'near', type: 'cabinet', name: 'Nearby cabinet', device: { latitude: 41.5001, longitude: -93.6 } }, { id: 'name', name: 'North cabinet' }, { id: 'prior', name: 'Renamed installation', fieldEvidence: [{ source: 'DRU', sourceAssetId: 'abc' }] }];
  const before = JSON.stringify(assets);
  assert.deepEqual(suggestDruMatches(feature, assets).map(m => m.assetId), ['prior', 'name', 'near']);
  assert.equal(JSON.stringify(assets), before);
});
test('DRU proximity suggestions require declared WGS84, valid coordinates and compatible equipment', async () => {
  const { suggestDruMatches } = await matcher;
  const asset = { id: 'near', type: 'cabinet', name: 'Nearby', device: { latitude: 41.5001, longitude: -93.6 } };
  for (const datum of ['', 'EPSG:26915']) assert.equal(suggestDruMatches({ ...feature, properties: { horizontalDatum: datum } }, [asset]).length, 0);
  assert.equal(suggestDruMatches(feature, [{ ...asset, type: 'camera' }]).length, 0);
  assert.equal(suggestDruMatches(feature, [{ ...asset, device: { latitude: null, longitude: null } }]).length, 0);
  assert.equal(suggestDruMatches(feature, [{ ...asset, device: { latitude: 42, longitude: -93.6 } }]).length, 0);
  assert.equal(suggestDruMatches({ ...feature, geometry: { type: 'lineString', coordinates: [[-93.6, 41.5], [-93.6, 41.51]] } }, [asset]).length, 0);
});
test('DRU suggestions retain ambiguity and never equate an asset class with identity', async () => {
  const { suggestDruMatches } = await matcher;
  assert.equal(suggestDruMatches(feature, [{ id: 'a', name: 'Other cabinet', type: 'cabinet' }]).length, 0);
  const ambiguous = [{ id: 'a', name: 'North cabinet' }, { id: 'b', name: 'North cabinet' }];
  assert.equal(suggestDruMatches(feature, ambiguous).length, 2);
  assert.equal(suggestDruMatches({ ...feature, geometry: { type: 'point', coordinates: [[-93.6, 41.5]] } }, [{ id: 'n', name: 'Nearby', type: 'cabinet', device: { latitude: 41.5, longitude: -93.6 } }])[0].assetId, 'n');
});
