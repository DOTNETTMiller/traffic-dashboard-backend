# Interstate Corridor Monitoring & Auto-Update System

## Overview

This system automatically monitors OpenStreetMap for changes to interstate highway geometries and notifies you when updates are needed.

**Why is this needed?**
- Roads get realigned due to construction
- OSM volunteers improve route accuracy over time
- New interchanges and exits are added
- Route corrections happen regularly

**What gets monitored:**
- All 11 major interstate corridors
- Both directions (EB/WB or NB/SB)
- Geometry modification dates in OSM
- Data freshness (how old is our data?)

---

## Setup (One-Time)

### 1. Create Monitoring Table

Run this on your PostgreSQL database:

```bash
psql $DATABASE_URL < scripts/setup_corridor_monitoring.sql
```

Or via Railway:
```bash
railway run psql < scripts/setup_corridor_monitoring.sql
```

This creates:
- `corridor_update_checks` table - stores check history
- `latest_corridor_update_status` view - quick status overview
- Timestamps on `corridors` table

### 2. Enable GitHub Action (Automated Checks)

The GitHub Action is already set up at `.github/workflows/check-corridor-updates.yml`

**What it does:**
- ✅ Runs automatically on the 1st of every month
- ✅ Checks all interstate corridors for OSM updates
- ✅ Creates a GitHub issue if updates are needed
- ✅ Can be manually triggered via GitHub UI

**Requirements:**
- GitHub repository must have `DATABASE_URL` secret set
- Go to: Settings → Secrets and variables → Actions → New repository secret
- Name: `DATABASE_URL`
- Value: Your Railway PostgreSQL connection string

---

## Manual Checks

### Check for Updates Now

```bash
# Via Railway (recommended)
railway run node scripts/check_corridor_updates.js

# Locally (with DATABASE_URL set)
DATABASE_URL="your_url" node scripts/check_corridor_updates.js
```

**Output Example:**
```
🔍 Checking Interstate Corridor Geometries for Updates

📊 Found 22 interstate corridors in database

======================================================================
🛣️  Checking: I-80 EB
   Last updated: 1/15/2026, 3:42:18 PM
   🌍 Checking OpenStreetMap for changes...
   ✓ OSM has 623 way segments
   ✓ Latest OSM modification: 1/20/2026, 8:23:45 AM
   ⚠️  NEEDS UPDATE (5 days behind OSM)

======================================================================
🛣️  Checking: I-80 WB
   Last updated: 1/15/2026, 3:43:02 PM
   🌍 Checking OpenStreetMap for changes...
   ✓ OSM has 589 way segments
   ✓ Latest OSM modification: 1/12/2026, 2:15:33 PM
   ✅ UP TO DATE (OSM last modified 3 days before our data)

...

📊 UPDATE CHECK SUMMARY
✅ Up to date: 18 corridors
⚠️  Needs update (30-180 days): 3 corridors
🔴 Significant update needed (>180 days): 1 corridors
❌ Failed to check: 0 corridors

⚠️  CORRIDORS NEEDING UPDATE:
   - I-80 EB: 5 days behind
   - I-35 NB: 47 days behind
   - I-90 WB: 92 days behind

💡 RECOMMENDATION: Update specific corridors
   Run: railway run node scripts/fetch_all_interstate_geometries.js
```

### View Status in Database

```sql
-- Quick status overview
SELECT * FROM latest_corridor_update_status;

-- Group by status
SELECT
  status,
  COUNT(*) as count,
  array_agg(name) as corridors
FROM latest_corridor_update_status
GROUP BY status;

-- Check update history
SELECT
  check_date,
  up_to_date_count,
  needs_update_count,
  significant_update_count
FROM corridor_update_checks
ORDER BY check_date DESC
LIMIT 10;
```

---

## Update Thresholds

The system uses age-based thresholds to determine update urgency:

| Age | Status | Action |
|-----|--------|--------|
| 0-30 days | ✅ **Up to date** | No action needed |
| 30-180 days | ⚠️ **Needs update** | Schedule update in next maintenance |
| 180+ days | 🔴 **Significant update** | Update soon - data may be stale |

**Why these thresholds?**
- **30 days**: Minor OSM edits (tag fixes, small corrections)
- **180 days**: Major construction projects typically show up in OSM within 6 months
- **1 year+**: Likely missing significant route changes

---

## When to Update

### Automatic Triggers (GitHub Action)

The monthly GitHub Action will **automatically create an issue** when:
- Any corridor is >180 days old (significant update needed)
- 3+ corridors are >30 days old (bulk update recommended)

**Issue includes:**
- Summary of corridors needing updates
- Recommended action (exact command to run)
- Full check output
- Links to documentation

### Manual Triggers

Run updates manually when:
- You know of a recent construction project
- New interchange opened
- Route realignment announced
- After major OSM editing events (like "map-a-thon" events)

---

## How to Update After Check

If the check shows corridors need updating:

### Full Update (Recommended)

Updates **all interstates** at once:

```bash
railway run node scripts/fetch_all_interstate_geometries.js
```

**When to use:**
- Multiple corridors need updates
- Scheduled quarterly/annual maintenance
- After 6+ months since last update

**Time:** ~10 minutes

