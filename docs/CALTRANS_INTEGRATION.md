# California Caltrans Integration

## Overview

This document describes the integration of California Department of Transportation (Caltrans) data sources into the DOT Corridor Communicator system.

## Current Integration Status

### California Highway Patrol (CHP) Incidents
- **Status**: ✅ Integrated
- **Source**: CHP Incidents XML Feed
- **Data Type**: Real-time traffic incidents
- **Update Frequency**: Real-time
- **Coverage**: Statewide incidents on California highways and interstates

### 511 SF Bay (Metropolitan Transportation Commission)
- **Status**: ✅ Integrated
- **Source**: 511 SF Bay WZDx Feed
- **Data Type**: Construction, work zones, road conditions
- **Format**: WZDx v4.x (GeoJSON)
- **Coverage**: San Francisco Bay Area

## Available Caltrans Data Sources

### 1. Caltrans Lane Closure System (LCS)
- **Purpose**: Planned lane closures and construction activities
- **Format**: Custom XML/JSON
- **Coverage**: All Caltrans districts
- **Integration Status**: 🔄 Planned

### 2. Caltrans QuickMap
- **Purpose**: Real-time traffic conditions, incidents, CMS messages
- **Format**: REST API
- **Coverage**: Statewide
- **Integration Status**: 🔄 Planned

### 3. Caltrans Performance Measurement System (PeMS)
- **Purpose**: Historical traffic data, speeds, volumes
- **Format**: API
- **Coverage**: Major California highways
- **Integration Status**: 📋 Future consideration

## Integration Plan

### Phase 1: CHP Incidents (Complete)
- ✅ Integrated CHP XML incident feed
- ✅ Parse incident types, locations, descriptions
- ✅ Map to interstate routes (I-5, I-10, I-15, I-40, I-80, etc.)
- ✅ Display on map with severity indicators

### Phase 2: Lane Closure System (Planned)
**Steps**:
1. Obtain LCS API access credentials
2. Review LCS data format and schema
3. Map LCS closure types to DOT Corridor event types
4. Implement parser for LCS format
5. Add to state feeds configuration
6. Test with sample data

**Benefits**:
- Planned construction visibility
- Better detour planning
- Cross-state coordination for major projects

### Phase 3: QuickMap Integration (Planned)
**Steps**:
1. Register for QuickMap API access
2. Determine relevant data endpoints (CMS messages, incidents, cameras)
3. Implement data normalization
4. Add camera feeds to multi-camera view
5. Integrate CMS messages with DOT messaging system

**Benefits**:
- Comprehensive California coverage
- Camera views for verification
- Dynamic message sign content

## Data Normalization

California data sources are normalized to the standard DOT Corridor format:

```javascript
{
  id: "CA-{source}-{id}",
  state: "California",
  corridor: "I-5", // or appropriate interstate
  eventType: "Construction" | "Incident" | "Closure" | "Restriction",
  description: "...",
  location: "...",
  latitude: 34.0522,
  longitude: -118.2437,
  startTime: "2025-01-01T00:00:00Z",
  endTime: "2025-01-31T23:59:59Z",
  lanesAffected: "...",
  severity: "high" | "medium" | "low",
  direction: "North" | "South" | "East" | "West" | "Both",
  source: "CHP" | "511SF" | "LCS" | "QuickMap"
}
```

## Interstate Coverage

California interstates monitored by the system:
- **I-5**: Major north-south corridor (Oregon to Mexico)
- **I-8**: East-west (San Diego to Arizona)
- **I-10**: East-west (Santa Monica to Arizona)
- **I-15**: North-south (San Diego to Nevada)
- **I-40**: East-west (Barstow to Arizona)
- **I-80**: East-west (San Francisco to Nevada)

## API Configuration

### CHP Incidents Feed
```javascript
{
  stateKey: "ca-chp",
  stateName: "California Highway Patrol",
  apiUrl: "https://media.chp.ca.gov/sa_xml/sa.xml",
  apiType: "Custom XML",
  format: "xml",
  enabled: true
}
```

### 511 SF Bay Feed
```javascript
{
  stateKey: "ca",
  stateName: "California (SF Bay)",
  apiUrl: "https://511.org/api/wzdx",
  apiType: "WZDx",
  format: "geojson",
  enabled: true
}
```

## Caltrans Districts

Caltrans is organized into 12 districts. Future integration may include district-specific feeds:

| District | Region | Major Interstates |
|----------|--------|-------------------|
| D1 | North Coast | US-101 |
| D2 | Northeast | I-5 |
| D3 | Marysville/Sacramento | I-5, I-80 |
| D4 | San Francisco Bay | I-80, I-580, I-680 |
| D5 | Central Coast | US-101 |
| D6 | Fresno | I-5 |
| D7 | Los Angeles | I-5, I-10, I-405, I-605, I-710 |
| D8 | San Bernardino | I-10, I-15, I-40 |
| D9 | Eastern Sierra | US-395 |
| D10 | Stockton | I-5, I-580 |
| D11 | San Diego | I-5, I-8, I-15 |
| D12 | Orange County | I-5, I-405 |

## Contact Information

For questions about Caltrans data integration:
- **CHP Incidents**: Public XML feed (no credentials required)
- **511 SF Bay**: https://511.org/open-data
- **Lane Closure System**: Contact Caltrans IT for API access
- **QuickMap**: https://quickmap.dot.ca.gov

## Future Enhancements

1. **Truck Restrictions**: Integrate Caltrans truck route restrictions
2. **Chain Control**: Winter chain control status on mountain passes
3. **Bridge Clearances**: Low clearance bridges on California routes
4. **Weigh Stations**: Real-time weigh station status
5. **Rest Areas**: Rest area locations and truck parking availability

## Related Documentation

- [Data Sources](./DATA_SOURCES.md) - All integrated data feeds
- [Data Normalization](./DATA_NORMALIZATION.md) - Format conversion details
- [Adding New Feeds](./ADDING_NEW_FEEDS.md) - How to add new data sources

---

**Last Updated**: November 2025
**Status**: CHP & 511 SF Bay Active | LCS & QuickMap Planned
