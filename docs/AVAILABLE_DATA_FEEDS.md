# Available Data Feeds for Integration

This document lists all available state DOT and major city traffic data feeds that can be integrated into the DOT Corridor Communicator.

## Currently Integrated (44 States/Agencies)

✅ Already in system:
- Alaska DOT (511AK)
- Colorado DOT
- Delaware DOT
- Florida DOT
- Georgia DOT (511GA)
- Hawaii DOT
- Idaho DOT
- Illinois Tollway
- Indiana / Indiana DOT
- Iowa / Iowa DOT
- Kansas / Kansas DOT
- Kentucky Transportation Cabinet
- Louisiana DOT
- Maryland DOT
- Massachusetts DOT
- Maricopa County DOT (AZ)
- Metropolitan Transportation Commission San Francisco (CA)
- Michigan DOT
- Minnesota / Minnesota DOT
- Missouri DOT
- National Park Service
- Nebraska
- Nevada
- New Jersey / New Jersey Institute of Technology
- New Mexico DOT
- New York DOT
- North Carolina DOT
- Ohio DOT
- Oklahoma DOT
- Oregon DOT (TripCheck)
- Pennsylvania Turnpike Commission
- St. Charles County, MO
- Texas DOT
- Utah / Utah DOT
- Virginia DOT
- Washington State DOT
- Wisconsin DOT

## New WZDx Feeds Available for Integration

### States Not Yet Integrated

#### 1. **Alabama DOT**
- Status: Check WZDx registry for availability
- Potential corridor coverage: I-20, I-65, I-85, I-59

#### 2. **Arizona DOT** (State-level)
- Status: Maricopa County already integrated
- WZDx: Check for state-level feed
- Coverage: I-10, I-17, I-19, I-40

#### 3. **Arkansas DOT**
- Status: Research needed
- Potential: I-40, I-30

#### 4. **Connecticut DOT**
- Status: Research 511 system
- Potential: I-95, I-91, I-84

#### 5. **Michigan DOT**
- Already listed but verify WZDx feed availability
- Coverage: I-94, I-75, I-96, I-69

#### 6. **Mississippi DOT**
- Status: Research needed
- Potential: I-10, I-55, I-20

#### 7. **Montana DOT**
- Status: Research needed
- Potential: I-90, I-15, I-94

#### 8. **Nevada DOT** (State-level)
- Already in system - verify WZDx integration
- Coverage: I-80, I-15

#### 9. **New Hampshire DOT**
- Status: Research 511NH system
- Potential: I-95, I-93, I-89

#### 10. **Rhode Island DOT**
- Status: Research needed
- Potential: I-95

#### 11. **South Carolina DOT**
- Status: Research needed
- Potential: I-95, I-26, I-85, I-20

#### 12. **South Dakota DOT**
- Status: Research needed
- Potential: I-90, I-29

#### 13. **Tennessee DOT**
- Status: Research SmartWay 511 system
- Potential: I-40, I-24, I-65, I-75, I-81
- Note: Major corridor state

#### 14. **Vermont DOT**
- Status: Research needed
- Potential: I-89, I-91

#### 15. **West Virginia DOT**
- Status: Research needed
- Potential: I-64, I-77, I-79, I-81

#### 16. **Wyoming DOT**
- Status: Research WyoRoad 511 system
- Potential: I-80, I-25, I-90
- Note: Major I-80 corridor state

## Major City Traffic APIs

### 1. **New York City DOT**
- **Feed**: https://www.nyc.gov/html/dot/html/about/datafeeds.shtml
- **Format**: Real-time XML/JSON feeds
- **Data**: Traffic speeds, incidents, construction
- **Coverage**: All 5 boroughs
- **Cost**: Free, public API
- **Priority**: HIGH - Major metropolitan area

### 2. **City of Austin, TX**
- **Feed**: https://data.austintexas.gov/download/d9mm-cjw9
- **Format**: WZDx GeoJSON
- **Data**: Work zones
- **Coverage**: Austin metro area
- **Cost**: Free
- **Status**: WZDx feed available

### 3. **Philadelphia (PennDOT Regional)**
- **Feed**: Request access via pa.gov/services/penndot/request-access-to-transportation-related-data-feeds
- **Format**: Various formats available
- **Data**: Real-time incidents, roadwork, conditions
- **Coverage**: Pennsylvania, Philadelphia metro
- **Cost**: Free
- **Note**: Requires data feed request form

### 4. **Los Angeles (Caltrans District 7)**
- **Feed**: Already integrated via Caltrans LCS
- **Coverage**: LA metro area
- **Status**: ✅ Integrated

### 5. **Chicago (Illinois DOT/Tollway)**
- **Feed**: Illinois Tollway already integrated
- **Additional**: Check IDOT state feeds for Chicago metro
- **Coverage**: Chicago metro, I-90, I-94, I-290
- **Status**: Partial integration

### 6. **Houston, TX**
- **Feed**: Texas DOT already integrated
- **Format**: WZDx GeoJSON
- **Coverage**: Houston metro via TxDOT
- **Status**: ✅ Integrated via state feed

