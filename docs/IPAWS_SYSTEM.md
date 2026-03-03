# IPAWS Alert System

## Overview

The Integrated Public Alert and Warning System (IPAWS) integration enables TMC operators to generate and send Wireless Emergency Alerts (WEA) for qualifying transportation events.

### Key Innovation: Intelligent Geofence Recommendations 🆕
The system automatically recommends optimal buffer distances based on:
- **Event Type**: Construction (2 mi), Incidents (0.75 mi), Weather (3 mi), etc.
- **Severity**: High severity increases buffer by 30%
- **Lane Impact**: Major blockages increase buffer by 20%

See [IPAWS Geofence Recommendations](IPAWS_GEOFENCE_RECOMMENDATIONS.md) for complete details.

## Features

### 1. Manual Alert Generation
- Click "Generate IPAWS Alert" button on any event card
- Automatic qualification evaluation based on Iowa DOT policy
- Multi-step review process:
  - **Qualification**: Shows whether event qualifies and why
  - **Geofence**: Displays alert area with population estimates
  - **Messages**: Previews English and Spanish alert text
  - **CAP-XML**: Shows the formatted Common Alerting Protocol message

### 2. Automated Rules-Based Alerts
Configure automated alert rules that trigger when events meet specific conditions.

#### Rule Components

**Trigger Conditions:**
- **Corridors**: Which routes trigger the alert (e.g., I-80, US-30)
- **Event Types**: Types of events (construction, incident, closure)
- **Severity**: Event severity levels (high, medium, low)
- **Lanes Affected**: Minimum/maximum lane impact (e.g., reduced to 1 lane)

**Geofence Configuration:**
- **Auto-generate**: Creates buffer around event geometry
  - Customizable buffer distance (default: 1 mile)
  - Follows corridor centerline
- **Custom Polygon**: Upload specific geographic boundaries
  - Useful for recurring work zones
  - Precise targeting for known problem areas

**Population Filtering:**
- **Maximum Population**: Cap on affected population (default: 5,000)
- **Exclude Urban Areas**: Focus alerts on non-populated/rural regions
- **Population Density**: Filter based on minimum density thresholds

**Approval Settings:**
- **Manual Approval**: Requires supervisor review before sending
- **Auto-Send**: Automatically transmits alerts (for trusted rules)

## Qualification Criteria

Events qualify for IPAWS alerts if they meet **any** of the following:

1. **Duration-Based**: Closure duration ≥ 4 hours on Tier 1 route
2. **Danger-Based**: Presents imminent danger:
   - Hazmat incidents
   - Wrong-way drivers
   - Fire/explosion
   - Bridge collapse or infrastructure failure
   - Evacuation orders

### Tier 1 Routes (IPAWS-Eligible)
- Interstate highways (I-80, I-35, I-380, I-680)
- US highways (US-30, US-65, US-20, etc.)
- Major state routes (IA-28, etc.)

## Usage

### Setting Up Automated Rules

1. Navigate to IPAWS Rules Configuration (from admin menu)
2. Click "Add Rule"
3. Configure trigger conditions:
   ```
   Example: "I-80 Lane Reduction Alert"
   - Corridors: I-80
   - Min Lanes Affected: 1
   - Geofence: Auto-generate, 1.5 mile buffer
   - Max Population: 3,000
   - Exclude Urban Areas: Yes
   - Auto-approve: Yes
   ```
4. Save and enable the rule

### Manually Generating Alerts

1. Find event in event table/cards
2. Click "🚨 Generate IPAWS Alert"
3. Review qualification status
4. Check geofence and population
5. Preview alert messages
6. Submit for approval or send directly (if authorized)

## Examples

### Example 1: Rural Interstate Lane Closure
**Scenario**: I-80 reduced to one lane for overnight road work in rural area

**Rule Configuration**:
```json
{
  "name": "I-80 Rural Lane Reduction",
  "conditions": {
    "corridors": ["I-80"],
    "minLanesAffected": 1
  },
  "geofenceConfig": {
    "type": "auto",
    "bufferMiles": 1.5
  },
  "populationConfig": {
    "maxPopulation": 3000,
    "excludeUrbanAreas": true
  },
  "requiresApproval": false
}
```

**Result**: Automatically sends WEA to devices within 1.5 miles of work zone in non-urban areas

### Example 2: High-Severity Incident
**Scenario**: Multi-vehicle crash with hazmat on US-30

**Manual Process**:
1. Event detected: severity=high, eventType=hazmat incident
2. Operator clicks "Generate IPAWS Alert"
3. System shows: "✅ Qualifies - Imminent Danger (IMMEDIATE priority)"
4. Geofence auto-generated: 2-mile buffer
5. Alert sent in English + Spanish
6. Estimated reach: ~4,200 people

## Database Setup

Run the migration to create the rules table:

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL -f migrations/add_ipaws_rules_table.sql
```

This creates:
- `ipaws_rules` - Stores rule configurations
- `ipaws_alert_history` - Tracks sent alerts
- Example rules for common scenarios

## API Endpoints

### Rules Management
- `GET /api/ipaws/rules` - List all rules
- `POST /api/ipaws/rules` - Create new rule
- `PUT /api/ipaws/rules/:id` - Update rule
- `DELETE /api/ipaws/rules/:id` - Delete rule

### Alert Generation
- `POST /api/ipaws/generate` - Generate alert for event
- `POST /api/ipaws/evaluate` - Check if event qualifies
- `POST /api/ipaws/evaluate-rules` - Evaluate event against all rules
- `GET /api/ipaws/summary/:eventId` - Get alert summary

## Policy Compliance

The system implements Iowa DOT IPAWS Transportation Alert Policy:
- ✅ Tier 1 route validation
- ✅ Duration thresholds (≥4 hours)
- ✅ Imminent danger evaluation
- ✅ 1-mile buffer geofences
- ✅ Population masking (<5,000)
- ✅ Multilingual support (English/Spanish)
- ✅ Supervisor approval workflow
- ✅ CAP-XML message formatting

## Advanced Features

### Population Density Filtering
For rules targeting non-populated areas, the system:
1. Calculates population within geofence
2. If exceeds threshold, recommends buffer reduction
3. Optionally excludes urban boundaries (when census data available)
4. Provides population impact estimates

### Custom Geofences
For recurring work zones or known problem corridors:
1. Draw custom polygon on map (coming soon)
2. Save with rule for reuse
3. System uses custom boundary instead of auto-buffer
4. Useful for complex interchange projects

### Multi-State Coordination
When events are near state borders:
1. System detects border proximity
2. Flags for cross-state coordination
3. Can configure rules to notify adjacent DOTs
4. Supports multi-state geofence coverage

## Troubleshooting

**Event doesn't qualify:**
- Check if route is Tier 1 (Interstate, NHS, major state highway)
- Verify duration ≥4 hours or imminent danger type
- Review event metadata (severity, eventType, lanesAffected)

**Population exceeds threshold:**
- Reduce geofence buffer distance
- Enable "Exclude Urban Areas" filter
- Use custom polygon to target specific area

**Alert not auto-generating:**
- Verify rule is enabled
- Check condition matching (exact corridor names)
- Review event data structure (missing fields)

## Future Enhancements

- [ ] LandScan population data integration
- [ ] OpenStreetMap urban boundary filtering
- [ ] Visual geofence editor
- [ ] Real-time alert status dashboard
- [ ] SMS/email notifications for sent alerts
- [ ] Analytics dashboard (alerts sent, reach estimates)
- [ ] Integration with FEMA IPAWS-OPEN platform
