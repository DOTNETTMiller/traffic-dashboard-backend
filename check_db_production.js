const Database = require('better-sqlite3');
const crypto = require('crypto');

console.log('Checking production database...');

try {
  const db = new Database('./states.db');
  
  console.log('✅ Database opened');
  
  // Check if users table exists
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();
  console.log('Users table exists:', tables.length > 0);
  
  // List all users
  const users = db.prepare('SELECT id, username, email, active FROM users').all();
  console.log('\nUsers in database:');
  users.forEach(u => console.log(`  ${u.id}: ${u.username} (${u.email}) - Active: ${u.active}`));
  
  // Test login query
  const testUser = 'matthew.miller@iowadot.us';
  const testPass = 'Bim4infra';
  const hash = crypto.createHash('sha256').update(testPass).digest('hex');
  
  console.log(`\nTesting query for ${testUser}...`);
  const result = db.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ? AND active = 1').get(testUser, hash);
  
  if (result) {
    console.log('✅ Login query successful!');
  } else {
    console.log('❌ Login query returned no results');
    
    // Check if user exists
    const userExists = db.prepare('SELECT * FROM users WHERE username = ?').get(testUser);
    if (userExists) {
      console.log('User exists but password hash does not match');
      console.log('Expected hash:', hash);
      console.log('Stored hash:', userExists.password_hash);
    } else {
      console.log('User does not exist in database');
    }
  }
  
  db.close();
} catch (error) {
  console.error('❌ Error:', error.message);
}
