'use strict';
// Import a bounded, offline snapshot. No routing service is needed at runtime.
const fs = require('node:fs');
const path = require('node:path');
const turf = require('@turf/turf');
const source = 'https://gis.iowadot.gov/agshost/rest/services/RAMS/All_Routes/FeatureServer/0';
const bbox = [-93.70, 41.64, -93.44, 41.77];

async function main() {
  const query = new URL(source + '/query');
  for (const [key, value] of Object.entries({ where: "OFFICIAL_ROUTE_NUMBER IN (80,35) AND OFFICIAL_ROUTE_PREFIX='I' AND RAMP_CLASSIFICATION='N'", geometry: bbox.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'ROUTE_ID,ROUTE_NAME,OFFICIAL_ROUTE_NUMBER,OFFICIAL_ROUTE_DIRECTION,RAMP_CLASSIFICATION', returnGeometry: 'true', outSR: '4326', f: 'geojson' })) query.searchParams.set(key, value);
  const response = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : await fetch(query, { signal: AbortSignal.timeout(30000) }).then(r => { if (!r.ok) throw new Error('DOT query failed: ' + r.status); return r.json(); });
  if (!response.features || response.error || response.exceededTransferLimit) throw new Error('Incomplete or invalid DOT geometry response.');
  const features = [];
  for (const [number, code, direction] of [[80, 'E', 'eastbound'], [80, 'W', 'westbound'], [35, 'N', 'northbound'], [35, 'S', 'southbound']]) {
    // The service also returns overlapping municipal/concurrent route records.
    // Select the statewide directional mainline; never stitch unrelated pieces.
    const candidates = response.features.filter(f => f.properties.OFFICIAL_ROUTE_NUMBER === number && f.properties.OFFICIAL_ROUTE_DIRECTION === code && f.properties.RAMP_CLASSIFICATION === 'N' && f.properties.ROUTE_NAME === `STATE OF IOWA, I ${number} ${code}`);
    candidates.sort((a, b) => turf.length(b) - turf.length(a));
    if (!candidates.length) throw new Error('Missing mainline: I-' + number + ' ' + code);
    const clipped = turf.bboxClip(candidates[0], bbox);
    const parts = clipped.geometry.type === 'LineString' ? [clipped.geometry.coordinates] : clipped.geometry.coordinates;
    for (const [index, coordinates] of parts.entries()) {
      if (coordinates.length < 2) continue;
      features.push({ type: 'Feature', properties: { id: `IADOT-I${number}-${code}-${index + 1}`, route: `I-${number}`, direction, sourceRouteId: candidates[0].properties.ROUTE_ID }, geometry: { type: 'LineString', coordinates: coordinates.map(p => p.map(n => Number(n.toFixed(7)))) } });
    }
  }
  const result = { type: 'FeatureCollection', metadata: { source: 'Iowa DOT RAMS All Routes', sourceUrl: source, queryUrl: query.href, retrievedAt: new Date().toISOString(), bbox, method: 'Directional statewide mainlines clipped to the corridor bounding box; original vertices retained at 7 decimal places.', use: 'Road alignment reference. Events, asset placements and operations remain simulated; not surveyed or commissioned locations.' }, features };
  const target = path.join(__dirname, '../products/atms/fixtures/des-moines-road-alignment.geojson');
  fs.writeFileSync(target, JSON.stringify(result) + '\n');
  console.log(`Saved ${features.length} road segments, ${features.reduce((n, f) => n + f.geometry.coordinates.length, 0)} vertices to ${target}`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
