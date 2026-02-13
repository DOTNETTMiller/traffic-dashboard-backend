# Iowa I-80 Geometry Issue - Technical Documentation

**Date**: February 6, 2026
**Problem**: Only 9% (3/32) of Iowa I-80 events display curved highway geometry; 81% show straight 2-point lines
**Status**: TIGER/Line geometry imported successfully, but events not using it

---

## 1. Architecture Overview

### Backend
- **Platform**: Node.js/Express API hosted on Railway
- **Database**: PostgreSQL with PostGIS/JSONB geometry storage
- **API Endpoint**: `https://corridor-communication-dashboard-production.up.railway.app/api/events`

### Database Schema

**`corridors` table**:
```sql
Column       | Type                        | Nullable
-------------+-----------------------------+---------
id           | text                        | NOT NULL
name         | text                        | NOT NULL
description  | text                        |
geometry_ref | text                        |
created_at   | timestamp without time zone |
updated_at   | timestamp without time zone |
geometry     | jsonb                       |
bounds       | jsonb                       |
```

**`events` table** (relevant columns):
```sql
Column          | Type
----------------+------------------
id              | text
corridor        | text
start_latitude  | double precision
start_longitude | double precision
end_latitude    | double precision
end_longitude   | double precision
geometry        | jsonb
```

### Frontend
- Displays events on interactive map
- Uses `geometry` field from event JSON to draw curved lines
- Falls back to straight lines when geometry is missing/minimal

---

## 2. Current Database State

### I-80 WB Corridor Geometry

```bash
# Query to inspect I-80 WB geometry
env DATABASE_URL="..." psql -c "
  SELECT
    name,
    jsonb_array_length(geometry->'coordinates') as coord_count,
    geometry->'type' as geom_type
  FROM corridors
  WHERE name = 'I-80 WB';
"
```

**Result**:
- **Name**: I-80 WB
- **Coordinates**: 94,078 points
- **Type**: LineString
- **Source**: TIGER/Line 2023 Primary Roads (US Census Bureau)
- **Last Updated**: February 6, 2026

**Known Gaps in TIGER/Line Data**:
- Gap 1: 1,967.5 miles at coordinate index 1,165
- Gap 2: 28.8 miles at coordinate index 1,662
- Gap 3: 1,810.1 miles at coordinate index 2,172

**Note**: These massive gaps indicate TIGER stores I-80 as disconnected regional segments, not a continuous route.

### Sample Corridor Geometry (First 5 Coordinates)

```javascript
{
  "type": "LineString",
  "coordinates": [
    [-124.20891700011, 41.99829769937],
    [-124.20886699964, 41.99838469949],
    [-124.20874400023, 41.99856269922],
    [-124.20843600034, 41.99900870067],
    [-124.20817700028, 41.99937570000]
  ]
}
```

---

## 3. The Problem

### Expected Behavior
Events should display as **curved highways** following the I-80 WB geometry with 94,078 available coordinates.

### Actual Behavior (Test Results from Iowa I-80 Events)

**Total Events**: 32

**✅ Working Events (3 - 9%)**:
- 8-9 coordinates per event
- Display as proper curved highways
- Example coordinate counts: 8, 9, 8

**❌ Broken Events (26 - 81%)**:
- 2 coordinates per event (straight line)
- Not using corridor geometry
- Simply drawing straight line from start to end point

**⚠️ No Geometry (3 - 9%)**:
- Missing geometry field entirely

### Sample Event Comparison

**Working Event** (event-2026-02-03-i-80-eb-between-us-63-mm-...):
```json
{
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-92.32959, 41.66419],
      [-92.32959, 41.66419],
      [-92.24893, 41.66667],
      [-92.24893, 41.66667],
      [-92.24893, 41.66667],
      [-92.24893, 41.66667],
      [-92.24893, 41.66667],
      [-92.24893, 41.66667]
    ]
  },
  "start_latitude": 41.66419,
  "start_longitude": -92.32959,
  "end_latitude": 41.66667,
  "end_longitude": -92.24893,
  "corridor": "I-80 EB"
}
```

**Broken Event** (typical):
```json
{
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [-93.xxx, 41.xxx],  // start point
      [-93.yyy, 41.yyy]   // end point
    ]
  },
  "start_latitude": 41.xxx,
  "start_longitude": -93.xxx,
  "end_latitude": 41.yyy,
  "end_longitude": -93.yyy,
  "corridor": "I-80 WB"
}
```

---

## 4. Event Processing Flow

### How Events Are Created

