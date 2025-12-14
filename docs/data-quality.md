# Event Data Quality Documentation

## Overview

This document describes the data quality standards and field availability for traffic events from state DOT feeds across the DOT Corridor Communicator system.

Last Updated: 2025-01-15

---

## Event Data Fields

All traffic events are normalized to a common schema with the following core fields:

### Required Fields (Always Present)

- **id** - Unique event identifier
- **state** - State name (e.g., "Nevada", "Iowa")
- **eventType** - Type of event (work-zone, incident, road-condition, etc.)
- **description** - Human-readable event description
- **location** - Location description or road name

### Time Fields

- **startTime** - Event start time/date (ISO 8601 format)
  - **Coverage:** 85-100% depending on feed type
  - **Format:** `2025-01-15T14:30:00Z`
  - **Notes:** Nearly all feeds provide start time

- **endTime** - Estimated end time/date (ISO 8601 format)
  - **Coverage:** Varies significantly by API type (see breakdown below)
  - **Format:** `2025-01-15T18:00:00Z`
  - **Notes:** Not all feeds provide estimated end times

### Geographic Fields

- **latitude** - Event latitude coordinate
- **longitude** - Event longitude coordinate
- **coordinates** - Alternative format: `[longitude, latitude]`
- **county** - County name (when available)

### Impact Fields

- **severity** - Impact severity: `high`, `medium`, `low`
- **lanesAffected** - Lane closure info (e.g., "2 lanes closed", "Right shoulder")
- **direction** - Traffic direction affected (northbound, southbound, both, etc.)
- **corridor** - Interstate corridor (e.g., "I-80", "I-95")

---

## End Time Coverage by API Type

### WZDx Feeds (Work Zone Data Exchange)

**States:** North Carolina, Oklahoma, Colorado, Utah, Iowa, Florida, Minnesota, Maryland, Wisconsin, Missouri, Virginia, Pennsylvania, New York, Texas, Indiana, Kansas, Nebraska, Ohio, Michigan, Illinois, California, Arizona, Washington, Oregon, New Jersey, Massachusetts, Connecticut, New Mexico, Hawaii, Kentucky, Delaware, Louisiana, Idaho

**End Time Coverage:** 60-90%

**Field Name:** `estimated_end_date`

**Notes:**
- WZDx is a standardized format published by FHWA
- End times are part of the WZDx v4.0+ specification
- Most states provide estimated completion dates for planned work zones
- Some states may not provide end times for ongoing maintenance

**Sample:**
```json
{
  "id": "NC-12345",
  "state": "North Carolina",
  "startTime": "2025-01-15T08:00:00Z",
  "endTime": "2025-01-20T17:00:00Z",
  "eventType": "work-zone",
  "description": "I-40 lane closure for bridge repair"
}
```

### FEU-G Feeds (Full Event Update - CARS Program)

**States:** Iowa, Kansas, Nebraska, Indiana, Minnesota (alternative feeds)

**End Time Coverage:** 70-85%

**Field Name:** `endTime` (varies by state)

**Notes:**
- FEU-G is an XML format from the Coalition for Advancing Road Safety
- Provides detailed event information including estimated duration
- End times available for most planned events
- May not include end times for real-time incidents with unknown duration

**Sample:**
```json
{
  "id": "IA-FEU-789",
  "state": "Iowa",
  "startTime": "2025-01-15T06:00:00Z",
  "endTime": "2025-01-15T15:00:00Z",
  "eventType": "incident",
  "description": "I-80 EB accident at MM 142"
}
```

### Custom State APIs

**States:** Nevada, Ohio (511 APIs), Illinois (IDOT), New Jersey (NJDOT)

**End Time Coverage:** 20-60%

**Field Name:** Varies (`endDate`, `estimated_end_time`, `duration`, etc.)

**Notes:**
- Each state has a custom API format
- End time availability depends on state's data collection practices
- Some states provide duration instead of explicit end time
- Real-time incident feeds often lack end time estimates

