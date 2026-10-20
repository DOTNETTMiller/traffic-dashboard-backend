const normal = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
function sourcePoint(feature) {
  if (!['epsg:4326', 'wgs84', 'wgs 84'].includes(normal(feature.properties?.horizontalDatum))) return null;
  if (normal(feature.geometry?.type) !== 'point') return null;
  const raw = feature.geometry.coordinates;
  const point = Array.isArray(raw?.[0]) ? raw[0] : raw;
  return Array.isArray(point) && point.length >= 2 && point.slice(0, 2).every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90 ? point : null;
}
export function suggestDruMatches(feature, assets) {
  const point = sourcePoint(feature), sourceId = normal(feature.sourceAssetId);
  return assets.flatMap(asset => {
    if (asset.fieldEvidence?.some(e => e.source === 'DRU' && normal(e.sourceAssetId) === sourceId) || normal(asset.id) === sourceId) return [{ assetId: asset.id, name: asset.name, rank: 3, reason: 'Same DRU asset ID' }];
    if (normal(asset.name) && normal(asset.name) === normal(feature.name)) return [{ assetId: asset.id, name: asset.name, rank: 2, reason: 'Same equipment name' }];
    const lat = asset.device?.latitude, lon = asset.device?.longitude;
    if (!point || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || asset.type !== feature.suggestedType || asset.type === 'other') return [];
    const rad = Math.PI / 180, dLat = (lat - point[1]) * rad, dLon = (lon - point[0]) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(point[1] * rad) * Math.sin(dLon / 2) ** 2;
    const meters = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    return meters <= 75 ? [{ assetId: asset.id, name: asset.name, rank: 1, distance: meters, reason: `Same type · ${Math.round(meters)} m from capture` }] : [];
  }).sort((a, b) => b.rank - a.rank || (a.distance || 0) - (b.distance || 0) || a.name.localeCompare(b.name)).slice(0, 3);
}
