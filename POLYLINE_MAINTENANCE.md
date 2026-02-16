# Interstate Polyline Maintenance Guide

This guide explains how to set up automatic updates for your Interstate highway polylines.

## Overview

The Interstate polylines (I-80 and I-35) provide high-quality curved geometry for traffic events. These polylines should be updated periodically to account for highway changes and improvements.

**Update Schedule:** Every 90 days (or when major highway construction occurs)

## Automated Update Options

### Option 1: Railway Cron Jobs (Recommended for Production)

Railway supports cron jobs that can run on a schedule. Add this to your `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE"
  },
  "cron": [
    {
      "name": "update-interstate-polylines",
      "schedule": "0 2 1 * *",
      "command": "node scripts/auto_update_polylines.js"
    }
  ]
}
```

**Schedule:** `0 2 1 * *` = 2:00 AM on the 1st of every month

### Option 2: GitHub Actions (Free Automation)

Create `.github/workflows/update-polylines.yml`:

```yaml
name: Update Interstate Polylines

on:
  schedule:
    # Run at 2 AM on the 1st of every month
    - cron: '0 2 1 * *'
  workflow_dispatch:  # Allow manual triggering

jobs:
  update-polylines:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run automatic update
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: node scripts/auto_update_polylines.js

      - name: Notify on failure
        if: failure()
        run: echo "Polyline update failed - check logs"
```

**Setup:**
1. Add `DATABASE_URL` to GitHub Secrets (Settings → Secrets → Actions)
2. Commit the workflow file
3. GitHub will run it monthly (and you can trigger manually)

### Option 3: Manual Cron Job (Linux/Mac Server)

If you're running on your own server, use crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs 1st of month at 2 AM)
0 2 1 * * cd /path/to/DOT\ Corridor\ Communicator && DATABASE_URL="your_db_url" node scripts/auto_update_polylines.js >> /var/log/polyline-updates.log 2>&1
```

### Option 4: Node-Cron (In-App Scheduling)

Add to your `backend_proxy_server.js`:

```javascript
const cron = require('node-cron');
const { checkAndUpdate } = require('./scripts/auto_update_polylines');

// Schedule for 1st of month at 2 AM
cron.schedule('0 2 1 * *', async () => {
  console.log('🔄 Running scheduled Interstate polyline update...');
  try {
    await checkAndUpdate();
  } catch (err) {
    console.error('❌ Scheduled update failed:', err);
  }
});
```

Then install node-cron:
```bash
npm install node-cron
```

## Manual Updates

### Check if Update Needed

```bash
node scripts/check_polyline_updates.js
```

### Run Update Manually

```bash
node scripts/auto_update_polylines.js
```

### Update Specific Interstate

**I-80 only:**
```bash
node scripts/build_interstate_polylines.js
node scripts/fix_i80_wb_sequence.js
```

**I-35 only:**
```bash
node scripts/fetch_i35_via_nominatim.js
node scripts/complete_i35_iowa_minnesota.js
```

## How the Auto-Update Works

1. **Checks Age:** Queries database for `updated_at` timestamp on each corridor
2. **Determines Need:** If any corridor is > 90 days old, triggers update
3. **Runs Scripts:** Automatically runs the appropriate build scripts
4. **Fixes Sequences:** Ensures I-80 WB direction is correct
5. **Reports Results:** Logs success/failure of each step

## Monitoring Updates

### View Last Update Time

```sql
SELECT id, updated_at,
       EXTRACT(DAY FROM (CURRENT_TIMESTAMP - updated_at)) as days_old
FROM corridors
WHERE id IN ('i-80-eb', 'i-80-wb', 'i-35-nb', 'i-35-sb')
ORDER BY id;
```

### Check Polyline Health

```bash
node scripts/test_polyline_snapping.js
```

This tests that:
- All sequences are correct (EB/WB/NB/SB)
- Events snap properly to polylines
- No reversed coordinates

## Troubleshooting

### Update Failed - Rate Limited by Overpass API

**Solution:** The scripts have built-in rate limiting (2-3 seconds between requests). If you still hit limits, wait 1 hour and re-run.

### Update Failed - Timeout Errors

**Solution:** Some OSM queries timeout if the network is slow. Re-running usually succeeds.

### Polyline Sequence Reversed

**Solution:** Run the sequence fix script:
```bash
node scripts/fix_i80_wb_sequence.js
```

### Database Connection Failed

**Solution:** Ensure `DATABASE_URL` environment variable is set:
```bash
echo $DATABASE_URL
```

## When to Force an Update

Update immediately (outside the 90-day schedule) if:

1. **Major Highway Construction:** Interstate realignment, new segments
2. **Data Issues Reported:** Users see geometry problems
3. **After Database Migration:** Polylines may need rebuilding
4. **OSM Data Improved:** Community improved highway data

## Support

- **Scripts:** All in `scripts/` directory
- **Test:** `scripts/test_polyline_snapping.js`
- **Check:** `scripts/check_polyline_updates.js`
- **Auto-Update:** `scripts/auto_update_polylines.js`

---

**Last Updated:** 2026-02-15
**Polyline Coverage:** I-80 (11 states), I-35 (6 states)
