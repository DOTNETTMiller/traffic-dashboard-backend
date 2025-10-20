# State Data Standards and Format Deviations Analysis

**Generated:** 2025-10-19
**System:** DOT Corridor Communicator

---

## Executive Summary

This document provides a comprehensive analysis of data format standards and deviations across 31 state DOT feeds integrated into the Corridor Communicator system. The analysis identifies which TMDD-related standards each state implements and documents specific data format deviations that require custom transformation logic.

### Key Findings

- **23 states** use WZDx (Work Zone Data Exchange) format across multiple versions
- **5 states** use FEU-G XML (CARS Program, TMDD-based)
- **2 states** use custom formats (Nevada Custom JSON, New Jersey RSS)
- **1 state** has duplicate entries with different formats (Utah)

---

## TMDD Standards Overview

### Current TMDD Standard

**TMDD Version 3.1** (Published January 2020)
- Latest official release from ITE (Institute of Transportation Engineers)
- Two volumes: High-level concepts (Vol 1) and XML Design specifications (Vol 2)
- Addresses backwards/forwards compatibility
- Separates TMDD-specific and project-specific extensions

### Historical Versions
- 3.04 (Oct 2019) - Superseded
- 3.03d (Dec 2016)
- 3.02, 3.01 - Superseded
- 3.0 (Nov 2008)

### TMDD-Derived Formats

1. **WZDx (Work Zone Data Exchange)**
   - Modern, JSON-based format
   - Not strictly TMDD but serves similar purpose
   - Managed by US DOT and state DOTs
   - Multiple versions in use (v4.0, v4.1, v4.2)

2. **FEU-G (Full Event Update - General)**
   - XML-based TMDD implementation
   - Used by CARS Program (Condition Acquisition and Reporting System)
   - Direct TMDD compliance
   - Namespace-based structure

---

## State-by-State Analysis

### Group 1: WZDx v4.x States (GeoJSON Format)

These states use the modern Work Zone Data Exchange format, typically version 4.0 or higher.

#### 1. **Colorado DOT** (state_key: `co`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (unspecified)
- **TMDD Relation:** WZDx-based (not direct TMDD)
- **Data Structure:**
  - Uses `features` array with GeoJSON Feature objects
  - Properties contain work zone details
  - Coordinates in `geometry` field
- **Deviations:**
  - Generic WZDx handler in code (backend_proxy_server.js:336-401)
  - Checks for `core_details` (v4+) or direct properties (older versions)
  - Road names from `core_details.road_names` or `properties.road_names`

#### 2. **Florida DOT** (state_key: `fl`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (from One Network platform)
- **TMDD Relation:** WZDx-based
- **Data Structure:** Standard WZDx GeoJSON with One Network extensions
- **Deviations:** Uses generic WZDx handler

#### 3. **Illinois Tollway** (state_key: `il`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** **v4.2** (explicitly stated in URL)
- **TMDD Relation:** WZDx v4.2
- **Data Structure:** Latest WZDx specification
- **Deviations:** Generic WZDx handler
- **Note:** URL indicates most recent WZDx version

#### 4. **Indiana DOT** (state_key: `in`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (CARS API)
- **TMDD Relation:** WZDx-based
- **Data Structure:** CARS Program WZDx implementation
- **Deviations:** Generic WZDx handler
- **Note:** Also has FEU-G XML feed (see Group 2)

#### 5. **Iowa DOT** (state_key: `ia`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (Dataprism platform)
- **TMDD Relation:** WZDx-based
- **Data Structure:** Cloud-based ATMS WZDx feed
- **Deviations:** Generic WZDx handler

#### 6. **Kansas DOT** (state_key: `ks`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (CARS API)
- **TMDD Relation:** WZDx-based
- **Data Structure:** CARS Program WZDx implementation
- **Deviations:** Generic WZDx handler

