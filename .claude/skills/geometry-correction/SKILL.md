---
name: geometry-correction
description: Correct the geometry of reported work zones (WZDx) from crow-flies 2-point straight lines into true road-following polylines, using a fixed source cascade — the STATE's own linear referencing system (LRS/centerline, by measure or by snap) first, FHWA ARNOLD national LRS second, an OSRM-compatible router last. Complete, portable, stack-agnostic method — triage which events need fixing, locate or snap onto the correct carriageway, slice the sub-line between begin and end, densify, gate the result before accepting it, and stamp WZDx x_geometry_* provenance. Use to build or operate geometry remediation for a WZDx feed, e.g. as a data-quality step before publishing to an exchange like MITRE iNODE.
---

# Geometry correction of work zones — full method

**Goal.** Given a reported work zone whose geometry is a **2-point straight line** between begin and
end coordinates, replace it with a polyline that **follows the actual roadway**, on the **correct
carriageway**, spanning exactly the reported extent — without changing any other field of the event.

A crow-flies line cuts corners, leaves the pavement, and reports a shorter length than the closure
actually has. Consumers map-match it onto the wrong road; a navigation app routes through it.

Stack-agnostic specification, implementable anywhere.

---

## 1. Inputs

1. **Work zones** — `id`, route/`road_names` (e.g. `I-80`), `direction`, begin/end coordinates (or
   begin/end **measure**: milepost, postmile, chainage), and the existing `geometry`.
2. **Tier 1 — state LRS / centerline** — the state's own authoritative routed centerline, **split by
   direction**, ideally **postmile/milepost-attributed** (per segment: route, direction, begin
   measure, end measure). This is the same reference frame the closure was authored in.
3. **Tier 2 — ARNOLD** — FHWA/BTS All Roads Network Of Linear Referenced Data, per-state hosted
   FeatureServers. National coverage, one vintage, **inconsistent per-state `route_id` schemas**.
4. **Tier 3 — OSRM-compatible router** — any `/route/v1/driving/{lon,lat};{lon,lat}` endpoint
   (self-hosted OSRM or Valhalla). Needs no LRS at all; knows nothing about carriageway or extent.

---

## 2. Triage (fix only what is broken)

Correct an event only when its geometry is **degenerate**: a `LineString` with ≤ 2 coordinates, a
`MultiLineString` whose every member has ≤ 2, or a geometry absent where begin/end points exist.

**A geometry with > 2 vertices is already road-following — leave it alone.** The feed's own detailed
polyline is more authoritative than anything reconstructed here. Never "improve" it.

---

## 3. Tier 1 — the state's LRS (preferred, two modes)

### 3a. By measure (best — no snapping at all)

When the closure carries **route + direction + begin/end measure**, and the centerline carries
per-segment begin/end measures, build a **calibrated route line** once per `(route, direction)`:
merge the segments in measure order (dropping a duplicated joint vertex < 1 m), then record, for each
source segment, its measure span against its position along the merged line. Locating a measure is
then linear interpolation inside the segment whose span contains it; slice the merged line between
the located begin and end.

This reproduces the closure exactly as the author described it. There is no proximity guess, no
snap tolerance, and it is correct even where carriageways are 30 m apart.

### 3b. By snap (when only coordinates exist)

1. Fetch the centerline for the route, filtered to the **matching carriageway** by the direction
   field (`NB/SB/EB/WB`). Exclude ramps, connectors, frontage roads, turnarounds.
2. Choose the candidate line minimizing `distance(begin) + distance(end)`; reject if the begin point
   is farther than `MAX_SNAP_M` (default 200 m, hard cap 300 m) — that means the wrong route.
3. Project both endpoints onto that line and take the **sub-line between them** (`lineSlice`), in
   ascending measure order. A slice shorter than ~10 m is not a closure — reject.

**Direction `both`:** emit one corrected geometry **per available carriageway**, each stamped with
its own concrete direction. Do not emit a single centerline and call it both. Where no directional
centerline exists, offset the centerline ~12 m perpendicular per carriageway as a last resort and
label the result as offset, not as surveyed.

---

## 4. Tier 2 — ARNOLD (national fallback)

ARNOLD covers every state, so it catches routes a state layer misses — but two things break it:

- **`route_id` schema is per-state.** Utah keys I-15 as `'0015'`; California uses county/street-name
  composites (`SAC_SAC_11TH ST_P`). A shared `route_id LIKE '0005%'` query returns **nothing** for
  those states — silently. That silence is why state-LRS-first is the order, not a preference.
- **Segments are short and unordered.** Query within a bbox around the event (~0.15°), then **stitch**:
  score each returned segment by distance to the event endpoints, start from the best, and repeatedly
  append/prepend any segment whose end lies within `STITCH_M` (default 500 m) of the growing line,
  reversing it when needed and dropping the duplicate joint vertex. Stop when nothing else connects.

Accept the stitched line only if it beats the best single segment's vertex count; otherwise take the
single best segment. ARNOLD has one vintage — it will not contain a realignment newer than its year.

---

## 5. Tier 3 — OSRM (last resort)

Route from begin to end with `overview=full&geometries=geojson` and use the returned geometry.

It is last for good reason: the router optimizes travel, so it will happily **return the opposite
carriageway**, take a **detour around** a road it believes is closed, or connect two points via a
different highway entirely. Treat its output as a shape hint, never as linear referencing, and put it
through §6 like everything else.

Operationally: a public OSRM endpoint is rate-limited — serialize requests through a queue
(~1.5 s apart), **cache by rounded begin/end/direction key**, and never fan out one request per event
in parallel.

---

## 6. Acceptance gates (run on every tier's candidate, before accepting)

A tier's output is a **proposal**. Reject it and fall through to the next tier when any gate fails:

