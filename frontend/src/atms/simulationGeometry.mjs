// The same projection is used for road vertices, affected limits, and assets.
// Mercator preserves local shape; one scale fits both axes without stretching.
export const lineParts = geometry => geometry?.type === 'LineString' ? [geometry.coordinates] : geometry?.type === 'MultiLineString' ? geometry.coordinates : [];
const mercator = ([lon, lat]) => [lon * Math.PI / 180, Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, lat)) * Math.PI / 360))];
export function corridorProjection(features, width = 960, height = 510, padding = 62) {
  const points = features.flatMap(f => lineParts(f.geometry).flat()).map(mercator);
  if (!points.length) return () => [width / 2, height / 2];
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((width - padding * 2) / Math.max(maxX - minX, 1e-9), (height - padding * 2) / Math.max(maxY - minY, 1e-9));
  return point => {
    const [x, y] = mercator(point);
    return [width / 2 + (x - (minX + maxX) / 2) * scale, height / 2 - (y - (minY + maxY) / 2) * scale];
  };
}
