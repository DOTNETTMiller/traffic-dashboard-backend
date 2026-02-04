/**
 * Estimate storage requirements for full-resolution interstate geometry
 */

// Storage calculation for GeoJSON LineString coordinates
// Each coordinate is [longitude, latitude] = 2 float64 values
// Float64 = 8 bytes each
// Plus JSON overhead (brackets, commas, etc.)

const INTERSTATES = [
  { name: 'I-5', miles: 1381, estimatedPoints: 15000 },
  { name: 'I-8', miles: 348, estimatedPoints: 4000 },
  { name: 'I-10', miles: 2460, estimatedPoints: 22000 },
  { name: 'I-15', miles: 1433, estimatedPoints: 15000 },
  { name: 'I-20', miles: 1539, estimatedPoints: 16000 },
  { name: 'I-25', miles: 1062, estimatedPoints: 11000 },
  { name: 'I-30', miles: 367, estimatedPoints: 4000 },
  { name: 'I-35', miles: 1568, estimatedPoints: 16000 },
  { name: 'I-40', miles: 2559, estimatedPoints: 24000 },
  { name: 'I-44', miles: 634, estimatedPoints: 7000 },
  { name: 'I-45', miles: 285, estimatedPoints: 3500 },
  { name: 'I-55', miles: 964, estimatedPoints: 10000 },
  { name: 'I-57', miles: 386, estimatedPoints: 4500 },
  { name: 'I-59', miles: 445, estimatedPoints: 5000 },
  { name: 'I-64', miles: 952, estimatedPoints: 10000 },
  { name: 'I-65', miles: 887, estimatedPoints: 9500 },
  { name: 'I-66', miles: 76, estimatedPoints: 1000 },
  { name: 'I-69', miles: 570, estimatedPoints: 6500 },
  { name: 'I-70', miles: 2153, estimatedPoints: 20000 },
  { name: 'I-71', miles: 345, estimatedPoints: 4000 },
  { name: 'I-74', miles: 612, estimatedPoints: 7000 },
  { name: 'I-75', miles: 1786, estimatedPoints: 18000 },
  { name: 'I-76', miles: 435, estimatedPoints: 5000 },
  { name: 'I-77', miles: 610, estimatedPoints: 7000 },
  { name: 'I-78', miles: 144, estimatedPoints: 2000 },
  { name: 'I-79', miles: 343, estimatedPoints: 4000 },
  { name: 'I-80', miles: 2900, estimatedPoints: 25000 },
  { name: 'I-81', miles: 855, estimatedPoints: 9000 },
  { name: 'I-84', miles: 769, estimatedPoints: 8500 },
  { name: 'I-85', miles: 666, estimatedPoints: 7500 },
  { name: 'I-90', miles: 3021, estimatedPoints: 28000 },
  { name: 'I-94', miles: 1585, estimatedPoints: 16000 },
  { name: 'I-95', miles: 1920, estimatedPoints: 20000 }
];

console.log('📊 Interstate Geometry Storage Estimation\n');
console.log('='.repeat(80));

let totalPoints = 0;
let totalMiles = 0;

INTERSTATES.forEach(interstate => {
  totalPoints += interstate.estimatedPoints * 2; // EB + WB (or NB + SB)
  totalMiles += interstate.miles;
});

console.log(`Total Interstates: 33`);
console.log(`Total Directional Corridors: 66 (EB/WB or NB/SB)`);
console.log(`Total Miles Covered: ${totalMiles.toLocaleString()} miles`);
console.log(`Total Coordinate Points: ${totalPoints.toLocaleString()}\n`);

// Storage calculation
const BYTES_PER_COORDINATE = 16; // 2 float64 values
const JSON_OVERHEAD = 1.3; // 30% overhead for JSON formatting
const METADATA_PER_CORRIDOR = 500; // name, description, bounds, timestamps

const coordinateBytes = totalPoints * BYTES_PER_COORDINATE * JSON_OVERHEAD;
const metadataBytes = 66 * METADATA_PER_CORRIDOR;
const totalBytes = coordinateBytes + metadataBytes;

const totalKB = totalBytes / 1024;
const totalMB = totalKB / 1024;

console.log('Storage Breakdown:');
console.log('='.repeat(80));
console.log(`Coordinate data: ${(coordinateBytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`Metadata (names, descriptions, bounds): ${(metadataBytes / 1024).toFixed(2)} KB`);
console.log(`\nTotal Storage (geometry field): ${totalMB.toFixed(2)} MB`);
console.log(`Total Storage (with indexes): ~${(totalMB * 1.2).toFixed(2)} MB\n`);

// PostgreSQL JSONB compression
const compressionRatio = 0.6; // PostgreSQL JSONB typically compresses to ~60% of original
const compressedMB = totalMB * compressionRatio;

console.log('With PostgreSQL JSONB Compression:');
console.log(`Actual disk usage: ~${compressedMB.toFixed(2)} MB\n`);

// Per-interstate breakdown (top 10 largest)
console.log('='.repeat(80));
console.log('Top 10 Largest Interstates (by storage):');
console.log('='.repeat(80));

const sorted = [...INTERSTATES].sort((a, b) => b.estimatedPoints - a.estimatedPoints);

sorted.slice(0, 10).forEach(interstate => {
  const pointsWithDirection = interstate.estimatedPoints * 2;
  const sizeKB = (pointsWithDirection * BYTES_PER_COORDINATE * JSON_OVERHEAD) / 1024;
  const compressedKB = sizeKB * compressionRatio;
  console.log(`${interstate.name.padEnd(8)} ${String(interstate.miles).padStart(5)} mi  ${String(pointsWithDirection.toLocaleString()).padStart(8)} pts  ${compressedKB.toFixed(0).padStart(5)} KB (compressed)`);
});

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`📦 Total Database Storage: ~${compressedMB.toFixed(1)} MB (compressed)`);
console.log(`📦 Uncompressed Size: ~${totalMB.toFixed(1)} MB`);
console.log(`📦 With Indexes & Overhead: ~${(compressedMB * 1.5).toFixed(1)} MB total\n`);

console.log('💰 Cost Impact:');
console.log('   Railway PostgreSQL: Negligible (<1% of typical DB size)');
console.log('   Network Transfer: ~${compressedMB.toFixed(1)} MB per full corridor sync');
console.log('   Browser Memory: ~${totalMB.toFixed(1)} MB when all corridors loaded\n');

console.log('✅ Recommended Approach:');
console.log('   - Full resolution is completely feasible');
console.log('   - PostgreSQL will handle compression automatically');
console.log('   - Consider lazy-loading corridors in frontend (load on-demand)');
console.log('   - API can return simplified geometry for overview maps if needed\n');
