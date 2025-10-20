# DOT Corridor Communicator: Standards Compliance & Data Normalization Guide

## Executive Summary

This guide explains how the DOT Corridor Communicator normalizes traffic event data from various state DOT feeds and provides a roadmap for achieving compliance with national transportation data standards.

**Target Standards:**
- **WZDx v4.x** - Work Zone Data Exchange (Open Data Standard)
- **SAE J2735** - Dedicated Short Range Communications Message Set Dictionary
- **TMDD v3.1** - Traffic Management Data Dictionary (Center-to-Center)

---

## 1. Current State Assessment

### Data Sources
- **32 State DOT Agencies** providing real-time traffic event data
- **Formats**: Primarily WZDx v4.x (JSON/GeoJSON), some legacy XML/RSS
- **Use Case**: Cross-state corridor coordination and traveler information

### Compliance Challenges
Most states are **not fully compliant** with national standards due to:
1. **Invalid Enum Values**: Using "unknown", "both", custom values instead of standard enums
2. **Missing Required Fields**: Incomplete timestamps, coordinates, or identifiers
3. **Non-Standard Formats**: Legacy or custom data structures
4. **Inconsistent Semantics**: Same concept expressed differently across states

---

## 2. Data Normalization Process

### Our Translation Layer

The DOT Corridor Communicator normalizes incoming data into a **unified event model** suitable for cross-state coordination:

```javascript
// Normalized Event Schema
{
  id: "STATE-unique-identifier",           // Unique event ID
  state: "State DOT Name",                  // Originating agency
  corridor: "I-80",                         // Interstate/highway route
  eventType: "work-zone",                   // WZDx event type enum
  description: "Construction project...",    // Human-readable description
  location: "MM 123 near Exit 45",          // Location description
  county: "County Name",                    // County/region
  latitude: 41.2345,                        // WGS84 latitude
  longitude: -96.1234,                      // WGS84 longitude
  startTime: "2025-10-19T14:30:00Z",       // ISO 8601 timestamp
  endTime: "2025-12-01T18:00:00Z",         // ISO 8601 timestamp
  lanesAffected: "some-lanes-closed",       // WZDx vehicle_impact enum
  severity: "medium",                       // Impact level (high/medium/low)
  direction: "northbound",                  // WZDx direction enum
  requiresCollaboration: false              // Cross-state flag
}
```

### Field Mapping Rules

#### **Event Type Mapping** (to WZDx event_type)
```
Source Format          → Normalized Value
─────────────────────────────────────────
"Construction"         → "work-zone"
"RoadWork"            → "work-zone"
"Maintenance"         → "work-zone"
"Incident"            → "incident"
"Accident"            → "incident"
"Weather"             → "weather-condition"
"Road Closure"        → "restriction"
"Detour"              → "detour"
```

#### **Direction Mapping** (to WZDx direction)
```
Source Format          → Normalized Value
─────────────────────────────────────────
"N", "North"          → "northbound"
"S", "South"          → "southbound"
"E", "East"           → "eastbound"
"W", "West"           → "westbound"
"Both Ways"           → "undefined"
"Bi-directional"      → "undefined"
"Unknown"             → INVALID - needs fix
```

#### **Vehicle Impact Mapping** (to WZDx vehicle_impact)
```
Source Format                    → Normalized Value
─────────────────────────────────────────────────────
"Open"                          → "all-lanes-open"
"Lane Closure"                  → "some-lanes-closed"
"All Lanes Closed"              → "all-lanes-closed"
"Left Lane Closed"              → "some-lanes-closed-merge-right"
"Right Lane Closed"             → "some-lanes-closed-merge-left"
"Shoulder Work"                 → "all-lanes-open"
"Unknown", "Check conditions"   → INVALID - needs fix
```

#### **Severity Calculation**
```
Based on:
- Lane closures: all-lanes-closed = high
- Duration: >7 days = elevated severity
- Time of day: peak hours = elevated severity

Result: high | medium | low
```

---

## 3. Standard Compliance Requirements

### WZDx v4.x Compliance (90+ points = Grade A)

**Required Fields (50 points)**
- ✅ **GPS Coordinates** (25 pts): Valid lat/lon, non-zero, within range
  - Must be WGS84 decimal degrees
  - Latitude: -90 to +90
  - Longitude: -180 to +180

- ✅ **Route/Corridor** (15 pts): Interstate or highway identifier
  - Format: `I-80`, `US-50`, `SR-123`
  - Required for corridor-based coordination

- ✅ **Description** (10 pts): Human-readable event description
  - Minimum 10 characters
  - Describes nature of work/incident

**Important Fields (30 points)**
- ✅ **Event Type** (10 pts): Valid WZDx enum
  ```
  work-zone | detour | special-event | incident |
  weather-condition | restriction
  ```

- ✅ **Start Time** (10 pts): Valid ISO 8601 timestamp
  - Format: `2025-10-19T14:30:00Z` or `2025-10-19T14:30:00-06:00`

