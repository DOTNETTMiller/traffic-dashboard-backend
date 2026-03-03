# IPAWS Population-Aware Targeting

## Overview

The IPAWS system now includes **intelligent population analysis** to ensure alerts reach people in affected areas while **avoiding annoying locals in populated areas**. This uses GIS-based population density data to target rural/highway users instead of city residents.

## Key Concept: Focus on Highway Users, Not City Residents

### The Problem
Traditional buffer-based alerts can include large populations in nearby cities who aren't actually affected by highway incidents:

**Example**: I-80 incident 5 miles outside Des Moines
- **1-mile buffer**: Includes ~2,000 rural residents ✅ Good
- **Extends into city**: Includes ~50,000 urban residents ❌ Unnecessary

### The Solution
**Population-Aware Geofencing**:
1. Generate buffer around event
2. Calculate population within buffer
3. Identify urban areas (cities/towns)
4. **Exclude urban populations** that aren't actually using the highway
5. Alert only rural residents and highway corridor users

## How It Works

### Step 1: Population Analysis
When generating an IPAWS alert, the system automatically:

```
Event: I-80 Construction near Des Moines
Buffer: 2.0 miles (construction recommendation)

Population Analysis:
├─ Total Area: 12.5 sq mi
├─ Total Population: 8,245 people
│
├─ 🌾 Rural: 1,850 people
│   └─ Highway corridor residents
│   └─ Farmland near route
│
└─ 🏙️ Urban: 6,395 people
    └─ West Des Moines (eastern edge)
    └─ Clive (northern fringe)
```

### Step 2: Smart Exclusion
System identifies that urban population can be excluded:

```
⚠️ Population 8,245 exceeds 5,000 threshold

Recommendation:
🌾 Exclude Urban Areas (6,395 people)

After Exclusion:
✅ Rural Population: 1,850 people
✅ Within 5,000 threshold
✅ Targets actual highway users
```

### Step 3: One-Click Application
Operator clicks **"Exclude Urban Areas"** button:
- Urban areas automatically removed from geofence
- Population drops to rural-only
- Alert targets people actually affected

## Visual Interface

### Population Impact Panel

When you generate an alert, you see:

```
┌─────────────────────────────────────────┐
│ 👥 Population Impact Analysis           │
├─────────────────────────────────────────┤
│ 🌾 Rural        🏙️ Urban                │
│ 1,850           6,395                    │
├─────────────────────────────────────────┤
│ Affected Cities: West Des Moines, Clive │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ⚠️ Policy Compliance                     │
│ Population 8,245 is above 5,000         │
│ threshold. Adjustment recommended.      │
│                                         │
│ [🌾 Exclude Urban Areas (6,395 people)] │
└─────────────────────────────────────────┘
```

### After Exclusion

```
┌─────────────────────────────────────────┐
│ ✅ Excluded: West Des Moines, Clive     │
│                                         │
│ New Population: 1,850                   │
│ Reduction: 78%                          │
│                                         │
│ Alert will reach:                       │
│ • Rural corridor residents              │
│ • Travelers on I-80                     │
│ • Farmland near construction            │
└─────────────────────────────────────────┘
```

## Population Data Sources

### Current Implementation
Uses **estimated population density** based on:
- Known Iowa city locations and populations
- Distance-based density calculations
- Proximity to population centers

### Iowa Population Centers Included
- Des Moines (215,000)
- Cedar Rapids (133,000)
- Davenport (102,000)
- Sioux City (85,000)
- Iowa City (75,000)
- Waterloo (68,000)
- And 6 more major cities

### Future Enhancements
Can integrate with:
- **LandScan** - Oak Ridge National Lab population data
- **US Census Bureau** - Official census tract data
- **OpenStreetMap** - Urban boundary polygons
- **State GIS** - Iowa-specific land use data

## Real-World Examples

### Example 1: Rural Interstate Construction
```
Event: I-80 construction, 20 miles west of Des Moines
Type: Construction
Buffer: 2.0 mi

Population:
├─ Rural: 850 people      ✅ Alert these
└─ Urban: 0 people        (No cities nearby)

Result: Alert 850 rural residents
Annoyance Factor: ZERO (only affected people notified)
```

### Example 2: Incident Near City
```
Event: I-80 crash, 3 miles from Cedar Rapids
Type: Incident
Buffer: 0.75 mi (incident recommendation)

Population:
├─ Rural: 425 people      ✅ Alert these
└─ Urban: 3,200 people    ❌ Exclude (city fringe)

Action: Exclude urban areas
Result: Alert 425 rural/highway users
Avoided: 3,200 unnecessary city notifications
```

### Example 3: Hazmat Near Multiple Cities
```
Event: Hazmat spill on I-80 between Des Moines & Ankeny
Type: Hazmat
Buffer: 2.5 mi (hazmat recommendation)

Population:
├─ Rural: 1,100 people         ✅ Alert these
└─ Urban: 12,500 people        ❌ Exclude
    ├─ Ankeny: 8,200
    └─ Des Moines suburbs: 4,300

Action: Exclude Ankeny and Des Moines suburbs
Result: Alert 1,100 corridor residents
Avoided: 12,500 people not affected by hazmat
```

### Example 4: Weather Event (Wide Area)
```
Event: Ice storm affecting I-35 corridor
Type: Weather
Buffer: 3.0 mi (weather recommendation)

Population:
├─ Rural: 4,200 people      ✅ Alert these
└─ Urban: 8,900 people      ⚠️ Evaluate

Decision: Keep urban (widespread weather affects cities too)
Result: Alert all 13,100 people
Reasoning: Weather impacts city travelers using I-35
```

## Population Density Classification

The system classifies areas automatically:

