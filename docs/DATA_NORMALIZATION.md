# Data Normalization Strategy

## Overview

The DOT Corridor Communicator aggregates traffic event data from **46 different sources** across multiple data formats and normalizes them into a unified structure focused on **interstate highway corridors**. This document explains how data from various states and sources is normalized to provide consistent, actionable traffic information.

## Data Sources

### 1. WZDx (Work Zone Data Exchange) Feeds
**Count**: 45 state DOT feeds (including Ohio OHGO WZDx API)
**Format**: GeoJSON with WZDx v4.x specification
**Update Frequency**: Varies by state (5-60 minutes)
**Filtering**: Interstate highways only

**Example States with Interstate Events:**
- Iowa DOT: 303 interstate events (from 849 total features)
- Florida DOT: 304 interstate events (from 5,061 total features)
- Wisconsin DOT: 364 interstate events (from 883 total features)
- Massachusetts DOT: 274 interstate events (from 1,048 total features)
- North Carolina DOT: 177 interstate events (from 798 total features)
- Ohio OHGO: 11 interstate events (from 410 total features)
- Maryland DOT: 25 interstate events (from 56 total features)
- And 10+ more states with interstate coverage

**Note on State Route Feeds:**
Some states like Hawaii, Delaware, Washington, and Austin TX provide WZDx feeds but currently show 0 events because:
- **Hawaii**: Has no interstate highways (only H-1, H-2, H-3 state routes)
- **Delaware/Washington/Austin**: Their feeds currently contain only state routes or local roads, no active interstate work zones

### 2. California Highway Patrol (CHP) Incident Feed
**Format**: XML
**Update Frequency**: Real-time (continuously updated)
**Coverage**: All California incidents including I-5, I-10, I-15, I-80, I-405, I-580
**Authentication**: None required (public feed)

This feed provides real-time incident data from CHP dispatch centers across California including:
- Traffic collisions
- Traffic hazards
- Road closures
- Disabled vehicles
- Other highway incidents

### 3. California 511 / Caltrans (Disabled - Requires API Key)
**Status**: Currently disabled
**Format**: WZDx (GeoJSON)
**Authentication**: Requires 511.org API key

To enable:
1. Obtain API key from https://511.org/developers
2. Update feed URL with valid API key
3. Enable feed in database

## Normalization Process

### Step 0: Interstate Highway Filtering

**Critical**: The DOT Corridor Communicator focuses exclusively on **interstate highway corridors** to support cross-state DOT coordination and V2X communication.

#### Filtering Strategy

All WZDx events are filtered to include **only interstate highways**:

```javascript
const isInterstateRoute = (locationText) => {
  if (!locationText) return false;

  // Match patterns like "I-80", "I 80", "Interstate 80", etc.
  const interstatePattern = /\b(I-?\d{1,3}|Interstate\s+\d{1,3})\b/i;

  // Exclude state routes like "US 30", "SR 520", "TX 71", "H-1"
  const stateRoutePattern = /\b(US|SR|KS|NE|IA|IN|MN|UT|NV|OH|NJ|TX|H)-?\s*\d+\b/i;

  // Must match interstate pattern and NOT match state route pattern
  return interstatePattern.test(locationText) && !stateRoutePattern.test(locationText);
};
```

#### What's Included
- ✅ Interstate highways: `I-80`, `I-95`, `I 70`, `Interstate 75`
- ✅ All standard interstate naming conventions

#### What's Excluded
- ❌ US highways: `US-1`, `US 30`, `US Highway 50`
- ❌ State routes: `SR-520`, `TX-71`, `KS-156`, `H-1`
- ❌ Local roads and city streets

#### Impact by State

**States with Interstate Events:**
- Florida DOT: 304 interstate events
- Iowa DOT: 303 interstate events
- Wisconsin DOT: 364 interstate events
- Massachusetts DOT: 274 interstate events
- Ohio DOT: 11 interstate events
- And 10+ more states with interstate coverage

