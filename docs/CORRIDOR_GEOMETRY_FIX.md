# Fixing TETC Corridor Geometry Visualization

## Problem

The TETC Corridor visualization layer shows multiple overlapping lines that don't follow the actual interstate routes. This happens because corridor geometries in the database are either:
1. Simple straight lines between start/end points
2. Fragmented segments that don't connect properly
3. Missing actual highway route data
4. **Not separated by direction** (EB/WB or NB/SB lanes shown as one line)

## Solution

We provide **THREE scripts** to comprehensively fix corridor geometries with real road-following data and directional separation:

### Option 1: Fetch ALL Interstate Geometries with Split Highways (RECOMMENDED) ⭐

**Script:** `scripts/fetch_all_interstate_geometries.js`

This script fetches **ALL major interstate highways** from OpenStreetMap with **separate geometries for each direction** (EB/WB or NB/SB).

**Interstates Included:**
- I-5 (West Coast, NS)
- I-10 (Southern, EW)
- I-15 (Intermountain, NS)
- I-20 (Southern, EW)
- I-25 (Mountain, NS)
- I-35 (Central, NS)
- I-40 (Southern, EW)
- I-70 (Central, EW)
- I-80 (Northern, EW)
- I-90 (Northern, EW)
- I-95 (East Coast, NS)

**Features:**
- ✅ **Split highways**: Separate EB/WB or NB/SB roadways
- ✅ **Directional detection**: Uses OSM tags and geometry analysis
- ✅ **National coverage**: All 11 major interstates
- ✅ **Automatic simplification**: ~150 points per direction
- ✅ **Creates separate corridor records**: "I-80 EB", "I-80 WB", etc.

**How to Run:**

```bash
# On Railway production (RECOMMENDED)
railway run node scripts/fetch_all_interstate_geometries.js

# Or locally with DATABASE_URL
DATABASE_URL="your_postgres_url" node scripts/fetch_all_interstate_geometries.js
```

**What it does:**
1. Queries OpenStreetMap for each interstate's full extent
2. Separates ways by direction using OSM tags and coordinate analysis
3. Merges segments for each direction into continuous lines
4. Creates/updates corridor records with directional names (e.g., "I-80 EB", "I-80 WB")
5. Takes ~5-10 minutes due to API rate limiting

**Expected Output:**
```
🇺🇸 Fetching ALL Interstate Highway Geometries from OpenStreetMap

======================================================================
🛣️  Fetching I-80 (East-West)
   Bounds: [-124, 39.5] to [-74, 42.5]
======================================================================
   🌍 Querying OpenStreetMap Overpass API...
   ✓ Found 1247 way segments
   📊 Direction breakdown:
      Eastbound (EB): 623 segments
      Westbound (WB): 589 segments
      Undirected: 35 segments
   ✓ EAST: 18,234 → 17,892 → 150 points
   ✓ WEST: 17,456 → 17,102 → 150 points
   ✅ Created: I-80 EB
   ✅ Created: I-80 WB

✅ Successfully fetched: 11 interstates
🛣️  Total corridor directions created: 22

📋 All Interstate Corridors in Database:
   I-5 NB: 148 points
   I-5 SB: 152 points
   I-10 EB: 149 points
   I-10 WB: 151 points
   ...
   I-95 NB: 147 points
   I-95 SB: 153 points
```

---

### Option 2: Fetch Real I-80 Geometry from OpenStreetMap (Single Interstate)

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

### Option 3: Fix Work Zone Directional Assignments ⭐

**Script:** `scripts/fix_workzone_directions.js`

**Problem:** Work zones often report incorrect direction in their description. For example:
- Work zone says "WB" (westbound) but is actually on the EB (eastbound) roadway
- This confuses operators and misroutes traffic alerts

**Solution:** This script uses corridor geometry to determine which actual roadway the event is closest to, then corrects the `direction` field.

**How it works:**
1. Loads all directional corridors (I-80 EB, I-80 WB, etc.)
2. For each work zone with directional info, calculates distance to each roadway
3. Finds the closest roadway geometry
4. Compares claimed direction (from description) vs actual roadway
5. Updates the `direction` field if mismatch found

**How to Run:**

```bash
# DRY RUN first (recommended) - shows what would change
railway run node scripts/fix_workzone_directions.js --dry-run

# Apply fixes
railway run node scripts/fix_workzone_directions.js
```

**Expected Output:**
```
🔧 Fixing Work Zone Directional Assignments

📊 Found 22 directional corridors

🛣️  Corridors by interstate:
   I-80: EB, WB
   I-35: NB, SB
   I-90: EB, WB

📋 Found 437 work zone events with directional info

🔴 MISMATCH FOUND:
   Event ID: 12847
   Road: I-80
   Title: Lane closure for bridge work...
   Claimed Direction: WESTBOUND
   Actual Roadway: I-80 EB
   Actual Direction: EASTBOUND
   Distance to roadway: 0.08 miles
   ✅ Updated direction to: eastbound

📊 SUMMARY
✅ Already correct: 398 events
🔧 Fixed: 39 events
⚠️  No match/unclear: 0 events
```

**Benefits:**
- ✅ Accurate directional routing alerts
- ✅ Better operator situational awareness
- ✅ Prevents wrong-way traffic advisories
- ✅ Improves data quality metrics

---

### Option 4: Generate Routes Using OSRM (Fallback)

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

## Summary & Recommended Workflow

**Complete setup (first time):**

```bash
# Step 1: Fetch ALL interstate geometries with split highways (takes ~10 min)
railway run node scripts/fetch_all_interstate_geometries.js

# Step 2: Fix work zone directional assignments
railway run node scripts/fix_workzone_directions.js --dry-run  # Preview first
railway run node scripts/fix_workzone_directions.js            # Apply fixes

# Step 3: Verify in application
# Navigate to map → TETC Corridors layer should show separate EB/WB or NB/SB lines
```

**Maintenance (annual or when adding corridors):**

```bash
# Re-fetch OSM data (roads get updated/improved over time)
railway run node scripts/fetch_all_interstate_geometries.js

# Re-check work zone directions
railway run node scripts/fix_workzone_directions.js
```

**Expected Results:**

1. **Corridor Visualization:**
   - ✅ Separate blue lines for EB and WB (or NB/SB)
   - ✅ Each line follows actual roadway precisely
   - ✅ Smooth curves matching real interstate geometry
   - ✅ No overlapping or fragmented lines

2. **Work Zone Accuracy:**
   - ✅ Events assigned to correct roadway direction
   - ✅ "WB" work zones actually on WB lanes
   - ✅ Improved data quality scores
   - ✅ Better routing and alert systems

3. **Data Quality:**
   - ✅ More accurate DQI scores for corridors
   - ✅ Better vendor coverage gap analysis
   - ✅ Improved interstate event correlation

## Split Highway Benefits

**Why separate EB/WB or NB/SB?**

1. **Operational Clarity**: Operators can see which specific roadway has incidents
2. **Directional Routing**: Traffic apps can route around issues in one direction only
3. **Data Quality**: Measure vendor coverage separately for each direction
4. **Event Correlation**: Match events to correct roadway for better analysis
5. **Truck Parking**: Different directions may have different parking facility access

**Visual Example:**

Before (single line):
```
    ════════════════════════  I-80 (overlapping EB+WB)
```

After (split highways):
```
    ════════════════════════  I-80 EB (eastbound lanes)
    ════════════════════════  I-80 WB (westbound lanes)
```

This matches how the actual interstate is built - two separate roadways, often miles apart in rural areas!
