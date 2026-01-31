# Fixing TETC Corridor Geometry Visualization

## Problem

The TETC Corridor visualization layer shows multiple overlapping lines that don't follow the actual interstate routes. This happens because corridor geometries in the database are either:
1. Simple straight lines between start/end points
2. Fragmented segments that don't connect properly
3. Missing actual highway route data

## Solution

We provide **two scripts** to fix corridor geometries with real road-following data:

### Option 1: Fetch Real I-80 Geometry from OpenStreetMap (RECOMMENDED)

**Script:** `scripts/fetch_i80_osm_geometry.js`

This script fetches actual Interstate 80 highway geometry from OpenStreetMap's Overpass API and updates the database with accurate road-following polylines.

**Advantages:**
- ✅ Uses real highway data from OpenStreetMap
- ✅ Follows actual road curves and interchanges
- ✅ More accurate than routing algorithms
- ✅ Free, no API key required
- ✅ Automatically simplifies to ~100 points for optimal rendering

**How to Run:**

```bash
# On Railway production (recommended)
railway run node scripts/fetch_i80_osm_geometry.js

# Or locally with DATABASE_URL
DATABASE_URL="your_postgres_url" node scripts/fetch_i80_osm_geometry.js
```

**What it does:**
1. Queries your `corridors` table for I-80 segments
2. For each corridor, fetches real highway geometry from OpenStreetMap within the corridor bounds
3. Merges and deduplicates OSM way segments
4. Simplifies coordinates to ~100 points for smooth rendering
5. Updates the database with proper LineString geometry

**Expected Output:**
```
🛣️  Fetching I-80 geometry from OpenStreetMap...

📊 Found 3 I-80 corridor(s) to update

🔧 Processing: I-80 Iowa Segment
   Bounds: [-96.619, 41.236] to [-90.140, 42.073]
   🌍 Querying OpenStreetMap Overpass API...
   ✓ Found 47 I-80 way segments
   ✓ Extracted 1834 coordinate points
   ✓ Deduplicated to 1721 unique points
   ✓ Simplified from 1721 to 100 points
   ✅ Database updated successfully

✅ Successfully updated: 3 corridor(s)
📊 Final geometry state:
   - I-80 Iowa Segment: 100 points
   - I-80 Nebraska Segment: 97 points
   - I-80 Wyoming Segment: 103 points
```

---

### Option 2: Generate Routes Using OSRM (Fallback)

**Script:** `scripts/fix_corridor_geometries.js`

This script uses the OSRM routing engine to generate road-following routes between corridor start/end points.

**Advantages:**
- ✅ Works for any corridor with defined bounds
- ✅ Uses free OSRM routing service
- ✅ Automatically simplifies geometry

**Disadvantages:**
- ⚠️ May not perfectly match actual interstate route
- ⚠️ Routing algorithm may take shortcuts
- ⚠️ Less accurate than real OSM data

**How to Run:**

```bash
# On Railway production
railway run node scripts/fix_corridor_geometries.js

# Or locally with DATABASE_URL
DATABASE_URL="your_postgres_url" node scripts/fix_corridor_geometries.js
```

---

## After Running the Fix

### 1. Verify in Database

Connect to your PostgreSQL database and check the corridor geometries:

```sql
-- Check updated corridors
SELECT
  id,
  name,
  jsonb_array_length((geometry->'coordinates')) as point_count,
  geometry->'type' as geom_type
FROM corridors
WHERE name LIKE '%I-80%';
```

Expected result:
```
 id |        name        | point_count | geom_type
----+--------------------+-------------+------------
  1 | I-80 Iowa Segment  |         100 | "LineString"
  2 | I-80 Nebraska Seg  |          97 | "LineString"
```

### 2. Test in the Application

1. Navigate to the map view in your application
2. Look for the TETC Corridors toggle button (should appear as "📊 Show Market Opportunities" or "🎯 Show Data Quality")
3. The I-80 corridor should now render as a **single smooth blue line** following the actual highway route

