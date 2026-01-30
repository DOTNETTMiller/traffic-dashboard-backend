# Database Backup & Recovery Guide

## 🛡️ Protection Measures

This system has **automatic database backups** to prevent user data loss during updates and migrations.

## Automatic Backups

**When backups are created:**
- ✅ **Every time the server starts** (automatic)
- ✅ **Before running any migration scripts** (manual)
- ✅ **Up to 30 most recent backups are kept**

**Backup location:** `./backups/`

## Manual Backup Commands

### Create a backup
```bash
node scripts/backup_database.js
```

### List all backups
```bash
node scripts/backup_database.js --list
```

### Restore from a backup
```bash
node scripts/backup_database.js --restore states-2026-01-30T13-30-31.db
```

## 📋 Best Practices

### Before ANY of these actions, create a backup:

1. **Database migrations**
   ```bash
   node scripts/backup_database.js
   node scripts/your-migration-script.js
   ```

2. **Schema changes**
   ```bash
   node scripts/backup_database.js
   # Then make your schema changes
   ```

3. **Major updates**
   ```bash
   node scripts/backup_database.js
   git pull
   npm install
   ```

4. **User management operations**
   - Creating/deleting users
   - Changing user roles
   - Password resets

### What's Protected

✅ **User accounts and authentication**
✅ **State configurations**
✅ **Messages and comments**
✅ **Interchange and bridge data**
✅ **Grant applications**
✅ **All system configuration**

## 🚨 Recovery Procedures

### If you accidentally lose data:

1. **Stop the server immediately**
   ```bash
   # Kill the backend process
   pkill -f "node backend_proxy_server.js"
   ```

2. **List available backups**
   ```bash
   node scripts/backup_database.js --list
   ```

3. **Restore from the most recent backup**
   ```bash
   node scripts/backup_database.js --restore <backup-filename>
   ```

4. **Restart the server**
   ```bash
   node backend_proxy_server.js
   ```

### Manual database file backup (emergency)
```bash
# Create a manual copy
cp states.db states.db.emergency-backup-$(date +%Y%m%d-%H%M%S)
```

## 🔒 What's Excluded from Git

The following are **never committed** to version control:

- `states.db` - Main database file
- `states.db-shm`, `states.db-wal` - SQLite temporary files
- `backups/` - All backup files
- `*.db.backup`, `*.db.bak` - Backup file patterns

## 📊 Backup Retention

- **Maximum backups:** 30 (oldest are auto-deleted)
- **Backup frequency:** On every server startup
- **Backup size:** ~24 MB per backup (compressed SQLite)

## ⚠️ Important Notes

1. **Backups are local only** - They are not synced to the cloud
2. **Production backups** - On Railway/production, consider setting up:
   - PostgreSQL automatic backups (built-in)
   - Daily backup exports
   - Off-site backup storage

3. **Never delete the backups directory** manually unless you're certain all data is safe

## 🔄 Migration Safety Checklist

Before running ANY database migration:

- [ ] Create a manual backup
- [ ] Verify the backup was created successfully
- [ ] Test the migration on a copy first (if possible)
- [ ] Document what changes are being made
- [ ] Know how to restore from backup if needed

## 📞 Support

If you encounter data loss:
1. Check `backups/` directory immediately
2. Use `--list` to see available backups
3. Restore from the most recent backup before the incident
4. The system creates a safety backup before every restore operation
