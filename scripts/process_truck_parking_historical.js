// Process historical truck parking data from TruckStopsExport
// This script builds time-based occupancy patterns for predictions

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Database = require('../database.js');

const db = new Database.constructor();

// Parse CSV line accounting for quoted fields
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Extract state and site info from SiteId
function parseSiteId(siteId) {
  // Format: KY00065IS000020NSMARATHON or IA00080IS001510OEJASPSCAL
  const stateMatch = siteId.match(/^([A-Z]{2})/);
  const state = stateMatch ? stateMatch[1] : 'XX';

  return {
    state,
    facilityId: `tpims-historical-${siteId.toLowerCase()}`
  };
}

// Build hourly and day-of-week patterns
class PatternBuilder {
  constructor() {
    // Store patterns by facility: facilityId -> dayOfWeek -> hour -> [availabilities]
    this.patterns = new Map();
  }

  addDataPoint(facilityId, timestamp, available, capacity) {
    const date = new Date(timestamp);
    const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday
    const hour = date.getHours();

    if (!this.patterns.has(facilityId)) {
      this.patterns.set(facilityId, new Map());
    }

    const facilityPatterns = this.patterns.get(facilityId);
    const key = `${dayOfWeek}-${hour}`;

    if (!facilityPatterns.has(key)) {
      facilityPatterns.set(key, []);
    }

    const occupancyRate = capacity > 0 ? (capacity - available) / capacity : 0;
    facilityPatterns.get(key).push({
      available,
      capacity,
      occupancyRate,
      timestamp: date
    });
  }

  calculateAverages() {
    const results = [];

    for (const [facilityId, facilityPatterns] of this.patterns.entries()) {
      for (const [key, dataPoints] of facilityPatterns.entries()) {
        const [dayOfWeek, hour] = key.split('-').map(Number);

        // Calculate average occupancy rate
        const avgOccupancyRate = dataPoints.reduce((sum, dp) => sum + dp.occupancyRate, 0) / dataPoints.length;
        const sampleCount = dataPoints.length;

        // Get capacity (use most recent)
        const capacity = dataPoints[dataPoints.length - 1].capacity;

        results.push({
          facilityId,
          dayOfWeek,
          hour,
          avgOccupancyRate,
          sampleCount,
          capacity
        });
      }
    }

    return results;
  }

  getFacilityInfo() {
    const facilities = new Map();

    for (const [facilityId, facilityPatterns] of this.patterns.entries()) {
      // Get all data points for this facility to find capacity and sample stats
      let totalCapacity = 0;
      let sampleCount = 0;

      for (const dataPoints of facilityPatterns.values()) {
        for (const dp of dataPoints) {
          totalCapacity += dp.capacity;
          sampleCount++;
        }
      }

      const avgCapacity = sampleCount > 0 ? Math.round(totalCapacity / sampleCount) : 0;

      facilities.set(facilityId, {
        facilityId,
        totalSamples: sampleCount,
        avgCapacity
      });
    }

    return Array.from(facilities.values());
  }
}

async function processParkingData(filePath, limit = null) {
  console.log(`\n📂 Processing: ${path.basename(filePath)}`);
  console.log('⏳ This may take a while for large files...\n');

  await db.init();

  const patternBuilder = new PatternBuilder();
  const facilities = new Map();

  let lineCount = 0;
  let processedCount = 0;
  let skipCount = 0;

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let headers = [];

  for await (const line of rl) {
    lineCount++;

    // Parse header
    if (lineCount === 1) {
      headers = parseCSVLine(line);
      console.log('📋 Headers:', headers.join(', '));
      continue;
    }

    // Apply limit if specified
    if (limit && processedCount >= limit) {
      console.log(`\n⏹️  Reached limit of ${limit} records`);
      break;
    }

    try {
      const values = parseCSVLine(line);
      const record = {};
      headers.forEach((header, i) => {
        record[header] = values[i];
      });

      const siteId = record.SiteId;
      const timestamp = record.TimeStamp;
      const available = parseInt(record.TrueAvailable || record.ReportedAvailable || 0);
      const capacity = parseInt(record.Capacity || 0);

      if (!siteId || !timestamp || capacity === 0) {
        skipCount++;
        continue;
      }

      const { state, facilityId } = parseSiteId(siteId);

      // Store facility if not seen before
      if (!facilities.has(facilityId)) {
        facilities.set(facilityId, {
          facilityId,
          siteId,
          state,
          capacity,
          firstSeen: timestamp,
          lastSeen: timestamp
        });
      } else {
        facilities.get(facilityId).lastSeen = timestamp;
      }

      // Add to pattern builder
      patternBuilder.addDataPoint(facilityId, timestamp, available, capacity);

      processedCount++;

      if (processedCount % 10000 === 0) {
        process.stdout.write(`\r✅ Processed ${processedCount.toLocaleString()} records...`);
      }

    } catch (error) {
      console.error(`\n❌ Error processing line ${lineCount}:`, error.message);
      skipCount++;
    }
  }

  console.log(`\n\n📊 Processing Summary:`);
  console.log(`   Total lines: ${lineCount.toLocaleString()}`);
  console.log(`   Processed: ${processedCount.toLocaleString()}`);
  console.log(`   Skipped: ${skipCount.toLocaleString()}`);
  console.log(`   Facilities: ${facilities.size.toLocaleString()}\n`);

  // Calculate patterns
  console.log('🧮 Calculating time-based patterns...');
  const patterns = patternBuilder.calculateAverages();
  console.log(`✅ Generated ${patterns.length.toLocaleString()} time-based patterns\n`);

  // Save to JSON for quick loading
  const outputData = {
    facilities: Array.from(facilities.values()),
    patterns: patterns,
    metadata: {
      sourceFile: path.basename(filePath),
      processedAt: new Date().toISOString(),
      recordCount: processedCount,
      facilityCount: facilities.size,
      patternCount: patterns.length
    }
  };

  const outputPath = path.join(__dirname, '../data/truck_parking_patterns.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`💾 Saved patterns to: ${outputPath}\n`);

  return outputData;
}

// Main execution
async function main() {
  const exportPath = path.join(__dirname, '../TruckStopsExport/TruckParkingExport.txt');

  // Check if file exists
  if (!fs.existsSync(exportPath)) {
    console.error(`❌ File not found: ${exportPath}`);
    console.log('\n💡 Please ensure TruckStopsExport/TruckParkingExport.txt exists');
    process.exit(1);
  }

  const fileStats = fs.statSync(exportPath);
  console.log(`\n📁 File size: ${(fileStats.size / 1024 / 1024 / 1024).toFixed(2)} GB`);

  // Process with limit for initial testing (remove limit to process all)
  const SAMPLE_LIMIT = 100000; // Process first 100k records for testing
  console.log(`\n⚙️  Processing first ${SAMPLE_LIMIT.toLocaleString()} records (modify SAMPLE_LIMIT in code to process more)\n`);

  await processParkingData(exportPath, SAMPLE_LIMIT);

  console.log('✅ Processing complete!\n');
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { processParkingData };
