---
name: probe-validation
description: Independently corroborate a reported work zone with a COMMERCIAL PROBE / traffic-incident source (e.g. TomTom Traffic Incidents API) — an operator-independent view of what navigation traffic data reports at the location. Complete, portable, stack-agnostic method — tile the active zones, query incidents with budget/rate/circuit-breaker controls, filter to work-zone categories, match by route + distance, and emit WZDx x_tomtom_* verification. Use to build or operate probe-based work-zone validation, e.g. as a WZDx quality signal in MITRE iNODE.
---

# Probe / traffic-incident validation of work zones — full method

**Goal.** Corroborate a reported work zone against a **commercial traffic-incident provider** (probe /
nav data). If an independent provider reports road works / a lane or road closure at the zone's
location, that is strong third-party evidence the zone is live. The example provider is the **TomTom
Traffic Incidents API v5**; the method generalizes to any incident provider with a bbox query.

Stack-agnostic; includes the cost-safety controls a metered API requires.

---

## 1. Inputs

1. **Work zones** — `id`, route, representative point/geometry, active window.
2. **A traffic-incident API** — queried over bounding-box tiles, returning incidents with a category,
   location, road numbers, and (optionally) delay. Requires a key/credits.

---

## 2. Tiling (cover the zones cheaply)

Incident APIs charge per request and cap bbox area. Build a **minimal tile set** covering the active
zones:
- Bucket zone points onto a coarse grid (**cell ≈ 0.8°**, which stays under a 10,000 km² bbox cap even
  at low latitudes); emit **one padded tile per occupied cell**. N clustered zones then cost far fewer
  requests than one bbox per zone.
- For a fixed corridor, walk the route polyline into tiles each under the area cap.

---

## 3. Query with cost & safety controls (essential for a metered API)

- **Daily budget:** cap requests/day (`DAILY_BUDGET`, default 2500) well under the provider's limit;
  stop early when hit.
- **Pace tiles:** small delay between requests so a round does not burst the per-second rate cap.
- **Circuit-breaker:** on `403/402 InsufficientFunds` (out of credits) or `429` (rate limit), stop the
  round immediately (every further tile fails identically) and **back off** — long (e.g. 6 h) for
  credits, short (e.g. 10 min) for rate-limit. Surface the state (`ok` / `insufficient-credits` /
  `rate-limited`) so consumers can see whether the signal is live.
- **Cache** the incident set with a TTL (`ZONE_TTL`, default 3 h — work zones are stable over hours);
  refresh in the background, never block the consumer.

---

## 4. Filter incidents to the work-zone signal

Keep only incidents that indicate roadwork/closure, on a relevant road class:
- **Category:** work-zone categories only — e.g. TomTom `iconCategory` **7 (Lane closed)**,
  **8 (Road closed)**, **9 (Road works)**. Drop weather/jam/accident categories.
- **Road class:** restrict to Interstate / US-highway road numbers (e.g. matches `^(I|US)[-\s.]?\d`)
  to stay in scope and drop the flood of local-street incidents a bbox returns.

---

## 5. Match to a zone

For each active zone, find a qualifying incident that is:
- on the **same route** (normalized) when both name one, and
- within **`MATCH_MAX_M`** (default ≈ 1–2 km) of the zone point.
Keep the nearest. Record its category and distance.

---

## 6. Output (WZDx-compatible)

On a corroborated zone, attach to `properties`:

| Field | Meaning |
|---|---|
| `x_tomtom_corroborated` | `true` |
| `x_tomtom_category` | e.g. `Road works` / `Lane closed` / `Road closed` |
| `x_tomtom_distance_m` | distance from zone to matched incident |
| `x_tomtom_delay_s` | reported delay, if any |
| *(and)* | add `"tomtom"` (or your provider key) to `x_verification` |

*(A vendor-neutral implementation may name these `x_probe_*`; keep them stable and documented.)*

---

## 7. Parameters (defaults)

| Name | Default | Purpose |
|---|---|---|
| `GRID_CELL` | 0.8° | tiling cell (keeps bbox < 10,000 km²) |
| `DAILY_BUDGET` | 2500 | self-imposed daily request cap |
| `TILE_DELAY` | ~120 ms | pace between tile requests |
| `ZONE_TTL` | 3 h | incident cache lifetime |
| `MATCH_MAX_M` | 1000–2000 m | zone↔incident match distance |
| `COOLDOWN` | 6 h / 10 min | breaker back-off (credits / rate-limit) |

---

## 8. Invariants

1. **Positive-only** — a probe match elevates; its absence never demotes (probe data lags and misses
   short/rural zones).
2. **Category-gated** — only roadwork/closure categories corroborate; not weather/jams/accidents.
3. **Same-route, in-range** — never corroborate across routes or beyond the match distance.
4. **Metered-safe** — never hammer a credit/rate-limited API; the circuit-breaker + budget + cache are
   mandatory, not optional.
5. **Sticky-eligible** — corroborations may accumulate and persist (never demoted), which also keeps a
   zone validated through a provider credit outage.

---

## 9. End-to-end pseudocode

```text
if breaker.in_cooldown(): use_cached(); return
tiles = tiles_for(active_zone_points, GRID_CELL)
incidents = []
for i, bbox in enumerate(tiles):
    if budget.remaining() <= 0: break
    if i>0: sleep(TILE_DELAY)
    r = provider.incidents(bbox)                    # one request
    if r.status in (402,403,429):
        breaker.trip(r.status); break               # §3
    incidents += r.incidents
wz = [x for x in incidents if category_workzone(x) and highway(x)]   # §4
for zone in active_zones:
    m = nearest_same_route(zone, wz, MATCH_MAX_M)   # §5
    if m:
        zone.x_tomtom_corroborated = true
        zone.x_tomtom_category = m.category
        zone.x_tomtom_distance_m = m.distance
        add(zone.x_verification, "tomtom")
```

---

## 10. Reference implementation

CCAI Connected Corridor: `services/tomtom-incidents.js` (tiling, budget, pacing, breaker error codes),
`services/tomtom-corroboration.js` (category filter + match), backend cache/cooldown + `GET
/api/tomtom/status`. Output composes into `GET /api/cwz/events`; see
`docs/VALIDATED_WORK_ZONES_DEV_SPEC.md`.