1. **Event Ingestion**: Iowa DOT data imported/synced
2. **Corridor Detection**: `corridor` field set to "I-80 WB", "I-80 EB", etc.
3. **Location Data**: `start_latitude`, `start_longitude`, `end_latitude`, `end_longitude` extracted
4. **Geometry Snapping**: Backend should query `corridors` table and extract relevant portion of geometry
5. **Event Saved**: Event stored with full curved geometry

### Expected Geometry Snapping Logic

**Hypothetical Process**:
```javascript
// 1. Get corridor geometry
const corridor = await db.query(
  `SELECT geometry FROM corridors WHERE name = $1`,
  [event.corridor]
);

// 2. Find nearest points on corridor geometry
const startPoint = findNearestPoint(corridor.geometry, event.start_longitude, event.start_latitude);
const endPoint = findNearestPoint(corridor.geometry, event.end_longitude, event.end_latitude);

// 3. Extract segment between start and end
const eventGeometry = extractSegment(corridor.geometry, startPoint.index, endPoint.index);

// 4. Save event with curved geometry
event.geometry = eventGeometry;
```

### Actual Behavior

**For 26 out of 32 events**: Geometry snapping fails or is bypassed, falling back to simple straight line:
```javascript
event.geometry = {
  type: 'LineString',
  coordinates: [
    [event.start_longitude, event.start_latitude],
    [event.end_longitude, event.end_latitude]
  ]
};
```

---

## 5. What We've Tried

### Approach 1: OSM Relation-Based Fetching ❌
**Status**: FAILED

**Attempt**: Use OpenStreetMap route relations to get properly ordered Interstate segments
- Identified 22 I-80 route relations (11 WB, 11 EB)
- Created script: `scripts/fetch_i80_via_relation.js`

**Result**: Overpass API returned 504 Gateway Timeout on recursive member queries

**File**: `/Users/mattmiller/Projects/DOT/DOT Corridor Communicator/scripts/fetch_i80_via_relation.js`

### Approach 2: TIGER/Line Import ✅ (Partial Success)
**Status**: GEOMETRY IMPORTED, BUT EVENTS NOT USING IT

**Process**:
1. Downloaded TIGER/Line 2023 Primary Roads (36.4MB shapefile)
2. Filtered to Interstates only: `ogr2ogr -f GeoJSON -where "RTTYP='I'" tiger_interstates.geojson tl_2023_us_primaryroads.shp`
3. Created import script: `scripts/import_tiger_interstates.js`
4. Merged 256 I-80 segments into single LineString per direction
5. Successfully imported 217 Interstates (434 directional corridors)

**Result**:
- ✅ I-80 WB geometry updated: 47,621 → 94,078 coordinates
- ❌ Only 3 out of 32 events use the new geometry (9% success rate)

**Files**:
- Script: `/Users/mattmiller/Projects/DOT/DOT Corridor Communicator/scripts/import_tiger_interstates.js`
- Data: `/tmp/tiger_interstates.geojson` (45MB, 5,599 features)
- Log: `/tmp/tiger_import.log`

### Approach 3: Research Alternative Data Sources 📚
**Status**: NO PERFECT SOLUTION EXISTS

**Sources Investigated**:
- **HPMS (Highway Performance Monitoring System)**: Federal data, but "may not completely cover all Federal-aid highways"
- **OSM Wiki**: Acknowledges gaps exist in highway relations
- **TIGER/Line**: Official US Census data, but stores roads as disconnected regional segments

**Conclusion**: All public Interstate datasets have gaps at boundaries. This is a fundamental limitation.

---

## 6. Key Questions for External Help

### Question 1: Where is the geometry snapping logic?
- Is there a specific file/function that handles attaching corridor geometry to events?
- Search terms: "geometry", "snap", "corridor", "LineString"

### Question 2: Why do 3 events work but 26 don't?
- What's different about the 3 working events?
- Are they using a different code path?
- Do they have different location accuracy?

### Question 3: Are events falling outside TIGER geometry segments?
- Do the 26 broken events have start/end points that fall in the 3 gap areas?
- Test query:
  ```sql
  SELECT id, corridor, start_longitude, start_latitude, end_longitude, end_latitude
  FROM events
  WHERE corridor LIKE 'I-80%' AND state = 'Iowa';
  ```

### Question 4: Is there a distance threshold for snapping?
- If an event's location is too far from the corridor geometry, does it fall back to straight line?
- Example: If gap is 1,967 miles, events in gap areas can't snap

