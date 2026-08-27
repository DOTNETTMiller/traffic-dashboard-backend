---
name: device-validation
description: Independently validate a reported work zone by auto-associating a CONNECTED FIELD DEVICE (arrow board, portable DMS, smart barrel/sensor, TMA) physically present on the zone. Complete, portable, stack-agnostic method — match a live device to the zone by route + linear position (chainage) with on/far gating, score confidence, and emit WZDx x_cwz_connected verification. The strongest single validator (hardware on site). Use to build or operate device-based work-zone validation, e.g. as a WZDx quality signal in MITRE iNODE.
---

# Device validation of work zones — full method

**Goal.** Given a reported work zone and a feed of **connected field devices**, decide whether a
device is actually deployed on the zone, and if so associate them and mark the zone device-verified.
A powered device reporting its location from within a zone's extent is the **strongest single
confirmation** that the zone is physically established.

Stack-agnostic specification, implementable anywhere.

---

## 1. Inputs

1. **Work zones** — `id`, route (e.g. `I-80`), geometry (LineString preferred → gives extent), active
   window. If linear-referencing (mileposts/chainage) is available for the route, keep it.
2. **Connected devices** — a live feed where each device has: `id`, `type` (arrow-board, portable-DMS,
   sensor, TMA, …), location `[lat, lon]`, route (if reported), operating `status`/`mode` (on/active
   vs off/stored), and a `last_report`/heartbeat timestamp.
3. Optional: a linear-referencing service (route centerline + measure) to compute device chainage.

---

## 2. Device eligibility (filter first)

Only consider devices that are **currently deployed**: powered/active status **and** a fresh heartbeat
(within `DEVICE_FRESH` — default 60 min). Drop stored/off/stale devices — a dark arrow board in a yard
is not on a zone.

---

## 3. Association (route + linear position, with on/far gating)

For each active zone, associate an eligible device when **both** hold:

1. **Same route** — normalized route match (`I-80` == `I 80` == `I80`). Never associate across routes.
2. **On the zone extent** — the device lies within the zone's linear span plus a buffer:
   - **Preferred (chainage):** compute the device's milepost/measure on the route; associate if it is
     within `[zone.begin_measure − BUF, zone.end_measure + BUF]` (**BUF** default ≈ 0.5 mi). This is
     robust to divided-highway offset and curvature.
   - **Fallback (distance):** perpendicular distance from the device point to the zone geometry ≤
     `ON_MAX_M` (default 400 m). Beyond `FAR_MAX_M` (default 1500 m) → "far", do not associate.

"On/far gating": ON devices verify; FAR devices are recorded as nearby-but-not-on and do **not** verify.

---

## 4. Confidence score

Combine into `x_connected_confidence` (0..1):
- proximity (closer/lower chainage error → higher),
- device count on the zone (more independent devices → higher),
- device type weight (an arrow board or portable DMS on a lane taper > a lone sensor),
- heartbeat freshness.
A single fresh on-zone arrow board should already score high (≈0.9).

---

## 5. Output (WZDx-compatible)

On a device-verified zone, attach to `properties`:

| Field | Meaning |
|---|---|
| `x_cwz_connected` | `true` |
| `x_connected_devices` | array of the associated device objects |
| `x_connected_device_count` | count |
| `x_connected_confidence` | 0..1 (§4) |
| `x_connection_status` | `"verified"` |
| *(and)* | add `"device"` to `x_verification` |

Also emit a **device feed** (CWZ 1.0 / WZDx device `FeatureCollection`): each device with the
`road_event_ids` it is matched to — the inverse index, so consumers can go device → zone(s).

---

## 6. Parameters (defaults)

| Name | Default | Purpose |
|---|---|---|
| `DEVICE_FRESH` | 60 min | max heartbeat age to count a device as live |
| `BUF` | 0.5 mi | chainage buffer around the zone extent |
| `ON_MAX_M` | 400 m | distance-fallback "on zone" threshold |
| `FAR_MAX_M` | 1500 m | beyond this, not even "nearby" |

---

## 7. Invariants

1. **Positive-only** — a device association elevates a zone; the absence of a device never demotes one.
2. **Deployed only** — off/stored/stale devices must not associate (§2).
3. **Same-route + on-extent** — never associate a device on a different route or outside the zone span.
4. **Sticky-eligible** — once a zone is device-verified it may accumulate and persist (never demoted),
   unlike camera validation. Persist associations so they survive feed rebuilds.

---

## 8. End-to-end pseudocode

```text
devices = [d for d in device_feed if d.active and fresh(d, DEVICE_FRESH)]
for zone in active_zones:
    onzone = []
    for d in devices:
        if not same_route(d.route, zone.route): continue
        if on_zone(d, zone, BUF, ON_MAX_M):        # §3 chainage or distance
            onzone.append(d)
    if onzone:
        zone.x_cwz_connected = true
        zone.x_connected_devices = onzone
        zone.x_connected_device_count = len(onzone)
        zone.x_connected_confidence = score(onzone, zone)   # §4
        add(zone.x_verification, "device")
        emit_device_feed(onzone, zone.id)
```

---

## 9. Reference implementation

CCAI Connected Corridor: the device↔work-zone matcher (live state device feeds via `device-adapters`,
RAMS chainage for linear position, on/far gating, validation monitoring) and `cwz-device-feed.js`
(the device `FeatureCollection`). Output composes into `GET /api/cwz/events` alongside camera / probe
/ DMS — see `docs/VALIDATED_WORK_ZONES_DEV_SPEC.md`.