| Gate | Rule |
|---|---|
| Vertices | > 2 after densification |
| Snap distance | begin and end within `MAX_SNAP_M` of the chosen line |
| Length sanity | corrected length between `0.95×` and `LEN_MAX×` (default 1.5) the straight-line distance — longer than that means a detour or the wrong road |
| Bearing | corrected line's overall bearing agrees with the event's stated direction (±90°); reverse the coordinate order rather than rejecting when it is simply backwards |
| Route identity | the chosen line's route matches the event's route — **never** correct onto a different road |

If every tier fails all gates, **emit the event unchanged**. A wrong polyline is worse than an honest
straight line, because it looks authoritative.

Then **densify** to `SPACING_M` (default 10 m) so downstream map-matching and length math behave, and
round coordinates to 6 decimals.

---

## 7. Output (WZDx-compatible)

Replace `geometry` only. Every other field — ids, times, lanes, `core_details` — is preserved
verbatim. On a corrected zone attach to `properties`:

| Field | Meaning |
|---|---|
| `x_geometry_source` | `"state-lrs"` \| `"state-pm"` \| `"state-snap"` \| `"arnold"` \| `"osrm"` |
| `x_geometry_method` | `"measure"` \| `"snap"` \| `"stitch"` \| `"route"` |
| `x_geometry_snap_m` | endpoint snap distance in metres (0 for measure mode) |
| `x_geometry_vertices` | before → after vertex count |
| `x_geometry_corrected_at` | timestamp |

A `both`-direction event that was split emits **one feature per carriageway**, each with its own
concrete `direction`.

---

## 8. Parameters (defaults)

| Name | Default | Purpose |
|---|---|---|
| `MAX_SNAP_M` | 200 m | max endpoint-to-centerline distance (hard cap 300 m) |
| `SPACING_M` | 10 m | densified vertex spacing (0 = keep native) |
| `STITCH_M` | 500 m | max gap to join two ARNOLD segments |
| `LEN_MAX` | 1.5× | max corrected/straight length ratio |
| `BBOX_PAD` | 0.15° | envelope padding for centerline/ARNOLD queries |
| `OSRM_DELAY_MS` | 1500 | spacing between public-router requests |

Work in a **projected CRS** for every distance/length/slice operation (a state plane or Albers, e.g.
EPSG:3310 in California) — degrees are not metres, and a lat/long "200 m" tolerance is wrong by ~25%
across the corridor. Convert back to WGS84 only on output.

---

## 9. Invariants

1. **Never touch a good geometry** — > 2 vertices means the feed already told the truth (§2).
2. **Tier order is fixed** — state LRS → ARNOLD → OSRM. Each tier is more authoritative about
   *carriageway and extent* than the next; a router knows neither.
3. **Never cross routes or carriageways** — failing a gate is the correct outcome, not a near miss.
4. **Unchanged on failure** — a zone that survives no tier is emitted exactly as received.
5. **Geometry only** — correcting a shape must never alter times, lanes, type, or identity.
6. **Provenance always** — every corrected geometry says which tier produced it (§7).
7. **Cache the reference, not the event** — one centerline fetch per `(route, direction)` (per route +
   ~0.05° cell for large statewide layers) serves hundreds of events; per-event fetching will get you
   rate-limited and will stall the loop.

---

## 10. End-to-end pseudocode

```text
for event in feed:
    if not degenerate(event.geometry): emit(event); continue        # §2

    for tier in [state_lrs, arnold, osrm]:                          # §3–§5
        if tier is state_lrs and event.has_measures:
            cand = locate_by_measure(route_index[event.route, event.dir],
                                     event.begin_m, event.end_m)    # §3a
        elif tier is state_lrs:
            cand = snap_and_slice(centerlines(event.route, event.dir), event)  # §3b
        elif tier is arnold:
            cand = stitch(arnold_query(state, route_id(event.route), bbox(event)), event)
        else:
            cand = route_between(event.begin, event.end)            # §5

        if cand and passes_gates(cand, event): break                # §6
        cand = None

    if not cand: emit(event); continue                              # unchanged (§9.4)

    for geom in split_by_carriageway(cand, event.direction):        # §3b "both"
        emit(with_geometry(event, densify(geom, SPACING_M), provenance(tier)))  # §7
```

---

## 11. Quality check (after a run)

Report **corrected / skipped / unchanged by tier**, mean vertex count before vs after, and mean
corrected-to-straight length ratio. Then sample ~5 points along a sample of corrected lines and
measure offset from an independent road source (OSM via the router): **< 20 m excellent, 20–50 m
normal** for official-vs-crowdsourced, **> 50 m** means a projection problem or a stale vintage —
investigate before publishing. Spot-check on a map that both carriageways landed on the right side.

---

## 12. Reference implementation

CCAI Connected Corridor:

- `docs/wzdx-diy/wzdx_geometry_fix.py` — the portable, self-testing implementation of this whole
  cascade (`--fallback-order state,arnold,osrm`), including measure-based LCS location
  (`build_route_index` / `locate_pm` / `pm_correct`), and CIFS output. `--selftest` runs synthetic.
- `services/state-centerline-service.js` — tier 1 by snap (Caltrans SHN, TxDOT Roadways), with
  direction filtering, route caching, and densification.
- `services/arnold-geometry-service.js` — tier 2, including segment stitching, bounded concurrency,
  and the bidirectional offset fallback.
- `backend_proxy_server.js` — tier 3: queued/cached OSRM snapping (`osrm_geometry_cache`).
- Background: `docs/STATE_GEOMETRY_ALIGNMENT.md` (per-state services, projections, OSM alignment
  validation) and `docs/IOWA_GEOMETRY_ENRICHMENT.md` (the proven Midwest 2-point remediation).
