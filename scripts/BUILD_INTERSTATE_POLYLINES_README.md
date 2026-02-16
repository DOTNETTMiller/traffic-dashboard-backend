# Build Interstate Polylines Script

## Overview

This script fetches complete, high-resolution polylines for Interstate 80 (I-80) and Interstate 35 (I-35) from OpenStreetMap and stores them in your PostgreSQL database.

## Location

`scripts/build_interstate_polylines.js`

## What It Does

1. **Fetches from OpenStreetMap**: Queries the Overpass API for complete I-80 and I-35 route relations
2. **Builds Continuous Polylines**: Assembles way segments in proper order, handling direction reversals
3. **Quality Analysis**: Checks for gaps in geometry and reports quality metrics
4. **Simplification**: Uses Douglas-Peucker algorithm to reduce point count while preserving shape
5. **Database Storage**: Stores as GeoJSON LineString in the `geometry` JSONB column
6. **Bounds Calculation**: Computes and stores bounding boxes for map viewport

## Routes Covered

### Interstate 80 (I-80)
- **Coverage**: San Francisco, CA to Teaneck, NJ
- **States**: CA, NV, UT, WY, NE, IA, IL, IN, OH, PA, NJ (11 states)
- **Directions**: Westbound (WB) and Eastbound (EB)
- **OSM Relations**: 22 total relations (11 WB + 11 EB)

### Interstate 35 (I-35)
- **Coverage**: Laredo, TX to Duluth, MN
- **States**: TX, OK, KS, MO, IA, MN (6 states)
- **Directions**: Northbound (NB) and Southbound (SB)
- **OSM Relations**: 10 total relations (5 NB + 5 SB)

## Database Schema

The script stores data in the `corridors` table:

```sql
CREATE TABLE corridors (
    id TEXT PRIMARY KEY,              -- e.g., 'i-80-wb'
    name TEXT NOT NULL,               -- e.g., 'I-80 WB'
    description TEXT,                 -- e.g., 'I-80 Westbound (East to West)'
    geometry JSONB,                   -- GeoJSON LineString with coordinates
    bounds JSONB,                     -- Bounding box: {west, east, south, north}
    geometry_ref TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Example Geometry Data

```json
{
  "type": "LineString",
  "coordinates": [
    [-122.4194, 37.7749],
    [-122.4000, 37.7800],
    ...
  ]
}
```

### Example Bounds Data

```json
{
  "west": -122.4194,
  "east": -74.0200,
  "south": 37.7749,
  "north": 42.1500
}
```

## Prerequisites

1. Node.js 18+ installed
2. PostgreSQL database with `corridors` table
3. Environment variable `DATABASE_URL` set
4. Dependencies: `pg`, `axios` (already in package.json)

## How to Run

```bash
# Make sure DATABASE_URL is set
export DATABASE_URL="postgresql://user:pass@host:port/database"

# Run the script
node scripts/build_interstate_polylines.js
```

## Expected Output

```
======================================================================
BUILD INTERSTATE POLYLINES FROM OPENSTREETMAP
======================================================================

======================================================================
PROCESSING: Interstate 80
Description: I-80 from San Francisco, CA to Teaneck, NJ
======================================================================

  Processing I-80 WB...
    Fetching 11 OSM relations
    Querying OSM relation 69363...
      Got 1234 coordinates
    Querying OSM relation 69364...
      Got 2345 coordinates
    ...
    Total coordinates: 45623 (after deduplication)
    Analyzing geometry quality...
    Quality: EXCELLENT - No gaps found, continuous geometry
    Bounds: [-122.419, 37.775] to [-74.020, 42.150]
    Simplifying from 45623 to ~10000 points...
    Simplified to 9876 points (epsilon: 0.000150)
    Database: UPDATED corridor 'i-80-wb'
  SUCCESS: I-80 WB stored with 9876 points

  Processing I-80 EB...
    ...

======================================================================
SUMMARY
======================================================================

I-80:
  I-80 WB:
    Original points: 45,623
    Final points: 9,876
    Bounds: W-122.42 E-74.02 S37.78 N42.15
  I-80 EB:
    Original points: 44,891
    Final points: 9,654
    Bounds: W-122.42 E-74.02 S37.78 N42.15

I-35:
  I-35 NB:
    Original points: 28,934
    Final points: 8,234
    Bounds: W-99.47 E-92.10 S27.51 N46.78
  I-35 SB:
    Original points: 28,567
    Final points: 8,156
    Bounds: W-99.47 E-92.10 S27.51 N46.78

