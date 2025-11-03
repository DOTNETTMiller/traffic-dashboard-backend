// Streaming processor for truck parking patterns - memory efficient
// Filters by TrustData and weights by verification quality

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Database = require('../database.js');

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
  const stateMatch = siteId.match(/^([A-Z]{2})/);
  const state = stateMatch ? stateMatch[1] : 'XX';
  return {
    state,
    facilityId: `tpims-historical-${siteId.toLowerCase()}`
  };
}

// Streaming pattern aggregator - stores only summary stats
class StreamingPatternAggregator {
  constructor(db) {
    this.db = db;
    this.facilities = new Map();
    // Store only running stats, not raw data
    this.patterns = new Map(); // key: facilityId-dayOfWeek-hour -> {sum, count, capacity}
    this.batchSize = 10000;
    this.recordsProcessed = 0;
  }

  addDataPoint(facilityId, siteId, state, timestamp, available, capacity, trustData, verificationAmplitude) {
    const date = new Date(timestamp);
    const dayOfWeek = date.getDay();
    const hour = date.getHours();

    // Track facility
    if (!this.facilities.has(facilityId)) {
      this.facilities.set(facilityId, {
        facilityId,
        siteId,
        state,
        capacity,
        totalSamples: 0,
        trustedSamples: 0,
        firstSeen: timestamp,
        lastSeen: timestamp
      });
    } else {
      const fac = this.facilities.get(facilityId);
      fac.lastSeen = timestamp;
      fac.totalSamples++;
      if (trustData === 1) fac.trustedSamples++;
    }

    // Calculate occupancy
    const occupied = capacity - available;
    const occupancyRate = capacity > 0 ? occupied / capacity : 0;

    // Aggregate by pattern key
    const key = `${facilityId}-${dayOfWeek}-${hour}`;
    if (!this.patterns.has(key)) {
      this.patterns.set(key, {
        facilityId,
        dayOfWeek,
        hour,
        sumOccupancy: 0,
        count: 0,
        trustedCount: 0,
        capacity,
        qualitySum: 0
      });
    }

    const pattern = this.patterns.get(key);
    pattern.sumOccupancy += occupancyRate;
    pattern.count++;
    if (trustData === 1) pattern.trustedCount++;

    // Weight quality by verification amplitude (0-10 scale)
    const quality = trustData === 1 ? Math.max(1, 10 - Math.abs(verificationAmplitude || 0)) : 0.5;
    pattern.qualitySum += quality;

    this.recordsProcessed++;
  }

  calculateAverages() {
    const results = [];
    for (const [key, pattern] of this.patterns.entries()) {
      const avgOccupancyRate = pattern.sumOccupancy / pattern.count;
      const avgQuality = pattern.qualitySum / pattern.count;
      const trustRatio = pattern.trustedCount / pattern.count;

      results.push({
        facilityId: pattern.facilityId,
        dayOfWeek: pattern.dayOfWeek,
        hour: pattern.hour,
        avgOccupancyRate,
        sampleCount: pattern.count,
        trustedSampleCount: pattern.trustedCount,
        capacity: pattern.capacity,
        avgQuality,
        trustRatio
      });
    }
    return results;
  }