- ✅ **Severity/Impact** (10 pts): Impact classification

**Enhanced Fields (20 points)**
- ✅ **Direction** (7 pts): Valid WZDx enum
  ```
  northbound | southbound | eastbound | westbound |
  inner-loop | outer-loop | undefined
  ```

- ✅ **Vehicle Impact** (7 pts): Valid WZDx enum
  ```
  all-lanes-open | some-lanes-closed | all-lanes-closed |
  alternating-one-way | some-lanes-closed-merge-left |
  some-lanes-closed-merge-right | all-lanes-open-shift-left |
  all-lanes-open-shift-right | some-lanes-closed-split |
  flagging | temporary-traffic-signal | unknown
  ```

- ✅ **End Time** (6 pts): Projected completion timestamp

### SAE J2735 Readiness (for V2X Communication)

**Core Requirements:**
1. **Precise Location**: GPS coordinates accurate to within 10 meters
2. **Temporal Accuracy**: Timestamps within 1 second of actual time
3. **ITIS Codes**: Standardized incident type identifiers
4. **Message Priority**: Based on severity and impact

**Mapping to J2735 TIM (Traveler Information Message):**
```javascript
{
  msgCnt: sequenceNumber,
  timeStamp: eventUpdateTime,
  packetID: uniqueEventId,
  dataFrames: [{
    startTime: eventStartTime,
    durationTime: calculatedDuration,
    priority: severityToPriority(severity),  // 0-7 scale
    regions: [{
      anchorPosition: { lat, long, elevation },
      directionality: direction,
      description: corridorName
    }],
    content: {
      advisory: {
        itis: itisCodeFromEventType,
        text: vmsMessageText
      }
    }
  }]
}
```

### TMDD v3.1 Elements (for Center-to-Center Exchange)

**Key TMDD Event Fields:**
- `event-id`: Unique organization-scoped identifier
- `event-category`: Incident classification
- `event-locations`: Geographic references with mileposts
- `event-times`: Start, end, update timestamps
- `event-lanes`: Detailed lane closure information
- `event-description`: Structured description using ITIS codes

**TMDD Advantages:**
- Rich metadata for institutional exchange
- Supports complex lane configurations
- Built-in data quality indicators
- Standardized organization identifiers

**TMDD Migration Path:**
For states currently using legacy TMDD:
1. Continue TMDD for center-to-center exchanges
2. **Also publish WZDx feed** for open data/public consumption
3. Use this system as a bridge between TMDD and WZDx

---

## 4. Achieving Compliance: Step-by-Step Guide

### Phase 1: Fix Invalid Enums (Quick Win - Immediate Impact)

**Problem:** Using non-standard values like "unknown", "both", "check conditions"

**Solution:**
```javascript
// BEFORE (Non-compliant)
{
  "direction": "unknown",  // ❌ Not in WZDx enum
  "vehicle_impact": "check conditions"  // ❌ Not in WZDx enum
}

// AFTER (Compliant)
{
  "direction": "undefined",  // ✅ Valid WZDx value for bidirectional
  "vehicle_impact": "unknown"  // ✅ Valid WZDx value
}
```

**Impact:** Can improve score by 15-20 points immediately

### Phase 2: Add Missing Required Fields

**GPS Coordinates:**
- Geocode all events using address/milepost data
- Validate coordinates are within state boundaries
- Ensure non-zero values

**Timestamps:**
- Use ISO 8601 format with timezone
- Include start time for all events
- Estimate end time if unknown (default: start + 24 hours)

**Route/Corridor:**
- Extract from location string or event description
- Standardize format (I-35, US-6, SR-123)
- Required for interstate corridor coordination

### Phase 3: Enhance Data Quality

**Add End Times:**
- For planned work: Use project completion date
- For incidents: Estimate based on severity
- For indefinite: Use start + 1 year as placeholder

**Improve Descriptions:**
- Include nature of work/incident
- Specify location context (exits, landmarks)
- Add traveler-relevant details (alternate routes)

**Lane Detail:**
- Map generic "lane closure" to specific WZDx enums
- Include merge direction when applicable
- Specify number of lanes if available

---

## 5. Validation & Testing

### Automated Validation

The DOT Corridor Communicator performs real-time validation:

```javascript
// WZDx Enum Validation
const validDirections = [
  'northbound', 'southbound', 'eastbound', 'westbound',
  'inner-loop', 'outer-loop', 'undefined'
];

if (!validDirections.includes(event.direction)) {
  violations.push({
    field: 'direction',
    actual: event.direction,
    expected: validDirections.join(', '),
    fix: 'Update to use WZDx v4.x direction enum'
  });
}
```

### Manual Testing Checklist

- [ ] All events have valid GPS coordinates
- [ ] All timestamps are ISO 8601 format
- [ ] Event types match WZDx enums exactly
- [ ] Directions use WZDx values (not "unknown", "both")
- [ ] Vehicle impact uses WZDx values (not "check conditions")
- [ ] All events have interstate/route identifier
- [ ] Descriptions are meaningful (not just IDs)

