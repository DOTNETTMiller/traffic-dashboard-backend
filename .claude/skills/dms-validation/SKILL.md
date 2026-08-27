---
name: dms-validation
description: Independently corroborate a reported work zone from DYNAMIC MESSAGE SIGN (DMS) text — a human operator posting a work-zone/closure message on a nearby sign is evidence from a different operational system than the WZDx feed. Complete, portable, stack-agnostic method — fetch live sign text, accept only genuine closure/roadwork phrasing while rejecting the unrelated messages boards cycle through (Amber alerts, safety campaigns, travel times, weather, crashes), match by route + distance, and emit WZDx x_dms_* verification. Use to build or operate DMS-based work-zone validation, e.g. as a WZDx quality signal in MITRE iNODE.
---

# DMS-message validation of work zones — full method

**Goal.** Corroborate a reported work zone using the **live text on nearby dynamic message signs**. A
DMS showing "ROAD WORK / RIGHT LANE CLOSED / FOLLOW DETOUR" near a zone is a human operator, in a
**different system** than the WZDx export, posting about that closure — independent corroboration. The
hard part is rejecting the many *unrelated* messages a board cycles through.

Stack-agnostic specification.

---

## 1. Inputs

1. **Work zones** — `id`, route, representative point, active window.
2. **DMS signs** — each with `id`/name, location `[lat, lon]`, route (if known), and the **current
   message text**. Most DOT DMS feeds expose live `msgtext`.

---

## 2. Classify each sign's message (the crux)

A sign corroborates only if its text **states a real closure/roadwork** AND is **not** one of the
unrelated categories. Use two gates:

**ACCEPT (strong) — a specific closure/roadwork phrase:**
```
/ROAD ?WORK|WORK ?ZONE|LANE (CLOSED|CLOSURE)|(RIGHT|LEFT|CENTER|#?\d) LANES? CLOSED|
 SHOULDER (CLOSED|WORK)|SHLDR (CLOSED|CLD)|ROAD ?CLOSED|
 CLOSED (AT|AHEAD|MON|TUE|WED|THU|FRI|SAT|SUN|NIGHT|\d)|RAMP CLOSED|\bDETOUR\b|
 CONSTRUCTION|PAVING|MILLING|BRIDGE WORK|WORK AHEAD/i
```

**REJECT (exclude) — messages boards cycle through that are NOT this work zone:**
```
/AMBER ALERT|SILVER ALERT|BLUE ALERT|CLICK IT|BUCKLE UP|SEAT ?BELT|DRIVE SOBER|\bDUI\b|\bOWI\b|
 DON'?T DRINK|IMPAIRED|BUZZED|TEXT.*DRIV|DISTRACT|PHONE DOWN|PUT.*PHONE DOWN|MOVE OVER|
 IT'?S THE LAW|GIVE.*BRAKE|SAVE LIVES|SLOW DOWN,? SAVE|GAME ?DAY|EVENT TRAFFIC|TRAVEL TIME|
 \b\d+ MIN\b|\bMINUTES? TO\b|HIGH WIND|DENSE FOG|\bSNOW\b|\bICE\b|\bCRASH\b|COLLISION|STALLED|
 DISABLED VEH|\bINCIDENT\b|EMERGENCY VEH|\bVOTE\b|ELECTION/i
```

**Rule:** `qualifies = ACCEPT.test(msg) AND NOT REJECT.test(msg)`. Deliberately drop weak bare tokens
(a lone "CLOSED", "MERGE", "WORKERS", "REDUCED SPEED", "EXPECT DELAY") from ACCEPT — they appear in
incident/ramp/generic messages too. This correctly rejects e.g. the generic "WORK ZONES / SLOW DOWN /
IT'S THE LAW" awareness campaign (ACCEPT hits "WORK ZONE" but REJECT hits "IT'S THE LAW").

---

## 3. Match to a zone

For each active zone, among qualifying signs, find the nearest that is:
- on the **same route** when both name one (route may come from the sign record or be parsed from the
  message), and
- within **`MATCH_MAX_M`** (default ≈ 8 km / ~5 mi — DMS warn UPSTREAM of a closure, so a larger radius
  than the on-site validators is correct).
Keep the nearest.

---

## 4. Output (WZDx-compatible)

On a corroborated zone, attach to `properties`:

| Field | Meaning |
|---|---|
| `x_dms_corroborated` | `true` |
| `x_dms_message` | the sign text (truncated) |
| `x_dms_name` | sign name / location |
| `x_dms_distance_m` | distance from zone to sign |
| `x_dms_match` | the ACCEPT phrase that matched (provenance) |
| *(and)* | add `"dms"` to `x_verification` |

---

## 5. Parameters (defaults)

| Name | Default | Purpose |
|---|---|---|
| `MATCH_MAX_M` | 8000 m | zone↔sign match distance (DMS warn upstream) |
| `SIGN_TTL` | 10 min | cache for the fetched sign set |

---

## 6. Invariants

1. **Positive-only** — a DMS match elevates; its absence never demotes.
2. **Two-gate classification** — ACCEPT *and* NOT-REJECT; never corroborate on a bare keyword or an
   excluded campaign/alert/travel-time/weather/incident message.
3. **Same-route, in-range** — respect route and the (larger, upstream) distance window.
4. **Sticky-eligible** — corroborations may accumulate and persist (never demoted).

---

## 7. End-to-end pseudocode

```text
signs = [s for s in fetch_dms() if s.location and qualifies(s.message)]   # §2
for zone in active_zones:
    m = nearest_same_route(zone, signs, MATCH_MAX_M)                      # §3
    if m:
        zone.x_dms_corroborated = true
        zone.x_dms_message  = m.message[:120]
        zone.x_dms_name     = m.name
        zone.x_dms_distance_m = m.distance
        zone.x_dms_match    = first_match(ACCEPT, m.message)
        add(zone.x_verification, "dms")
```

---

## 8. Reference implementation

CCAI Connected Corridor: `services/dms-corroboration.js` (the ACCEPT/REJECT gates + match, cached sign
fetch from DOT DMS feeds). Output composes into `GET /api/cwz/events`; see
`docs/VALIDATED_WORK_ZONES_DEV_SPEC.md`.
