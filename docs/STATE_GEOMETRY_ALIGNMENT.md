# State Geometry Alignment Guide

## Overview

This guide explains how to fix 2-point event geometries using official state DOT data sources to ensure accurate alignment with OpenStreetMap base layers.

## The Problem

Many state DOT feeds provide traffic events with only **2 coordinate points** (start and end), resulting in:

- ❌ Straight-line geometries that don't follow highway paths
- ❌ Inaccurate route visualization on maps
- ❌ Poor distance calculations
- ❌ Misleading event locations

**Example 2-Point Geometry:**
```json
{
  "type": "LineString",
  "coordinates": [
    [-93.6234, 41.5912],  // Start point only
    [-93.2891, 41.6045]   // End point only
  ]
}
```

## The Solution

Replace 2-point geometries with detailed polylines from official state DOT GIS services:

**Enhanced Geometry:**
```json
{
  "type": "LineString",
  "coordinates": [
    [-93.6234, 41.5912],
    [-93.6198, 41.5923],
    [-93.6145, 41.5941],
    ... // 80+ more points
    [-93.2891, 41.6045]
  ]
}
```

---

## Supported States

### Iowa ✅

**Data Source:** Iowa DOT Road Network FeatureServer
**URL:** https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0

**Script:** `scripts/fix_iowa_2point_geometries.js`

**Features:**
- Survey-grade official centerlines
- 50-100+ points per route segment
- Automatic OpenStreetMap alignment validation
- ~10-30m typical offset (excellent)

**Usage:**
```bash
DATABASE_URL="postgresql://..." node scripts/fix_iowa_2point_geometries.js
```

**Expected Output:**
```
🔧 Processing evt-123: I-80 WB
   Route: I-80
   ✓ Found 3 road segments
   ✅ Alignment check: 18m avg offset from OSM
   ✅ Fixed! Geometry updated from 2 points to 87 points

📊 Summary:
   ✅ Fixed: 145
   ❌ Failed: 12
   ⏭️  Skipped: 3

🗺️  OpenStreetMap Alignment:
   Average offset: 22 meters
   Well-aligned (<50m): 96% (139/145)
   ✅ Excellent alignment with OpenStreetMap!
```

### Other States 🔄

Use the **generalized multi-state script** `scripts/fix_state_geometries.js` to process additional states. See configuration section below for details.

---

## How to Add Support for a New State

### Step 1: Find State DOT GIS Services

Most state DOTs provide ArcGIS REST services with highway centerlines. Look for:

1. **State DOT GIS Portal**
   - Search: "[State] DOT GIS" or "[State] DOT open data"
   - Example: https://gis.iowadot.gov/

2. **ArcGIS REST Services Directory**
   - Look for services named: "Road Network", "Highway Centerlines", "Routes", "LRS"
   - URL pattern: `https://gis.[state]dot.gov/.../rest/services/...`

3. **Open Data Portals**
   - Many states use: https://data.[state]dot.gov/
   - Powered by ArcGIS Hub or ESRI platforms

### Step 2: Verify Service Compatibility

Check if the service has:

- ✅ **Polyline geometry** (not just points)
- ✅ **Route/highway identifiers** (I-80, US-20, etc.)
- ✅ **GeoJSON output support** (`f=geojson` parameter)
- ✅ **Public access** (or API key available)

**Test Query:**
```bash
curl "https://gis.[STATE]dot.gov/.../FeatureServer/0/query?where=1=1&outFields=*&returnGeometry=true&f=geojson&resultRecordCount=5"
```

### Step 3: Update State Configuration

Edit `scripts/fix_state_geometries.js` and add the state to the `STATE_CONFIGS` object:

```javascript
const STATE_CONFIGS = {
  iowa: {
    name: 'Iowa',
    apiUrl: 'https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0/query',
    routeField: 'ROUTEID',
    routePatterns: [/I-?(\d+)/i, /US-?(\d+)/i],
    requiresAuth: false
  },

  ohio: {
    name: 'Ohio',
    apiUrl: 'https://gis.dot.state.oh.us/...', // Replace with actual URL
    routeField: 'ROUTE_ID',
    routePatterns: [/I-?(\d+)/i, /SR-?(\d+)/i],
    requiresAuth: true,
    apiKey: process.env.OHIO_GIS_API_KEY
  },

  // Add more states here...
};
```

### Step 4: Run the Generalized Script

The generalized script `scripts/fix_state_geometries.js` supports multiple states with a single command:

```bash
# Fix a specific state
DATABASE_URL="postgresql://..." node scripts/fix_state_geometries.js --state=iowa

# Fix multiple states at once
DATABASE_URL="postgresql://..." node scripts/fix_state_geometries.js --state=iowa,ohio,utah

# Fix all configured states
DATABASE_URL="postgresql://..." node scripts/fix_state_geometries.js --all

# Show available states and usage
node scripts/fix_state_geometries.js
```

**Output Example:**
```
🚛 Multi-State Geometry Alignment Tool
======================================

Processing 2 state(s): iowa, ohio

================================================================================
🚛 Processing Iowa
================================================================================

📊 Found 145 Iowa events with 2-point geometries

🔧 Processing evt-123: I-80 WB
   Route: I-80
   ✓ Found 3 road segments
   ✅ Alignment check: 18m avg offset from OSM
   ✅ Fixed! Geometry updated from 2 points to 87 points

...

📊 OVERALL SUMMARY
================================================================================

Iowa:
  ✅ Fixed: 145
  ❌ Failed: 12
  ⏭️  Skipped: 3

Ohio:
  ✅ Fixed: 89
  ❌ Failed: 5
  ⏭️  Skipped: 1

Grand Total:
  ✅ Fixed: 234
  ❌ Failed: 17
  ⏭️  Skipped: 4
```

---

## Coordinate System Compatibility

### Understanding Projections

| System | EPSG Code | Usage |
|--------|-----------|-------|
| **WGS84** | 4326 | OpenStreetMap, GPS, GeoJSON standard |
| **Web Mercator** | 3857 | Web maps (Google, Bing, Esri) |
| **State Plane** | Varies | State-specific survey systems |

### Automatic Conversion

When requesting `f=geojson`, ArcGIS services automatically convert to **WGS84 (EPSG:4326)**, which matches OpenStreetMap.

**In the Script:**
```javascript
const params = {
  f: 'geojson',     // Triggers automatic WGS84 conversion
  outSR: 4326,      // Explicitly request WGS84
  // ...
};
```

### Alignment Validation

The script validates alignment by:

1. Fetching OSRM route (uses OSM data)
2. Comparing state DOT geometry to OSRM
3. Sampling 5 points along each route
4. Calculating average offset

**Acceptable Offsets:**
- **<20m**: Excellent alignment
- **20-50m**: Good alignment (typical for official vs. crowdsourced)
- **>50m**: Review - may indicate projection issues or rural areas

---

## Common State DOT Services

### Configured States

These states are already configured in `scripts/fix_state_geometries.js`:

| State | Service URL | Route Field | Status |
|-------|-------------|-------------|--------|
| **Iowa** | https://gis.iowadot.gov/agshost/rest/services/RAMS/Road_Network/FeatureServer/0 | ROUTEID | ✅ Configured |
| **Ohio** | https://gis.dot.state.oh.us/tims/rest/services/TIMS_PUB/Roadway_Network/MapServer/0 | ROUTE_ID | ✅ Configured |
| **Minnesota** | https://gisdata.mn.gov/arcgis/rest/services/trans/roadcenterlines/MapServer/0 | ROUTE_SYS | ✅ Configured |
| **Utah** | https://gis.udot.utah.gov/hosting/rest/services/ROUTES/MapServer/0 | ROUTE_ID | ✅ Configured |

### Additional Available Services

