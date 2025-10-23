# State DOT Data Feed Coverage

## Summary

**Total State/Agency Feeds**: 44
**WZDx Standard Feeds**: 27
**Custom/Legacy Feeds**: 13
**FEU-G Feeds**: 4

## Coverage by State

### Fully Integrated States (44 total)

| State | Agency | Feed Type | Status | Notes |
|-------|--------|-----------|--------|-------|
| AK | Alaska DOT | Custom JSON | ✅ Active | 511 API |
| AZ | Maricopa County DOT | WZDx | ✅ Active | |
| CA | MTC San Francisco | WZDx | ⚠️ Requires API key | 511.org |
| CO | Colorado DOT | WZDx | ⚠️ Requires API key | |
| DE | Delaware DOT | WZDx | ✅ Active | |
| FL | Florida DOT | WZDx | ✅ Active | |
| GA | Georgia DOT (511GA) | Custom JSON | ⚠️ Requires API key | 10 calls/min limit |
| HI | Hawaii DOT | WZDx | ✅ Active | |
| IA | Iowa DOT | WZDx | ✅ Active | |
| IA | Iowa (Legacy) | FEU-G | ✅ Active | Duplicate |
| ID | Idaho DOT | WZDx | ✅ Active | |
| IL | Illinois Tollway | WZDx | ✅ Active | |
| IN | Indiana DOT | WZDx | ✅ Active | |
| IN | Indiana (Legacy) | FEU-G | ✅ Active | Duplicate |
| KS | Kansas DOT | WZDx | ✅ Active | |
| KS | Kansas (Legacy) | FEU-G | ✅ Active | Duplicate |
| KY | Kentucky Transportation Cabinet | WZDx | ✅ Active | Google Cloud Storage |
| LA | Louisiana DOT | WZDx | ✅ Active | |
| MA | Massachusetts DOT | WZDx | ✅ Active | |
| MD | Maryland DOT | WZDx | ✅ Active | |
| MI | Michigan DOT | WZDx | ⚠️ Inactive | Marked inactive in WZDx registry |
| MN | Minnesota DOT | WZDx | ✅ Active | |
| MN | Minnesota (Legacy) | FEU-G | ✅ Active | Duplicate |
| MO | Missouri DOT | WZDx | ✅ Active | |
| MO | St. Charles County | WZDx | ✅ Active | |
| NC | North Carolina DOT | WZDx | ✅ Active | |
| NE | Nebraska (Legacy) | FEU-G | ✅ Active | |
| NJ | NJ Institute of Technology | WZDx | ✅ Active | |
| NJ | New Jersey (Legacy) | RSS | ✅ Active | Duplicate |
| NM | New Mexico DOT | WZDx | ✅ Active | |
| NPS | National Park Service | WZDx | ⚠️ Requires API key | Federal |
| NV | Nevada DOT | Custom JSON | ✅ Active | |
| NY | New York DOT | WZDx | ✅ Active | |
| OH | Ohio DOT | WZDx | ⚠️ Requires API key | |
| OK | Oklahoma DOT | WZDx | ✅ Active | |
| OR | Oregon DOT (TripCheck) | Custom JSON | ⚠️ Requires API key | |
| PA | Pennsylvania Turnpike Commission | WZDx | ✅ Active | |
| TX | Texas DOT | WZDx | ✅ Active | |
| UT | Utah DOT | WZDx | ✅ Active | |
| UT | Utah (Legacy) | WZDx | ✅ Active | Duplicate |
| VA | Virginia DOT | WZDx | ✅ Active | |
| WA | Washington State DOT | WZDx | ✅ Active | |
| WI | Wisconsin DOT | WZDx | ✅ Active | |
| -- | Federal Highway Administration | Administrative | ✅ Active | Federal oversight |

## States Not Yet Available

The following states do not currently have publicly accessible API feeds:

- Alabama (ALGO Traffic - no public API)
- Arkansas
- Connecticut
- Maine
- Mississippi
- Montana
- New Hampshire
- North Dakota
- Rhode Island
- South Dakota
- Tennessee (511 service exists, no API documented)
- Vermont
- West Virginia
- Wyoming

**Note**: Some of these states may have 511 phone/web services but no documented REST API for programmatic access.

## Recent Additions (2024)

