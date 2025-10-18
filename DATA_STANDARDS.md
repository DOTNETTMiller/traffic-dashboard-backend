# Data Quality & Standardization Analysis

## Overview

This document describes the data quality analysis and standardization features added to the DOT Corridor Communicator system.

## New API Endpoints

### 1. Data Quality Analysis
**Endpoint:** `GET /api/analysis/normalization`

This endpoint analyzes traffic event data from all connected state DOT APIs and generates a comprehensive report on:

- **Data completeness** - Percentage of events with complete information
- **Quality grades (A-F)** - Overall assessment of each state's data quality
- **Specific issues** - Missing fields, inconsistent formats, etc.
- **Recommendations** - Actionable steps to improve data quality

#### Example Usage:
```bash
curl http://localhost:3001/api/analysis/normalization
```

#### Report Structure:
```json
{
  "generatedAt": "2025-10-18T02:58:28.263Z",
  "summary": {
    "totalStates": 9,
    "totalEvents": 788,
    "statesWithGoodData": 1,
    "statesNeedingImprovement": 8
  },
  "states": {
    "StateName": {
      "eventCount": 44,
      "grade": "C",
      "dataCompleteness": 75.0,
      "apiType": "FEU-G",
      "sourceFormat": "xml",
      "strengths": [...],
      "issues": [...],
      "recommendations": [...]
    }
  },
  "recommendations": [...]
}
```

#### Grading System:
- **A (90-100%)** - Excellent data quality, minimal improvements needed
- **B (80-89%)** - Good data quality, minor improvements recommended
- **C (70-79%)** - Acceptable data quality, several improvements needed
- **D (60-69%)** - Poor data quality, significant improvements required
- **F (<60%)** - Failing data quality, major overhaul needed

#### Evaluated Metrics:
1. **Coordinates** (25% weight) - Valid GPS coordinates in decimal degrees
2. **Description** (20% weight) - Meaningful event descriptions
3. **Event Type** (15% weight) - Proper categorization (Construction, Incident, etc.)
4. **Corridor** (15% weight) - Interstate route identification
5. **Severity** (10% weight) - Risk level assessment
6. **Start Time** (10% weight) - Event start timestamp
7. **Direction** (5% weight) - Travel direction affected

### 2. SAE J2735 TIM Conversion
**Endpoint:** `GET /api/convert/tim`

Converts traffic events into standardized **Traveler Information Messages (TIM)** compatible with:
- **SAE J2735** - Standard for V2X (Vehicle-to-Everything) communications
- **ITIS Codes** - International Traffic Information Standard codes
- **WZDx** - Work Zone Data Exchange format
- **VMS Messages** - Variable Message Sign display text

#### Example Usage:
```bash
curl http://localhost:3001/api/convert/tim
```

#### Message Structure:
```json
{
  "format": "SAE J2735 TIM (Traveler Information Message)",
  "timestamp": "2025-10-18T02:58:44.186Z",
  "messageCount": 788,
  "messages": [
    {
      "msgCnt": 26,
      "timeStamp": "2025-10-18T02:00:06.000Z",
      "packetID": "NE-kstldpdxu",
      "dataFrames": [
        {
          "startTime": "...",
          "durationTime": 120,
          "priority": 0,
          "regions": [...],
          "content": {
            "advisory": {
              "item": {
                "itis": 8963,
                "text": "*** CONSTRUCTION *** / I-80 Westbound / USE CAUTION"
              }
            },
            "workZone": {...},
            "incident": null
          }
        }
      ],
      "vmsMessage": "*** CONSTRUCTION *** / I-80 Westbound / USE CAUTION / WESTBOUND ONLY",
      "wzdx_event_type": "work-zone",
      "original_event": {...}
    }
  ]
}
```

#### ITIS Codes Used:
- **8963** - Road work
- **769** - Incident
- **773** - Road closure
- **8704** - Winter weather conditions

#### VMS Message Format:
Variable Message Sign messages follow this structure:
1. **Line 1:** Event type (with *** for high severity)
2. **Line 2:** Location (truncated to 40 chars)
3. **Line 3:** Impact (lane closures or general advice)
4. **Line 4:** Direction affected (if applicable)

Example: `*** CONSTRUCTION *** / I-80 Westbound / 2 LANES CLOSED / WESTBOUND ONLY`

## Data Quality Report UI

### Accessing the Report
In the frontend application at http://localhost:3000, click the **"Data Quality Report"** button in the top navigation.