**Sample:**
```json
{
  "id": "NV-511-456",
  "state": "Nevada",
  "startTime": "2025-01-15T10:00:00Z",
  "endTime": null,
  "eventType": "road-condition",
  "description": "I-15 NB: Icy conditions reported"
}
```

### RSS Feeds

**States:** Pennsylvania (511 RSS)

**End Time Coverage:** 0-10%

**Field Name:** N/A

**Notes:**
- RSS feeds primarily provide publication date
- End times rarely included
- Events are descriptive alerts rather than structured work zones

**Sample:**
```json
{
  "id": "PA-RSS-123",
  "state": "Pennsylvania",
  "startTime": "2025-01-15T12:30:00Z",
  "endTime": null,
  "eventType": "incident",
  "description": "I-76: Multi-vehicle accident westbound"
}
```

---

## End Time Coverage Summary

| API Type | States | Average End Time Coverage | Format |
|----------|--------|---------------------------|--------|
| WZDx | 30+ states | 60-90% | ISO 8601 |
| FEU-G | 5 states | 70-85% | ISO 8601 |
| Custom API | 4+ states | 20-60% | Varies |
| RSS | 1 state | 0-10% | Rarely provided |

**Overall System Coverage:** Approximately 55-70% of all events include an estimated end time

---

## Why End Times Matter

### For Traffic Management

- **Duration Estimation:** Helps travelers plan alternate routes
- **Resource Allocation:** Assists agencies in scheduling crews and equipment
- **Corridor Coordination:** Enables multi-state planning for major events

### For Data Standards Compliance

- **SAE J2735 (DSRC/CV):** Traveler Information Messages require `durationTime`
- **TMDD (Traffic Management Data Dictionary):** Requires temporal bounds for events
- **WZDx Standard:** End times are recommended for work zone coordination

---

## Data Quality Thresholds

The system evaluates end time coverage using these thresholds:

- **Good (70%+):** Sufficient for corridor planning and C2C coordination
- **Fair (40-70%):** Adequate for basic traveler information
- **Poor (<40%):** May impact compliance with TMDD/CV message standards

### Compliance Scores

```
| Field     | Weight | Good (70%+) | Fair (40-70%) | Poor (<40%) |
|-----------|--------|-------------|---------------|-------------|
| startTime | 25%    | 6.25 pts    | 3-6 pts       | 0-3 pts     |
| endTime   | 15%    | 3.75 pts    | 1.5-3.5 pts   | 0-1.5 pts   |
```

---

## Checking End Time Coverage

### Via API

Use the data quality analysis endpoint:

```bash
GET /api/analyze/states/:stateKey
```

Response includes:
```json
{
  "dataQuality": {
    "hasStartTime": 95,
    "hasEndTime": 68,
    "scores": {
      "startTime": 95,
      "endTime": 68
    }
  }
}
```

### Via Dashboard

1. Navigate to State Analytics
2. Select a state
3. View "Data Quality" section
4. Check "End Time Coverage" percentage

---

## Recommendations for States

### For States with <40% End Time Coverage

1. **Add estimated duration field** to event records
2. **Include completion dates** for planned work zones
3. **Provide time ranges** even if estimates are approximate
4. **Use historical data** to estimate typical incident durations

### For All States

1. **Use ISO 8601 format** for all timestamp fields
2. **Update end times** as new information becomes available
3. **Distinguish** between planned (work zones) and unplanned (incidents) events
4. **Provide null/empty** rather than omitting field if end time unknown

---

## Related Standards

- **WZDx Specification:** https://github.com/usdot-jpo-ode/wzdx
- **SAE J2735:** DSRC Message Set Dictionary
- **TMDD:** Traffic Management Data Dictionary (ITE/AASHTO)
- **ISO 8601:** Date and time format standard

---

## Questions or Issues?

For questions about data quality or to report feed issues:
- Contact your state DOT data coordinator
- Submit feedback via the Corridor Communicator dashboard
- Email: support@corridor-communicator.org

---

**Document Version:** 1.0
**Last Updated:** 2025-01-15
**Access URL:** https://[your-domain]/docs/data-quality.md
