# IPAWS Intelligent Geofence Recommendations

## Overview

The IPAWS system now includes **intelligent geofence recommendations** that automatically suggest optimal buffer distances based on event type, severity, and impact. This ensures alerts reach the right people at the right distance for each situation.

## How It Works

When generating an IPAWS alert, the system:

1. **Analyzes the event** (type, severity, lanes affected)
2. **Recommends a buffer distance** based on best practices
3. **Adjusts dynamically** for severity and impact
4. **Explains the reasoning** to the operator

## Recommended Buffer Distances by Event Type

### Construction Events
- **Recommended Buffer**: 2.0 miles
- **Reasoning**: Construction affects larger areas and traffic patterns
- **Use Case**: Planned roadwork, lane closures, work zones
- **Why Larger**: Drivers need advance notice to plan alternate routes

### Incidents & Crashes
- **Recommended Buffer**: 0.75 miles
- **Reasoning**: Immediate localized impact requiring quick notification
- **Use Case**: Accidents, stalled vehicles, minor incidents
- **Why Smaller**: Focus on immediate area; real-time events

### Road Closures
- **Recommended Buffer**: 1.5 miles
- **Reasoning**: Full closures require detour planning
- **Use Case**: Complete road/lane closures
- **Why Moderate**: Balance between immediate area and detour routes

### Weather Events
- **Recommended Buffer**: 3.0 miles
- **Reasoning**: Weather affects larger geographic areas
- **Use Case**: Ice, flooding, reduced visibility
- **Why Largest**: Weather impacts span wide areas

### Hazmat Incidents
- **Recommended Buffer**: 2.5 miles
- **Reasoning**: Safety perimeter and potential evacuation needs
- **Use Case**: Chemical spills, dangerous cargo incidents
- **Why Large**: Safety critical - wider notification for potential evacuation

### Lane Restrictions
- **Recommended Buffer**: 1.0 miles
- **Reasoning**: Moderate traffic flow impact
- **Use Case**: Temporary lane restrictions, shoulder closures
- **Why Standard**: Affects traffic flow but not complete closure

### Maintenance
- **Recommended Buffer**: 1.25 miles
- **Reasoning**: Planned maintenance with moderate traffic impact
- **Use Case**: Scheduled maintenance, inspections
- **Why Moderate**: Planned events with predictable impact

### Bridge Closures
- **Recommended Buffer**: 2.0 miles
- **Reasoning**: Bridge closures require significant detours
- **Use Case**: Bridge work, structural issues
- **Why Large**: Major infrastructure requiring long detours

## Dynamic Adjustments

The system **automatically adjusts** recommendations based on:

### Severity Multipliers
- **High Severity**: +30% buffer distance
- **Medium Severity**: No adjustment (base recommendation)
- **Low Severity**: -20% buffer distance

**Example**: Construction event (base 2.0 mi) at high severity → 2.6 miles

### Lane Impact Adjustments
- **3+ Lanes Affected**: +20% buffer distance
- **2 Lanes Affected**: No adjustment
- **1 Lane Affected**: -10% buffer distance

**Example**: Incident (base 0.75 mi) affecting 3 lanes → 0.9 miles

### Combined Adjustments
Severity and lane impact adjustments **compound**:

**Example**: High-severity construction affecting 3 lanes
- Base: 2.0 miles (construction)
- × 1.3 (high severity) = 2.6 miles
- × 1.2 (3+ lanes) = 3.12 miles
- Rounded to nearest 0.25 mi = **3.0 miles**

## Visual Examples

### Example 1: Construction on I-80
```
Event Type: Construction
Severity: Medium
Lanes Affected: 2

Base Recommendation: 2.0 miles (construction)
Severity Adjustment: None (medium)
Lanes Adjustment: None (2 lanes)
Final Buffer: 2.0 miles

Reasoning: "Construction affects larger area and traffic patterns"
Lead Time: "Typically known in advance - wider notification area"
```

### Example 2: High-Severity Crash
```
Event Type: Incident (crash)
Severity: High
Lanes Affected: 4 (all lanes)

Base Recommendation: 0.75 miles (incident)
Severity Adjustment: +30% → 0.975 miles
Lanes Adjustment: +20% → 1.17 miles
Final Buffer: 1.25 miles (rounded)

Reasoning: "Immediate localized impact, drivers need quick notification"
Impact: Adjusted for high severity + major lane blockage
```

### Example 3: Weather Event
```
Event Type: Weather
Severity: High
Lanes Affected: All

Base Recommendation: 3.0 miles (weather)
Severity Adjustment: +30% → 3.9 miles
Lanes Adjustment: +20% → 4.68 miles
Final Buffer: 4.75 miles (rounded)

Reasoning: "Weather affects larger geographic area"
Lead Time: "Broad impact requires wider notification"
```

### Example 4: Minor Lane Restriction
```
Event Type: Restriction
Severity: Low
Lanes Affected: 1

Base Recommendation: 1.0 miles (restriction)
Severity Adjustment: -20% → 0.8 miles
Lanes Adjustment: -10% → 0.72 miles
Final Buffer: 0.75 miles (rounded)

Reasoning: "Lane restrictions affect traffic flow"
Impact: Reduced for low severity + single lane
```

## User Experience

### In Manual Alert Generation
When generating an alert manually, operators see:

1. **Recommendation Banner** at top of Geofence tab:
   ```
   💡 Intelligent Geofence Recommendation
   Based on event type "construction": 2.0 mile buffer

   Construction affects larger area and traffic patterns

   ℹ️ Adjusted for high severity
   ℹ️ Adjusted for 3 lane(s) affected
   ```

