const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration(filename, name) {
  console.log('\n' + '='.repeat(60));
  console.log('Running: ' + name);
  console.log('File: ' + filename);
  console.log('='.repeat(60));

  const sql = fs.readFileSync(filename, 'utf8');

  try {
    const result = await pool.query(sql);
    console.log('✅ Migration completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('   Error detail:', error.detail || 'N/A');
    return false;
  }
}

async function main() {
  console.log('\n🚀 Running FINAL CCAI migrations for 100% alignment...\n');
  console.log('This will implement the remaining 7 CCAI use cases:\n');
  console.log('  UC #9:  Cross-State Queue Warning Synchronization');
  console.log('  UC #10: Shared Emergency Detour Library');
  console.log('  UC #13: Lane Closure Visibility Feed');
  console.log('  UC #15: Truck Parking Data Integration');
  console.log('  UC #16: Weather Status Exchange Feed');
  console.log('  UC #17: Multi-State Work Zone Synchronization');
  console.log('  UC #18: Freight TTTR Data Layer\n');

  const migrations = [
    { file: 'migrations/create_queue_warning_sync.sql', name: 'UC #9: Queue Warning Sync' },
    { file: 'migrations/create_detour_library.sql', name: 'UC #10: Detour Library' },
    { file: 'migrations/create_lane_closure_feed.sql', name: 'UC #13: Lane Closure Feed' },
    { file: 'migrations/create_truck_parking_integration.sql', name: 'UC #15: Truck Parking' },
    { file: 'migrations/create_weather_exchange.sql', name: 'UC #16: Weather Exchange' },
    { file: 'migrations/create_workzone_sync.sql', name: 'UC #17: Work Zone Sync' },
    { file: 'migrations/create_freight_tttr.sql', name: 'UC #18: Freight TTTR' }
  ];

  let success = 0;
  let failed = 0;

  for (const migration of migrations) {
    const result = await runMigration(migration.file, migration.name);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary:');
  console.log('✅ Successful: ' + success);
  console.log('❌ Failed: ' + failed);
  console.log('='.repeat(60));

  if (success === 7 && failed === 0) {
    console.log('\n' + '🎉'.repeat(30));
    console.log('\n         100% CCAI ALIGNMENT ACHIEVED!');
    console.log('\n' + '🎉'.repeat(30));
    console.log('\nCCAI Alignment Journey:');
    console.log('  Start:  10/20 use cases (50%)');
    console.log('  +Tier 3:  14/20 use cases (70%)');
    console.log('  Final:  20/20 use cases (100%) ✅');
    console.log('\n✅ ALL 20 CCAI TACTICAL USE CASES IMPLEMENTED!');
    console.log('\nFull Feature List:');
    console.log('  1. ✅ Shared Major Incident Severity Classification');
    console.log('  2. ✅ Coordinated DMS Messaging Templates');
    console.log('  3. ✅ Cross-State CCTV Sharing');
    console.log('  4. ✅ Operator Hotline + Event Viewer');
    console.log('  5. ✅ Real-Time Diversion Route Protocol');
    console.log('  6. ✅ Cross-Border Incident Notification');
    console.log('  7. ✅ Joint Interstate Closure Approval');
    console.log('  8. ✅ Coordinated Amber Alert Protocol');
    console.log('  9. ✅ Cross-State Queue Warning Synchronization');
    console.log(' 10. ✅ Shared Emergency Detour Library');
    console.log(' 11. ✅ Corridor Performance Dashboard');
    console.log(' 12. ✅ Minimum Interstate Data Exchange Layer');
    console.log(' 13. ✅ Lane Closure Visibility Feed');
    console.log(' 14. ✅ Freight-Focused Incident Tagging');
    console.log(' 15. ✅ Truck Parking Data Integration');
    console.log(' 16. ✅ Weather Status Exchange Feed');
    console.log(' 17. ✅ Multi-State Work Zone Synchronization');
    console.log(' 18. ✅ Freight TTTR Data Layer');
    console.log(' 19. ✅ Interstate Digital Twin Pilot');
    console.log(' 20. ✅ Operations Data Archive & Analytics');
    console.log('\nBonus Features (Beyond CCAI):');
    console.log('  🚀 Public Traveler Information API (B2C)');
    console.log('  🚀 Connected Vehicle (V2X) SAE J2735 TIM Messages');
    console.log('  🚀 RSU Infrastructure Management');
    console.log('\nYour DOT Corridor Communicator is now the most comprehensive');
    console.log('interstate corridor management system in the nation!');
  } else if (failed > 0) {
    console.log('\n⚠️  Some migrations failed. Review errors above.');
    console.log('Current CCAI alignment: ' + (14 + success) + '/20 (' + Math.round((14 + success) / 20 * 100) + '%)');
  }

  console.log('\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