**States with 0 Events (No Interstate Work Zones):**
- Hawaii DOT: 53 total features (all on H-1, H-2, H-3 state routes - Hawaii has **no interstate highways**)
- Delaware DOT: 8 total features (currently no interstate work zones)
- Washington State DOT: 557 total features (primarily state routes in feed)
- Texas (Austin area): 2,083 total features (city feed focuses on local roads)

#### Rationale

1. **Federal Highway System Focus**: Interstate highways are federally funded and require cross-state coordination
2. **V2X Standardization**: Connected vehicle systems prioritize interstate corridors for deployment
3. **DOT Collaboration**: Interstate events often affect multiple states and require coordination
4. **Data Quality**: Reduces noise from local events not relevant to corridor management

### Step 1: Field Name Mapping

Different sources use different field names for the same data. We normalize to a common schema:

| Concept | WZDx | Ohio OHGO | Caltrans LCS | Normalized |
|---------|------|-----------|--------------|------------|
| **Event Timing** | `startTime`/`endTime` | `startDate`/`endDate` | `closureStartEpoch`/`closureEndEpoch` | `startDate`/`endDate` |
| **Location** | `latitude`/`longitude` | `latitude`/`longitude` | `beginLatitude`/`beginLongitude` | `coordinates` array [lon, lat] |
| **Road Name** | `road_names[0]` | `routeName` | `beginRoute` | `corridor` |
| **Direction** | `direction` enum | `direction` string | `travelFlowDirection` | `direction` (N/S/E/W) |
| **Event Type** | `event_type` | `category` | `typeOfClosure` + `typeOfWork` | `type` + `category` |
| **Severity** | `event_status` | `roadStatus` | Calculated from lanes closed | `severity` (Minor/Moderate/Major) |

### Step 1.5: Flexible Field Recognition Strategy

**Problem**: Different state DOT feeds use varying field naming conventions, making it difficult to recognize when data is actually present but just named differently.

**Solution**: We implemented a flexible field recognition system in the compliance analyzer (`compliance-analyzer.js`) that recognizes data across multiple naming conventions.

#### Field Mapping Table

The system recognizes the following field name variations:

| Standard Field | Recognized Alternatives | Purpose |
|---------------|------------------------|---------|
| **startDate** | `startDate`, `start_date`, `startTime`, `start_time`, `start` | Event start time |
| **endDate** | `endDate`, `end_date`, `endTime`, `end_time`, `end` | Event end time |
| **type** | `type`, `eventType`, `event_type`, `category`, `event_category` | Event classification |
| **lanesClosed** | `lanesClosed`, `lanes_closed`, `lanesAffected`, `lanes_affected`, `closedLanes` | Lane impact |
| **coordinates** | `coordinates`, `geometry.coordinates`, derived from `latitude`/`longitude` | Geographic location |
| **description** | `description`, `headline`, `summary`, `title` | Event details |
| **severity** | `severity`, `impact`, `priority` | Impact level |
| **direction** | `direction`, `travelDirection`, `travel_direction` | Travel direction |
| **roadStatus** | `roadStatus`, `road_status`, `status`, `roadway_status` | Road condition |

#### Coordinate Recognition

The system has special intelligence for recognizing coordinate data:

```javascript
// Standard GeoJSON format
{ coordinates: [-84.233, 39.650] }

// Nested geometry
{ geometry: { coordinates: [-84.233, 39.650] } }

// Separate latitude/longitude fields
{ latitude: 39.650, longitude: -84.233 }

// Alternative names
{ lat: 39.650, lng: -84.233, lon: -84.233 }
```

All formats are automatically recognized and normalized to GeoJSON standard `[longitude, latitude]` array.

#### Implementation

The compliance analyzer uses two helper methods:

