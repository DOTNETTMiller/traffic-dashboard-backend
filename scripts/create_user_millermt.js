#!/usr/bin/env node
/**
 * Create user: millermt_ia@yahoo.com
 */

const { Client } = require('pg');
const crypto = require('crypto');

async function createUser() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable is not set');
    console.error('Run with: railway run node scripts/create_user_millermt.js');
    process.exit(1);
  }

  console.log('🐘 Connecting to PostgreSQL database...');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    const email = 'millermt_ia@yahoo.com';
    const username = email;
    const password = 'TempPass123!';
    const fullName = 'Matt Miller';
    const role = 'admin';

    // Hash password using SHA-256
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

    console.log(`\n📝 Creating user: ${email}`);

    await client.query(`
      INSERT INTO users (username, email, password_hash, full_name, role, active, notify_on_messages)
      VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = CURRENT_TIMESTAMP
    `, [username, email, passwordHash, fullName, role]);

    console.log('✅ User created/updated successfully!');
    console.log('\n📧 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${role}`);

  } catch (error) {
    console.error('\n❌ Failed to create user:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🐘 PostgreSQL connection closed');
  }
}

createUser();
