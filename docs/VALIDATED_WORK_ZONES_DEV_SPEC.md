# Validated Work Zones — Developer Specification

**Audience:** MITRE iNODE integration engineers and data consumers
**Profile:** CWZ 1.0 over WZDx v4.2 (`RoadEventFeature` / GeoJSON `FeatureCollection`)
**Status:** Production. Multi-state (I-35 / I-80 corridor states + others as ingested).
**Version:** 1.0 (this document) · Feed `feed_info.version` = `4.2`
**Contact:** `matthew.miller@iowadot.us`

---

## 1. What this is

The platform ingests WZDx work-zone feeds from many state DOTs, then **independently
corroborates** each active zone against sources that are operationally *separate* from the
WZDx export itself. A zone confirmed by one or more of those sources is **elevated** into the
**Validated Work Zones** feed with machine-readable provenance describing *how* it was validated.

The goal for an exchange like iNODE: distinguish "a DOT feed *says* there's a work zone here"
from "**this work zone is independently confirmed to be live right now**," and carry the evidence
so downstream consumers can apply their own confidence policy.

**Design invariant — positive-only.** Validators *elevate*; they never demote a zone on the mere
absence of a signal. The single exception is the camera validator's once-daily re-check, which
can mark a zone `x_tc_removed` when a camera visually confirms the traffic control is gone (see §4.2).

---

## 2. The four validators (independent signal classes)

Each validator is a *different operational system* than the WZDx feed being checked, so agreement
between them is meaningful corroboration rather than one source echoing itself.

| Key (`x_verification`) | Signal class | What it confirms | Can demote? |
|---|---|---|---|
| `device` | Connected field device on site | An arrow board / DMS / sensor is auto-associated to the zone | No |
| `camera` | AI vision on a public traffic-camera still | Deployed traffic-control devices are visible in the roadway | Yes — daily (see §4.2) |
| `tomtom` | Commercial probe/traffic (TomTom Incidents API) | An independent commercial provider reports works/closure at the location | No |
| `dms` | Operator-posted dynamic message sign text | A human posted a work-zone/closure message on a nearby DMS | No |

### 2.1 Verification metadata by source

When a source corroborates a zone, its evidence is attached to `properties`:

- **device:** `x_cwz_connected`, `x_connected_devices[]`, `x_connected_device_count`, `x_connected_confidence`
- **camera:** `x_camera_verified`, `x_camera_detected[]` (e.g. `["cones","arrow-board"]`), `x_camera_checked_at`, `x_camera_url` (live snapshot), `x_camera_id`
- **tomtom:** `x_tomtom_corroborated`, `x_tomtom_category` (e.g. `Road works`/`Lane closed`/`Road closed`), `x_tomtom_distance_m`, `x_tomtom_delay_s`
- **dms:** `x_dms_corroborated`, `x_dms_message` (the sign text), `x_dms_name`, `x_dms_distance_m`

---

## 3. API

Base URL (production): `https://corridor-communication-dashboard-production.up.railway.app`
All endpoints are CORS-open (`Access-Control-Allow-Origin: *`), read-only, no auth.

### 3.1 `GET /api/cwz/events` — the Validated Work Zones feed

Returns a WZDx v4.2 `FeatureCollection` containing **only elevated zones** — every feature has at
least one validator set. Response is cached; `feed_info.update_frequency` = 300 s.

```
200 OK · application/json
{
  "feed_info": {
    "title": "CCAI Connected Work Zone — RoadEvent Feed (premier, real-time)",
    "update_date": "2026-08-27T13:20:17Z",
    "version": "4.2",
    "x_cwz_profile": "CWZ 1.0",
    "x_dataset_tier": "premier-realtime-connected",
    "update_frequency": 300,
    "data_sources": [ { "data_source_id": "...", "organization_name": "CCAI (multi-state)" } ]
  },
  "type": "FeatureCollection",
  "features": [ RoadEventFeature, ... ]
}
```