| State | Service URL | Route Field | Status |
|-------|-------------|-------------|--------|
| **Nevada** | https://www.nvroads.com/api/v2/ | (Custom API) | 🔄 Available |
| **California** | https://gis.data.ca.gov/datasets/ | ROUTE | 🔄 Available |
| **Pennsylvania** | https://gis.penndot.gov/arcgis/rest/services/ | ROUTE_NUM | 🔄 Available |
| **Texas** | https://gis-txdot.opendata.arcgis.com/ | RTE_ID | 🔄 Available |

### How to Find Services

**Method 1: Google Search**
```
"[State] DOT GIS services" OR "[State] DOT open data"
```

**Method 2: ArcGIS Hub Search**
```
https://hub.arcgis.com/search?q=[State]%20DOT
```

**Method 3: State DOT Website**
- Navigate to: Technology → GIS → Data Downloads
- Look for: REST Services, Web Services, API Documentation

---

## Troubleshooting

### Issue: Service Returns No Features

**Cause:** Query parameters may be incorrect

**Solution:**
```javascript
// Try different query approaches
where: "ROUTEID = 'I80'"          // Exact match
where: "ROUTEID LIKE '%80%'"      // Substring match
where: "ROUTE_NAME = 'I-80 EB'"   // Full name
where: "1=1"                       // Get all (for testing)
```

### Issue: Large Offset from OSM (>100m)

**Possible Causes:**
1. Service is using State Plane coordinates (not converted)
2. Rural areas where OSM has less accuracy
3. Recent highway realignment not in OSM yet

**Solution:**
```javascript
// Explicitly request WGS84 output
params.outSR = 4326;

// Or use spatialReference parameter
params.spatialReference = { wkid: 4326 };
```

### Issue: API Rate Limiting

**Symptoms:**
- HTTP 429 errors
- Slow responses
- Request failures

**Solution:**
```javascript
// Add delay between requests (already in script)
await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay

// Or process in batches
const batches = chunkArray(events, 50);
for (const batch of batches) {
  await processBatch(batch);
  await new Promise(resolve => setTimeout(resolve, 5000)); // 5s between batches
}
```

### Issue: Authentication Required

**Solution:**
```javascript
// Add API key to headers
headers: {
  'Authorization': `Bearer ${process.env.STATE_GIS_API_KEY}`
}

// Or as query parameter
params.token = process.env.STATE_GIS_API_KEY;
```

---

## Performance Optimization

### Caching Strategy

**1. Bounding Box Queries**
```javascript
// Only fetch relevant segments
const bbox = {
  minLat: startLat - 0.1,
  maxLat: endLat + 0.1,
  minLon: startLon - 0.1,
  maxLon: endLon + 0.1
};

params.geometry = JSON.stringify({
  xmin: bbox.minLon,
  ymin: bbox.minLat,
  xmax: bbox.maxLon,
  ymax: bbox.maxLat,
  spatialReference: { wkid: 4326 }
});
```

**2. Route-Level Caching**
```javascript
// Cache entire route once, reuse for all events
const routeCache = new Map();

async function getRouteGeometry(routeId) {
  if (routeCache.has(routeId)) {
    return routeCache.get(routeId);
  }

  const geometry = await queryStateAPI(routeId);
  routeCache.set(routeId, geometry);
  return geometry;
}
```

**3. Database Caching**
```sql
CREATE TABLE state_route_geometries (
  state_key TEXT,
  route_id TEXT,
  geometry JSONB,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (state_key, route_id)
);
```

---

## Quality Assurance

### Pre-Flight Checks

Before running on production:

1. **Test on Small Sample**
   ```bash
   # Add LIMIT to query
   WHERE state_key = 'ia' LIMIT 10
   ```

2. **Validate Alignment**
   - Check average offset is <50m
   - Review events with >100m offset
   - Verify visual appearance on map

3. **Compare Metrics**
   ```sql
   -- Before
   SELECT AVG(json_array_length(json_extract(geometry, '$.coordinates')))
   FROM cached_events WHERE state_key = 'ia';

   -- After (should be much higher)
   SELECT AVG(json_array_length(json_extract(geometry, '$.coordinates')))
   FROM cached_events WHERE state_key = 'ia';
   ```