### Report Features:

#### Summary Cards
- Total states monitored
- Total events tracked
- States with good data quality
- States needing improvement

#### State Details Tab
For each state, displays:
- **Grade badge** - Visual indicator (A-F) with color coding
- **Data completeness** - Progress bar showing percentage
- **API type** - FEU-G, WZDx, RSS, or Custom JSON
- **Strengths** - Green checkmarks for areas of excellence
- **Issues** - Warning symbols for problem areas
- **Recommendations** - Blue lightbulbs with actionable advice

#### Overall Recommendations Tab
Enterprise-wide recommendations categorized by:
- **Priority** - High/Medium/Low
- **Category** - Data Standardization, Coordinate Quality, etc.
- **Recommendation** - Specific action to take
- **Benefit** - Expected improvement

## Standards & Formats

### Current API Formats
1. **FEU-G (CARS Program)** - XML format used by Iowa, Kansas, Nebraska, Indiana, Minnesota
2. **WZDx (Work Zone Data Exchange)** - JSON format used by Utah
3. **RSS XML** - Used by New Jersey
4. **Custom JSON** - Used by Nevada, Ohio

### Target Standards

#### WZDx (Recommended)
Work Zone Data Exchange is the emerging federal standard for work zone information. Benefits:
- Developed by USDOT
- Growing adoption nationwide
- Designed for interoperability
- Supports automated systems

#### SAE J2735 TIM
Traveler Information Message standard for connected vehicles:
- Part of V2X ecosystem
- Enables vehicle-to-infrastructure communication
- Real-time traffic alerts
- Integration with in-vehicle systems

## Cross-Jurisdictional Detection

Events are automatically flagged as requiring cross-state collaboration based on:

1. **Explicit mentions** - "state line", "border", "multi-state"
2. **Multiple states** - Descriptions mentioning different states
3. **Border proximity** - High severity events at extreme mileposts (≤10 or ≥400)
4. **Border locations** - Welcome centers, rest areas near state lines

Example: A major closure on I-80 at MM 5 in Nebraska would be flagged because it's near the Wyoming border.

## Integration Recommendations

### For State DOT Agencies

1. **Migrate to WZDx** - If not already using it, transition to WZDx format
2. **Improve coordinates** - Ensure all events include accurate GPS coordinates
3. **Enhance descriptions** - Provide detailed, human-readable event information
4. **Standardize times** - Use ISO 8601 format for all timestamps
5. **Specify lanes** - Include lane closure details in standardized format

### For Connected Vehicle Systems

Use the `/api/convert/tim` endpoint to:
- Broadcast TIM messages via DSRC/C-V2X
- Display VMS messages on highway signs
- Integrate with navigation systems
- Power mobile traveler information apps

### For Data Analytics

Use the `/api/analysis/normalization` endpoint to:
- Monitor data quality over time
- Track improvements after system upgrades
- Benchmark against other states
- Identify training needs for data entry staff

## Technical Details

### Weighted Scoring
Data completeness uses a weighted average to prioritize critical fields:
```
Completeness =
  Coordinates × 0.25 +
  Description × 0.20 +
  EventType × 0.15 +
  Corridor × 0.15 +
  Severity × 0.10 +
  StartTime × 0.10 +
  Direction × 0.05
```

### Color Coding
- **Green (#10b981)** - Grade A, strengths, good metrics
- **Blue (#3b82f6)** - Grade B, recommendations
- **Yellow (#f59e0b)** - Grade C, medium priority
- **Orange (#ef4444)** - Grade D, high priority
- **Red (#991b1b)** - Grade F, critical issues

## Future Enhancements

Potential additions to the analysis system:

1. **Trend Analysis** - Track data quality improvements over time
2. **Real-time Alerts** - Notify when data quality drops below threshold
3. **Automated Recommendations** - AI-powered suggestions for improvements
4. **Export Reports** - Generate PDF/Excel reports for stakeholders
5. **API Validation** - Automatic testing of state API endpoints
6. **Performance Metrics** - Response time and reliability tracking

## Support

For questions or issues with the data quality analysis features:
- Review the normalization report at `/api/analysis/normalization`
- Check the TIM conversion output at `/api/convert/tim`
- View the visual report at http://localhost:3000 → Data Quality Report

---

**Generated:** October 2025
**Version:** 1.0
**System:** DOT Corridor Communicator
