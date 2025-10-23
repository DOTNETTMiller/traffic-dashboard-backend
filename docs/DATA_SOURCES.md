# Data Sources

This document tracks all data sources integrated into the Corridor Communicator system.

## Traffic Event Feeds (WZDx)

### State DOT Feeds (44 states)
Integrated in `backend_proxy_server.js` as part of the main event aggregation system.

**Format**: WZDx (Work Zone Data Exchange) - FHWA standard
**Update Frequency**: Varies by state (typically 5-15 minutes)
**Data Includes**:
- Work zones
- Incidents
- Road closures
- Detours
- Lane restrictions

**States Covered**:
AL, AZ, AR, CA, CO, CT, DE, FL, GA, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, TN, TX, UT, VT, VA, WI

## Truck Parking Data

### 1. Iowa DOT Rest Areas ✅ ACTIVE
**Source**: Iowa DOT ArcGIS REST Service
**URL**: `https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Rest_Area_View/FeatureServer/0`
**Status**: ✅ Integrated
**Script**: `scripts/import_iowa_rest_areas.js`
**Update Frequency**: Static (facility locations and capacity)
**Facilities**: 32 rest areas
**Total Truck Spaces**: 558

**Data Fields**:
- Coordinates (lat/lon)
- Truck parking capacity
- Amenities (WiFi, restrooms, pet areas, etc.)
- Facility name and address

**Notes**:
- Provides static facility data (locations, capacity)
- No real-time availability data
- Run import script once to populate database

### 2. Ohio TPIMS (OHGO) 🔑 REQUIRES API KEY
**Source**: Ohio Department of Transportation Public API
**URL**: `https://publicapi.ohgo.com/api/v1/truck-parking`
**Status**: ⚠️ Configured but requires API key
**Script**: `scripts/fetch_tpims_data.js`
**Update Frequency**: Real-time (fetch every 5-15 minutes recommended)

**Data Fields**:
- Id, Location, Description
- Latitude, Longitude
- Capacity (maximum spaces)
- ReportedAvailable (current availability)
- Address
- Open status
- LastReported timestamp

**Authentication**:
1. Register at `https://publicapi.ohgo.com/accounts/registration`
2. Get API key from `https://publicapi.ohgo.com/docs/api-key`
3. Set environment variable: `export OHIO_API_KEY="your-key-here"`

**Benefits**:
- Real-time availability data
- Ground truth for validating predictions
- Coordinates included for all facilities
- Frequent updates

### 3. Kentucky TPIMS (TRIMARC) ⚠️ LIMITED
**Source**: TRIMARC Traffic Operations Center
**URL**: `http://www.trimarc.org/dat/tpims/TPIMS_Dynamic.json`
**Status**: ⚠️ Partial (no coordinates)
**Script**: `scripts/fetch_tpims_data.js`
**Update Frequency**: Real-time

**Data Fields**:
- Site names
- ReportedAvailable ("LOW", "HIGH", or numeric)
- **Missing**: Latitude/Longitude coordinates

**Issue**: Kentucky feed provides availability data but no coordinates. Can only update existing facilities, cannot add new ones.

**Workaround**: Match site names to static facility database or manually add coordinates.

### 4. Minnesota DOT TPIMS ⚠️ LIMITED
**Source**: Minnesota DOT IRIS System
**URL**: `http://iris.dot.state.mn.us/iris/TPIMS_dynamic`
**Status**: ⚠️ Partial (no coordinates)
**Script**: `scripts/fetch_tpims_data.js`
**Update Frequency**: Real-time

**Same Issue as Kentucky**: Availability data without coordinates.

### 5. National Truck Parking Dataset (BTS/FHWA) 🗺️ REFERENCE ONLY
**Source**: Bureau of Transportation Statistics / FHWA
**URL**: `https://catalog.data.gov/dataset/truck-stop-parking1`
**Status**: 📚 Reference dataset (2017-2019)
**Coverage**: All U.S. states

**Data Fields**:
- Nationwide truck parking facility locations
- Coordinates
- Basic facility information

