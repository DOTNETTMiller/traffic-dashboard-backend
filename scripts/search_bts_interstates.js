const shapefile = require('shapefile');

const SHAPEFILE_PATH = '/Users/mattmiller/Downloads/NTAD_North_American_Roads_-6941702301048783378/North_American_Roads.shp';

async function searchInterstates() {
  console.log('Searching for Interstate highways in BTS shapefile...\n');

  const source = await shapefile.open(SHAPEFILE_PATH);

  let totalFeatures = 0;
  let matchingFeatures = 0;
  const samples = [];

  let result = await source.read();

  while (!result.done) {
    totalFeatures++;

    if (totalFeatures % 100000 === 0) {
      console.log(`Processed ${totalFeatures} features, found ${matchingFeatures} potential interstates...`);
    }

    const feature = result.value;
    const props = feature.properties;

    // Look for Interstate indicators
    const roadname = (props.ROADNAME || '').toLowerCase();
    const roadnum = String(props.ROADNUM || '').trim();

    // Check if it might be an interstate
    if (roadname.includes('interstate') ||
        roadname.includes('i-') ||
        roadname.includes('i 35') ||
        roadname.includes('i 80') ||
        (props.COUNTRY === 2 && props.CLASS === 1)) { // USA, Class 1 might be interstates

      matchingFeatures++;

      if (samples.length < 20) {
        samples.push({
          roadname: props.ROADNAME,
          roadnum: props.ROADNUM,
          class: props.CLASS,
          nhs: props.NHS,
          admin: props.ADMIN,
          country: props.COUNTRY,
          jurisname: props.JURISNAME
        });
      }
    }

    result = await source.read();
  }

  console.log(`\n✅ Finished searching`);
  console.log(`   Total features: ${totalFeatures}`);
  console.log(`   Potential interstates found: ${matchingFeatures}\n`);

  if (samples.length > 0) {
    console.log('Sample matches:');
    samples.forEach((sample, i) => {
      console.log(`\n${i + 1}.`, JSON.stringify(sample, null, 2));
    });
  } else {
    console.log('No Interstate highways found in dataset.');
  }
}

searchInterstates().catch(console.error);
