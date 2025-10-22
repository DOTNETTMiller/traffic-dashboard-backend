#!/usr/bin/env node

const Database = require('better-sqlite3');
const crypto = require('crypto');

const db = new Database('./states.db');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

console.log('🧪 Testing User Management System\n');

// Test 1: List all users
console.log('TEST 1: Listing all users');
console.log('─'.repeat(60));
const users = db.prepare('SELECT username, email, role, active FROM users').all();
users.forEach(user => {
  console.log(`✓ ${user.username} | ${user.role} | ${user.active ? 'Active' : 'Inactive'}`);
});

// Test 2: Verify email-based usernames
console.log('\nTEST 2: Verifying email-based usernames');
console.log('─'.repeat(60));
const mismatch = users.filter(u => u.username !== u.email);
if (mismatch.length === 0) {
  console.log('✓ All usernames match their email addresses');
} else {
  console.log('❌ Found users with username != email:');
  mismatch.forEach(u => console.log(`  ${u.username} != ${u.email}`));
}

// Test 3: Test login with your credentials
console.log('\nTEST 3: Testing login for matthew.miller@iowadot.us');
console.log('─'.repeat(60));
const username = 'matthew.miller@iowadot.us';
const password = 'Bim4infra';
const passwordHash = hashPassword(password);

const user = db.prepare(`
  SELECT * FROM users WHERE username = ? AND password_hash = ? AND active = 1
`).get(username, passwordHash);

if (user) {
  console.log('✓ Login successful!');
  console.log(`  Username: ${user.username}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Role: ${user.role}`);
  console.log(`  Active: ${user.active === 1}`);
} else {
  console.log('❌ Login failed - credentials do not match');
}

// Test 4: Check for admin users
console.log('\nTEST 4: Checking admin users');
console.log('─'.repeat(60));
const admins = db.prepare('SELECT username, email FROM users WHERE role = ?').all('admin');
console.log(`✓ Found ${admins.length} admin user(s):`);
admins.forEach(admin => console.log(`  - ${admin.username}`));

// Test 5: Verify database schema
console.log('\nTEST 5: Verifying database schema');
console.log('─'.repeat(60));
const columns = db.prepare("PRAGMA table_info(users)").all();
const requiredColumns = ['username', 'email', 'password_hash', 'role', 'active', 'state_key'];
const hasAllColumns = requiredColumns.every(col =>
  columns.some(c => c.name === col)
);

if (hasAllColumns) {
  console.log('✓ All required columns present in users table');
} else {
  console.log('❌ Missing required columns');
}

console.log('\n' + '═'.repeat(60));
console.log('✅ All tests completed!');
console.log('═'.repeat(60));

db.close();