**Notes**:
- Static dataset from 2017-2019 (part of Jason's Law survey)
- No real-time availability data
- Useful for seeding facility locations
- Available as shapefile or through ArcGIS services
- Download via Open Data Catalog

## Work Zone / Closure Data

### California DOT Lane Control System (Caltrans LCS) 🚧 FUTURE USE
**Source**: Caltrans District Feeds
**Update Frequency**: Every 5 minutes
**Status**: 🔜 Not yet integrated (for future enhancement)

**URLs** (12 districts):
```
https://cwwp2.dot.ca.gov/data/d1/lcs/lcsStatusD01.json
https://cwwp2.dot.ca.gov/data/d2/lcs/lcsStatusD02.json
https://cwwp2.dot.ca.gov/data/d3/lcs/lcsStatusD03.json
https://cwwp2.dot.ca.gov/data/d4/lcs/lcsStatusD04.json
https://cwwp2.dot.ca.gov/data/d5/lcs/lcsStatusD05.json
https://cwwp2.dot.ca.gov/data/d6/lcs/lcsStatusD06.json
https://cwwp2.dot.ca.gov/data/d7/lcs/lcsStatusD07.json
https://cwwp2.dot.ca.gov/data/d8/lcs/lcsStatusD08.json
https://cwwp2.dot.ca.gov/data/d9/lcs/lcsStatusD09.json
https://cwwp2.dot.ca.gov/data/d10/lcs/lcsStatusD10.json
https://cwwp2.dot.ca.gov/data/d11/lcs/lcsStatusD11.json
https://cwwp2.dot.ca.gov/data/d12/lcs/lcsStatusD12.json
```

**Data Fields**:
- Closure ID and type
- Location (coordinates, route, postmile)
- Timestamp (start/end)
- Facility type (ramp, lane, etc.)
- Type of work
- Lanes closed vs total lanes
- Direction

**Use Cases**:
- Enhanced work zone data for California (supplement WZDx)
- High-frequency updates (5 min vs typical 15 min)
- Detailed closure information
- Can improve parking demand predictions near work zones

**Integration Priority**: Medium (CA already has WZDx feed, this adds more detail)

## Data Quality & Coverage

### Real-Time Truck Parking Availability
| State | Facilities | Real-Time | Coordinates | Status |
|-------|-----------|-----------|-------------|--------|
| Iowa | 32 | ❌ | ✅ | Active |
| Ohio | ~20-30 | ✅ | ✅ | Requires API key |
| Kentucky | ~13 | ✅ | ❌ | Partial |
| Minnesota | ~7 | ✅ | ❌ | Partial |

### Traffic Events
| Data Type | States | Update Freq | Status |
|-----------|--------|-------------|--------|
| Work Zones | 44 | 5-15 min | Active |
| Incidents | 44 | 5-15 min | Active |
| Road Closures | 44 | 5-15 min | Active |

## Recommended Next Steps

### Immediate Priority: Ohio API Key
1. Register for Ohio TPIMS API key
2. Adds 20-30 facilities with real-time data
3. Enables prediction validation
4. High-quality data source with coordinates

### Short-term: Find More State ArcGIS Services
Similar to Iowa, other states likely have ArcGIS REST services for rest areas:
- Search pattern: `"[State] DOT rest area" site:arcgis.com`
- Look for FeatureServer endpoints
- Priority states: Major freight corridors (I-80, I-40, I-10, I-5, I-95)

### Medium-term: California LCS Integration
- Adds detailed work zone data for California
- 12 district feeds with 5-minute updates
- Enhances parking predictions near work zones

### Long-term: MAASTO Archive Data
Access historical TPIMS data from the MAASTO (Mid America Association of State Transportation Officials) system:
- 8-state regional system (IL, IN, IA, KS, KY, MI, MN, WI)
- Historical data available since 2019
- Would dramatically improve prediction accuracy
- Contact state DOTs or MAASTO directly for access

## Data Limitations

### Missing Coordinates Issue
Kentucky and Minnesota TPIMS feeds don't include facility coordinates. Options:
1. **Manual mapping**: Create lookup table matching site names to coordinates
2. **Static database**: Use BTS national dataset to seed coordinates
3. **Geocoding**: Use address/route information to geocode facilities
4. **State coordination**: Request coordinate data from DOTs

### Static vs Real-Time
Iowa provides excellent facility data but no real-time availability. This means:
- Can show facilities on map
- Can generate predictions
- Cannot validate predictions without real-time data
- Could be supplemented with TPIMS data if Iowa joins MAASTO

### API Key Requirements
Ohio requires registration and API key management:
- Need to monitor rate limits
- Key rotation/management
- Potential for access restrictions

## Usage Examples

### Fetch Real-Time Parking Data
```bash
# Set Ohio API key (if available)
export OHIO_API_KEY="your-key-here"

# Fetch from all TPIMS feeds
node scripts/fetch_tpims_data.js
```

### Import Static Facility Data
```bash
# Import Iowa rest areas (one-time)
node scripts/import_iowa_rest_areas.js
```

### Generate Predictions
```bash
# Generate predictions using historical patterns + events
node scripts/generate_parking_predictions.js
```

## Data Provenance

All data sources are tracked in the database:
- `truck_parking_facilities.created_at` - When facility was added
- `truck_parking_facilities.last_updated` - Last data refresh
- `parking_availability.timestamp` - When availability was recorded
- `parking_availability.is_prediction` - Whether data is predicted or actual

## Contact Information

### Data Providers
- **Ohio TPIMS**: https://publicapi.ohgo.com
- **Iowa DOT**: Contact for potential TPIMS access
- **TRIMARC (KY)**: http://www.trimarc.org
- **Minnesota DOT**: http://www.dot.state.mn.us

### Data Standards
- **WZDx Specification**: https://github.com/usdot-jpo-ode/jpo-wzdx
- **TPIMS Standards**: https://ops.fhwa.dot.gov/freight/infrastructure/truck_parking/
- **Jason's Law**: https://ops.fhwa.dot.gov/freight/infrastructure/truck_parking/jasons_law/
