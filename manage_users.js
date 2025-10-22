#!/usr/bin/env node

const Database = require('better-sqlite3');
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let db;
try {
  db = new Database('./states.db');
} catch (err) {
  console.error('❌ Error opening database:', err.message);
  process.exit(1);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function listUsers() {
  try {
    const rows = db.prepare(`
      SELECT id, username, email, full_name, organization, state_key, role, active,
             created_at, last_login
      FROM users
      ORDER BY created_at DESC
    `).all();

    console.log('\n📋 All Users:');
    console.log('─'.repeat(100));
    if (rows.length === 0) {
      console.log('No users found.');
    } else {
      rows.forEach(user => {
        const status = user.active ? '✅ Active' : '❌ Inactive';
        console.log(`ID: ${user.id} | ${user.username}`);
        if (user.username !== user.email) {
          console.log(`  Email: ${user.email}`);
        }
        console.log(`  Role: ${user.role} | State: ${user.state_key || 'None'} | ${status}`);
        console.log(`  Name: ${user.full_name || 'N/A'} | Org: ${user.organization || 'N/A'}`);
        console.log(`  Created: ${user.created_at} | Last Login: ${user.last_login || 'Never'}`);
        console.log('─'.repeat(100));
      });
    }
  } catch (err) {
    console.error('❌ Error listing users:', err.message);
  }
}

async function createUser() {
  console.log('\n➕ Create New User');
  console.log('─'.repeat(50));
  console.log('Note: Email will be used as the username');

  const email = await question('Email address: ');
  const password = await question('Password: ');
  const fullName = await question('Full Name (optional): ');
  const organization = await question('Organization (optional): ');
  const stateKey = await question('State Key (optional, e.g., IA, UT): ');
  const roleInput = await question('Role (admin/user) [user]: ');
  const role = roleInput.toLowerCase() === 'admin' ? 'admin' : 'user';

  if (!email || !password) {
    console.log('❌ Email and password are required.');
    return;
  }

  const passwordHash = hashPassword(password);

  try {
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, organization, state_key, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      email,  // username = email
      email,
      passwordHash,
      fullName || null,
      organization || null,
      stateKey || null,
      role
    );

    console.log('\n✅ User created successfully!');
    console.log(`   ID: ${result.lastInsertRowid}`);
    console.log(`   Email/Username: ${email}`);
    console.log(`   Role: ${role}`);
    if (stateKey) console.log(`   State: ${stateKey}`);
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      console.log('❌ Error: Email already exists.');
    } else {
      console.log('❌ Error creating user:', err.message);
    }
  }
}

async function resetPassword() {
  console.log('\n🔑 Reset User Password');
  console.log('─'.repeat(50));

  const email = await question('Email/Username: ');
  const newPassword = await question('New Password: ');

  if (!email || !newPassword) {
    console.log('❌ Email and password are required.');
    return;
  }

  const passwordHash = hashPassword(newPassword);

  try {
    const result = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?')
      .run(passwordHash, email);

    if (result.changes === 0) {
      console.log(`❌ User '${email}' not found.`);
    } else {
      console.log(`\n✅ Password reset successfully for '${email}'!`);
      console.log(`   New password: ${newPassword}`);
    }
  } catch (err) {
    console.log('❌ Error resetting password:', err.message);
  }
}