### Post-Processing Validation

```javascript
// Count improvements
const summary = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN json_array_length(json_extract(geometry, '$.coordinates')) > 2
        THEN 1 ELSE 0 END) as detailed,
    AVG(json_array_length(json_extract(geometry, '$.coordinates'))) as avg_points
  FROM cached_events
  WHERE state_key = ? AND geometry_source LIKE '%DOT%'
`).get('ia');

console.log(`Detailed geometries: ${summary.detailed}/${summary.total} (${Math.round(summary.detailed/summary.total*100)}%)`);
console.log(`Average points per event: ${Math.round(summary.avg_points)}`);
```

---

## Best Practices

### 1. Data Source Attribution

Always record the data source:

```javascript
db.prepare(`
  UPDATE cached_events
  SET
    geometry = ?,
    geometry_source = ?,
    geometry_updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`).run(
  JSON.stringify(newGeometry),
  'Iowa DOT Road Network FeatureServer',
  eventId
);
```

### 2. Incremental Updates

Only update events that need it:

```sql
WHERE state_key = 'ia'
  AND json_array_length(json_extract(geometry, '$.coordinates')) = 2
  AND (geometry_source IS NULL OR geometry_source = 'straight_line')
```

### 3. Backup Before Running

```bash
# Backup database
pg_dump $DATABASE_URL > backup_before_geometry_fix.sql

# Or SQLite
sqlite3 traffic_data.db ".backup traffic_data_backup.db"
```

### 4. Monitor Progress

```javascript
// Log progress every N events
if ((index + 1) % 10 === 0) {
  console.log(`Progress: ${index + 1}/${total} events processed`);
}
```

---

## State-Specific Notes

### Iowa

- **Best Practices:** Excellent data quality, very detailed polylines
- **Coverage:** All Interstate, US, and state highways
- **Update Frequency:** Monthly
- **Known Issues:** None
- **Alignment:** Typically 10-30m offset (excellent)

### Ohio

- **Best Practices:** Requires API key (register at gis.dot.state.oh.us)
- **Coverage:** Interstate and state routes
- **Known Issues:** Some rural routes may have less detail
- **Alignment:** Typically 15-40m offset (good)

### Utah

- **Best Practices:** Public access, no auth required
- **Coverage:** All UDOT-maintained routes
- **Known Issues:** Mountain areas may have sparser geometry
- **Alignment:** Typically 20-50m offset (good to fair)

---

## Future Enhancements

### Planned Features

1. **Automatic State Detection**
   - Auto-discover state DOT services
   - Test connectivity and compatibility
   - Self-configure route field mappings

2. **Machine Learning Matching**
   - Learn from manual corrections
   - Improve segment matching algorithm
   - Handle complex interchanges

3. **Real-Time Updates**
   - Subscribe to state DOT change feeds
   - Auto-update geometries when routes change
   - Detect and fix geometry drift

4. **Visual Validation Dashboard**
   - Before/after comparison viewer
   - Alignment offset heatmap
   - Manual correction interface

---

## References

### Documentation

- [ArcGIS REST API Documentation](https://developers.arcgis.com/rest/)
- [GeoJSON Specification](https://geojson.org/)
- [EPSG Coordinate Systems](https://epsg.io/)
- [OpenStreetMap Documentation](https://wiki.openstreetmap.org/)

### State DOT Portals

- [Iowa DOT GIS](https://gis.iowadot.gov/)
- [AASHTO GIS-T Symposium](https://www.gis-t.org/)
- [FHWA GIS Resources](https://www.fhwa.dot.gov/planning/processes/tools/gis/)

---

## Support

For questions or issues:

1. Check existing scripts in `scripts/fix_*_geometries.js`
2. Review alignment validation output
3. Test with small sample first
4. Contact state DOT GIS team for API access

---

**Last Updated:** February 2026
**Maintainer:** DOT Corridor Communicator Team
**Version:** 1.0
