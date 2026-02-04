const shapefile = require('shapefile');

const SHAPEFILE_PATH = '/Users/mattmiller/Downloads/NTAD_North_American_Roads_-6941702301048783378/North_American_Roads.shp';

async function inspectFields() {
  console.log('\n🔍 Inspecting BTS Shapefile Fields\n');
  console.log('='.repeat(80));

  try {
    const source = await shapefile.open(SHAPEFILE_PATH);
    const result = await source.read();

    if (!result.done && result.value) {
      const props = result.value.properties;

      console.log('\nAll Available Fields:');
      console.log('-'.repeat(80));

      const fields = Object.entries(props).map(([key, value]) => ({
        name: key,
        type: typeof value,
        sample: typeof value === 'string' ? value.substring(0, 40) : value
      }));

      // Sort by field name
      fields.sort((a, b) => a.name.localeCompare(b.name));

      for (const field of fields) {
        console.log(`  ${field.name.padEnd(15)} ${String(field.type).padEnd(10)} ${field.sample}`);
      }

      console.log('\n' + '='.repeat(80));

      // Look for Interstate-related fields
      console.log('\n🔍 Searching for Interstate Identification Fields:\n');

      const interstateKeywords = ['system', 'fsystem', 'f_system', 'class', 'func', 'sign', 'signt', 'signn'];
      const foundFields = [];

      for (const keyword of interstateKeywords) {
        const matches = Object.keys(props).filter(k => k.toLowerCase().includes(keyword));
        if (matches.length > 0) {
          for (const match of matches) {
            foundFields.push({ field: match, value: props[match], keyword });
          }
        }
      }

      if (foundFields.length > 0) {
        for (const { field, value, keyword } of foundFields) {
          console.log(`  ✓ ${field.padEnd(15)} = ${value} (matched: ${keyword})`);
        }
      } else {
        console.log('  ⚠️  No Interstate identification fields found');
      }

      // Look for route number fields
      console.log('\n🔍 Searching for Route Number Fields:\n');

      const routeKeywords = ['road', 'route', 'num', 'sign'];
      const routeFields = [];

      for (const keyword of routeKeywords) {
        const matches = Object.keys(props).filter(k => k.toLowerCase().includes(keyword));
        if (matches.length > 0) {
          for (const match of matches) {
            routeFields.push({ field: match, value: props[match] });
          }
        }
      }

      if (routeFields.length > 0) {
        for (const { field, value } of routeFields) {
          console.log(`  ✓ ${field.padEnd(15)} = ${value}`);
        }
      } else {
        console.log('  ⚠️  No route number fields found');
      }

      // Look for milepoint/LRS fields
      console.log('\n🔍 Searching for Milepoint/LRS Fields:\n');

      const lrsKeywords = ['mile', 'begin', 'end', 'beg', '_mp', 'measure', 'from', 'to'];
      const lrsFields = [];

      for (const keyword of lrsKeywords) {
        const matches = Object.keys(props).filter(k => k.toLowerCase().includes(keyword));
        if (matches.length > 0) {
          for (const match of matches) {
            if (!lrsFields.find(f => f.field === match)) {
              lrsFields.push({ field: match, value: props[match] });
            }
          }
        }
      }

      if (lrsFields.length > 0) {
        for (const { field, value } of lrsFields) {
          console.log(`  ✓ ${field.padEnd(15)} = ${value}`);
        }
      } else {
        console.log('  ⚠️  No milepoint/LRS fields found');
      }

      // Look for direction fields
      console.log('\n🔍 Searching for Direction Fields:\n');

      const dirKeywords = ['dir', 'direction', 'thru'];
      const dirFields = [];

      for (const keyword of dirKeywords) {
        const matches = Object.keys(props).filter(k => k.toLowerCase().includes(keyword));
        if (matches.length > 0) {
          for (const match of matches) {
            dirFields.push({ field: match, value: props[match] });
          }
        }
      }

      if (dirFields.length > 0) {
        for (const { field, value } of dirFields) {
          console.log(`  ✓ ${field.padEnd(15)} = ${value}`);
        }
      } else {
        console.log('  ⚠️  No direction fields found');
      }

      console.log('\n' + '='.repeat(80) + '\n');

    } else {
      console.log('⚠️  Could not read first feature from shapefile');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

inspectFields().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