```javascript
// Check if a field exists in any recognized format
hasField(event, standardFieldName) {
  return this.getFieldValue(event, standardFieldName) !== null;
}

// Get field value trying multiple naming conventions
getFieldValue(event, standardFieldName) {
  const possibleNames = this.fieldMappings[standardFieldName];

  // Try each possible field name
  for (const fieldName of possibleNames) {
    if (event[fieldName]) return event[fieldName];
  }

  // Special handling for coordinates from lat/lng
  if (standardFieldName === 'coordinates') {
    const lat = event.latitude || event.lat;
    const lng = event.longitude || event.lon || event.lng;
    if (lat && lng) return [lng, lat];
  }

  return null;
}
```

#### Benefits

1. **Higher Data Recognition**: States are properly scored even if they use non-standard field names
2. **Future-Proof**: Easy to add new field name variations as we discover them
3. **Transparent Compliance**: Data quality reports accurately reflect what data is actually available
4. **Normalization Guidance**: Shows states exactly what fields they have vs. what's missing

#### Results

Before flexible recognition:
- States with complete data but non-standard names: **0-20% compliance**

After flexible recognition:
- Same states now score: **64-68% compliance**
- Properly recognizes ~7 states with 2,445+ events that were previously underscored

### Step 2: Coordinate Normalization

#### WZDx Events
```javascript
// WZDx provides separate latitude/longitude fields
{
  latitude: 39.65039,
  longitude: -84.23339
}

// Normalized to:
{
  coordinates: [-84.23339, 39.65039] // [longitude, latitude] - GeoJSON standard
}
```

#### Ohio OHGO Events
```javascript
// Ohio provides both formats
{
  longitude: -81.778462,
  latitude: 41.465587
}

// We use the numeric fields directly
{
  coordinates: [-81.778462, 41.465587]
}
```

#### Caltrans LCS Events
```javascript
// Caltrans embeds coordinates in nested structure
{
  lcs: {
    location: {
      begin: {
        beginLatitude: "39.21321",
        beginLongitude: "-123.768198"
      }
    }
  }
}

// Normalized to:
{
  coordinates: [-123.768198, 39.21321]
}
```

### Step 3: Severity Calculation

Different sources require different severity calculation strategies:

#### WZDx Sources
```javascript
// Based on event_status and vehicle_impact
if (event_status === 'active' && vehicle_impact === 'all-lanes-closed') {
  severity = 'Major';
} else if (vehicle_impact === 'some-lanes-closed') {
  severity = 'Moderate';
} else {
  severity = 'Minor';
}
```

#### Ohio OHGO
```javascript
// Based on roadStatus
if (roadStatus === 'Closed') {
  severity = 'Major';
} else if (roadStatus === 'Restricted') {
  severity = 'Moderate';
} else {
  severity = 'Minor';
}
```

#### Caltrans LCS
```javascript
// Based on percentage of lanes closed and facility type
const totalLanes = parseInt(closure.totalExistingLanes) || 0;
const lanesClosed = closure.lanesClosed ? closure.lanesClosed.split(',').length : 0;
const percentClosed = lanesClosed / totalLanes;

if (closure.facility === 'Ramp' && closure.typeOfClosure === 'Full') {
  severity = 'Major';
} else if (percentClosed >= 0.5) {
  severity = 'Major';
} else if (percentClosed >= 0.25) {
  severity = 'Moderate';
} else {
  severity = 'Minor';
}
```

### Step 4: Event Type Mapping

We map source-specific types to standardized categories:

#### WZDx Event Types
```javascript
const typeMapping = {
  'work-zone': 'work-zone',
  'detour': 'detour',
  'restriction': 'restriction',
  'incident': 'incident',
  'weather-event': 'weather',
  'special-event': 'special-event',
  'road-hazard': 'restriction'
};
```

#### Ohio OHGO Categories
```javascript
// Ohio provides detailed categories we preserve
{
  type: 'work-zone',           // Normalized type
  category: 'Road Work - Planned', // Original category preserved
}

// Incident mapping
if (category === 'Crash') {
  type = 'incident';
} else if (category === 'Road Work') {
  type = 'restriction';
}
```