#### 7. **Maricopa County DOT, Arizona** (state_key: `az`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (AZTECH platform)
- **TMDD Relation:** WZDx-based
- **Data Structure:** Regional WZDx implementation
- **Deviations:** Generic WZDx handler

#### 8. **Maryland DOT** (state_key: `md`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** **v4.1** (explicitly stated in URL)
- **TMDD Relation:** WZDx v4.1
- **Data Structure:** RITIS platform WZDx feed
- **Deviations:** Generic WZDx handler

#### 9. **Massachusetts DOT** (state_key: `ma`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** **v4.1** (explicitly stated in URL)
- **TMDD Relation:** WZDx v4.1
- **Data Structure:** Smart Work Zone Management system
- **Deviations:** Generic WZDx handler

#### 10. **Metropolitan Transportation Commission San Francisco** (state_key: `ca`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (511 platform)
- **TMDD Relation:** WZDx-based
- **Data Structure:** 511 traffic platform WZDx
- **Deviations:** Generic WZDx handler

#### 11. **Minnesota DOT** (state_key: `mn`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (CARS API)
- **TMDD Relation:** WZDx-based
- **Data Structure:** CARS Program WZDx implementation
- **Deviations:** Generic WZDx handler
- **Note:** Also has FEU-G XML feed (see Group 2)

#### 12. **Missouri DOT** (state_key: `mo`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (RIDSI platform)
- **TMDD Relation:** WZDx-based
- **Data Structure:** Regional Integrated Data System
- **Deviations:** Generic WZDx handler

#### 13. **New Jersey Institute of Technology** (state_key: `nj`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (Smart Work Zones)
- **TMDD Relation:** WZDx-based
- **Data Structure:** NJIT Smart Work Zones platform
- **Deviations:** Generic WZDx handler
- **Note:** State also has RSS feed (see Group 3)

#### 14. **New York DOT** (state_key: `ny`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (511NY platform)
- **TMDD Relation:** WZDx-based
- **Data Structure:** 511NY WZDx implementation
- **Deviations:** Generic WZDx handler

#### 15. **North Carolina DOT** (state_key: `nc`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (One Network platform)
- **TMDD Relation:** WZDx-based
- **Data Structure:** One Network WZDx feed
- **Deviations:** Generic WZDx handler

#### 16. **Ohio DOT** (state_key: `ohio`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** **v4.2** (explicitly stated in URL)
- **TMDD Relation:** WZDx v4.2
- **Data Structure:** OHGO public API
- **Special Handling:** Has custom parser (backend_proxy_server.js:257-280)
- **Deviations:**
  - Custom JSON structure with direct fields (not GeoJSON features)
  - Fields: `route`, `direction`, `milepost`, `latitude`, `longitude`
  - Separate endpoints for incidents vs construction
  - Uses `lanesBlocked` instead of standard lane impact fields

#### 17. **Oklahoma DOT** (state_key: `ok`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x
- **TMDD Relation:** WZDx-based
- **Data Structure:** OK Traffic WZDx feed
- **Deviations:** Generic WZDx handler

#### 18. **Pennsylvania Turnpike Commission** (state_key: `pa`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (ATMS platform)
- **TMDD Relation:** WZDx-based
- **Data Structure:** PA Turnpike ATMS WZDx
- **Deviations:** Generic WZDx handler

#### 19. **Texas DOT** (state_key: `tx`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x
- **TMDD Relation:** WZDx-based
- **Data Structure:** Austin open data WZDx
- **Deviations:** Generic WZDx handler

#### 20. **Virginia DOT** (state_key: `va`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** v4.x (Iteris SmartRoute)
- **TMDD Relation:** WZDx-based
- **Data Structure:** 511 ATIS platform WZDx
- **Deviations:** Generic WZDx handler

#### 21. **Washington State DOT** (state_key: `wa`)
- **API Type:** WZDx
- **Format:** geojson
- **Detected Version:** **v4** (explicitly stated in URL path)
- **TMDD Relation:** WZDx v4
- **Data Structure:** WSDOT WZDx API
- **Deviations:** Generic WZDx handler

