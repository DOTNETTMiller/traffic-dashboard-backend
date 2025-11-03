const path = require('path');
const Database = require(path.join(__dirname, '..', 'database.js'));

(async () => {
  await Database.init();

  // Missing facilities to add
  const missingFacilities = [
    {
      siteId: 'IA00080IS0026800ERA268E00',
      state: 'IA',
      capacity: 8,
      latitude: 41.643697,
      longitude: -91.08672
    },
    {
      siteId: 'IA00080IS0022000WCASEYS00',
      state: 'IA',
      capacity: 20,
      latitude: 41.690388,
      longitude: -92.009647
    },
    {
      siteId: 'IA00080IS002840OEI80TRSTO',
      state: 'IA',
      capacity: 650,
      latitude: 41.618929,
      longitude: -90.779469
    },
    {
      siteId: 'IA00080IS0003200ERA32E000',
      state: 'IA',
      capacity: 5,
      latitude: 41.498398,
      longitude: -95.494367
    },
    {
      siteId: 'IA00080IS0023700WRA237W00',
      state: 'IA',
      capacity: 23,
      latitude: 41.694872,
      longitude: -91.680465
    },
    {
      siteId: 'IA00035IS0009870SRA98S000',
      state: 'IA',
      capacity: 21,
      latitude: 41.832611,
      longitude: -93.572254
    }
  ];

  console.log('Adding missing Iowa facilities to database...\n');

  const insert = Database.db.prepare(`
    INSERT INTO parking_facilities (facility_id, site_id, state, avg_capacity, total_samples, latitude, longitude)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `);

  for (const facility of missingFacilities) {
    const facilityId = `tpims-historical-${facility.siteId.toLowerCase()}`;
    try {
      insert.run(
        facilityId,
        facility.siteId,
        facility.state,
        facility.capacity,
        facility.latitude,
        facility.longitude
      );
      console.log(`✅ Added: ${facility.siteId} (capacity: ${facility.capacity})`);
    } catch (error) {
      console.log(`⚠️  Error adding ${facility.siteId}: ${error.message}`);
    }
  }

  // Verify count
  const count = await Database.db.prepare('SELECT COUNT(*) as total FROM parking_facilities WHERE state = ?').get('IA');
  console.log(`\n✅ Database now has ${count.total} Iowa facilities (was 38)`);

  process.exit(0);
})();