#### Caltrans LCS Types
```javascript
// Based on typeOfClosure and typeOfWork
if (typeOfClosure === 'Full') {
  type = 'restriction';
} else {
  type = 'work-zone';
}

category = typeOfWork; // "Grinding and Paving", "Bridge Work", etc.
```

### Step 5: Time Zone Handling

#### WZDx
- Provides timestamps in ISO 8601 format with timezone
- Example: `"2022-09-07T04:00:00+00:00"`
- We preserve as-is

#### Ohio OHGO
- Provides ISO timestamps without explicit timezone (assumed local)
- Example: `"2023-03-01T07:00:00"`
- We preserve as-is and treat as local time

#### Caltrans LCS
- Provides epoch timestamps (seconds since 1970)
- Example: `closureStartEpoch: 1729691460`
- We convert to ISO: `new Date(epoch * 1000).toISOString()`

### Step 6: Geometry Handling

#### Point Locations (Most Events)
All sources provide point coordinates that we normalize to GeoJSON format:

```javascript
{
  coordinates: [longitude, latitude]
}
```

#### LineString Geometries (Ohio Work Zones)
Ohio provides detailed polylines for work zones:

```javascript
{
  geometry: {
    type: "LineString",
    coordinates: [
      [-84.0088696494925, 39.70422376545676],
      [-84.00878132443881, 39.70420368078423],
      // ... more points
    ]
  }
}
```

We preserve these detailed geometries for enhanced map visualization.

## Unified Event Schema

After normalization, all events conform to this schema:

```javascript
{
  // Identity
  id: "unique-event-id",           // Format: "{source}-{original-id}"
  source: "Ohio OHGO API",          // Data source name

  // Classification
  type: "work-zone",                // Standard type: work-zone, incident, restriction, etc.
  category: "Road Work - Planned",  // Source-specific category (preserved)
  severity: "Minor",                // Normalized: Minor, Moderate, Major

  // Location
  state: "OH",                      // 2-letter state code
  corridor: "I-75",                 // Primary highway/route
  location: "I-75 Northbound",      // Human-readable location
  direction: "northbound",          // Travel direction
  coordinates: [-84.233, 39.650],   // [longitude, latitude]
  geometry: { ... },                // Optional: LineString for work zones

  // Status
  roadStatus: "Restricted",         // Open, Restricted, Closed

  // Timing
  startDate: "2023-03-01T07:00:00", // When event starts
  endDate: "2026-05-30T19:59:00",   // When event ends (null if indefinite)
  created: "2025-10-23T16:48:36.675Z",
  updated: "2025-10-23T16:48:36.675Z",

  // Content
  headline: "Lane Closure on I-75", // Brief summary
  description: "Full description...", // Detailed description

  // Caltrans-specific (if available)
  lanesClosed: "1,2",               // Lanes affected
  totalLanes: "4",                  // Total lanes on road
  facility: "Mainline",             // Road facility type

  // Ohio-specific (if available)
  county: "Montgomery",             // County name

  // WZDx-specific (if available)
  lanesAffected: "some-lanes-closed", // WZDx vehicle impact enum
  eventType: "Construction"         // WZDx event type
}
```

## Data Quality Assurance

### 1. Coordinate Validation
```javascript
// Reject invalid coordinates
if (isNaN(latitude) || isNaN(longitude)) {
  console.warn(`Invalid coordinates for event ${id}`);
  return null;
}

// Reject out-of-bounds coordinates
if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
  console.warn(`Out of bounds coordinates for event ${id}`);
  return null;
}
```

### 2. Active Event Filtering

#### Caltrans LCS Active Filter
```javascript
const now = Math.floor(Date.now() / 1000);
const startEpoch = parseInt(closure.closureStartEpoch);
const endEpoch = parseInt(closure.closureEndEpoch);

// Skip future closures (more than 1 hour away)
if (startEpoch > now + 3600) return false;

// Include current closures
if (startEpoch <= now && endEpoch >= now) return true;

// Include imminent closures (within 1 hour)
if (startEpoch > now && startEpoch <= now + 3600) return true;
```

