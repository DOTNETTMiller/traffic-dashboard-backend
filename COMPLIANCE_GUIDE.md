# SAE J2735 Compliance Deliverables for States

## Overview

This system provides automated SAE J2735 compliance analysis for each state DOT's traffic data feed. States can use these reports to understand how their current data format compares to national standards and get specific recommendations for improvements.

## Compliance Standards Covered

This system evaluates state DOT data feeds against **three major standards**:

1. **SAE J2735** - Connected vehicle communications (TIM messages)
2. **WZDx v4.x** - Work Zone Data Exchange (USDOT standard)
3. **ngTMDD/C2C-MVT** - Next Generation Traffic Management Data Dictionary for center-to-center communications

## Available Compliance Reports

### 1. State Compliance Summary
**Endpoint:** `GET /api/compliance/summary`

Shows compliance status for all states at a glance.

**Example:**
```bash
curl http://localhost:3001/api/compliance/summary
```

**Returns:**
- Data completeness score (0-100) for each state
- Current data format (WZDx, FEU-G, RSS, Custom JSON)
- SAE J2735 readiness status
- Link to detailed compliance guide

---

### 2. State-Specific Compliance Guide
**Endpoint:** `GET /api/compliance/guide/:state`

Detailed analysis and recommendations for a specific state.

**Example:**
```bash
# Get Iowa's compliance guide
curl http://localhost:3001/api/compliance/guide/iowa

# Get Utah's compliance guide
curl http://localhost:3001/api/compliance/guide/utah
```

**Contains:**
1. **Current Data Format Analysis**
   - API type (WZDx, FEU-G, RSS, Custom JSON)
   - Endpoint URL
   - Format strengths

2. **Data Quality Scores** (0-100%)
   - GPS Coordinates coverage
   - Event Type classification
   - Direction information
   - Lane closure details
   - Start/End time completeness
   - Description quality

3. **Identified Gaps**
   - Missing or incomplete fields
   - Severity rating (HIGH, MEDIUM, LOW)
   - Impact on cross-state coordination

4. **Specific Recommendations**
   - Prioritized action items
   - SAE J2735 field mappings
   - WZDx field mappings
   - Example transformations

5. **Transformation Steps**
   - How to extract each field from current format
   - "Before and after" examples
   - Field mapping documentation

6. **WZDx Migration Guide**
   - Benefits of migrating to WZDx standard
   - Step-by-step implementation plan
   - Estimated timeline (5-9 weeks)
   - Validation resources

7. **SAE J2735 TIM Example**
   - Complete example of state's event converted to SAE J2735 format
   - Shows exact structure needed for V2X systems
   - Includes ITIS codes and VMS messages

8. **C2C/ngTMDD Compliance Check (NEW)**
   - Evaluates readiness for center-to-center (TMC-to-TMC) communication
   - Based on Next Generation Traffic Management Data Dictionary
   - Compatible with C2C-MVT validation tool
   - Checks for:
     - Unique Event ID (for tracking across TMCs)
     - Organization ID (which DOT owns the event)
     - Linear Reference (route + milepost)
     - Update Timestamp
     - Event Status
     - Geographic Coordinates
     - Directional Impact
     - Lane Impact
   - Pass/Fail grade with specific recommendations

---

### 3. Data Quality Report (All States)
**Endpoint:** `GET /api/analysis/normalization`

Comprehensive data quality analysis comparing all states.

**Example:**
```bash
curl http://localhost:3001/api/analysis/normalization
```

**Contains:**
- Letter grades (A-F) for each state
- Detailed percentages for each data field
- Strengths and weaknesses analysis
- Overall recommendations for interstate coordination

---

### 4. SAE J2735 TIM Conversion
**Endpoint:** `GET /api/convert/tim`

Converts all events to SAE J2735 Traveler Information Message format.

**Example:**
```bash
curl http://localhost:3001/api/convert/tim
```

**Contains:**
- Full SAE J2735 TIM structure for each event
- ITIS codes (ISO 14823 standard)
- VMS (Variable Message Sign) text
- Geographic regions and coordinates
- Priority levels
- Duration times