### 7. **Seattle, WA**
- **Feed**: Washington State DOT already integrated
- **Additional**: https://wzdx.wsdot.wa.gov/api/v4/WorkZoneFeed
- **Coverage**: Seattle metro, I-5, I-90
- **Status**: ✅ Integrated

### 8. **Phoenix, AZ**
- **Feed**: Maricopa County DOT already integrated
- **WZDx**: https://wzdxapi.aztech.org/construction
- **Coverage**: Phoenix metro
- **Status**: ✅ Integrated

### 9. **Boston, MA**
- **Feed**: Massachusetts DOT already integrated
- **WZDx**: https://feed.massdot-swzm.com/massdot_wzdx_v4.1_work_zone_feed.geojson
- **Coverage**: Boston metro, I-95, I-93
- **Status**: ✅ Integrated

### 10. **San Francisco Bay Area**
- **Feed**: Metropolitan Transportation Commission integrated
- **511 API**: https://api.511.org/traffic/wzdx?api_key=<key>
- **Coverage**: SF Bay Area
- **Status**: ✅ Integrated

## 511 Systems with Open Data APIs

### High Priority for Integration:

1. **511 San Francisco Bay Area (511.org)**
   - URL: https://511.org/open-data
   - API: Traffic, transit, parking data
   - Format: Multiple formats (XML, JSON, GTFS)
   - Rate Limit: 60 requests/hour (can be increased)
   - Cost: Free with API key
   - Coverage: 9 Bay Area counties

2. **511NY (New York State)**
   - URL: https://511ny.org/developers/resources
   - Format: XML real-time feeds
   - Data: Traffic and transit events
   - Coverage: Entire New York State
   - Agencies: NYSDOT, NYC DOT, Thruway Authority
   - Cost: Free

3. **511WI (Wisconsin)**
   - URL: https://511wi.gov/developers/resources
   - Format: Real-time XML/JSON
   - Coverage: Entire Wisconsin
   - Cost: Free

4. **511GA (Georgia)**
   - URL: https://511ga.org/developers/doc
   - API: REST API
   - Data: Cameras, message signs, events, alerts, rest areas
   - Coverage: Georgia
   - Cost: Free

5. **511PA (Pennsylvania)**
   - URL: https://www.511pa.com
   - Note: Request access via PennDOT data feed form
   - Coverage: All of Pennsylvania
   - Cost: Free

## Missing Major Corridor States

### Critical Gaps (I-80, I-90, I-95 Corridors):

1. **Wyoming** - I-80 corridor (WyoRoad 511)
2. **Connecticut** - I-95 corridor
3. **Rhode Island** - I-95 corridor
4. **New Hampshire** - I-95 corridor
5. **South Dakota** - I-90 corridor
6. **Montana** - I-90 corridor

### Important Southern States:

1. **Tennessee** - I-40, I-24 corridors
2. **Alabama** - I-20, I-65 corridors
3. **Mississippi** - I-10, I-55 corridors
4. **South Carolina** - I-95, I-85 corridors
5. **Arkansas** - I-40, I-30 corridors

## Integration Priority Recommendations

### TIER 1 - Critical Corridor Gaps:
1. Wyoming DOT (I-80)
2. Tennessee DOT (I-40)
3. Connecticut DOT (I-95)
4. Montana DOT (I-90)
5. NYC DOT (major metro)

### TIER 2 - Major Metros:
1. Philadelphia/PennDOT regional
2. Chicago (expand Illinois coverage)

### TIER 3 - Regional Coverage:
1. Alabama DOT
2. South Carolina DOT
3. Arkansas DOT
4. Mississippi DOT
5. New Hampshire DOT
6. Rhode Island DOT
7. Vermont DOT
8. West Virginia DOT
9. South Dakota DOT

## Next Steps

1. **Immediate Action Items:**
   - Request API keys for feeds requiring registration:
     - 511 San Francisco (if not already done)
     - Ohio DOT (if not already done)
     - Illinois Tollway (if not already done)
     - PennDOT data feeds

2. **Research Phase:**
   - Contact Wyoming DOT for WZDx feed availability
   - Contact Tennessee DOT (SmartWay 511)
   - Research Connecticut DOT 511 system
   - Contact Montana DOT for 511 data access

3. **Testing Phase:**
   - Test NYC DOT real-time feeds
   - Verify all WZDx feeds are v4.1 compatible
   - Test 511 API integrations

4. **Documentation:**
   - Create integration guides for each new feed
   - Document API key requirements
   - Create state-by-state coverage maps

## Resources

- **WZDx Feed Registry**: https://datahub.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Exchange-WZDx-Feed-Registry/69qe-yiui
- **WZDx Specification**: https://github.com/usdot-jpo-ode/wzdx
- **511 Open Data**: https://511.org/open-data
- **Data.gov Traffic Datasets**: https://catalog.data.gov/dataset/?tags=traffic
- **WZDx Contact**: avdx@dot.gov

## Notes

- Most WZDx feeds are v4.1 or v4.2 (latest spec)
- Some feeds require API key registration (usually free)
- Rate limits vary by provider
- All listed feeds are publicly accessible with proper registration
- Focus on I-80, I-35, I-95, I-90, I-40 corridors for maximum impact

---

*Last Updated: November 2025*
*Next Review: Check WZDx registry quarterly for new feeds*
