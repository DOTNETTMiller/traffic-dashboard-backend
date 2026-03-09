# CCAI-Aligned Severity Classification Matrix

**Version:** 1.0
**Effective Date:** March 3, 2026
**Standard:** CCAI Tactical Use Case #1

---

## Overview

This document defines the standardized severity classification system aligned with CCAI Tactical Use Cases for consistent incident categorization across all 44+ states in the DOT Corridor Communicator platform.

---

## Severity Levels

### HIGH Severity
**Definition:** Events causing major disruptions requiring immediate multi-state coordination

**Criteria (ANY of the following):**
- ✅ All lanes blocked (full closure)
- ✅ Fatality confirmed
- ✅ Multiple injury crash (3+ injuries)
- ✅ Hazmat incident (any release or spill)
- ✅ Major bridge/structure damage
- ✅ Expected duration > 4 hours
- ✅ Interstate highway full closure
- ✅ Evacuation required
- ✅ Emergency services requesting TMC coordination

**Typical Event Types:**
- Major multi-vehicle crashes
- Bridge strikes with structural damage
- Hazmat spills
- Major construction full closures
- Natural disaster impacts (flooding, tornado damage)
- Emergency evacuations

**Required Actions:**
- Immediate notification to adjacent states (within 5 minutes)
- Cross-state DMS activation
- Diversion route activation
- Executive briefing
- Media coordination

**Cross-State Notification:** MANDATORY within 50 miles of border

---

### MEDIUM Severity
**Definition:** Significant events causing notable delays but not requiring full corridor closure

**Criteria (ANY of the following):**
- ✅ 2+ lanes blocked (but not all lanes)
- ✅ Injury crash (1-2 injuries)
- ✅ Expected duration 1-4 hours
- ✅ Heavy truck involved (requires specialized equipment)
- ✅ Bridge/overpass involved (clearance issue)
- ✅ Work zone with lane restrictions
- ✅ Vehicle fire
- ✅ Significant debris in roadway

**Typical Event Types:**
- Multi-vehicle crashes (no fatalities)
- Disabled heavy trucks
- Work zone incidents
- Vehicle fires
- Bridge clearance violations
- Moderate weather impacts

**Required Actions:**
- Standard state notification
- DMS activation (if available)
- Detour consideration
- Regular status updates
- Incident commander notification

**Cross-State Notification:** RECOMMENDED within 25 miles of border

---

### LOW Severity
**Definition:** Minor events causing localized delays with minimal impact

**Criteria (ALL of the following must be true):**
- ✅ 0-1 lane blocked
- ✅ No injuries
- ✅ Expected duration < 1 hour
- ✅ No hazmat
- ✅ No structural damage
- ✅ Traffic flow maintained

**Typical Event Types:**
- Disabled vehicles
- Minor debris
- Temporary maintenance
- Shoulder work
- Minor weather impacts
- Parking violations

**Required Actions:**
- Standard monitoring
- DMS activation (optional)
- Detour not required
- Status updates on request

**Cross-State Notification:** OPTIONAL (only if near border)

---

## Override Rules

### Severity Escalation
Operators may escalate severity if:
- Traffic backup exceeds 3 miles
- Secondary crash occurs
- Weather conditions deteriorating
- Media attention increasing
- Public safety concerns arise
- Executive request

### Severity De-escalation
Operators may reduce severity if:
- Lanes reopened ahead of schedule
- Traffic flow restored
- No secondary impacts
- Overestimated initial assessment

**All overrides must be logged with reason**

---

## Special Classifications

### Amber Alerts
**Severity:** Always HIGH
**Rationale:** Public safety, multi-state coordination required

### Weather Events
- **Severe (tornado, blizzard, flooding):** HIGH
- **Moderate (heavy snow, ice, fog):** MEDIUM
- **Light (rain, light snow):** LOW

### Construction/Work Zones
- **Full closure:** HIGH
- **Lane closure (50%+ lanes):** MEDIUM
- **Shoulder work:** LOW

### Freight-Specific
- **Oversize load stuck/damaged:** MEDIUM (HIGH if blocking all lanes)
- **Hazmat violation:** HIGH
- **Truck parking emergency:** MEDIUM

---

## Implementation Notes

### Backend Logic Location
`backend_proxy_server.js` - `determineSeverity()` function

### Frontend Display
- HIGH: Red badge, flashing indicator
- MEDIUM: Orange badge
- LOW: Yellow badge

### State-Specific Overrides
States may apply local severity adjustments but must document reason in event notes.

---

## Compliance Tracking

### Metrics
- Severity accuracy (vs ground truth): Target >90%
- Override rate: Target <10%
- Cross-state agreement: Target >85%

### Quarterly Review
- Analyze severity distribution
- Review override patterns
- Validate against actual impacts
- Update criteria as needed

---

## Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-03 | Initial CCAI-aligned classification | DOT Corridor Communicator Team |

---

**Questions or Clarifications:** Contact system administrators