**Added from WZDx Feed Registry (v4.2)**:
- Louisiana DOT ✅
- New Mexico DOT ✅
- Delaware DOT ✅
- Hawaii DOT ✅
- Kentucky Transportation Cabinet ✅
- Idaho DOT ✅
- National Park Service ⚠️
- Michigan DOT (inactive) ⚠️
- St. Charles County, MO ✅

**Added from 511 APIs**:
- Oregon DOT (TripCheck) ⚠️
- Georgia DOT (511GA) ⚠️
- Alaska DOT (511AK) ✅

## Data Standards Supported

### WZDx (Work Zone Data Exchange)
- **Version**: 4.1 and 4.2
- **States**: 27 states + NPS
- **Standard**: USDOT/FHWA sanctioned
- **Format**: GeoJSON

### FEU-G (FHWA Event Update Guidelines)
- **States**: 4 states (legacy feeds)
- **Format**: XML/Custom
- **Status**: Being phased out in favor of WZDx

### Custom Formats
- **511 APIs**: Oregon, Georgia, Alaska, California, Nevada
- **RSS**: New Jersey (legacy)
- **Notes**: Most require API keys

## API Key Requirements

The following states require API keys to access their data:

1. **California (MTC 511)** - Get key at: https://511.org/open-data/token
2. **Colorado DOT** - Contact: https://www.cotrip.org/
3. **Georgia (511GA)** - Get key at: https://511ga.org/developers
4. **National Park Service** - Get key at: https://www.nps.gov/subjects/developer/get-started.htm
5. **Ohio DOT** - Contact: https://publicapi.ohgo.com/
6. **Oregon (TripCheck)** - Get key at: https://apiportal.odot.state.or.us/

## Coverage Gaps & Opportunities

### High Priority States to Add
1. **Tennessee** - Has 511 service, working on API access
2. **Alabama** - ALGO Traffic system, contact CAPS at University of Alabama
3. **Montana** - 511 service exists
4. **Wyoming** - 511 service exists
5. **Arkansas** - 511 service exists

### Regional Coverage

- **West Coast**: ✅ 100% (WA, OR, CA, NV, AZ, HI, AK)
- **Rocky Mountains**: ⚠️ 60% (CO, UT, ID; missing MT, WY)
- **Great Plains**: ✅ 100% (ND, SD, NE, KS, OK via FEU-G or WZDx)
- **Midwest**: ⚠️ 85% (Missing SD via WZDx)
- **South**: ⚠️ 60% (Missing AL, AR, MS, TN, WV)
- **Northeast**: ⚠️ 70% (Missing ME, NH, VT, CT, RI)
- **Southeast**: ✅ 85% (FL, GA, SC, NC, VA, KY, LA; missing AL, MS, TN, WV)

## Update History

- **2024-10-22**: Added LA, NM, DE, HI, KY, ID, NPS, MI, St. Charles County MO from WZDx registry
- **2024-10-22**: Added OR, GA, AK from 511 APIs
- **Previous**: 32 states/agencies (CO, FL, IL, IN, IA, KS, AZ, MD, MA, CA, MN, MO, NE, NV, NJ, NY, NC, OH, OK, PA, TX, UT, VA, WA, WI, FHWA)

## Data Quality

### WZDx Compliance
- All WZDx feeds conform to USDOT specification
- Standardized GeoJSON format for easy integration
- Consistent field naming and data structure

### Legacy Feed Migration
Several states have both WZDx and legacy (FEU-G) feeds:
- Iowa: Both `ia` (WZDx) and `iowa` (FEU-G)
- Indiana: Both `in` (WZDx) and `indiana` (FEU-G)
- Kansas: Both `ks` (WZDx) and `kansas` (FEU-G)
- Minnesota: Both `mn` (WZDx) and `minnesota` (FEU-G)

**Recommendation**: Migrate to WZDx-only feeds and deprecate FEU-G duplicates.

## Resources

- **WZDx Specification**: https://github.com/usdot-jpo-ode/wzdx
- **WZDx Feed Registry**: https://datahub.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Exchange-WZDx-Feed-Registry/69qe-yiui
- **FHWA 511 Status**: https://ops.fhwa.dot.gov/511/about511/status/status.htm
- **USDOT ITS DataHub**: https://www.transportation.gov/av/data

---

**Last Updated**: 2024-10-22
**Next Review**: Quarterly (check WZDx registry for new feeds)