### Group 2: WZDx v4.0 States (JSON Format - Non-GeoJSON)

#### 22. **Utah DOT** (state_key: `utah` and `ut`)
- **API Type:** WZDx
- **Format:** json (not geojson)
- **Detected Version:** **v4.0** (explicitly stated in URL: `/v40/`)
- **TMDD Relation:** WZDx v4.0
- **Special Handling:** Custom parser (backend_proxy_server.js:283-330)
- **Data Structure:**
  - Uses `features` array like GeoJSON
  - Properties accessed via `feature.properties`
  - Geometry coordinates: `feature.geometry.coordinates`
  - Handles LineString (array of points) and Point geometries
- **Deviations:**
  - Dedicated Utah-specific handler before generic WZDx handler
  - Extracts coordinates differently: checks if coords[0] is array (LineString) or number (Point)
  - Road names from `props.road_names` (joined with ', ')
  - Lanes info from `props.lanes?.[0]?.status`
  - Event status mapping: 'active' → 'medium' severity, else 'low'
  - Direction from `props.direction`
- **Note:** Duplicate entry in database (state_key `utah` and `ut` point to same URL)

#### 23. **Wisconsin DOT** (state_key: `wi`)
- **API Type:** WZDx
- **Format:** json (not geojson)
- **Detected Version:** v4.x
- **TMDD Relation:** WZDx-based
- **Data Structure:** Similar to Utah structure
- **Deviations:** Uses generic WZDx handler (processes after checking for Utah)

---

### Group 2: FEU-G XML States (TMDD-Based)

These states use the Full Event Update - General format, which is a direct implementation of TMDD standards through the CARS Program.

#### 24. **Indiana** (state_key: `indiana`)
- **API Type:** FEU-G
- **Format:** xml
- **TMDD Version:** TMDD v3.x (FEU-G implementation)
- **TMDD Relation:** **Direct TMDD compliance**
- **Data Structure:**
  - Root: `FEUMessages`
  - Events in: `FEUMessages['feu:full-event-update']` array
  - Namespace-based: `feu:` prefix on elements
  - Event structure:
    - `event-reference` → `event-id`
    - `headline` → headline text
    - `details` → `detail` object with:
      - `locations` → `location` → `location-on-link`
      - `primary-location` → `geo-location` (lat/lng in microdegrees)
      - `route-designator` (road name)
      - `roadway-names` → `roadway-name` array
      - `descriptions` → `description` array
      - `event-times` → `start-time`, `end-time`
- **Special Handling:** FEU-G XML parser (backend_proxy_server.js:410-510)
- **Deviations:**
  - Coordinates in **microdegrees** (divide by 1,000,000 to get decimal degrees)
  - Nested XML structure requires deep extraction
  - Multiple description elements joined with '; '
  - Direction extracted from text analysis (helper function)
  - Lane info extracted from description text
- **Note:** Also has WZDx feed (state_key `in`)

#### 25. **Iowa** (state_key: `iowa`)
- **API Type:** FEU-G
- **Format:** xml
- **TMDD Version:** TMDD v3.x (FEU-G implementation)
- **TMDD Relation:** **Direct TMDD compliance**
- **Data Structure:** Same as Indiana (CARS Program standard)
- **Special Handling:** FEU-G XML parser
- **Deviations:** Same as Indiana
- **Note:** Also has WZDx feed (state_key `ia`)

#### 26. **Kansas** (state_key: `kansas`)
- **API Type:** FEU-G
- **Format:** xml
- **TMDD Version:** TMDD v3.x (FEU-G implementation)
- **TMDD Relation:** **Direct TMDD compliance**
- **Data Structure:** Same as Indiana (CARS Program standard)
- **Special Handling:** FEU-G XML parser
- **Deviations:** Same as Indiana
- **Note:** Also has WZDx feed (state_key `ks`)