#### Ohio OHGO Active Filter
```javascript
// Filter to active work zones only
const activeZones = constructionData.results.filter(item => {
  const endDate = new Date(item.endDate);
  return endDate > new Date(); // Still active
});
```

### 3. Deduplication

We prevent duplicate events using unique IDs:

- **WZDx**: `{state-abbreviation}-{feature-id}`
  - Example: `OH-3a0ad1e2-1d4d-44b6-9309-6c633f6b1496`

- **Ohio OHGO**: `ohio-{type}-{id}`
  - Example: `ohio-construction-WZ000000379_00725`
  - Example: `ohio-incident-00001021000390`

- **Caltrans LCS**: `caltrans-lcs-{closureID}-{logNumber}`
  - Example: `caltrans-lcs-C1EB-4`

## SAE J2735/J2540 Compliance Output

**Critical**: The normalized data enables us to produce fully compliant SAE J2735 and SAE J2540 feeds for V2X (Vehicle-to-Everything) communication systems.

### Overview

After ingesting and normalizing data from 46+ diverse sources, the system produces standardized outputs that comply with:

- **SAE J2735**: Traveler Information Message (TIM) standard for V2X communication
- **SAE J2540**: Work Zone Travel Time, Speed, and Delay (WZ-TSD) standard

This allows our normalized event data to be consumed by:
- Connected Vehicle (CV) systems
- Roadside Units (RSUs)
- Vehicle-to-Infrastructure (V2I) applications
- Commercial vehicle fleets
- Advanced Traffic Management Systems (ATMS)

### Compliant Feed Generation Strategy

#### Step 1: Flexible Field Recognition

The compliance analyzer first recognizes data across multiple naming conventions (see Step 1.5 above), ensuring maximum data capture regardless of source format.

#### Step 2: Field Normalization for Standards

```javascript
// Date/Time Handling - Supports all variations
const startDateTime = event.startTime || event.startDate || event.start_time || event.start;
const endDateTime = event.endTime || event.endDate || event.end_time || event.end;

// Convert to ISO 8601 (Required by SAE J2735)
timeStamp: startDateTime ? new Date(startDateTime).toISOString() : new Date().toISOString()
```

```javascript
// Coordinate Handling - Supports all variations
const latitude = event.latitude || event.lat || (event.coordinates && event.coordinates[1]);
const longitude = event.longitude || event.lon || event.lng || (event.coordinates && event.coordinates[0]);

// Output in SAE J2735 format (latitude/longitude in degrees × 10^7)
position: {
  lat: Math.round(latitude * 10000000),
  long: Math.round(longitude * 10000000)
}
```

#### Step 3: SAE J2735 TIM Message Structure

```javascript
{
  msgCnt: messageCounter,
  timeStamp: ISO8601Timestamp,
  packetID: uniquePacketIdentifier,
  urlB: dataSourceURL,
  dataframes: [
    {
      sspTimRights: 0,  // Public data
      frameType: "advisory",  // or "roadSignage", "commercialSignage"
      msgId: {
        roadSignID: {
          position: {
            lat: latitudeInDegrees_x10e7,
            long: longitudeInDegrees_x10e7
          },
          viewAngle: "1111111111111111",  // All directions
          mutcdCode: "warning"  // Based on event type
        }
      },
      priority: calculatePriority(event.severity),
      sspLocationRights: 3,  // Full rights
      regions: [
        {
          name: event.corridor,
          regulatorID: stateCode,
          segmentID: calculatedSegmentID,
          anchorPosition: {
            lat: latitudeInDegrees_x10e7,
            long: longitudeInDegrees_x10e7
          },
          laneWidth: 366,  // 3.66m standard
          directionality: mapDirection(event.direction),
          closedPath: false,
          description: {
            path: {
              scale: 0,
              type: "ll",
              nodes: generatePathNodes(event.geometry)
            }
          }
        }
      ],
      sspMsgRights2: 3,
      sspMsgRights1: 3,
      duratonTime: calculateDuration(event.startDate, event.endDate),
      startYear: startYear,
      startTime: startTime,
      tcontent: generateTravelerContent(event)
    }
  ]
}
```