2. **Buffer Distance** displayed in area card:
   ```
   Area (2.00 mi buffer)
   45.2 mi²
   ```

3. **Reasoning** in geofence details:
   ```
   • 2.00-mile buffer on corridor centerline (intelligent recommendation)
   • Population masking applied (LandScan data)
   • Typically known in advance - wider notification area
   ```

### In Rules Configuration
When configuring automated rules, operators see:

1. **Real-time Recommendations** as they add event types:
   ```
   💡 Recommended Buffers

   construction: 2.0 mi (affects larger area)
   incident: 0.75 mi (immediate localized impact)

   Multiple event types selected - choose buffer based on primary use case
   ```

2. **Quick Apply Button** (single event type):
   ```
   Buffer Distance (miles): [2.0]

   💡 Recommended Buffers     [Apply]
   construction: 2.0 mi (affects larger area)
   ```

## Override Capabilities

### Operators Can Always Override
The recommendations are **suggestions**, not requirements. Operators can:

1. **Set custom buffer** in manual alert generation
2. **Configure specific buffer** in rules (overrides recommendation)
3. **Adjust based on local knowledge** (e.g., geography, traffic patterns)

### When to Override

**Increase Buffer When:**
- Event is near major population center (more people need notice)
- Limited alternate routes available (wider detour needed)
- Event duration is very long (>8 hours)
- High tourist/commercial traffic area

**Decrease Buffer When:**
- Very rural area with low traffic
- Multiple alternate routes available
- Short-duration event (<2 hours)
- Event impact is highly localized

## Integration with Population Filtering

Recommendations work **together** with population filtering:

1. System recommends buffer (e.g., 2.0 miles for construction)
2. Generates geofence with that buffer
3. Calculates population within geofence
4. If population > threshold (e.g., 5,000):
   - Suggests reducing buffer
   - Enables urban area exclusion
   - Provides population impact estimates

**Example Flow**:
```
Event: I-80 Construction near Des Moines
Recommended Buffer: 2.0 miles
Initial Population: 12,000 (exceeds 5,000 threshold)

System suggests:
• Reduce buffer to 1.25 miles → Est. population: 4,800 ✓
• OR enable "Exclude Urban Areas" → Est. population: 3,200 ✓
```

## Best Practices

### For TMC Operators

1. **Trust the recommendation** for typical events
2. **Review reasoning** to understand the logic
3. **Consider local factors** (geography, traffic patterns)
4. **Override when needed** based on expertise
5. **Monitor population** - reduce buffer if too high

### For Rule Configuration

1. **Match event types** to actual event descriptions
2. **Use recommended buffers** as starting point
3. **Test rules** with sample events
4. **Adjust based on feedback** from field operations
5. **Enable population filtering** to auto-constrain alerts

### For System Administrators

1. **Review recommendations** periodically
2. **Update based on outcomes** (were alerts effective?)
3. **Gather operator feedback** on buffer appropriateness
4. **Adjust for regional differences** if needed
5. **Document local overrides** for consistency

## Technical Implementation

### Backend Logic
Located in: `services/ipaws-alert-service.js`

```javascript
// Get recommendation
const recommendation = getGeofenceRecommendation(event);

// Apply to geofence generation
const geofence = generateGeofence(event, customBuffer || recommendation.adjustedBufferMiles);
```

### Data Structure
```javascript
{
  recommended: {
    bufferMiles: 2.0,
    reason: "Construction affects larger area",
    priority: "standard",
    leadTime: "Typically known in advance"
  },
  adjustedBufferMiles: 2.6,  // After severity/lanes adjustments
  originalBufferMiles: 2.0,   // Base recommendation
  adjustments: {
    severityAdjusted: true,
    lanesAdjusted: true,
    finalBuffer: 2.6
  },
  eventType: "construction"
}
```

## Maintenance & Updates

### Adding New Event Types
To add recommendations for new event types, update `services/ipaws-alert-service.js`:

```javascript
this.geofenceRecommendations = {
  // ... existing types ...

  'new_event_type': {
    bufferMiles: 1.5,
    reason: 'Brief description of why',
    priority: 'standard|high|immediate',
    leadTime: 'Context about timing'
  }
};
```

### Adjusting Existing Recommendations
Based on operational feedback, update the values:

```javascript
construction: {
  bufferMiles: 2.5,  // Changed from 2.0 based on feedback
  reason: 'Updated reasoning',
  // ...
}
```

## Future Enhancements

Potential improvements to the recommendation system:

- [ ] **Machine learning** based on historical alert effectiveness
- [ ] **Geographic-specific** recommendations (urban vs rural)
- [ ] **Time-of-day** adjustments (rush hour vs overnight)
- [ ] **Traffic volume** integration (AADT-based buffers)
- [ ] **Weather-aware** adjustments (conditions affecting visibility)
- [ ] **Route-specific** tuning (interstate vs secondary roads)

## Summary

The intelligent geofence recommendation system:

✅ **Automates** buffer distance selection based on event characteristics
✅ **Adjusts dynamically** for severity and impact
✅ **Explains reasoning** to operators
✅ **Integrates seamlessly** with manual and automated workflows
✅ **Remains flexible** - operators can always override
✅ **Improves consistency** across different operators and shifts
✅ **Optimizes reach** - right distance for each event type

The system makes IPAWS alerts more effective by ensuring the geofence matches the event's actual impact area and urgency.