### 3.2 `GET /api/cwz/devices` — connected-device feed

Companion CWZ 1.0 device `FeatureCollection`: the connected field devices and the
`road_event_ids` they are matched to. Use to resolve `device`-validated zones to their hardware.

### 3.3 `GET /api/tomtom/status` — validator health (no cost)

Reports the TomTom validator's circuit-breaker state without triggering a pull. Useful for
consumers that want to know whether the `tomtom` signal is currently live.

```
{ "configured": true, "status": "ok" | "insufficient-credits" | "rate-limited",
  "cooldownUntil": "2026-08-27T19:00:00Z" | null,
  "corridorCount": 42, "zoneCount": 130,
  "lastCorridorPull": "...", "lastZonePull": "..." }
```

---

## 4. Feature schema

Each feature is a WZDx `RoadEventFeature` with CWZ/validation extensions on `properties`.

```jsonc
{
  "id": "<stable work-zone id>",              // == core_details.name; stable across refreshes
  "type": "Feature",
  "geometry": { "type": "LineString" | "Point", "coordinates": [...] },
  "properties": {
    // --- WZDx core (standard) ---
    "core_details": {
      "event_type": "work-zone",
      "road_names": ["I-80"],
      "direction": "eastbound",              // westbound | northbound | southbound | ...
      "description": "...",
      "name": "<stable work-zone id>"
    },

    // --- CWZ / validation extensions ---
    "x_verification": ["device","tomtom"],   // which validators corroborated (0..4 entries)
    "x_cwz_connected": true,
    "x_connection_status": "verified",       // "verified" (≥1 source) | "connected"
    "x_connected_device_count": 1,
    "x_connected_confidence": 0.9,
    "x_connected_devices": [ { ...device... } ],

    // present only when the corresponding validator fired:
    "x_camera_verified": true,
    "x_camera_detected": ["cones","arrow-board"],
    "x_camera_checked_at": "2026-08-27T12:00:00Z",
    "x_camera_url": "https://.../snapshot.jpg",
    "x_camera_id": "IA-CAM-1234",

    "x_tomtom_corroborated": true,
    "x_tomtom_category": "Road works",
    "x_tomtom_distance_m": 210,
    "x_tomtom_delay_s": 45,

    "x_dms_corroborated": true,
    "x_dms_message": "RIGHT LANE CLOSED 2 MILES",
    "x_dms_name": "I-80 EB MM 128 DMS",
    "x_dms_distance_m": 3200,

    // sticky provenance (see §5): set true when a validation was re-applied from the ledger
    "x_tomtom_sticky": true,
    "x_dms_sticky": true,
    "x_device_sticky": true
  }
}
```

### Derivation of `x_verification`
`x_verification` is the array of source keys whose flag is set, in fixed order:
`device` (`x_cwz_connected`) · `camera` (`x_camera_verified`) · `tomtom` (`x_tomtom_corroborated`)
· `dms` (`x_dms_corroborated`). A feature appears in the feed iff `x_verification.length ≥ 1`.

### Confidence model (recommended consumer policy)
- **`x_verification.length ≥ 2` → "strong" / multi-source agreement.** Two independent systems
  confirm the same zone — the platform styles these distinctly and treats them as highest confidence.
- **`length == 1` → single-source corroboration.** Still elevated, but weight per source: `device`
  and `camera` are on-site/visual (strongest single sources); `tomtom` and `dms` are proximity-based
  corroboration (strong positive, soft as a standalone claim).
- Consumers should not treat *absence* of a validator as evidence a zone is inactive (positive-only).

---

## 5. Validation lifecycle & persistence

### 5.1 Sticky accumulation (device / tomtom / dms)
Once a zone is corroborated by `device`, `tomtom`, or `dms`, that validation is recorded in a
durable ledger and **re-applied on every subsequent build** — so a validation persists across cache
rebuilds, feed refreshes, and (for TomTom) API credit outages. It is **never demoted**. Re-applied
validations carry `x_*_sticky: true` so a consumer can distinguish a live hit from an accumulated one.