async function updateUser() {
  console.log('\n✏️  Update User');
  console.log('─'.repeat(50));

  const username = await question('Email/Username to update: ');

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      console.log(`❌ User '${username}' not found.`);
      return;
    }

    console.log(`\nCurrent info for '${username}':`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Full Name: ${user.full_name || 'N/A'}`);
    console.log(`  Organization: ${user.organization || 'N/A'}`);
    console.log(`  State Key: ${user.state_key || 'N/A'}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.active ? 'Yes' : 'No'}`);
    console.log('\nEnter new values (press Enter to keep current):');

    const email = await question(`Email [${user.email}]: `);
    const fullName = await question(`Full Name [${user.full_name || ''}]: `);
    const organization = await question(`Organization [${user.organization || ''}]: `);
    const stateKey = await question(`State Key [${user.state_key || ''}]: `);
    const roleInput = await question(`Role (admin/user) [${user.role}]: `);
    const activeInput = await question(`Active (yes/no) [${user.active ? 'yes' : 'no'}]: `);

    const updates = [];
    const values = [];

    if (email) {
      updates.push('email = ?');
      updates.push('username = ?');  // Keep username and email in sync
      values.push(email);
      values.push(email);
    }
    if (fullName !== undefined && fullName !== '') {
      updates.push('full_name = ?');
      values.push(fullName);
    }
    if (organization !== undefined && organization !== '') {
      updates.push('organization = ?');
      values.push(organization);
    }
    if (stateKey !== undefined) {
      updates.push('state_key = ?');
      values.push(stateKey || null);
    }
    if (roleInput) {
      updates.push('role = ?');
      values.push(roleInput.toLowerCase() === 'admin' ? 'admin' : 'user');
    }
    if (activeInput) {
      updates.push('active = ?');
      values.push(activeInput.toLowerCase() === 'yes' ? 1 : 0);
    }

    if (updates.length === 0) {
      console.log('No changes made.');
      return;
    }

    values.push(user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(values);
    console.log('\n✅ User updated successfully!');
  } catch (err) {
    console.log('❌ Error updating user:', err.message);
  }
}

async function deleteUser() {
  console.log('\n🗑️  Delete User');
  console.log('─'.repeat(50));
  console.log('⚠️  WARNING: This action cannot be undone!');

  const username = await question('Email/Username to delete: ');
  const confirm = await question(`Are you sure you want to delete '${username}'? (yes/no): `);

  if (confirm.toLowerCase() !== 'yes') {
    console.log('Delete cancelled.');
    return;
  }

  try {
    const result = db.prepare('DELETE FROM users WHERE username = ?').run(username);

    if (result.changes === 0) {
      console.log(`❌ User '${username}' not found.`);
    } else {
      console.log(`\n✅ User '${username}' deleted successfully.`);
    }
  } catch (err) {
    console.log('❌ Error deleting user:', err.message);
  }
}

async function testLogin() {
  console.log('\n🔐 Test User Login');
  console.log('─'.repeat(50));

  const username = await question('Email/Username: ');
  const password = await question('Password: ');

  const passwordHash = hashPassword(password);

  try {
    const user = db.prepare(`
      SELECT * FROM users WHERE username = ? AND password_hash = ? AND active = 1
    `).get(username, passwordHash);

    if (user) {
      console.log('\n✅ Login successful!');
      console.log(`   User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   State: ${user.state_key || 'None'}`);
    } else {
      console.log('\n❌ Login failed: Invalid username or password, or account is inactive.');
    }
  } catch (err) {
    console.log('❌ Error during login test:', err.message);
  }
}

async function quickReset() {
  console.log('\n⚡ Quick Password Reset (Common Accounts)');
  console.log('─'.repeat(50));

  // Get list of users
  const users = db.prepare('SELECT username, email FROM users ORDER BY id').all();

  console.log('Available users:');
  users.forEach((user, idx) => {
    console.log(`${idx + 1}. ${user.username}`);
  });
  console.log(`${users.length + 1}. Custom email`);

  const choice = await question(`\nSelect user (1-${users.length + 1}): `);
  const choiceNum = parseInt(choice);

  let username;
  if (choiceNum > 0 && choiceNum <= users.length) {
    username = users[choiceNum - 1].username;
  } else if (choiceNum === users.length + 1) {
    username = await question('Enter email/username: ');
  } else {
    console.log('Invalid choice.');
    return;
  }

  const newPassword = await question('New password: ');
  if (!newPassword) {
    console.log('❌ Password cannot be empty.');
    return;
  }

  const passwordHash = hashPassword(newPassword);

  try {
    const result = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?')
      .run(passwordHash, username);

    if (result.changes === 0) {
      console.log(`❌ User '${username}' not found.`);
    } else {
      console.log(`\n✅ Password reset successfully!`);
      console.log(`   Email/Username: ${username}`);
      console.log(`   Password: ${newPassword}`);
      console.log(`\nYou can now log in with these credentials.`);
    }
  } catch (err) {
    console.log('❌ Error resetting password:', err.message);
  }
}

async function showMenu() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   DOT Corridor User Management Tool   ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\n1. List all users');
  console.log('2. Create new user');
  console.log('3. Reset password');
  console.log('4. Update user details');
  console.log('5. Delete user');
  console.log('6. Test login');
  console.log('7. Quick password reset');
  console.log('0. Exit');

  const choice = await question('\nSelect an option: ');

  try {
    switch (choice) {
      case '1':
        await listUsers();
        break;
      case '2':
        await createUser();
        break;
      case '3':
        await resetPassword();
        break;
      case '4':
        await updateUser();
        break;
      case '5':
        await deleteUser();
        break;
      case '6':
        await testLogin();
        break;
      case '7':
        await quickReset();
        break;
      case '0':
        console.log('\nGoodbye! 👋');
        db.close();
        rl.close();
        process.exit(0);
        return;
      default:
        console.log('Invalid option. Please try again.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Show menu again
  await showMenu();
}

// Start the application
console.log('Starting User Management Tool...\n');
showMenu().catch(err => {
  console.error('Fatal error:', err);
  db.close();
  rl.close();
  process.exit(1);
});