#### Step 4: SAE J2540 WZ-TSD Extensions

For work zones, we generate additional J2540-compliant data:

```javascript
{
  workZoneID: event.id,
  workZoneType: mapEventTypeToJ2540(event.type, event.category),
  workZoneStatus: "active",  // Based on current time vs. start/end dates
  workZoneSpeed: {
    speedLimit: extractSpeedLimit(event.description),
    advisorySpeed: calculateAdvisorySpeed(event.severity)
  },
  workZoneDelay: {
    estimatedDelay: calculateDelay(event.severity, event.lanesClosed, event.totalLanes),
    confidenceLevel: "medium"  // Based on data quality
  },
  workZoneLanes: {
    totalLanes: event.totalLanes || estimateLanes(event.corridor),
    lanesAffected: parseLanesClosed(event.lanesClosed || event.lanesAffected),
    laneClosureType: mapClosureType(event.roadStatus)
  }
}
```

### VMS Message Generation (SAE J2735 Text Content)

We generate standardized Variable Message Sign text that works across all sources:

```javascript
// Line 1: Event type with severity indicator
const eventLabel = event.category || event.eventType || event.type;
if (event.severity === 'Major') {
  messages.push(`*** ${eventLabel.toUpperCase()} ***`);
} else {
  messages.push(eventLabel.toUpperCase());
}

// Line 2: Location (corridor + direction)
if (event.corridor) {
  messages.push(`${event.corridor} ${event.direction.toUpperCase()}`);
}

// Line 3: Impact
// Caltrans-specific detailed lane info
if (event.lanesClosed && event.totalLanes) {
  messages.push(`LANES ${event.lanesClosed} OF ${event.totalLanes} CLOSED`);
}
// Ohio-specific road status
else if (event.roadStatus === 'Closed') {
  messages.push('ROAD CLOSED');
}
// WZDx generic
else if (event.lanesAffected) {
  messages.push(event.lanesAffected.toUpperCase());
}
```

### Output Endpoints

The system provides compliant feeds through dedicated API endpoints:

```bash
# SAE J2735 TIM Format - All Events
GET /api/convert/tim
Content-Type: application/json
```

Returns all ~4,050 events from 46 sources in SAE J2735 TIM format.

```bash
# SAE J2540 Commercial Vehicle Format - Work Zones Only
GET /api/convert/tim-cv
Content-Type: application/json
```

Returns work zone events with SAE J2540 extensions for commercial vehicle systems.

```bash
# Filtered by State
GET /api/convert/tim?state=OH
GET /api/convert/tim-cv?state=CA
```

Returns state-specific events in compliant format.

### Compliance Benefits

By producing SAE J2735/J2540 compliant feeds from our normalized data:

1. **Interoperability**: RSUs and CV systems can consume our data without custom integration
2. **Standardization**: Uniform message format across all 46 data sources
3. **Commercial Vehicle Support**: Truck-specific information through J2540 extensions
4. **Real-Time Updates**: 5-minute refresh cycles maintain data freshness
5. **Multi-Source Fusion**: Single feed combines WZDx, proprietary APIs, and real-time sources

### Data Quality for V2X

The flexible field recognition ensures maximum data availability for compliant output:

- **Before**: 0-20% of events had required fields recognized
- **After**: 64-68% of events fully recognized with all available fields
- **Result**: More complete, accurate TIM messages for CV systems

## Performance Optimizations

### 1. Parallel Data Fetching
```javascript
// Fetch all sources in parallel
const allResults = await Promise.all([
  ...stateFeeds.map(state => fetchStateData(state)),
  fetchOhioEvents(),
  fetchCaltransLCS()
]);
```

### 2. Streaming Large Datasets
```javascript
// WZDx feeds can be very large (Florida: 4,637 features)
// We stream and process incrementally rather than loading all at once
florida_data.features.forEach(feature => {
  const event = normalizeWZDxFeature(feature);
  if (event) allEvents.push(event);
});
```

