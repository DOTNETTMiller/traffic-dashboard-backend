# Google My Maps Polyline Extraction Guide

This guide shows you how to extract high-quality Interstate polylines from Google My Maps without paying for the Directions API.

---

## Why This Works

Google My Maps creates **directions layers** that use Google's routing engine to generate complete, gap-free route polylines. When you export the map as KML, these polylines are included in the file as `<LineString>` coordinates.

**Advantages:**
- ✅ **Free** - No API key or per-request charges
- ✅ **High Quality** - Uses Google's routing data
- ✅ **Gap-Free** - Single continuous polyline for the entire route
- ✅ **Accurate** - Follows actual Interstate paths, not straight lines

---

## Step-by-Step Instructions

### Step 1: Create a Google My Map

1. Go to **https://www.google.com/maps/d/**
2. Click **"+ Create a New Map"**
3. Give it a name (e.g., "I-80 Corridor")

### Step 2: Add Directions Layer

1. Click **"Add directions"** (below the search box)
2. Enter the **starting point** (western terminus of the Interstate)
   - Example for I-80: `San Francisco, CA`
3. Enter the **ending point** (eastern terminus)
   - Example for I-80: `Teaneck, NJ`
4. Click the search icon to generate the route

**Important Tips:**
- For very long routes (like I-80 coast-to-coast), you may need to add **waypoints** to ensure it follows the Interstate:
  - Click **"+ Add destination"** to add intermediate cities
  - Example I-80 waypoints: Sacramento, Reno, Salt Lake City, Cheyenne, Omaha, Des Moines, Chicago, Cleveland
- Make sure the blue route line follows the Interstate throughout

### Step 3: Export as KML

1. Click the **three dots menu** (⋮) next to the map title
2. Select **"Export to KML/KMZ"**
3. **Uncheck** "Export as KMZ" (we want KML, not compressed)
4. Click **"Download"**
5. Save the file (e.g., `I-80.kml`)

### Step 4: Import to Database

Run the import script with the downloaded KML file:

```bash
# Auto-detect Interstate number
DATABASE_URL="your_postgres_url" node scripts/import_google_mymaps_kml.js ~/Downloads/I-80.kml

# Or specify Interstate explicitly
DATABASE_URL="your_postgres_url" node scripts/import_google_mymaps_kml.js ~/Downloads/route.kml I-80
```

**Example output:**
```
======================================================================
📍 Importing Google My Maps KML
======================================================================

   Reading KML file: /Users/you/Downloads/I-80.kml
   ✓ Detected Interstate: I-80
   ✓ Found 1 route(s)
     Route segment: 15234 coordinates
   ✓ Total coordinates: 15234
     ✅ No gaps found - continuous geometry!

   Saving to database...
   ✓ Updated I-80 WB
   ✓ Updated I-80 EB

======================================================================
✅ Google My Maps KML import complete!
======================================================================
```

---

## Example: Creating I-80 Full Route

### Option A: Single Route (May Miss Parts)

**Start**: `San Francisco, CA`
**End**: `Teaneck, NJ`

This might work, but Google may choose non-Interstate sections.

### Option B: Multi-Waypoint Route (Recommended)

**Waypoints** (in order):
1. San Francisco, CA (start)
2. Sacramento, CA
3. Reno, NV
4. Salt Lake City, UT
5. Cheyenne, WY
6. North Platte, NE
7. Omaha, NE
8. Des Moines, IA
9. Davenport, IA
10. Chicago, IL
11. South Bend, IN
12. Toledo, OH
13. Cleveland, OH
14. Youngstown, OH
15. Teaneck, NJ (end)

Click **"+ Add destination"** between start and end to add each waypoint.

---

## Interstate Reference Table

Here are suggested start/end points for major Interstates:

| Interstate | Start (West/South) | End (East/North) |
|------------|-------------------|------------------|
| **I-5** | San Diego, CA | Blaine, WA |
| **I-10** | Santa Monica, CA | Jacksonville, FL |
| **I-15** | San Diego, CA | Sweet Grass, MT |
| **I-20** | Kent, TX | Florence, SC |
| **I-25** | Las Cruces, NM | Buffalo, WY |
| **I-29** | Kansas City, MO | Pembina, ND |
| **I-35** | Laredo, TX | Duluth, MN |
| **I-40** | Barstow, CA | Wilmington, NC |
| **I-55** | New Orleans, LA | Chicago, IL |
| **I-65** | Mobile, AL | Gary, IN |
| **I-70** | Cove Fort, UT | Baltimore, MD |
| **I-75** | Miami, FL | Sault Ste. Marie, MI |
| **I-80** | San Francisco, CA | Teaneck, NJ |
| **I-90** | Seattle, WA | Boston, MA |
| **I-95** | Miami, FL | Houlton, ME |

---

## Troubleshooting

### Issue: "No LineString coordinates found"
**Solution**: Make sure you created a **directions layer**, not just markers. The blue route line should be visible on the map.

### Issue: Route doesn't follow the Interstate
**Solution**: Add more waypoints to force the route to follow the Interstate highway. Google prefers the fastest route, which might not always be the Interstate.

### Issue: Multiple disconnected segments
**Solution**: The script will merge all segments automatically. If you see gaps in the output, you may need to add waypoints to bridge the gap areas.

### Issue: KML file is empty or invalid
**Solution**:
- Make sure you unchecked "Export as KMZ"
- Try re-exporting
- Open the KML file in a text editor - you should see `<coordinates>` tags

---

## Advanced: Bulk Interstate Import

To create all major Interstates:

1. Create a separate My Map for each Interstate
2. Add directions with appropriate waypoints
3. Export each as KML
4. Run the import script for each file

**Bash script example:**
```bash
#!/bin/bash
DATABASE_URL="your_postgres_url"

for kml in ~/Downloads/Interstate-*.kml; do
  echo "Importing $kml..."
  DATABASE_URL="$DATABASE_URL" node scripts/import_google_mymaps_kml.js "$kml"
done
```

---

## Comparison with Other Methods

| Method | Pros | Cons | Cost |
|--------|------|------|------|
| **Google My Maps** | ✅ Free, gap-free, high quality | ❌ Manual map creation | Free |
| **TIGER/Line** | ✅ Official US data | ❌ Has gaps at boundaries | Free |
| **OSM Relations** | ✅ Community data | ❌ API timeouts, gaps | Free |
| **Google Directions API** | ✅ Highest quality | ❌ $5 per 1000 requests | $$$ |
| **OSRM** | ✅ Self-hosted routing | ❌ Requires 64GB RAM | $$$ |

**Recommendation**: Use **Google My Maps** for critical Interstates (like I-80), and TIGER/Line for others.

---

## Next Steps

After importing your Interstate geometries:

1. **Verify the import**:
   ```sql
   SELECT name, jsonb_array_length(geometry->'coordinates') as coords
   FROM corridors
   WHERE name LIKE 'I-80%';
   ```

2. **Test with Iowa events**:
   ```bash
   curl "https://your-app.railway.app/api/events?state=Iowa"
   ```

3. **Check if events use curved geometry**:
   - Look for events with `coordinates.length > 2`
   - Events should follow the Interstate curve, not straight lines