#### 27. **Minnesota** (state_key: `minnesota`)
- **API Type:** FEU-G
- **Format:** xml
- **TMDD Version:** TMDD v3.x (FEU-G implementation)
- **TMDD Relation:** **Direct TMDD compliance**
- **Data Structure:** Same as Indiana (CARS Program standard)
- **Special Handling:** FEU-G XML parser
- **Deviations:** Same as Indiana
- **Note:** Also has WZDx feed (state_key `mn`)

#### 28. **Nebraska** (state_key: `nebraska`)
- **API Type:** FEU-G
- **Format:** xml
- **TMDD Version:** TMDD v3.x (FEU-G implementation)
- **TMDD Relation:** **Direct TMDD compliance**
- **Data Structure:** Same as Indiana (CARS Program standard)
- **Special Handling:** FEU-G XML parser
- **Deviations:** Same as Indiana

---

### Group 3: Custom Format States

#### 29. **Nevada** (state_key: `nevada`)
- **API Type:** Custom JSON
- **Format:** json
- **TMDD Relation:** **None** (proprietary format)
- **Data Structure:**
  - Root level array of events (not GeoJSON)
  - Each item contains:
    - `id`, `location_description`, `direction`
    - `routes` array (contains route names like "I-80")
    - `event_category`, `description`, `headline`
    - `county`
    - `start_latitude`, `start_longitude` (separate fields)
    - `start_time`, `end_time`
    - `lanes_affected`
- **Special Handling:** Custom Nevada parser (backend_proxy_server.js:231-254)
- **Deviations:**
  - Not GeoJSON compliant
  - Coordinates as separate string fields (need parseFloat)
  - Routes array instead of single road_names
  - Event categorization different from WZDx
  - Custom severity determination needed
  - Uses `location_description` for location text

#### 30. **New Jersey** (state_key: `newjersey`)
- **API Type:** RSS
- **Format:** xml
- **TMDD Relation:** **None** (RSS 2.0 standard)
- **Data Structure:**
  - Root: `rss` → `channel` → `item` array
  - Each item contains:
    - `title` (event headline)
    - `description` (may contain lat/lon and details)
    - `pubDate` (publication timestamp)
  - Coordinates embedded in description text:
    - Pattern: "Lat: XX.XXXX"
    - Pattern: "Lon: -XX.XXXX"
- **Special Handling:** RSS XML parser (backend_proxy_server.js:512-551)
- **Deviations:**
  - RSS 2.0 format, not traffic-specific
  - Requires regex parsing of description for coordinates
  - Location extracted from title and description text
  - No structured geometry field
  - Event type determined from text analysis
  - Lane info parsed from description text
  - No native severity field
- **Note:** Also has WZDx feed via NJIT (state_key `nj`)

---

## Data Transformation Requirements

### Common Transformation Pipeline

All state data is normalized to this internal structure:

```javascript
{
  id: String,              // Format: "ST-{event_id}"
  state: String,           // Full state name
  corridor: String,        // e.g., "I-80", "I-70"
  eventType: String,       // "Construction", "Incident", "Closure"
  description: String,     // Event details
  location: String,        // Human-readable location
  county: String,
  latitude: Number,        // Decimal degrees
  longitude: Number,       // Decimal degrees
  startTime: String,       // ISO 8601
  endTime: String | null,  // ISO 8601 or null
  lanesAffected: String,   // Lane impact description
  severity: String,        // "high", "medium", "low"
  direction: String,       // "North", "South", "East", "West", "Both"
  requiresCollaboration: Boolean  // Cross-jurisdictional flag
}
```

### Format-Specific Transformations

#### 1. WZDx GeoJSON → Internal Format

