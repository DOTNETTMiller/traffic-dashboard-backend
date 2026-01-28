#!/usr/bin/env node

/**
 * Create an initial admin user in the database
 * Usage: node scripts/create_admin_user.js <email> <password>
 */

const db = require('../database.js');

async function createAdminUser() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: node scripts/create_admin_user.js <email> <password>');
    console.error('Example: node scripts/create_admin_user.js matthew.miller@iowadot.us admin123');
    process.exit(1);
  }

  console.log(`Creating admin user: ${email}`);

  await db.init();

  try {
    const result = await db.createUser({
      username: email,
      email: email,
      password: password,
      fullName: 'Administrator',
      organization: 'DOT',
      role: 'admin',
      active: true
    });

    if (result.success) {
      console.log('✅ Admin user created successfully!');
      console.log(`   Email/Username: ${email}`);
      console.log(`   Password: ${password}`);
      console.log(`   Role: admin`);
      console.log('\nYou can now log in with these credentials.');
    } else {
      console.error('❌ Failed to create admin user:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

createAdminUser();