### 5.2 Camera — daily re-check (the one demotable source)
Cameras are deliberately *not* sticky. A confirmed camera validation is re-stamped for free across
rebuilds, but multi-day zones get **one fresh camera check per day**. Because a camera can actually
*see* that a zone is finished, that daily check can set `x_tc_removed` and drop the zone from the
elevated feed even while the source WZDx feed still lists it. This is the platform's only
"it's gone" signal, and the reason cameras are excluded from the sticky ledger.

### 5.3 False-positive controls
- **Camera vision** separates *actively deployed* devices (cones in a line/taper on the travel lanes,
  arrow board lit and facing traffic, workers in the roadway) from *stored/staged* devices (cones
  piled off the shoulder, dark arrow board). Only deployed devices set `x_camera_verified`.
- **DMS** requires a specific closure/roadwork phrase (`ROAD WORK`, `LANE CLOSED`, `CONSTRUCTION`,
  `DETOUR`, …) **and** excludes unrelated messages the boards cycle through (Amber/Silver alerts,
  seat-belt/OWI campaigns, generic "slow down / it's the law" slogans, travel times, weather, crashes).
- **TomTom** is filtered to Interstate/US-highway incidents and matched within a bounded distance on
  the same route.

---

## 6. Cadence & availability

- Feed build/serve: lazy + cached; `update_frequency` 300 s. No client polling required — the feed
  reflects the latest corroboration each fetch.
- TomTom pull cadence is env-tunable (`TOMTOM_ZONE_TTL_HOURS`, `TOMTOM_CORRIDOR_TTL_MIN`,
  `TOMTOM_DAILY_BUDGET`) and protected by a circuit-breaker; `GET /api/tomtom/status` reports state.
- Camera vision is gated (runs only when configured) and cost-capped; absence of a vision key simply
  means the `camera` source is unavailable, not that zones are invalid.

---

## 7. Integration guidance for MITRE iNODE

1. **Consume `GET /api/cwz/events`** as a WZDx v4.2 `FeatureCollection`. Standard WZDx parsers read
   `core_details` directly; the `x_*` fields are additive and can be ignored by a strict WZDx consumer.
2. **Map provenance into the exchange.** Carry `x_verification` (and the per-source metadata) as the
   evidence/quality attributes for each zone so iNODE participants can see *why* a zone is validated.
3. **Apply the confidence model in §4** rather than a boolean — prefer multi-source (`≥2`) for
   high-assurance use cases; single-source for broader coverage.
4. **Respect positive-only semantics.** Do not infer "no work zone" from the absence of a validator;
   only the camera `x_tc_removed` signal is an affirmative "removed."
5. **Stable identity.** `id` / `core_details.name` is stable across refreshes — safe as an exchange key.
6. **Health.** Poll `GET /api/tomtom/status` (free) if you need to know whether the `tomtom` signal is
   currently live vs. in cooldown.

---

## 8. Limitations & roadmap

- Coverage of each validator varies by state (camera/DMS feeds exist for a subset of states; NBI,
  OSRM, FCC, and WZDx ingestion are national). `x_verification` is authoritative for what actually
  fired on a given zone.
- Proximity-based sources (`tomtom`, `dms`) corroborate by distance-on-route, not exact geometry match.
- Candidate future validator: connected-safety-alert data (e.g. HAAS Alert / Safety Cloud) as a fifth,
  device/responder-broadcast signal class — gated behind a partner agreement.

---

## 9. Change log

- **1.0** — Initial developer spec: four validators, CWZ 1.0/WZDx v4.2 schema, sticky accumulation,
  camera daily re-check, `/api/cwz/events`, `/api/cwz/devices`, `/api/tomtom/status`.
