# IPAWS Quick Reference Card

## Recommended Buffer Distances by Event Type

| Event Type | Buffer | Why |
|------------|--------|-----|
| 🚧 **Construction** | 2.0 mi | Affects larger area, drivers need advance notice |
| ⚠️ **Incident/Crash** | 0.75 mi | Immediate localized impact |
| 🚫 **Road Closure** | 1.5 mi | Full closure requires detour planning |
| 🌧️ **Weather** | 3.0 mi | Weather affects broad geographic area |
| ☢️ **Hazmat** | 2.5 mi | Safety perimeter and evacuation potential |
| ⛔ **Restriction** | 1.0 mi | Moderate traffic flow impact |
| 🔧 **Maintenance** | 1.25 mi | Planned work with moderate impact |
| 🌉 **Bridge Closure** | 2.0 mi | Requires significant detours |

## Quick Adjustments

### Severity Multipliers
- 🔴 **High**: +30% (Example: 1.0 mi → 1.3 mi)
- 🟡 **Medium**: No change (base recommendation)
- 🟢 **Low**: -20% (Example: 1.0 mi → 0.8 mi)

### Lane Impact
- **3+ lanes blocked**: +20%
- **2 lanes blocked**: No change
- **1 lane blocked**: -10%

## Examples

### I-80 Construction (High Severity, 3 Lanes)
```
Base:     2.0 mi  (construction)
×         1.3     (high severity)
×         1.2     (3+ lanes)
= 3.12 mi → rounds to 3.0 miles
```

### Minor Incident (Low Severity, 1 Lane)
```
Base:     0.75 mi (incident)
×         0.8     (low severity)
×         0.9     (1 lane)
= 0.54 mi → rounds to 0.5 miles
```

### Hazmat Spill (High Severity)
```
Base:     2.5 mi  (hazmat)
×         1.3     (high severity)
= 3.25 mi → rounds to 3.25 miles
```

## Qualification Quick Check

### Does Event Qualify?
✅ **YES** if any of these:
- Tier 1 route (Interstate, US highway, major state route) **AND**
  - Closure ≥4 hours, **OR**
  - Imminent danger (hazmat, wrong-way, fire, bridge collapse)

❌ **NO** if:
- Not a Tier 1 route
- Closure <4 hours and no imminent danger

## Population Limits

- **Maximum**: 5,000 people in geofence
- **If exceeded**:
  - Reduce buffer distance, OR
  - Enable "Exclude Urban Areas"

## When to Override Recommendations

### Increase Buffer For:
- Near major population centers
- Limited alternate routes
- Very long duration (>8 hours)
- Tourist/commercial areas

### Decrease Buffer For:
- Very rural area
- Multiple alternate routes
- Short duration (<2 hours)
- Highly localized impact

## Manual Alert Workflow

1. Click **"🚨 Generate IPAWS Alert"** on event
2. Check **Qualification** tab (does it qualify?)
3. Review **Geofence** tab (see recommendation + reasoning)
4. Preview **Messages** tab (English + Spanish)
5. Review **CAP-XML** tab
6. Submit for approval

## Automated Rules Workflow

1. Go to **Admin → IPAWS Rules**
2. Click **"➕ Add Rule"**
3. Set **Trigger Conditions**:
   - Corridors (e.g., "I-80")
   - Event Types (e.g., "construction")
   - Severity, Lanes Affected
4. Configure **Geofence**:
   - See recommendations for your event types
   - Click "Apply" or set custom buffer
5. Set **Population Filtering**:
   - Max population (default: 5,000)
   - Exclude urban areas (recommended for rural focus)
6. Choose **Approval Setting**:
   - Manual (supervisor reviews)
   - Auto-send (trusted rules only)
7. Save and enable

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Event doesn't qualify | Check: Tier 1 route? Duration ≥4h or imminent danger? |
| Population too high | Reduce buffer OR enable "Exclude Urban Areas" |
| Rule not triggering | Verify corridor names match exactly (case-insensitive) |
| Wrong buffer shown | Check event type spelling and severity level |

## Common Event Type Keywords

The system looks for these keywords in event types and descriptions:

- **Construction**: construction, work zone, roadwork
- **Incident**: incident, crash, accident, collision
- **Closure**: closure, closed, road closure
- **Weather**: weather, ice, snow, flooding, wind
- **Hazmat**: hazmat, chemical, spill, dangerous
- **Restriction**: restriction, lane restriction, reduced lanes

## Support

- 📖 **Full Documentation**: `docs/IPAWS_SYSTEM.md`
- 🎯 **Geofence Guide**: `docs/IPAWS_GEOFENCE_RECOMMENDATIONS.md`
- 🗺️ **Setup Instructions**: `IPAWS_IMPLEMENTATION_SUMMARY.md`

---

**Print this card** and keep it at your TMC workstation for quick reference!
