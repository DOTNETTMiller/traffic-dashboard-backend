# Truck Parking Availability Prediction System

## Overview

The Corridor Communicator includes an intelligent prediction system for truck parking availability that combines:
- **Historical occupancy patterns** (time-of-day, day-of-week)
- **Real-time traffic events** (incidents, work zones, closures)
- **Machine learning feedback** (accuracy tracking and continuous improvement)

## How It Works

### 1. Baseline Time Patterns

The system learns from historical data to identify patterns:
- **Day of week**: Weekday vs weekend patterns
- **Hour of day**: Peak times (midnight-1am according to Jason's Law data)
- **Facility-specific**: Each rest area has unique patterns

Example: A rest area on I-80 might be 80% full on Friday nights but only 40% full on Tuesday afternoons.

### 2. Event Impact Modifiers

Traffic events increase parking demand as trucks seek alternative routes or waiting areas:

| Event Type | Distance | Impact |
|------------|----------|--------|
| Major incident/closure | < 10 miles | +30% demand |
| Moderate incident | < 10 miles | +15% demand |
| Minor incident | < 10 miles | +5% demand |
| Any incident | 10-25 miles | +10% demand |

**Logic**: Trucks diverted by an event will search for parking nearby, increasing occupancy rates.

### 3. Confidence Scoring

Predictions include confidence scores (0-100%):
- **High confidence (70-90%)**: Based on 50+ historical samples for this time slot
- **Medium confidence (50-70%)**: Based on 10-50 samples
- **Low confidence (30-50%)**: Baseline prediction with < 10 samples
- **Event penalty**: -20% confidence when nearby events affect prediction

### 4. Continuous Learning

As real TPIMS data becomes available:
1. Compare predictions to actual availability
2. Record accuracy metrics (percent error)
3. Update time-based patterns with new data
4. Improve future predictions

## Database Schema

### `parking_occupancy_patterns`
Stores historical averages by time:
```sql
facility_id TEXT
day_of_week INTEGER (0=Sunday, 6=Saturday)
hour_of_day INTEGER (0-23)
avg_occupancy_rate REAL (0.0-1.0)
sample_count INTEGER
```

### `parking_prediction_accuracy`
Tracks prediction performance:
```sql
facility_id TEXT
predicted_available INTEGER
actual_available INTEGER
prediction_error INTEGER
percent_error REAL
event_nearby BOOLEAN
timestamp DATETIME
```

## Usage

### Generate Predictions

```bash
node scripts/generate_parking_predictions.js
```

This script:
1. Updates occupancy patterns from last 30 days of data
2. Fetches current traffic events
3. Generates predictions for all facilities
4. Considers nearby events (within 50 miles)
5. Adds predictions to database

### Fetch Real Data & Validate

```bash
node scripts/fetch_tpims_data.js
```

This script:
1. Fetches real-time data from TPIMS feeds
2. Compares predictions to actual availability
3. Records accuracy metrics
4. Updates patterns with new data

### Check Prediction Accuracy

```javascript
const db = require('./database.js');

// Get accuracy stats for all facilities (last 7 days)
const stats = db.getPredictionAccuracyStats();

// Get accuracy for specific facility
const facilityStats = db.getPredictionAccuracyStats('iowa-123', 7);

// Example output:
// {
//   facilityId: 'iowa-grinnell-east',
//   totalPredictions: 48,
//   avgPercentError: 12.5,
//   accuracyRate: 87.5  // 87.5% within 20% error
// }
```

### Get Prediction for Specific Facility

```javascript
const db = require('./database.js');

// Get all nearby events
const events = [
  {
    headline: 'I-80 Closure',
    severity: 'Major',
    distance: 8.5,
    coordinates: [41.5, -93.2]
  }
];

// Generate prediction
const prediction = db.getPredictedAvailability(
  'iowa-grinnell-east',
  new Date(),  // Target time
  events       // Nearby events
);

// Example output:
// {
//   facilityId: 'iowa-grinnell-east',
//   totalSpaces: 25,
//   predictedAvailable: 8,
//   predictedOccupied: 17,
//   predictedOccupancyRate: 0.68,
//   confidence: 0.64,
//   hasPattern: true,
//   eventNearby: true,
//   timestamp: '2025-10-23T14:30:00Z'
// }
```

## Prediction Algorithm

```javascript
// Pseudocode
function predictAvailability(facilityId, time, events) {
  // 1. Get baseline from historical patterns
  const pattern = getPattern(facilityId, time.day, time.hour);
  let occupancyRate = pattern?.rate || 0.60;  // Default 60%
  let confidence = pattern ? calculateConfidence(pattern.samples) : 0.30;

  // 2. Apply event modifiers
  let eventModifier = 1.0;
  for (event of events) {
    if (event.distance < 10) {
      eventModifier *= (event.severity === 'major' ? 1.30 : 1.15);
    } else if (event.distance < 25) {
      eventModifier *= 1.10;
    }
  }

  // 3. Calculate final prediction
  occupancyRate = min(1.0, occupancyRate * eventModifier);
  available = totalSpaces * (1 - occupancyRate);

  // 4. Adjust confidence
  if (events.length > 0) {
    confidence *= 0.80;  // Less confident with events
  }

  return { available, confidence };
}
```

## Integration Points

### Backend API (Future)
```javascript
// Add to backend_proxy_server.js
app.get('/api/parking/predictions', (req, res) => {
  const facilities = db.getParkingFacilities();
  const events = getAllEvents();  // From existing feed aggregation

  const predictions = facilities.map(facility => {
    const nearbyEvents = findNearbyEvents(facility, events, 50);
    return db.getPredictedAvailability(
      facility.facilityId,
      new Date(),
      nearbyEvents
    );
  });

  res.json({ predictions });
});
```

### Scheduled Updates
```javascript
// Run every hour
setInterval(async () => {
  const { generatePredictions } = require('./scripts/generate_parking_predictions');
  await generatePredictions();
}, 60 * 60 * 1000);

// Run TPIMS fetch every 15 minutes
setInterval(async () => {
  const { fetchTPIMSFeed } = require('./scripts/fetch_tpims_data');
  // Fetch and validate...
}, 15 * 60 * 1000);
```

## Data Sources

### Current
- **Iowa ArcGIS**: 32 rest areas with static capacity data
- **Initial predictions**: Baseline 60% occupancy with 30% confidence

### Future Integration
- **TPIMS feeds**: Real-time availability from KY, MN, and other states
- **Iowa DOT TPIMS archive**: Historical data for pattern learning
- **More state APIs**: Expand to other states with ArcGIS services

## Performance Goals

Based on Jason's Law research and FHWA best practices:
- **Target accuracy**: 80% of predictions within 20% of actual
- **Confidence threshold**: Only show predictions with >50% confidence
- **Update frequency**: Generate new predictions every hour
- **Pattern refresh**: Recalculate patterns daily from last 30 days

## Example Workflow

### Day 1: Initial Deployment
1. Import Iowa rest areas (32 facilities)
2. Generate baseline predictions (60% occupancy, 30% confidence)
3. Display on map with "LOW CONFIDENCE" indicators

### Week 1: TPIMS Integration
1. Fetch real data from TRIMARC (KY) and MN DOT
2. Validate predictions against actual availability
3. Begin building accuracy metrics
4. Still using baseline patterns (not enough data yet)

### Week 2-4: Pattern Learning
1. Accumulate 3+ samples per time slot
2. Calculate time-based patterns (day/hour averages)
3. Confidence increases to 50-70% as patterns emerge
4. Accuracy improves to 60-70%

### Month 2+: Event-Aware Predictions
1. Rich historical patterns (50+ samples per slot)
2. Event impact modifiers improve accuracy during incidents
3. Confidence reaches 70-90% for normal conditions
4. Accuracy reaches 80%+ target

## Troubleshooting

### "No patterns updated"
- **Cause**: Need at least 3 samples per time slot
- **Solution**: Wait for more TPIMS data or import historical archives

### Low accuracy rates
- **Cause**: Baseline predictions without historical data
- **Solution**: Normal for first few weeks, will improve with data

### High error during events
- **Cause**: Event impact modifiers may need tuning
- **Solution**: Adjust multipliers in `getPredictedAvailability()` based on validation data

## Future Enhancements

1. **Weather data**: Integrate weather conditions (storms increase demand)
2. **Holiday patterns**: Special handling for holidays and peak travel
3. **Truck volumes**: Use traffic count data to predict demand
4. **Route analysis**: Predict based on freight corridor activity
5. **Machine learning**: Neural network for complex pattern recognition
6. **Predictive horizon**: Multi-hour forecasts (next 4 hours)