**Source Structure:**
```javascript
{
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    id: "event-id",
    geometry: {
      type: "LineString",  // or "Point"
      coordinates: [[lng, lat], ...]
    },
    properties: {
      core_details: {  // v4+ only
        road_names: ["I-80"],
        event_type: "work-zone-type",
        description: "...",
        direction: "northbound",
        start_date: "2025-01-01T00:00:00Z",
        end_date: "2025-12-31T23:59:59Z"
      },
      // Or direct on properties for older versions
      road_names: [...],
      vehicle_impact: "all-lanes-open",
      start_date: "...",
      end_date: "..."
    }
  }]
}
```

**Transformation Logic (backend_proxy_server.js:336-401):**
1. Check for `core_details` (v4+) or direct properties
2. Extract coordinates from geometry (LineString[0] or Point)
3. Get road names from nested or direct properties
4. Map `vehicle_impact` to severity: "all-lanes-open" → "low", else → "medium"
5. Extract event ID from core_details, properties, or feature.id
6. Interstate filtering via `isInterstateRoute()`

**Key Deviations:**
- v4+ uses `core_details` nesting
- Older versions have flat properties structure
- LineString vs Point geometry handling
- Vehicle impact field variations

#### 2. FEU-G XML → Internal Format

**Source Structure:**
```xml
<FEUMessages>
  <feu:full-event-update>
    <event-reference>
      <event-id>12345</event-id>
    </event-reference>
    <headline>
      <headline>Event headline text</headline>
    </headline>
    <details>
      <detail>
        <locations>
          <location>
            <location-on-link>
              <primary-location>
                <geo-location>
                  <latitude>40800000</latitude>    <!-- microdegrees -->
                  <longitude>-111900000</longitude>
                </geo-location>
              </primary-location>
              <route-designator>I-80</route-designator>
            </location-on-link>
          </location>
        </locations>
        <descriptions>
          <description>
            <phrase>Description text</phrase>
          </description>
        </descriptions>
        <event-times>
          <start-time>2025-01-01T00:00:00Z</start-time>
          <end-time>2025-12-31T23:59:59Z</end-time>
        </event-times>
      </detail>
    </details>
  </feu:full-event-update>
</FEUMessages>
```

**Transformation Logic (backend_proxy_server.js:410-510):**
1. Navigate nested namespace structure: `FEUMessages['feu:full-event-update']`
2. Extract event ID from `event-reference`
3. Extract headline from nested `headline.headline` object
4. Navigate to `details.detail` for main content
5. **Convert coordinates from microdegrees to decimal:** `lat / 1000000`
6. Extract route from `location-on-link['route-designator']`
7. Join multiple description phrases with '; '
8. Extract times from `event-times`
9. Parse text for lane info and direction

**Key Deviations:**
- **Microdegrees coordinate format** (unique to TMDD)
- Deep namespace nesting (`feu:` prefix)
- Multiple description elements need joining
- Text-based lane and direction extraction
- No native severity field (determined from text)

#### 3. Nevada Custom JSON → Internal Format

**Source Structure:**
```javascript
[
  {
    id: "NV12345",
    location_description: "I-80 Eastbound MM 123",
    direction: "Eastbound",
    routes: ["I-80", "US-50"],
    event_category: "Construction",
    description: "Lane closure for paving",
    headline: "I-80 Lane Closure",
    county: "Washoe",
    start_latitude: "39.5296",
    start_longitude: "-119.8138",
    start_time: "2025-01-01T00:00:00Z",
    end_time: "2025-12-31T23:59:59Z",
    lanes_affected: "Right lane"
  }
]
```

**Transformation Logic (backend_proxy_server.js:231-254):**
1. Check if any route in `routes` array matches interstate pattern
2. Parse `start_latitude` and `start_longitude` as floats
3. Use `location_description` for location text
4. Extract corridor from `location_description` or routes
5. Determine event type from `event_category`
6. Severity from custom `determineSeverity()` function

**Key Deviations:**
- Array of events at root (not GeoJSON)
- String coordinates (need parseFloat)
- Routes as array, need filtering for interstates
- Custom category naming
- No vehicle impact field

