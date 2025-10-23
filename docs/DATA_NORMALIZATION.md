# Data Normalization Strategy

## Overview

The DOT Corridor Communicator aggregates traffic event data from **46 different sources** across multiple data formats and normalizes them into a unified structure. This document explains how data from various states and sources is normalized to provide consistent, actionable traffic information.

## Data Sources

### 1. WZDx (Work Zone Data Exchange) Feeds
**Count**: 44 state DOT feeds
**Format**: GeoJSON with WZDx v4.x specification
**Update Frequency**: Varies by state (5-60 minutes)

**Example States**:
- Iowa DOT: 1,350+ features
- Florida DOT: 4,637 features
- North Carolina DOT: 960 features
- Maryland DOT: 196 features
- And 40 more states...

### 2. Ohio OHGO Public API
**Format**: JSON REST API
**Endpoints**:
- `/api/v1/construction` - 634 work zones (500 active)
- `/api/v1/incidents` - Real-time crashes and road work
- `/api/v1/truck-parking` - TPIMS parking availability

**Authentication**: Bearer token (API key required)

### 3. California Caltrans LCS (Lane Control System)
**Format**: JSON per-district feeds
**Districts**: 12 Caltrans districts
**Update Frequency**: 5 minutes
**Total Closures**: 11,984 (839 currently active)

**URL Pattern**: `https://cwwp2.dot.ca.gov/data/d{N}/lcs/lcsStatusD{N}.json`

## Normalization Process

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

## SAE J2735/J2540 Normalization

For V2X (Vehicle-to-Everything) compliance, we further normalize to SAE standards:

### Date/Time Handling
```javascript
// Handle both field naming patterns
const startDateTime = event.startTime || event.startDate;
const endDateTime = event.endTime || event.endDate;

// Convert to ISO 8601
timeStamp: startDateTime ? new Date(startDateTime).toISOString() : new Date().toISOString()
```

### Coordinate Handling
```javascript
// Handle both coordinate formats
const latitude = event.latitude || (event.coordinates && event.coordinates[1]);
const longitude = event.longitude || (event.coordinates && event.coordinates[0]);
```

### VMS Message Generation
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