### Selective Update (Advanced)

To update just one interstate, modify the script temporarily:

```javascript
// In fetch_all_interstate_geometries.js
const INTERSTATES = [
  { number: '80', name: 'I-80', bounds: {...}, orientation: 'EW' }
  // Comment out others
];
```

Then run:
```bash
railway run node scripts/fetch_all_interstate_geometries.js
```

---

## Monitoring Dashboard (Future Enhancement)

You can build a simple monitoring dashboard using the tracking data:

```sql
-- Create a materialized view for monitoring
CREATE MATERIALIZED VIEW corridor_health_dashboard AS
SELECT
  c.name,
  c.updated_at,
  EXTRACT(days FROM (NOW() - c.updated_at))::INTEGER as days_old,
  jsonb_array_length((c.geometry->'coordinates')) as points,
  CASE
    WHEN c.updated_at < NOW() - INTERVAL '180 days' THEN 'red'
    WHEN c.updated_at < NOW() - INTERVAL '30 days' THEN 'yellow'
    ELSE 'green'
  END as health_status
FROM corridors c
WHERE c.name LIKE 'I-%'
ORDER BY c.updated_at ASC NULLS FIRST;

-- Refresh daily via cron
-- REFRESH MATERIALIZED VIEW corridor_health_dashboard;
```

---

## Best Practices

### 1. Regular Schedule

**Recommended update frequency:**
- **Check:** Monthly (automated via GitHub Action)
- **Update:** Quarterly or when issues are created
- **Full refresh:** Annually in January

**Why quarterly?**
- Most road projects take months to appear in OSM
- Prevents unnecessary API load
- Balances data freshness with resource usage

### 2. Before Major Events

Update geometries before:
- Grant applications (show current infrastructure)
- Major incident planning exercises
- Data quality audits
- Pooled fund meetings

### 3. After Construction Projects

If you know of a major interstate project:
1. Wait 2-4 weeks after completion
2. Check if OSM has been updated (volunteers usually update quickly)
3. Run the update script if new geometry is available

### 4. Monitor OSM Changesets

For proactive monitoring, you can subscribe to OSM changesets:
- https://osmcha.org/
- Filter by: `highway=motorway` + your state
- Set up email alerts for changes

---

## Troubleshooting

### Check says "Failed to fetch OSM metadata"

**Cause:** Overpass API timeout or rate limiting

**Solution:**
1. Wait 5 minutes and retry
2. Check Overpass API status: https://overpass-api.de/api/status
3. Try a different Overpass instance if needed

### Check shows many corridors as "Never updated"

**Cause:** Corridors don't have `updated_at` timestamps

**Solution:**
```sql
-- Set all existing corridors to current date
UPDATE corridors
SET updated_at = NOW()
WHERE updated_at IS NULL AND name LIKE 'I-%';
```

### GitHub Action not running

**Check:**
1. Ensure `DATABASE_URL` secret is set in GitHub
2. Check Actions tab for error messages
3. Verify workflow file is in `.github/workflows/` directory
4. Check if Actions are enabled for your repository

---

## Exit Codes

The check script uses exit codes for automation:

- `0` - All corridors up to date ✅
- `1` - Some corridors need update ⚠️
- `2` - Script error/failure ❌

Use in automation:
```bash
if railway run node scripts/check_corridor_updates.js; then
  echo "All good!"
else
  echo "Updates needed - creating ticket"
  # Your ticketing system integration here
fi
```

---

## Cost & Performance

**API Usage:**
- ✅ FREE - uses OSM Overpass API
- ✅ Lightweight metadata queries only (no full geometry downloads)
- ✅ ~2 seconds per corridor check
- ✅ ~1 minute total for all 22 corridors

**Resource Impact:**
- Minimal database load (simple queries)
- No expensive computations
- Can run during business hours

**Data Transfer:**
- ~10 KB per corridor check
- ~220 KB total for full check
- Negligible bandwidth usage

---

## Future Enhancements

Ideas for expanding the monitoring system:

1. **Email Notifications**
   - Send alerts when significant updates needed
   - Weekly digest of data freshness

2. **Slack/Teams Integration**
   - Post to channel when updates available
   - Interactive buttons to trigger updates

3. **Web Dashboard**
   - Visual map showing corridor freshness
   - Click to see update history
   - One-click update trigger

4. **ML-Based Change Detection**
   - Predict when updates likely needed
   - Learn seasonal patterns
   - Prioritize high-traffic corridors

5. **Auto-Update Mode**
   - Automatically apply updates if confidence high
   - Require approval for significant changes
   - Rollback capability

---

## Summary

**Setup once:**
```bash
# 1. Create monitoring table
railway run psql < scripts/setup_corridor_monitoring.sql

# 2. Add DATABASE_URL secret to GitHub
# (via GitHub Settings → Secrets)
```

**Then forget about it:**
- GitHub Action runs monthly automatically
- Creates issues when updates needed
- You just run the update script when notified

**Manual check anytime:**
```bash
railway run node scripts/check_corridor_updates.js
```

**Update when needed:**
```bash
railway run node scripts/fetch_all_interstate_geometries.js
```

🎯 **Result:** Always-fresh corridor geometries without manual tracking!
