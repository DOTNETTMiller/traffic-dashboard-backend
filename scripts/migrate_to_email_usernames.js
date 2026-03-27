#!/usr/bin/env node

const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('./states.db');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

console.log('🔄 Migrating users to email-based usernames...\n');

try {
  // Get all current users
  const users = db.prepare('SELECT id, username, email FROM users').all();

  console.log('Current users:');
  users.forEach(user => {
    console.log(`  ${user.username} -> ${user.email}`);
  });

  console.log('\n📝 Updating usernames to match email addresses...\n');

  users.forEach(user => {
    if (user.username === user.email) {
      console.log(`✓ ${user.email} - Already using email as username`);
      return;
    }

    try {
      const result = db.prepare('UPDATE users SET username = ? WHERE id = ?')
        .run(user.email, user.id);
      console.log(`✅ ${user.username} -> ${user.email} - Updated`);
    } catch (err) {
      console.log(`❌ ${user.username} -> ${user.email} - Error: ${err.message}`);
    }
  });

  console.log('\n🎯 Setting password for matthew.miller@iowadot.us...');

  const newPassword = process.env.MIGRATION_PASSWORD || (() => { throw new Error('MIGRATION_PASSWORD environment variable required'); })();
  const passwordHash = hashPassword(newPassword);

  const result = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?')
    .run(passwordHash, 'matthew.miller@iowadot.us');

  if (result.changes === 0) {
    console.log('❌ User matthew.miller@iowadot.us not found');
  } else {
    console.log('✅ Password set successfully!');
    console.log('\n📋 Login credentials:');
    console.log(`   Email/Username: matthew.miller@iowadot.us`);
    console.log(`   Password: ${newPassword}`);
  }

  console.log('\n✅ Migration complete!\n');
  console.log('Updated user list:');

  const updatedUsers = db.prepare('SELECT username, email, role FROM users').all();
  updatedUsers.forEach(user => {
    console.log(`  ${user.username} (${user.role})`);
  });

  db.close();
} catch (error) {
  console.error('❌ Error during migration:', error.message);
  db.close();
  process.exit(1);
}
