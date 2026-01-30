#!/usr/bin/env node

/**
 * Database Backup Script
 *
 * Creates timestamped backups of the database to prevent data loss
 * Run this before any migrations or major updates
 *
 * Usage:
 *   node scripts/backup_database.js
 *   node scripts/backup_database.js --auto  (for automated backups)
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '..', 'states.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 30; // Keep last 30 backups

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`📁 Created backup directory: ${BACKUP_DIR}`);
}

function createBackup(isAuto = false) {
  try {
    // Check if database exists
    if (!fs.existsSync(DB_FILE)) {
      console.log('⚠️  Database file not found, skipping backup');
      return null;
    }

    // Get database file size
    const stats = fs.statSync(DB_FILE);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupFile = path.join(BACKUP_DIR, `states-${timestamp}.db`);

    // Copy database file
    fs.copyFileSync(DB_FILE, backupFile);

    const prefix = isAuto ? '🤖 Auto-backup' : '💾 Backup';
    console.log(`${prefix} created: ${path.basename(backupFile)} (${sizeMB} MB)`);

    // Clean up old backups
    cleanupOldBackups();

    return backupFile;
  } catch (error) {
    console.error('❌ Error creating backup:', error.message);
    return null;
  }
}

function cleanupOldBackups() {
  try {
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('states-') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort newest first

    if (backups.length > MAX_BACKUPS) {
      const toDelete = backups.slice(MAX_BACKUPS);
      toDelete.forEach(backup => {
        fs.unlinkSync(backup.path);
        console.log(`🗑️  Removed old backup: ${backup.name}`);
      });
    }
  } catch (error) {
    console.error('❌ Error cleaning up backups:', error.message);
  }
}

function listBackups() {
  try {
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('states-') && file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        return {
          name: file,
          size: `${sizeMB} MB`,
          date: stats.mtime.toLocaleString()
        };
      })
      .sort((a, b) => b.name.localeCompare(a.name)); // Sort newest first

    console.log('\n📋 Available Backups:');
    console.log('─'.repeat(80));
    if (backups.length === 0) {
      console.log('No backups found.');
    } else {
      backups.forEach((backup, i) => {
        console.log(`${i + 1}. ${backup.name}`);
        console.log(`   Size: ${backup.size} | Created: ${backup.date}`);
      });
      console.log('─'.repeat(80));
      console.log(`Total: ${backups.length} backup(s)`);
    }
  } catch (error) {
    console.error('❌ Error listing backups:', error.message);
  }
}

function restoreBackup(backupFile) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFile);

    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Backup file not found: ${backupFile}`);
      return false;
    }

    // Create a backup of current database before restoring
    console.log('⚠️  Creating safety backup of current database...');
    const safetyBackup = createBackup();

    // Restore backup
    fs.copyFileSync(backupPath, DB_FILE);
    console.log(`✅ Database restored from: ${backupFile}`);
    console.log(`📌 Safety backup created at: ${path.basename(safetyBackup)}`);

    return true;
  } catch (error) {
    console.error('❌ Error restoring backup:', error.message);
    return false;
  }
}

// CLI handling
const args = process.argv.slice(2);
const command = args[0];

if (command === '--auto') {
  createBackup(true);
} else if (command === '--list') {
  listBackups();
} else if (command === '--restore') {
  const backupFile = args[1];
  if (!backupFile) {
    console.error('❌ Please specify a backup file to restore');
    console.log('\nUsage: node scripts/backup_database.js --restore <backup-filename>');
    listBackups();
    process.exit(1);
  }
  restoreBackup(backupFile);
} else {
  console.log('💾 DOT Corridor Database Backup Tool\n');
  createBackup(false);
  console.log('\n📁 Backup location:', BACKUP_DIR);
  console.log('\n📖 Commands:');
  console.log('  --list              List all available backups');
  console.log('  --restore <file>    Restore from a specific backup');
  console.log('  --auto              Auto-backup (silent mode)');
}