#### 4. New Jersey RSS → Internal Format

**Source Structure:**
```xml
<rss version="2.0">
  <channel>
    <item>
      <title>Accident on I-80</title>
      <description>
        Accident on I-80 Eastbound at Exit 25
        Lat: 40.7580
        Lon: -74.0060
        Right lane blocked
      </description>
      <pubDate>Thu, 01 Jan 2025 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
```

**Transformation Logic (backend_proxy_server.js:512-551):**
1. Extract items from `rss.channel.item`
2. Parse description with regex: `/Lat:\s*([-\d.]+)/i`
3. Parse longitude: `/Lon:\s*([-\d.]+)/i`
4. Extract location from description and title text
5. Filter for interstate routes via `isInterstateRoute()`
6. Event type from title analysis
7. Parse description for lane impacts

**Key Deviations:**
- RSS 2.0 format (not traffic-specific)
- Coordinates in unstructured text (regex parsing)
- No geometry field
- Text parsing for all structured data
- pubDate is RFC 822 format (needs conversion)

---

## Specific Field Mapping Deviations

### Coordinates

| Format | Source Format | Conversion Needed | Notes |
|--------|---------------|-------------------|-------|
| WZDx GeoJSON | `geometry.coordinates[0][0]`, `[0][1]` | None (decimal degrees) | LineString: array of points, Point: single point |
| WZDx JSON (Utah) | `geometry.coordinates` | None | Check if LineString or Point |
| FEU-G XML | `geo-location.latitude` / `longitude` | **÷ 1,000,000** | Microdegrees → decimal |
| Nevada JSON | `start_latitude` / `start_longitude` strings | `parseFloat()` | String → number |
| NJ RSS | Regex match in description | `parseFloat()` | Text extraction required |

### Road Names

| Format | Source Field | Processing |
|--------|--------------|------------|
| WZDx v4+ | `core_details.road_names` array | `join(', ')` |
| WZDx v3 | `properties.road_names` array | `join(', ')` |
| FEU-G XML | `route-designator` or `roadway-names.roadway-name` | Text or array join |
| Nevada JSON | `routes` array | Filter for interstates, join |
| NJ RSS | Text in title/description | Regex extraction |

### Event Types

| Format | Source Field | Mapping |
|--------|--------------|---------|
| WZDx | `event_type` | "work-zone" → "Construction", etc. |
| FEU-G XML | Headline text analysis | Text pattern matching |
| Nevada JSON | `event_category` | Direct or text analysis |
| NJ RSS | Title text | Pattern matching ("accident" → "Incident") |
| Ohio Custom | Source type (incidents vs construction endpoint) | Endpoint-based determination |

### Severity

| Format | Determination Method |
|--------|---------------------|
| WZDx | `vehicle_impact`: "all-lanes-open" → "low", else "medium" |
| FEU-G XML | Text analysis of description/headline |
| Nevada JSON | Custom `determineSeverity()` function |
| NJ RSS | Text analysis |
| Utah WZDx | `event_status`: "active" → "medium", else "low" |
| Ohio Custom | `severity` field directly |

### Time Fields

| Format | Source Format | Conversion |
|--------|---------------|------------|
| WZDx | ISO 8601 | None |
| FEU-G XML | ISO 8601 | None |
| Nevada JSON | ISO 8601 | None |
| NJ RSS | RFC 822 (pubDate) | Date parsing needed |

### Lane Information

| Format | Source Field | Extraction Method |
|--------|--------------|-------------------|
| WZDx v4+ | `properties.vehicle_impact` | Direct or descriptive text |
| Utah WZDx | `props.lanes?.[0]?.status` | Array access with optional chaining |
| FEU-G XML | Description text | `extractLaneInfo()` text parsing |
| Nevada JSON | `lanes_affected` | Direct string |
| Ohio Custom | `lanesBlocked` or `lanesAffected` | Direct string |
| NJ RSS | Description text | Text parsing |