| Classification | Density (per sq mi) | Typical Area | Alert Strategy |
|---------------|---------------------|--------------|----------------|
| **Rural** | 0-500 | Farmland, small towns | ✅ Always include |
| **Suburban** | 500-2,000 | Suburbs, medium towns | ⚠️ Consider excluding |
| **Urban** | 2,000-5,000 | Cities | ❌ Usually exclude |
| **Dense Urban** | 5,000+ | City centers | ❌ Always exclude |

## Affected Cities Analysis

When geofence overlaps cities, you see:

```
Affected Cities:
├─ Ankeny
│   ├─ Population in geofence: 2,450
│   ├─ Overlap: 15% of geofence area
│   └─ Recommendation: Exclude
│
└─ Altoona
    ├─ Population in geofence: 890
    ├─ Overlap: 8% of geofence area
    └─ Recommendation: Exclude
```

## API Endpoints

### Population Estimation
```bash
POST /api/population/estimate
Body: {
  "geofence": { ... },
  "excludeUrban": true/false
}

Response: {
  "total": 1850,
  "urban": 6395,
  "rural": 1850,
  "density": 148,
  "classification": "rural",
  "affectedCities": [...]
}
```

### Urban Exclusion
```bash
POST /api/population/exclude-urban
Body: {
  "geofence": { ... },
  "maxPopulation": 5000
}

Response: {
  "geofence": { ... },  // Modified geofence
  "excluded": ["Des Moines", "Clive"],
  "population": {
    "total": 1850,
    "urban": 0,
    "rural": 1850
  },
  "reductionPercent": 78
}
```

### Adjustment Suggestions
```bash
POST /api/population/suggest-adjustment
Body: {
  "event": { ... },
  "geofence": { ... },
  "targetPopulation": 5000
}

Response: {
  "needsAdjustment": true,
  "method": "exclude_urban",
  "currentPopulation": 8245,
  "adjustedPopulation": 1850,
  "excluded": ["West Des Moines", "Clive"],
  "message": "Excluded cities to reduce population by 78%"
}
```

## Best Practices

### When to Exclude Urban Areas

**DO Exclude** for:
- ✅ Construction on rural interstates
- ✅ Incidents far from cities
- ✅ Maintenance in highway corridors
- ✅ Events affecting only through-traffic

**DON'T Exclude** for:
- ❌ Weather events (affect wide areas)
- ❌ Urban interchange closures
- ❌ Hazmat near residential areas
- ❌ Evacuation scenarios

### Guidelines by Event Type

| Event Type | Typical Strategy |
|-----------|------------------|
| Construction | Exclude urban (focus on corridor users) |
| Incident/Crash | Exclude urban (localized impact) |
| Weather | Keep urban (widespread impact) |
| Hazmat | Evaluate case-by-case |
| Closure | Exclude if rural highway |
| Bridge Work | Exclude unless urban bridge |

## Workflow

### TMC Operator Workflow:

1. **Click event** on map → IPAWS modal opens
2. **Review Geofence tab**:
   - See total population
   - See rural vs urban breakdown
   - See affected cities list
3. **If population > 5,000**:
   - System shows warning
   - Button appears: "Exclude Urban Areas"
4. **Click "Exclude Urban Areas"**:
   - Urban populations removed
   - New population shown
   - List of excluded cities displayed
5. **Verify acceptable**:
   - Check new population < 5,000
   - Confirm alert targets right people
6. **Submit alert**

### Automated Rules Workflow:

Configure rules with population settings:
```javascript
{
  "name": "I-80 Rural Lane Closures",
  "conditions": {
    "corridors": ["I-80"],
    "minLanesAffected": 1
  },
  "populationConfig": {
    "maxPopulation": 3000,
    "excludeUrbanAreas": true  // ← Automatic exclusion
  }
}
```

## Technical Implementation

### Population Calculation Algorithm

```javascript
1. Generate geofence buffer around event
2. For each Iowa city:
   a. Calculate distance to geofence center
   b. Check if city boundary overlaps geofence
   c. If overlap:
      - Calculate intersection area
      - Estimate population in overlap
      - Add to urban population
3. Calculate rural population:
   - Use baseline density (50 people/sq mi)
   - Adjust for proximity to cities
   - Apply to non-urban area
4. Return breakdown:
   - Total = urban + rural
   - Classification
   - Affected cities list
```

### Exclusion Algorithm

```javascript
1. Get urban areas overlapping geofence
2. Sort by population (largest first)
3. While population > threshold:
   a. Take next urban area
   b. Subtract from geofence (boolean geometry)
   c. Recalculate population
   d. If now under threshold, stop
4. Return modified geofence + excluded cities
```

## Benefits

### For Highway Users
✅ Get alerts for relevant highway incidents
✅ Timely notification about closures/hazards
✅ Clear focus on corridor impact

### For City Residents
✅ Don't get annoying alerts for distant highway issues
✅ Only notified if actually affected
✅ Reduces alert fatigue

### For TMC Operators
✅ Confidence alerts reach right people
✅ Automatic population calculation
✅ One-click urban exclusion
✅ Clear before/after metrics

### For Policy Compliance
✅ Stay under 5,000 population threshold
✅ Documented exclusion reasoning
✅ Audit trail of adjustments
✅ Meets FCC requirements

## Summary

The population-aware IPAWS system ensures you **alert the people who need to know** (highway corridor users, rural residents) while **avoiding annoying people who don't** (city residents far from the event).

**Key Features**:
- 🎯 Automatic population analysis
- 🌾 Rural vs urban breakdown
- 🏙️ Affected cities identification
- 🔘 One-click urban exclusion
- 📊 Real-time population impact
- ✅ Policy compliance verification

**Result**: More effective alerts, less annoyance, better compliance.