  async flushToDatabase() {
    console.log('\n💾 Flushing aggregated patterns to database...');

    // Prepare database
    await this.db.init();

    // Clear existing data
    console.log('🗑️  Clearing old parking data...');
    this.db.db.exec('DELETE FROM parking_patterns');
    this.db.db.exec('DELETE FROM parking_facilities');

    // Insert facilities
    console.log(`📦 Inserting ${this.facilities.size} facilities...`);
    const facStmt = this.db.db.prepare(`
      INSERT INTO parking_facilities
      (facility_id, site_id, state, avg_capacity, total_samples, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `);

    const transaction = this.db.db.transaction((facilities) => {
      for (const fac of facilities) {
        facStmt.run(
          fac.facilityId,
          fac.siteId,
          fac.state,
          fac.capacity,
          fac.totalSamples
        );
      }
    });

    transaction(Array.from(this.facilities.values()));

    // Insert patterns
    console.log(`📊 Inserting ${this.patterns.size} time-based patterns...`);
    const patternStmt = this.db.db.prepare(`
      INSERT INTO parking_patterns
      (facility_id, day_of_week, hour, avg_occupancy_rate, sample_count, capacity)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const patterns = this.calculateAverages();
    const patTransaction = this.db.db.transaction((patterns) => {
      for (const p of patterns) {
        patternStmt.run(
          p.facilityId,
          p.dayOfWeek,
          p.hour,
          p.avgOccupancyRate,
          p.sampleCount,
          p.capacity
        );
      }
    });

    patTransaction(patterns);

    console.log('✅ Database updated successfully!');
    return {
      facilities: this.facilities.size,
      patterns: this.patterns.size,
      recordsProcessed: this.recordsProcessed
    };
  }
}

async function processStreamingData(filePath) {
  console.log(`\n📂 Processing: ${path.basename(filePath)}`);
  console.log('⏳ Streaming mode - memory efficient\n');

  const db = new Database.constructor();
  await db.init();

  const aggregator = new StreamingPatternAggregator(db);

  let lineCount = 0;
  let processedCount = 0;
  let skipCount = 0;
  let trustedCount = 0;
  let untrustedCount = 0;
  const startTime = Date.now();

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let headers = [];

  for await (const line of rl) {
    lineCount++;

    if (lineCount === 1) {
      headers = parseCSVLine(line);
      console.log('📋 Headers:', headers.join(', '));
      continue;
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
      const trustData = parseInt(record.TrustData || 0);
      const verificationAmplitude = parseInt(record.VerificationCheckAmplitude || 0);

      // Skip invalid or untrusted data
      if (!siteId || !timestamp || capacity === 0) {
        skipCount++;
        continue;
      }

      // Filter: Only use trusted data
      if (trustData !== 1) {
        untrustedCount++;
        continue;
      }

      const { state, facilityId } = parseSiteId(siteId);

      aggregator.addDataPoint(
        facilityId,
        siteId,
        state,
        timestamp,
        available,
        capacity,
        trustData,
        verificationAmplitude
      );

      processedCount++;
      trustedCount++;

      if (processedCount % 100000 === 0) {
        const elapsed = Date.now() - startTime;
        const rate = processedCount / (elapsed / 1000);
        const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        process.stdout.write(
          `\r✅ ${processedCount.toLocaleString()} trusted | ` +
          `${aggregator.facilities.size} facilities | ` +
          `${rate.toFixed(0)} rec/sec | ` +
          `${memUsage.toFixed(0)} MB`
        );
      }

    } catch (error) {
      skipCount++;
    }
  }

  console.log(`\n\n📊 Processing Summary:`);
  console.log(`   Total lines: ${lineCount.toLocaleString()}`);
  console.log(`   Trusted data: ${trustedCount.toLocaleString()}`);
  console.log(`   Untrusted (skipped): ${untrustedCount.toLocaleString()}`);
  console.log(`   Invalid (skipped): ${skipCount.toLocaleString()}`);
  console.log(`   Trust ratio: ${(trustedCount / (trustedCount + untrustedCount) * 100).toFixed(1)}%`);
  console.log(`   Facilities: ${aggregator.facilities.size.toLocaleString()}`);
  console.log(`   Pattern keys: ${aggregator.patterns.size.toLocaleString()}\n`);

  // Flush to database
  const stats = await aggregator.flushToDatabase();

  return stats;
}

async function main() {
  const exportPath = path.join(__dirname, '../TruckStopsExport/TruckParkingExport.txt');

  if (!fs.existsSync(exportPath)) {
    console.error(`❌ File not found: ${exportPath}`);
    process.exit(1);
  }

  const fileStats = fs.statSync(exportPath);
  console.log(`\n📁 File size: ${(fileStats.size / 1024 / 1024 / 1024).toFixed(2)} GB`);
  console.log(`🔍 Filtering: TrustData = 1 only (verified data)\n`);

  await processStreamingData(exportPath);

  console.log('\n✅ Processing complete!');
  console.log('💡 Patterns are now in database and ready to use\n');
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { processStreamingData };