======================================================================
SUCCESS: All Interstate polylines built and stored!
======================================================================
```

## Features

### Intelligent Segment Stitching
- Automatically orders OSM way segments in proper sequence
- Detects when segments need to be reversed to connect properly
- Eliminates gaps by checking endpoint distances

### Quality Analysis
- Detects and reports geometry gaps larger than 3.5 miles
- Validates continuous connectivity of polylines
- Reports coordinate count and coverage statistics

### Douglas-Peucker Simplification
- Reduces point count while preserving shape accuracy
- Adaptive epsilon adjustment to hit target point count
- Default target: 10,000 points (balance between detail and performance)

### Database Operations
- Updates existing corridors if they already exist
- Creates new corridors with proper IDs and metadata
- Sets timestamps automatically

### Rate Limiting
- 1.5 second delay between Overpass API requests
- Prevents API throttling
- Respects Overpass API usage guidelines

## Troubleshooting

### "DATABASE_URL environment variable is required"
Set your database connection string:
```bash
export DATABASE_URL="postgresql://user:pass@host:port/database"
```

### "Relation not found"
OSM relation IDs may have changed. You can find current IDs by querying Overpass:
```
relation["ref"="80"]["network"="US:I"]["type"="route"]
```

### "Request timeout"
The Overpass API may be slow or overloaded. The script has a 200-second timeout per request.

### Geometry has gaps
Check the quality analysis output. Some gaps are normal where interstates have short breaks.

## Configuration

### Adding More Interstates

Edit the `INTERSTATE_CONFIGS` object in the script:

```javascript
const INTERSTATE_CONFIGS = {
  'I-90': {
    displayName: 'Interstate 90',
    description: 'I-90 from Seattle, WA to Boston, MA',
    directions: {
      westbound: {
        name: 'I-90 WB',
        description: 'I-90 Westbound',
        relationIds: [123, 456, 789] // OSM relation IDs
      },
      eastbound: {
        name: 'I-90 EB',
        description: 'I-90 Eastbound',
        relationIds: [321, 654, 987]
      }
    }
  }
};
```

### Adjusting Simplification

Change the target point count in the `processInterstate` function:

```javascript
const simplified = simplifyCoordinates(coords, 10000); // Change 10000 to desired count
```

## Performance

- **Total execution time**: ~3-5 minutes (depends on Overpass API speed)
- **API requests**: 22 for I-80 + 10 for I-35 = 32 total
- **Rate limiting**: 1.5 seconds between requests = ~48 seconds minimum
- **Data transfer**: ~50-100 MB from Overpass API
- **Database storage**: ~500 KB per interstate direction

## OSM Relation IDs

### I-80 Relations
Based on existing script `fetch_i80_via_relation.js`:
- **Westbound**: 69363, 69364, 113177, 280678, 282374, 286810, 396249, 934337, 934352, 942897, 942899
- **Eastbound**: 6901235, 6901301, 6902136, 6902197, 6903871, 6903909, 6904814, 6904820, 6904835, 6904948, 6904954

### I-35 Relations
These are approximate and may need verification:
- **Northbound**: 2706644, 2706645, 2706646, 6902062, 6902063
- **Southbound**: 108028, 108029, 108030, 108031, 108032

To verify or find updated relation IDs, use the Overpass Turbo query:
```
relation["ref"="35"]["network"="US:I"]["type"="route"]["route"="road"]
```

## Next Steps

After running this script:

1. **Verify the data**: Query the database to check geometry was stored
   ```sql
   SELECT id, name,
          jsonb_array_length(geometry->'coordinates') as point_count,
          bounds
   FROM corridors
   WHERE name LIKE 'I-80%' OR name LIKE 'I-35%';
   ```

2. **Test visualization**: Load the corridors in your map application

3. **Compare with existing data**: Check if the new polylines are better than existing ones

4. **Update references**: Modify event snapping logic to use the new corridor geometries

## Related Files

- `scripts/fetch_i80_via_relation.js` - Original I-80 fetcher (this script is based on it)
- `scripts/import_tiger_interstates.js` - Alternative TIGER/Line import approach
- `migrations/add_corridor_geometries_pg.sql` - Schema for geometry columns
- `migrations/insert_sample_geometries_pg.sql` - Sample data examples

## Notes

- The script updates existing corridors, so it's safe to run multiple times
- OSM data is continuously updated, so re-running periodically can get improvements
- Simplification preserves accuracy while reducing file size for faster map rendering
- Both directions are stored separately to support directional event snapping
