const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/iowa_check.json', 'utf8'));

// Filter for red lines (not weather)
const redLines = data.events.filter(e => e.geometry && e.type !== 'weather');

console.log('Red line events (closures/incidents):', redLines.length);
console.log('\nFirst 10 red line events:');
redLines.slice(0, 10).forEach((e, i) => {
  console.log(`${i+1}. ${e.type} on ${e.corridor || 'unknown'}: ${e.geometry.coordinates.length} points`);
});

// Check if deployment fixed the issue
const stillBroken = redLines.filter(e => e.geometry.coordinates.length === 2);
console.log(`\n❌ Still broken (2 points): ${stillBroken.length}/${redLines.length}`);

if (stillBroken.length > 0) {
  console.log('\nExamples of broken events:');
  stillBroken.slice(0, 3).forEach(e => {
    console.log(`- ${e.type} on ${e.corridor}: ${e.start_location} to ${e.end_location}`);
  });
}
