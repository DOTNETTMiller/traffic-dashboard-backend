# Adaptive Data Normalization System

## Overview

The DOT Corridor Communicator now includes an **adaptive normalization system** that automatically benefits from data quality improvements as states adopt better standards, without requiring code changes.

## The Problem

Previously, our normalization was hardcoded for each state's specific format:

```javascript
// Old approach - hardcoded for each state
if (stateName === 'Ohio') {
  normalized.eventType = item.category;          // Ohio-specific
  normalized.startTime = item.startDate;         // Ohio-specific
}
```

**Issues:**
- ❌ When Ohio improves and starts using WZDx standard `event_type` field, system still looks for old `category` field
- ❌ Requires code updates to take advantage of improvements
- ❌ No visibility into when states are improving
- ❌ Difficult to provide feedback to states

## The Solution

### 1. Priority-Based Field Recognition

The new **Adaptive Field Mapper** (`utils/adaptive-field-mapper.js`) uses prioritized field lookups:

```javascript
const FIELD_PRIORITY_MAP = {
  eventType: [
    'event_type',      // ✅ WZDx v4.x standard - PREFERRED
    'eventType',
    'type',
    'category',        // Legacy fallback
    'event_category'
  ]
};
```

**How it works:**
1. System tries `event_type` first (WZDx standard)
2. If not found, falls back to `eventType`, then `type`, etc.
3. **Automatically** uses better field names when states adopt them
4. No code changes needed!

### 2. Automatic Standards Detection

When a state improves their feed, the system automatically detects it:

```javascript
const { normalizeEvent } = require('./utils/adaptive-field-mapper');

// Works with ANY format
const normalized = normalizeEvent(rawEvent, {
  sourceId: 'Iowa DOT',
  logUnknownFields: true  // Logs when new fields appear
});
```

**Example improvement scenario:**

```
Before (Iowa using custom fields):
- eventCategory: "Construction"  ❌ Custom field
- beginDate: "2025-01-15"        ❌ Custom field

After (Iowa adopts WZDx):
- event_type: "work-zone"        ✅ WZDx standard
- start_date: "2025-01-15"       ✅ WZDx standard

System automatically:
- Uses new preferred fields
- Logs the improvement
- Maintains backward compatibility
```

### 3. Quality Monitoring

The **Data Quality Monitor** (`utils/data-quality-monitor.js`) tracks improvements over time:

```javascript
const monitor = require('./utils/data-quality-monitor');

// After processing state events
monitor.trackStateFieldUsage('Iowa', normalizedEvents);

// Automatically logs when improvements detected:
// "🎉 Iowa now using WZDx standard field for eventType!"
```

## Usage

### Basic Normalization

```javascript
const { normalizeEvent } = require('./utils/adaptive-field-mapper');

// Normalize any event format
const normalized = normalizeEvent(rawEventFromState, {
  sourceId: 'Florida DOT',
  stateName: 'Florida',
  defaultEventType: 'work-zone',
  logUnknownFields: true  // Enable improvement detection
});

// Returns standardized format:
{
  id: 'FL-abc123',
  state: 'Florida',
  eventType: 'work-zone',
  corridor: 'I-95',
  direction: 'northbound',
  startTime: '2025-01-15T08:00:00Z',
  severity: 'medium',
  // ... all standard fields
}
```

### Batch Processing with Monitoring

```javascript
const { normalizeEvent } = require('./utils/adaptive-field-mapper');
const monitor = require('./utils/data-quality-monitor');

function processStateFeed(stateName, rawEvents) {
  const normalized = [];

  rawEvents.forEach(rawEvent => {
    const event = normalizeEvent(rawEvent, {
      sourceId: stateName,
      stateName: stateName,
      logUnknownFields: true
    });

    if (event) {
      // Store raw event for quality tracking
      event._rawEvent = rawEvent;
      normalized.push(event);
    }
  });

  // Track quality and detect improvements
  monitor.trackStateFieldUsage(stateName, normalized);

  return normalized;
}
```

### Check Standards Compliance

```javascript
const monitor = require('./utils/data-quality-monitor');

// After processing feeds
if (monitor.isUsingWZDxStandards('Iowa')) {
  console.log('Iowa is using WZDx standards! ✅');
}

// Get recommendations for improvement
const recommendations = monitor.generateRecommendations('Nebraska');
// Returns:
// [
//   {
//     field: 'eventType',
//     preferredName: 'event_type',
//     action: 'Add "event_type" field to comply with WZDx v4.x'
//   }
// ]
```

### View Quality Trends

```javascript
const monitor = require('./utils/data-quality-monitor');

// Get 30-day trend for a state
const trend = monitor.getStateTrend('Wisconsin', 30);

// Returns:
// [
//   {
//     timestamp: '2025-01-01T...',
//     totalEvents: 364,
//     preferredFields: 2,  // Using 2 WZDx standard fields
//     totalFields: 15
//   },
//   {
//     timestamp: '2025-01-15T...',
//     totalEvents: 370,
//     preferredFields: 5,  // Improved! Now using 5 standard fields
//     totalFields: 18
//   }
// ]
```

## Benefits

### 1. Automatic Adaptation
- ✅ States improve feeds → System automatically uses better data
- ✅ No code deployments needed
- ✅ Backward compatible with legacy formats