---

## 6. Example: State Improvement Roadmap

### Scenario: State XYZ - Current Score 45/100 (Grade F)

**Issues Identified:**
1. 67% of events have `direction: "unknown"` (invalid enum)
2. 45% missing end times
3. 23% missing route/corridor field
4. Using custom event types not in WZDx spec

**Remediation Plan:**

**Week 1-2: Fix Enum Values** (+20 points)
```diff
- "direction": "unknown"
+ "direction": "undefined"

- "vehicle_impact": "check conditions"
+ "vehicle_impact": "unknown"
```
New Score: 65/100 (Grade D)

**Week 3-4: Add Missing Fields** (+15 points)
- Add route extraction from location strings
- Generate end time estimates
```javascript
// Extract route from location
"I-35 NB at MM 123" → corridor: "I-35"

// Estimate end time
if (!endTime) {
  endTime = new Date(startTime);
  endTime.setDate(endTime.getDate() + 7);  // +7 days default
}
```
New Score: 80/100 (Grade B)

**Month 2: Data Quality Enhancements** (+12 points)
- Improve geocoding accuracy
- Add detailed lane information
- Enhance descriptions
New Score: 92/100 (Grade A) ✅

---

## 7. Technical Implementation Guide

### For WZDx Feed Providers

**Minimum Viable WZDx Feed:**
```json
{
  "road_event_feed_info": {
    "feed_info_id": "state-dot-feed",
    "update_date": "2025-10-19T20:00:00Z",
    "publisher": "State DOT",
    "version": "4.2"
  },
  "features": [
    {
      "type": "Feature",
      "properties": {
        "core_details": {
          "event_type": "work-zone",
          "data_source_id": "state-dot",
          "road_names": ["Interstate 80"],
          "direction": "northbound"
        },
        "start_date": "2025-10-20T06:00:00Z",
        "end_date": "2025-12-15T18:00:00Z",
        "vehicle_impact": "some-lanes-closed"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-96.7, 40.8], [-96.6, 40.9]]
      }
    }
  ]
}
```

### For Legacy System Migrations

**Step 1:** Create WZDx wrapper around existing data
**Step 2:** Map existing fields to WZDx schema
**Step 3:** Validate against WZDx JSON schema
**Step 4:** Test with DOT Corridor Communicator API

---

## 8. Benefits of Standards Compliance

### For State DOTs
- ✅ **Interoperability**: Data works with any compliant system
- ✅ **Reduced Development**: Use standard tools/libraries
- ✅ **Better Quality**: Standards enforce data completeness
- ✅ **National Visibility**: Featured in USDOT initiatives

### For Travelers
- ✅ **Consistent Experience**: Same data format across states
- ✅ **Better Navigation**: Apps can process standardized data
- ✅ **Real-Time Updates**: Standards enable automation

### For Cross-State Coordination
- ✅ **Border Collaboration**: Adjacent states share event data
- ✅ **Corridor Management**: I-80, I-35 managed across state lines
- ✅ **Emergency Response**: Standardized incident reporting

---

## 9. Resources & References

### Standards Documentation
- **WZDx Specification**: https://github.com/usdot-jpo-ode/wzdx
- **SAE J2735**: https://www.sae.org/standards/content/j2735_202309/
- **TMDD v3.1**: https://www.ite.org/ (ITE Members)

### DOT Corridor Communicator API
- **Compliance Check**: `GET /api/compliance/guide/:state`
- **Validation Report**: Includes specific violations with examples
- **Roadmap**: Prioritized action plan to achieve Grade A

### Support
For questions about achieving compliance:
- Email: [Your contact]
- GitHub Issues: [Repo link if applicable]

---

## Appendix A: Complete Field Validation Rules

### Coordinates
```javascript
function validateCoordinates(lat, lon) {
  return lat !== 0 && lon !== 0 &&
         lat >= -90 && lat <= 90 &&
         lon >= -180 && lon <= 180;
}
```

### ISO 8601 Timestamps
```javascript
const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?([+-]\d{2}:\d{2})?$/;
function validateTimestamp(timestamp) {
  if (!iso8601Regex.test(timestamp)) return false;
  return !isNaN(new Date(timestamp).getTime());
}
```

### WZDx Enums (Complete List)

**event_type:**
`work-zone`, `detour`, `special-event`, `incident`, `weather-condition`, `restriction`

**direction:**
`northbound`, `southbound`, `eastbound`, `westbound`, `inner-loop`, `outer-loop`, `undefined`

**vehicle_impact:**
`all-lanes-open`, `some-lanes-closed`, `all-lanes-closed`, `alternating-one-way`, `some-lanes-closed-merge-left`, `some-lanes-closed-merge-right`, `all-lanes-open-shift-left`, `all-lanes-open-shift-right`, `some-lanes-closed-split`, `flagging`, `temporary-traffic-signal`, `unknown`

---

**Document Version:** 1.0
**Last Updated:** October 19, 2025
**Maintained By:** DOT Corridor Communicator Team
