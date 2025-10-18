# C2C-MVT Integration Guide

## Overview

This system now integrates with the **C2C-MVT (Center-to-Center Message Validation Tool)** from USDOT FHWA STOL to evaluate whether state DOT data feeds are ready for center-to-center (TMC-to-TMC) communication.

**C2C-MVT Tool:** https://github.com/usdot-fhwa-stol/c2c-mvt
**Standard:** ngTMDD (Next Generation Traffic Management Data Dictionary)

---

## What is C2C Compliance?

Center-to-Center (C2C) compliance ensures that traffic events can be reliably shared between different state DOT Traffic Management Centers (TMCs). This is critical for:

- **Interstate Coordination:** Events near state borders need to be shared with neighboring states
- **Regional Incident Management:** Multi-state incidents require coordinated response
- **Traveler Information Systems:** Consistent data enables accurate navigation apps
- **Connected Vehicle Systems:** V2X systems need standardized event data

---

## C2C Compliance Fields

The compliance check evaluates **8 critical fields** for center-to-center communication:

### 1. Unique Event ID (25 points)
- **Required:** YES
- **Purpose:** Track the same event across multiple TMC systems
- **Example:** `UT-6815kn6cz`, `NJ-accident-123456`
- **Current Status:** ✅ Most states have this

### 2. Organization ID (10 points)
- **Required:** RECOMMENDED
- **Purpose:** Identify which DOT/TMC owns/manages the event
- **Example:** `UT-DOT`, `NJDOT-TMC1`, `KDOT`
- **Current Status:** ❌ Most states missing this

### 3. Linear Reference (20 points)
- **Required:** YES
- **Purpose:** Precise location using route + milepost
- **Example:** `I-80 Eastbound MM 123.5`
- **Current Status:** ⚠️ Partial - many have route but missing milepost

### 4. Update Timestamp (10 points)
- **Required:** YES
- **Purpose:** Know when event was last updated
- **Example:** `2025-10-18T15:30:00Z`
- **Current Status:** ✅ Most states have this

### 5. Event Status (10 points)
- **Required:** YES
- **Purpose:** Is event active, cleared, or pending?
- **Example:** `active`, `cleared`, `planned`
- **Current Status:** ✅ Most states use severity as proxy

### 6. Geographic Coordinates (15 points)
- **Required:** YES
- **Purpose:** Map location for visualization
- **Example:** `lat: 40.7608, lon: -111.8910`
- **Current Status:** ✅ Utah 100%, others vary

### 7. Directional Impact (5 points)
- **Required:** RECOMMENDED
- **Purpose:** Which direction of travel is affected
- **Example:** `Eastbound`, `Westbound`, `Both`
- **Current Status:** ❌ Most states missing this

### 8. Lane Impact (5 points)
- **Required:** RECOMMENDED
- **Purpose:** Which lanes are closed/affected
- **Example:** `Left lane closed`, `Right shoulder`
- **Current Status:** ❌ Most states missing this

---

## Scoring Methodology

**Total Possible:** 100 points
**Passing Score:** 80+ points

**Grades:**
- **PASS (80-100):** Data is ready for C2C sharing between TMCs
- **FAIL (0-79):** Data needs improvement for reliable C2C communication

---

## Example: Utah C2C Compliance

```
C2C COMPLIANCE SCORE: 56/100 (FAIL)

Field Coverage:
✅ Unique Event ID         100%
❌ Organization ID           0%
⚠️ Linear Reference         50% (has route, missing milepost)
✅ Update Timestamp        100%
✅ Event Status            100%
✅ Geographic Coordinates  100%
❌ Directional Impact        0%
❌ Lane Impact               0%

Improvements Needed:
1. Add Organization ID (UT-DOT)
2. Add milepost to location (MM 123)
3. Specify direction (Eastbound/Westbound)
4. Specify lane closures
```

---

## How to Improve C2C Compliance

### Quick Wins (High Impact, Low Effort):

1. **Add Organization ID**
   ```json
   {
     "id": "UT-6815kn6cz",
     "organizationId": "UT-DOT",  // ADD THIS
     "description": "Road work on I-80"
   }
   ```

2. **Include Milepost in Location**
   ```json
   {
     "location": "I-80 Eastbound MM 123.5",  // ADD MM
     "description": "Construction zone"
   }
   ```

3. **Specify Direction**
   ```json
   {
     "direction": "Eastbound",  // ADD THIS
     "location": "I-80 MM 123"
   }
   ```

### Longer-Term Improvements:

4. **Add Lane Closure Details**
   ```json
   {
     "lanesAffected": "Left lane closed",
     "laneCount": 2,
     "lanesBlocked": ["1"]
   }
   ```

5. **Add Event Status Field**
   ```json
   {
     "status": "active",  // active, cleared, planned
     "severity": "medium"
   }
   ```

---

## Integration with C2C-MVT Tool

The C2C-MVT tool from USDOT can validate your message format. To use it:

### Option 1: Use Our Compliance API
```bash
curl http://localhost:3001/api/compliance/guide/yourstate
```

Look for the `c2cCompliance` section in the response.

### Option 2: Download C2C-MVT Tool
```bash
# Download from GitHub
wget https://github.com/usdot-fhwa-stol/c2c-mvt/releases/download/c2c-mvt-1.0.0/c2c-mvt.jar

# Run validation
java -jar c2c-mvt.jar
# Access at http://localhost:3116
```

Upload your JSON/XML feed to validate against ngTMDD schema.

---

## Benefits of C2C Compliance

### For State DOTs:
- ✅ Seamless sharing of events with neighboring states
- ✅ Reduced manual coordination calls between TMCs
- ✅ Automatic event synchronization across regions
- ✅ Better incident response times

### For Travelers:
- ✅ Consistent information across state lines
- ✅ Accurate navigation app routing
- ✅ Earlier warnings of downstream incidents
- ✅ Better trip planning

### For Connected Vehicles:
- ✅ Standardized V2I (Vehicle-to-Infrastructure) messages
- ✅ Compatible with SAE J2735 TIM format
- ✅ Real-time hazard warnings
- ✅ Work zone alerts

---

## Next Steps

1. **Check Your State's C2C Score**
   ```bash
   curl http://localhost:3001/api/compliance/guide/yourstate | jq '.c2cCompliance'
   ```

2. **Review Recommendations**
   - Focus on HIGH importance items first
   - Organization ID and Linear Reference are critical

3. **Implement Changes**
   - Add missing fields to your data feed
   - Update API documentation

4. **Validate**
   - Re-run compliance check
   - Use C2C-MVT tool for detailed validation
   - Aim for 80+ score (PASS)

5. **Register Your Feed**
   - Submit to USDOT ITS Data Registry
   - Share with neighboring states
   - Enable real-time C2C communication

---

## Resources

- **C2C-MVT Tool:** https://github.com/usdot-fhwa-stol/c2c-mvt
- **ngTMDD Standard:** https://www.ite.org/technical-resources/standards/next-generation-tmdd/
- **TMDD Documentation:** https://www.standards.its.dot.gov/Standard/516
- **ITS Standards:** https://www.standards.its.dot.gov/

---

**Last Updated:** October 2025