---

## TMDD Compliance Summary

### Direct TMDD Compliance (TMDD v3.x)

**5 States using FEU-G XML:**
1. Indiana (state_key: `indiana`)
2. Iowa (state_key: `iowa`)
3. Kansas (state_key: `kansas`)
4. Minnesota (state_key: `minnesota`)
5. Nebraska (state_key: `nebraska`)

**Characteristics:**
- Full TMDD message structure
- Namespace-based XML (`feu:` prefix)
- Microdegree coordinates
- Standard TMDD element names
- CARS Program implementation

### TMDD-Adjacent (WZDx Standards)

**23 States using WZDx:**
- Not direct TMDD but serves similar interoperability purpose
- Modern JSON/GeoJSON format
- Versions: v4.0, v4.1, v4.2
- Industry-standard for work zones
- Managed by US DOT and ITE community

**Notable WZDx Versions Identified:**
- **v4.2:** Illinois Tollway, Ohio DOT
- **v4.1:** Maryland DOT, Massachusetts DOT
- **v4.0:** Utah DOT (explicit in URL: `/v40/`)
- **v4.x:** All other WZDx states (version not explicit)

### Non-TMDD Formats

**2 States:**
1. Nevada - Proprietary JSON format
2. New Jersey - RSS 2.0 feed

---

## Normalization Challenges and Solutions

### Challenge 1: Coordinate Format Inconsistency

**Problem:** Three different coordinate formats across states
- Decimal degrees (WZDx)
- Microdegrees (FEU-G XML)
- String decimals (Nevada)
- Text-embedded (NJ RSS)

**Solution (backend_proxy_server.js:224-563):**
```javascript
// FEU-G: Convert microdegrees
lat = parseFloat(primaryLoc.latitude) / 1000000 || 0;

// Nevada: Parse strings
lat = parseFloat(item.start_latitude) || 0;

// WZDx: Direct access
lat = parseFloat(coords[0][1]) || 0;  // LineString
// or
lat = parseFloat(coords[1]) || 0;     // Point

// NJ RSS: Regex extraction
const latMatch = description.match(/Lat:\s*([-\d.]+)/i);
lat = latMatch ? parseFloat(latMatch[1]) : 0;
```

### Challenge 2: Nested Structure Variations

**Problem:** Different levels of nesting across formats

**WZDx v4+ Structure:**
```
features → feature → properties → core_details → road_names
```

**WZDx v3 Structure:**
```
features → feature → properties → road_names
```

**FEU-G Structure:**
```
FEUMessages → feu:full-event-update → details → detail → locations → location → location-on-link → route-designator
```

**Solution:** Version-agnostic field extraction:
```javascript
const coreDetails = props.core_details || props;
const roadNames = coreDetails.road_names || props.road_names || [];
```

### Challenge 3: Event Type Taxonomy Differences

**Problem:** Each format uses different event type terminology

**Mapping Applied:**
- WZDx: "work-zone" → "Construction"
- FEU-G: Text analysis ("maintenance" keyword → "Construction")
- Nevada: "Construction" category → "Construction"
- RSS: "accident" in title → "Incident"

**Solution:** `determineEventType()` function (backend_proxy_server.js:566-618)
- Pattern matching on combined text fields
- Keyword-based categorization
- Default fallbacks for unknown types

### Challenge 4: Severity Standardization

**Problem:** No consistent severity field across formats

**Solution:** Custom `determineSeverity()` functions
- FEU-G XML: `determineSeverityFromText()` analyzes description
- WZDx: Maps `vehicle_impact` values
- Nevada: Custom logic based on `event_category` and lanes affected
- Default: "medium" severity

### Challenge 5: Direction Extraction

**Problem:** Varying or missing direction fields

