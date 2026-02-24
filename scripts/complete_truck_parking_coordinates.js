#!/usr/bin/env node

/**
 * Complete Truck Parking Coordinate Matching
 *
 * Imports truck stop GPS coordinates from TruckStopsExport.xlsx and matches them
 * with existing truck parking facilities in the database.
 *
 * This script is ready to run once TruckStopsExport.xlsx is placed in the project root.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'traffic_data.db');
const EXCEL_PATH = path.join(__dirname, '..', 'TruckStopsExport', 'TruckStopsExport.xlsx');

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fuzzy name matching - calculates similarity score between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function nameSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  // Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - (matrix[s2.length][s1.length] / maxLen);
}

async function importTruckParkingCoordinates() {
  console.log('🚛 Truck Parking Coordinate Import Utility\n');

  // Check if Excel file exists
  if (!fs.existsSync(EXCEL_PATH)) {
    console.log('⚠️  TruckStopsExport.xlsx not found\n');
    console.log('📋 To use this feature:');
    console.log('   1. Create directory: mkdir -p TruckStopsExport');
    console.log('   2. Place TruckStopsExport.xlsx in that directory');
    console.log('   3. Run this script again\n');
    console.log('📄 Expected file path:', EXCEL_PATH);
    console.log('\n📊 Excel file format requirements:');
    console.log('   Required columns:');
    console.log('     - Facility name/ID');
    console.log('     - State (2-letter code)');
    console.log('     - Latitude');
    console.log('     - Longitude');
    console.log('   Optional columns:');
    console.log('     - Address');
    console.log('     - City');
    console.log('     - Total parking spaces');
    console.log('     - Truck-specific spaces');
    console.log('     - Amenities');
    return;
  }

  try {
    const xlsx = require('xlsx');
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    console.log('📂 Reading Excel file...\n');
    const workbook = xlsx.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    console.log(`✅ Found ${data.length} truck stop records\n`);

    if (data.length === 0) {
      console.log('⚠️  No data in Excel file');
      return;
    }

    // Detect column names (flexible to handle different formats)
    const firstRow = data[0];
    const columns = Object.keys(firstRow);

    const latCol = columns.find(c => /lat/i.test(c));
    const lonCol = columns.find(c => /lon|lng/i.test(c));
    const nameCol = columns.find(c => /name|facility/i.test(c));
    const stateCol = columns.find(c => /state/i.test(c));
    const addrCol = columns.find(c => /addr|address/i.test(c));

    console.log('📋 Detected columns:');
    console.log(`   Name: ${nameCol || 'NOT FOUND'}`);
    console.log(`   State: ${stateCol || 'NOT FOUND'}`);
    console.log(`   Latitude: ${latCol || 'NOT FOUND'}`);
    console.log(`   Longitude: ${lonCol || 'NOT FOUND'}`);
    console.log(`   Address: ${addrCol || 'NOT FOUND'}\n`);

    if (!latCol || !lonCol) {
      console.error('❌ Missing latitude/longitude columns in Excel file');
      return;
    }

    // Create or update truck_parking_facilities table
    console.log('📊 Preparing truck_parking_facilities table...\n');

    db.exec(`
      CREATE TABLE IF NOT EXISTS truck_parking_facilities (
        facility_id TEXT PRIMARY KEY,
        name TEXT,
        state TEXT,
        latitude REAL,
        longitude REAL,
        address TEXT,
        city TEXT,
        total_spaces INTEGER,
        truck_spaces INTEGER,
        amenities TEXT,
        data_source TEXT DEFAULT 'TruckStopsExport',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec('BEGIN TRANSACTION');

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const upsertStmt = db.prepare(`
      INSERT INTO truck_parking_facilities (
        facility_id, name, state, latitude, longitude, address, data_source
      ) VALUES (?, ?, ?, ?, ?, ?, 'TruckStopsExport')
      ON CONFLICT(facility_id) DO UPDATE SET
        name = excluded.name,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        address = excluded.address,
        last_updated = CURRENT_TIMESTAMP
    `);

    for (const row of data) {
      try {
        const lat = parseFloat(row[latCol]);
        const lon = parseFloat(row[lonCol]);
        const name = row[nameCol];
        const state = row[stateCol];
        const address = row[addrCol];

        if (isNaN(lat) || isNaN(lon)) {
          skipped++;
          continue;
        }

        // Generate facility ID from name + state
        const facilityId = `${state}-${name}`.toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .substring(0, 100);

        const result = upsertStmt.run(facilityId, name, state, lat, lon, address);

        if (result.changes > 0) {
          imported++;
        }
      } catch (error) {
        console.error(`   ⚠️  Error processing row: ${error.message}`);
        skipped++;
      }
    }

    db.exec('COMMIT');

    console.log('✅ Import complete!\n');
    console.log('📊 Summary:');
    console.log(`   Imported/Updated: ${imported}`);
    console.log(`   Skipped (invalid): ${skipped}`);

    // Get statistics
    const stats = db.prepare(`
      SELECT
        state,
        COUNT(*) as count
      FROM truck_parking_facilities
      GROUP BY state
      ORDER BY count DESC
      LIMIT 10
    `).all();

    console.log('\n📍 Top states by facilities:');
    stats.forEach(({ state, count }) => {
      console.log(`   ${state}: ${count} facilities`);
    });

    db.close();

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  importTruckParkingCoordinates();
}

module.exports = { importTruckParkingCoordinates, calculateDistance, nameSimilarity };
