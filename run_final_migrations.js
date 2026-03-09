const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration(filename) {
  console.log('\n' + '='.repeat(60));
  console.log('Running: ' + filename);
  console.log('='.repeat(60));

  const sql = fs.readFileSync(filename, 'utf8');

  try {
    const result = await pool.query(sql);
    console.log('✅ Migration completed successfully');
    if (result.rows && result.rows.length > 0) {
      result.rows.forEach(row => {
        console.log('   ', Object.values(row).join(': '));
      });
    }
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    return false;
  }
}

async function checkTable(tableName) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = $1
      ) as exists
    `, [tableName]);
    return result.rows[0].exists;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('\n🚀 Running FINAL CCAI migrations for 100% alignment...\n');

  // Check if tables already exist
  const travelerApiExists = await checkTable('traveler_api_keys');
  const cvMessagesExists = await checkTable('cv_messages');

  console.log('Table check:');
  console.log('  traveler_api_keys:', travelerApiExists ? 'EXISTS' : 'MISSING');
  console.log('  cv_messages:', cvMessagesExists ? 'EXISTS' : 'MISSING');
  console.log('');

  const migrations = [];

  if (!travelerApiExists) {
    migrations.push('migrations/create_traveler_api.sql');
  }

  if (!cvMessagesExists) {
    migrations.push('migrations/create_cv_messages.sql');
  }

  if (migrations.length === 0) {
    console.log('✅ All tables already exist! No migrations needed.');
    await pool.end();
    return;
  }

  let success = 0;
  let failed = 0;

  for (const migration of migrations) {
    const result = await runMigration(migration);
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

  if (success === 2) {
    console.log('\n🎉 100% CCAI ALIGNMENT ACHIEVED! 🎉');
  }

  console.log('='.repeat(60) + '\n');

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