**Solution:** `extractDirection()` function (backend_proxy_server.js:688-733)
1. Text pattern matching ("eastbound", "northbound", etc.)
2. Coordinate-based direction determination for major routes
3. Latitude thresholds for E/W routes (I-80, I-70, I-10):
   - Above 40.8°N → "Eastbound" (Utah section)
   - Above 41.2°N → "Eastbound" (Wyoming section)
4. Default: "Both" if undetermined

---

## Recommendations

### For Standardization

1. **Encourage WZDx v4.2 Adoption**
   - Latest version with best interoperability
   - Currently only 2 states using v4.2
   - Recommend migration path for v4.0/v4.1 states

2. **Maintain FEU-G Support**
   - 5 states rely on CARS Program FEU-G
   - Direct TMDD compliance
   - Continue microdegree conversion handling

3. **Custom Format Migration**
   - Nevada and New Jersey RSS → Consider WZDx transition
   - Lower maintenance burden
   - Better industry alignment

### For Data Quality

1. **Version Detection Enhancement**
   - Add version detection for all WZDx feeds
   - Log version mismatches
   - Alert on deprecated field usage

2. **Coordinate Validation**
   - Validate all coordinates are within US bounds
   - Flag zero coordinates (common error)
   - Verify coordinate order (lng, lat) vs (lat, lng)

3. **Interstate Filtering Improvement**
   - Current regex: `/\b(?:I-?|INTERSTATE\s+)(\d{1,3})\b/`
   - Consider secondary routes (US highways, state routes)
   - Add corridor configuration per state

### For Monitoring

1. **Format Change Detection**
   - Monitor for unexpected field absences
   - Alert on structure changes
   - Track WZDx version migrations

2. **Data Freshness Tracking**
   - Track last successful fetch per state
   - Monitor event timestamp distributions
   - Alert on stale data

3. **Transformation Error Logging**
   - Enhanced logging for parsing failures
   - Track which fields fail most often
   - State-specific error rates

---

## Technical Implementation Notes

### File Locations

**Primary Normalization Logic:**
- `backend_proxy_server.js:224-563` - `normalizeEventData()` function

**Format-Specific Handlers:**
- Lines 231-254: Nevada Custom JSON
- Lines 257-280: Ohio WZDx/Custom
- Lines 283-330: Utah WZDx v4.0
- Lines 336-401: Generic WZDx (all other states)
- Lines 410-510: FEU-G XML (TMDD)
- Lines 512-551: New Jersey RSS

**Helper Functions:**
- Lines 566-618: `determineEventType()` - Event categorization
- Lines 688-733: `extractDirection()` - Direction determination
- Lines 209-222: `extractCorridor()` - Interstate extraction
- Lines 195-206: `extractTextValue()` - XML text extraction

### Database Schema

**States Table:**
```sql
CREATE TABLE states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  state_key TEXT UNIQUE NOT NULL,
  state_name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_type TEXT NOT NULL,         -- "WZDx", "FEU-G", "Custom JSON", "RSS"
  format TEXT NOT NULL,            -- "json", "geojson", "xml"
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Environment Configuration

**API Keys Required:**
- Colorado DOT (apiKey parameter empty)
- Florida DOT (app_key present)
- Illinois Tollway (placeholder: [Your-API-Key-Here])
- California 511 (placeholder: %3ckey%3e)
- Ohio DOT (key present in URL)
- Oklahoma DOT (access_token present)
- Pennsylvania Turnpike (placeholder)
- Texas DOT (open data, no key)
- Virginia DOT (placeholder)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-19 | Initial analysis |

---

## References

- **TMDD Standards:** https://www.ite.org/technical-resources/standards/tmdd/
- **WZDx Specification:** https://github.com/usdot-jpo-ode/wzdx
- **CARS Program:** Multiple state FEU-G implementations
- **GeoJSON Specification:** https://geojson.org/

---

**Document Generated By:** DOT Corridor Communicator System Analysis
**Analyst:** AI Code Analysis Tool
**Contact:** System Administrator