**Before Fix:**
- Multiple overlapping straight lines
- Lines don't follow roads
- Looks fragmented and incorrect

**After Fix:**
- Single continuous line
- Follows actual I-80 highway path
- Smooth curves and accurate routing

---

## Troubleshooting

### Issue: "No I-80 segments found"

**Cause:** Corridor names in database don't match the query

**Solution:** Check corridor names in your database:
```sql
SELECT id, name, description FROM corridors;
```

Update the script's query if needed:
```javascript
WHERE name LIKE '%I-80%' OR name LIKE '%Interstate 80%' OR name LIKE '%Iowa%'
```

### Issue: "No bounds defined"

**Cause:** Corridor records don't have bounds data

**Solution:** Add bounds manually:
```sql
UPDATE corridors
SET bounds = jsonb_build_object(
  'north', 42.073,
  'south', 41.236,
  'east', -90.140,
  'west', -96.619
)
WHERE name = 'I-80 Iowa Segment';
```

### Issue: "Overpass API timeout"

**Cause:** Requesting too large an area or OSM server is busy

**Solutions:**
1. Wait a few minutes and retry
2. Split large corridors into smaller segments
3. Use the OSRM script (Option 2) as fallback

### Issue: Still seeing multiple lines after fix

**Possible causes:**

1. **Frontend cache:** Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)
2. **Multiple corridor records:** Check if there are duplicate I-80 entries
   ```sql
   SELECT * FROM corridors WHERE name LIKE '%I-80%';
   ```
3. **Geometry not updated:** Verify the update timestamp
   ```sql
   SELECT name, updated_at FROM corridors WHERE name LIKE '%I-80%';
   ```

---

## API Usage & Costs

### OpenStreetMap Overpass API
- **Cost:** FREE
- **Rate Limits:** ~2 requests per second (we add 2-second delays automatically)
- **Data License:** ODbL (Open Database License) - attribution required
- **Attribution:** Add to your app footer: "Map data © OpenStreetMap contributors"

### OSRM Routing Engine
- **Cost:** FREE (using public instance at router.project-osrm.org)
- **Rate Limits:** Fair use policy (we add 1-second delays)
- **Note:** For production, consider self-hosting OSRM for better reliability

---

## Best Practices

1. **Run on Production:** Always run geometry fixes on your production database where the corridors table lives

2. **Backup First:** Although these scripts only UPDATE existing records, it's good practice to backup:
   ```sql
   CREATE TABLE corridors_backup AS SELECT * FROM corridors;
   ```

3. **Test on Staging:** If you have a staging environment, test there first

4. **Monitor API Usage:** Both OSM and OSRM are free but have fair-use policies. The scripts include delays to be respectful.

5. **Update Periodically:** OSM data improves over time. Re-run annually to get the latest highway data.

---

## For Other Corridors

To add geometry for other interstate corridors (I-35, I-70, etc.), modify the OSM script:

```javascript
// In fetch_i80_osm_geometry.js, update the query:
const overpassQuery = `
  [out:json][timeout:60];
  (
    way["highway"="motorway"]["ref"~"I-?35"];  // Change to I-35
    way["highway"="motorway_link"]["ref"~"I-?35"];
  )(${south},${west},${north},${east});
  out geom;
`;
```

And update the corridor selection:
```javascript
WHERE name LIKE '%I-35%' OR name LIKE '%Interstate 35%'
```

---

## Summary

**Recommended workflow:**

1. **First time:** Run `fetch_i80_osm_geometry.js` to get real OSM data
2. **Verification:** Check the map - corridors should render as smooth lines
3. **Future updates:** Re-run annually or when adding new corridors
4. **Fallback:** If OSM fails, use `fix_corridor_geometries.js` with OSRM routing

**Expected result:** Clean, single-line corridor visualization that accurately follows Interstate 80's actual path across all states.