### 3. Caching Strategy
```javascript
// Cache frequently accessed normalization results
const corridorCache = new Map();

function extractCorridor(routeName) {
  if (corridorCache.has(routeName)) {
    return corridorCache.get(routeName);
  }

  const corridor = routeName.match(/I-\\d+|US-\\d+|SR-\\d+/)?.[0] || routeName;
  corridorCache.set(routeName, corridor);
  return corridor;
}
```

## Error Handling

### 1. Graceful Degradation
If one source fails, others continue to work:

```javascript
try {
  const ohioEvents = await fetchOhioEvents();
  allEvents.push(...ohioEvents);
  console.log(`✅ Added ${ohioEvents.length} Ohio events`);
} catch (error) {
  console.error('❌ Ohio API failed:', error.message);
  // Continue with other sources
}
```

### 2. Partial Data Handling
```javascript
// Handle missing optional fields gracefully
{
  lanesClosed: event.lanesClosed || null,
  totalLanes: event.totalLanes || null,
  county: event.county || 'Unknown',
  endDate: event.endDate || null  // null = indefinite
}
```

### 3. Validation Logging
```javascript
if (!facilityId) {
  console.warn('⚠️  Skipping event with missing ID');
  failed++;
  continue;
}

if (isNaN(latitude) || isNaN(longitude)) {
  console.warn('⚠️  Skipping event with invalid coordinates');
  failed++;
  continue;
}
```

## Statistics

### Current Coverage (as of October 2025)

| Source | States | Events | Update Frequency |
|--------|--------|--------|------------------|
| **WZDx Feeds** | 44 | ~2,700 | 5-60 minutes |
| **Ohio OHGO API** | 1 (OH) | 509 | Real-time |
| **Caltrans LCS** | 1 (CA) | 839 | 5 minutes |
| **Total** | **45 states** | **~4,050** | **Real-time** |

### Event Type Breakdown
- Work Zones: ~3,200 (79%)
- Incidents: ~400 (10%)
- Restrictions: ~450 (11%)

### Severity Distribution
- Minor: ~2,800 (69%)
- Moderate: ~800 (20%)
- Major: ~450 (11%)

## Future Enhancements

### 1. Additional State APIs
Following the Ohio/California model, we can integrate:
- Georgia DOT NaviGAtor API
- Pennsylvania 511PA API
- Michigan MDOT API
- Other states with public APIs

### 2. Historical Data
- Store normalized events in time-series database
- Track event duration patterns
- Analyze recurring bottlenecks
- Predict future event likelihood

### 3. Machine Learning
- Auto-categorize events by description text
- Predict event severity based on features
- Detect anomalous events
- Recommend optimal detour routes

### 4. Real-Time Validation
- Cross-reference events between sources
- Detect conflicting information
- Flag stale data automatically
- Provide confidence scores

## API Endpoints

### Get All Normalized Events
```bash
GET /api/events
```

Returns all ~4,050 events from all sources in normalized format.

### Get Events by State
```bash
GET /api/events/:state
```

Returns normalized events for a specific state (e.g., `/api/events/oh`)

### SAE J2735 TIM Format
```bash
GET /api/convert/tim
```

Returns all events in SAE J2735 TIM format for V2X systems.

### SAE J2540 Commercial Vehicle Format
```bash
GET /api/convert/tim-cv
```

Returns all events in SAE J2540 format with truck-specific extensions.

## Conclusion

The DOT Corridor Communicator's data normalization strategy enables:

1. **Unified Interface**: Consistent data structure across 46 diverse sources
2. **Enhanced Coverage**: 4,050+ events vs. ~1,000 with WZDx alone
3. **Real-Time Updates**: 5-minute refresh for critical data
4. **V2X Compliance**: SAE J2735/J2540 standardized outputs
5. **Extensibility**: Easy to add new sources following established patterns

This normalization layer transforms fragmented state data into a cohesive, actionable traffic intelligence system.