### 2. Continuous Improvement Tracking
- ✅ Logs when states adopt standards
- ✅ Detects new fields automatically
- ✅ Tracks quality trends over time
- ✅ Alerts on regressions

### 3. Better Feedback Loop
- ✅ Generate reports showing which states are using standards
- ✅ Provide specific recommendations for improvement
- ✅ Show states the impact of their improvements

### 4. Future-Proof
- ✅ Easy to add new preferred field names
- ✅ Supports WZDx v5.x without code changes (just add to priority map)
- ✅ Detects and logs unknown fields for analysis

## Field Priority Reference

### Critical Fields

| Concept | Preferred (WZDx) | Alternatives | Normalization |
|---------|------------------|--------------|---------------|
| **Event Type** | `event_type` | `eventType`, `type`, `category` | Maps to work-zone, incident, etc. |
| **Start Time** | `start_date` | `startDate`, `start_time`, `startTime` | Converts to ISO 8601 |
| **Coordinates** | `geometry.coordinates` | `latitude`/`longitude`, `lat`/`lon` | [lon, lat] array |
| **Road** | `road_names` | `road_name`, `route`, `corridor` | Extracts highway ID |
| **Direction** | `direction` | `travel_direction`, `bearing` | Normalizes to northbound/etc. |
| **Lanes** | `vehicle_impact` | `lanes_closed`, `lanes_affected` | Standard impact format |

### Adding New Fields

When WZDx v5.x or new standards emerge, just update the priority map:

```javascript
// In adaptive-field-mapper.js

const FIELD_PRIORITY_MAP = {
  newField: [
    'new_wzdx_v5_name',     // Add newest standard first
    'old_wzdx_v4_name',     // Keep old for compatibility
    'legacy_name'           // Fallback for older feeds
  ]
};
```

System automatically prefers new standard names without affecting existing feeds.

## Quality Monitoring Reports

### Generate Full Report

```javascript
const monitor = require('./utils/data-quality-monitor');

// After processing all states
const report = monitor.generateQualityReport();

console.log(report);
// {
//   generatedAt: '2025-01-15T10:00:00Z',
//   summary: {
//     totalStates: 45,
//     statesUsingWZDxStandards: 12,
//     averageFieldCoverage: 85.3
//   },
//   states: [
//     {
//       state: 'Florida',
//       totalEvents: 304,
//       preferredFields: 7,
//       standardsCompliance: 'Good'
//     },
//     // ...
//   ]
// }
```

### Improvement Detection

The system automatically logs when improvements are detected:

```
✅ DATA QUALITY IMPROVEMENTS DETECTED:
   🎉 Wisconsin now using WZDx standard field for eventType!
   🎉 Wisconsin now using WZDx standard field for startTime!
   📈 Wisconsin added new field: vehicle_impact
   📈 Wisconsin added new field: road_event_status
```

### Regression Alerts

Also detects when quality decreases:

```
⚠️  DATA QUALITY REGRESSIONS:
   ⚠️  Ohio no longer providing: endDate
   ⚠️  Ohio no longer providing: severity
```

## Integration Example

Here's how to integrate this into existing feed processing:

```javascript
const { normalizeEvent, detectUnmappedFields } = require('./utils/adaptive-field-mapper');
const monitor = require('./utils/data-quality-monitor');

async function processWZDxFeed(feedUrl, stateName) {
  const response = await fetch(feedUrl);
  const data = await response.json();

  const normalized = [];

  data.features.forEach(feature => {
    // Detect any fields we're not recognizing
    const unmapped = detectUnmappedFields(feature.properties, stateName);

    // Normalize using priority-based mapping
    const event = normalizeEvent(feature.properties, {
      sourceId: stateName,
      stateName: stateName,
      logUnknownFields: true
    });

    if (event) {
      event._rawEvent = feature.properties;
      normalized.push(event);
    }
  });

  // Track quality and detect improvements
  monitor.trackStateFieldUsage(stateName, normalized);

  return normalized;
}
```

## Viewing Logs

Quality improvements are logged to `logs/data-quality-trends.jsonl`:

```bash
# View recent improvements
tail -100 logs/data-quality-trends.jsonl | grep "preferredFieldUsage"

# Count states using standards
cat logs/data-quality-trends.jsonl | jq -r 'select(.preferredFieldUsage | length > 3) | .state' | sort -u
```

## Next Steps

1. **Deploy adaptive mapper** - Replace hardcoded normalization with adaptive system
2. **Enable monitoring** - Turn on quality tracking for all feeds
3. **Generate baseline report** - Establish current state quality levels
4. **Share with states** - Provide feedback on standards adoption
5. **Monitor improvements** - Watch for states improving their feeds
6. **Automatic benefits** - System automatically uses improved data

## Summary

The adaptive normalization system ensures that **as states improve their data feeds and adopt standards, your system automatically benefits without any code changes**. It provides:

- 🎯 **Priority-based field recognition** - Prefers standard names
- 📊 **Quality monitoring** - Tracks improvements over time
- 🔍 **Unknown field detection** - Discovers new capabilities
- 📈 **Trend analysis** - See quality changes over time
- 🔄 **Backward compatible** - Still works with legacy formats
- 🚀 **Future-proof** - Ready for new standards

Your normalization strategy **does update in real-time** - not the rules themselves, but the system automatically adapts as states provide better data!