---

## How States Can Use These Reports

### For State DOT Technical Staff:

1. **Review Your State's Compliance Guide**
   ```bash
   curl http://localhost:3001/api/compliance/guide/yourstate > compliance_report.json
   ```

2. **Identify Quick Wins**
   - Look for HIGH priority gaps that are easy to fix
   - Focus on coordinate quality and event type classification first

3. **Plan WZDx Migration**
   - Review the migration guide section
   - Follow the 5-step implementation plan
   - Budget 5-9 weeks for complete migration

4. **Validate Against SAE J2735**
   - Review the TIM example in your guide
   - Ensure your feed can populate all required fields
   - Test with SAE J2735 validators

### For Management/Decision Makers:

1. **Check Compliance Summary**
   ```bash
   curl http://localhost:3001/api/compliance/summary
   ```

2. **Compare Your State to Others**
   - See where you rank on data completeness (0-100 score)
   - Identify if you're SAE J2735 ready
   - Benchmark against neighboring states

3. **Understand the Business Case**
   - Review benefits in the WZDx migration guide
   - Better interoperability with connected vehicles
   - Improved cross-state coordination
   - Integration with Google Maps, Waze, Apple Maps

---

## Current State Formats

| State | Format | SAE Ready? | Guide URL |
|-------|--------|------------|-----------|
| Utah | WZDx v4.0 | ✅ Yes (95%) | `/api/compliance/guide/utah` |
| New Jersey | RSS XML | ⚠️ Partial (75%) | `/api/compliance/guide/newjersey` |
| Iowa | FEU-G XML | ❌ No | `/api/compliance/guide/iowa` |
| Kansas | FEU-G XML | ❌ No | `/api/compliance/guide/kansas` |
| Nebraska | FEU-G XML | ❌ No | `/api/compliance/guide/nebraska` |
| Indiana | FEU-G XML | ❌ No | `/api/compliance/guide/indiana` |
| Minnesota | FEU-G XML | ❌ No | `/api/compliance/guide/minnesota` |
| Nevada | Custom JSON | ❌ No | `/api/compliance/guide/nevada` |
| Ohio | Custom JSON | ❌ No | `/api/compliance/guide/ohio` |

---

## Standards References

### SAE J2735
- **Full Name:** SAE J2735 - Dedicated Short Range Communications (DSRC) Message Set Dictionary
- **Purpose:** Standard data format for connected vehicle communications
- **Key Components:**
  - Traveler Information Message (TIM)
  - Basic Safety Message (BSM)
  - Signal Phase and Timing (SPaT)

### WZDx (Work Zone Data Exchange)
- **Website:** https://github.com/usdot-jpo-ode/wzdx
- **Current Version:** v4.2
- **Maintained By:** USDOT ITS JPO
- **Benefit:** Direct compatibility with SAE J2735 for V2X systems

### ITIS Codes
- **Full Name:** Incident Traffic Information Standard (ISO 14823)
- **Purpose:** Standardized codes for traffic events
- **Examples:**
  - 8963: Road work
  - 769: Incident
  - 773: Road closure
  - 8704: Winter weather conditions

---

## API Authentication

Some state APIs require credentials. See `.env.example` for required environment variables:

- **CARS Program** (Iowa, Kansas, Nebraska, Indiana, Minnesota): `CARS_USERNAME`, `CARS_PASSWORD`
- **Nevada DOT**: `NEVADA_API_KEY`
- **Ohio DOT**: `OHIO_API_KEY`

Contact your respective DOT to request API credentials.

---

## Questions?

For technical questions about these compliance reports:
- Review the transformation steps in your state-specific guide
- Check the SAE J2735 TIM examples for field mappings
- Compare your format to WZDx specification

For questions about implementing WZDx:
- Visit https://github.com/usdot-jpo-ode/wzdx
- Join the WZDx community on GitHub
- Contact USDOT ITS JPO for support

---

## Updates

These compliance reports are generated in real-time from your current data feed. Run the API calls anytime to get the latest analysis based on current event data.

**Last Updated:** January 2025