### Question 5: Should we implement PostGIS geometry instead of JSONB?
- Current: JSONB column storing GeoJSON
- Alternative: PostGIS `geometry(LineString, 4326)` with spatial indexing
- Would enable `ST_LineSubstring`, `ST_LineLocatePoint`, `ST_ClosestPoint` for proper snapping

---

## 7. Recommended Next Steps

### Immediate Investigation
1. **Find geometry snapping code**: Search codebase for where event geometry is set
2. **Compare working vs broken events**: Inspect the 3 working events to understand why they succeeded
3. **Test gap hypothesis**: Check if 26 broken events have locations falling in gap areas

### Short-term Fix
1. **Implement robust snapping logic**:
   - Use turf.js `nearestPointOnLine` function
   - Find start/end indices in corridor geometry
   - Extract segment between indices
   - Handle edge cases (gaps, reversed direction)

2. **Add fallback handling**:
   - If distance to corridor > threshold, flag as error
   - Don't silently fall back to straight line
   - Log warnings for debugging

### Long-term Solution
1. **Migrate to PostGIS geometry**:
   - Replace JSONB with proper PostGIS geometry columns
   - Use spatial indexing for performance
   - Use `ST_LineSubstring` for segment extraction

2. **Consider hybrid approach**:
   - Use TIGER/Line as base geometry
   - Manually fill known gaps with OSM data or interpolation
   - Document which segments are synthetic

---

## 8. Technical Details for Debugging

### Database Connection String
```bash
DATABASE_URL="postgres://postgres:REDACTED_PASSWORD@tramway.proxy.rlwy.net:14217/railway"
```

### Useful Queries

**Get I-80 WB geometry sample**:
```sql
SELECT
  name,
  jsonb_array_length(geometry->'coordinates') as coord_count,
  geometry->'coordinates'->0 as first_coord,
  geometry->'coordinates'->-1 as last_coord
FROM corridors
WHERE name = 'I-80 WB';
```

**Get all Iowa I-80 events**:
```sql
SELECT id, corridor, start_longitude, start_latitude, end_longitude, end_latitude,
       jsonb_array_length(geometry->'coordinates') as geom_coords
FROM events
WHERE state = 'Iowa' AND corridor LIKE 'I-80%'
ORDER BY corridor, id;
```

**Find events with 2-point geometry**:
```sql
SELECT id, corridor
FROM events
WHERE state = 'Iowa'
  AND corridor LIKE 'I-80%'
  AND jsonb_array_length(geometry->'coordinates') = 2;
```

### API Endpoints

**Get all Iowa events**:
```bash
curl "https://corridor-communication-dashboard-production.up.railway.app/api/events?state=Iowa" | jq '.[] | select(.corridor | contains("I-80"))'
```

**Get specific event**:
```bash
curl "https://corridor-communication-dashboard-production.up.railway.app/api/events" | jq '.[] | select(.id == "event-2026-02-03-i-80-eb-between-us-63-mm-...")'
```

### Files to Examine

**Backend Event Processing**:
- Search for: `geometry`, `snap`, `corridor`, `LineString`
- Likely locations:
  - `backend/routes/events.js` or similar
  - `backend/services/geometry.js` or similar
  - `backend/models/event.js` or similar

**Import Scripts**:
- `/Users/mattmiller/Projects/DOT/DOT Corridor Communicator/scripts/import_tiger_interstates.js`
- `/Users/mattmiller/Projects/DOT/DOT Corridor Communicator/scripts/fetch_i80_via_relation.js`

**Logs**:
- `/tmp/tiger_import.log` - TIGER/Line import results
- `/tmp/i80_relation_fixed.log` - OSM relation attempt

---

## 9. Contact Information

**Repository**: /Users/mattmiller/Projects/DOT/DOT Corridor Communicator
**Platform**: Railway (https://railway.app)
**Database**: PostgreSQL on Railway (tramway.proxy.rlwy.net:14217)

---

## 10. Summary

**The Core Issue**: We have excellent Interstate geometry (94,078 coordinates for I-80 WB) in the database, but 81% of events ignore it and draw straight lines instead.

**The Mystery**: 3 events successfully use curved geometry (8-9 coords), proving the system CAN work. But 26 events fail, and we don't know why.

**Most Likely Cause**:
1. Events fall in gap areas between TIGER segments (1,967/29/1,810 mile gaps)
2. Geometry snapping logic has distance threshold that's too strict
3. Snapping code has bugs or is bypassed in certain conditions

**What We Need Help With**: Finding and fixing the geometry snapping logic so all events use the corridor geometry that exists in the database.
