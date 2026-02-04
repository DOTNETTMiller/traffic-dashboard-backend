const shapefile = require('shapefile');

const SHAPEFILE_PATH = '/Users/mattmiller/Downloads/NTAD_North_American_Roads_-6941702301048783378/North_American_Roads.shp';

async function inspectShapefile() {
  console.log('Inspecting first 20 features...\n');

  const source = await shapefile.open(SHAPEFILE_PATH);

  for (let i = 0; i < 20; i++) {
    const result = await source.read();
    if (result.done) break;

    const feature = result.value;
    console.log(`\nFeature ${i + 1}:`);
    console.log('Properties:', JSON.stringify(feature.properties, null, 2));
    console.log('Geometry type:', feature.geometry?.type);
    if (feature.geometry?.coordinates) {
      console.log(`Coordinates: ${feature.geometry.coordinates.length} points`);
    }
  }
}

inspectShapefile().catch(console.error);
