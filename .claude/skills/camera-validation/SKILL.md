---
name: camera-validation
description: Independently validate that a reported roadway work zone is physically active RIGHT NOW using public traffic-camera imagery and a vision model. Complete, portable, stack-agnostic method — match a work zone to a nearby camera, run one vision inference on its still image, confirm only ACTIVELY DEPLOYED traffic control (not stored cones), and maintain a confirm/daily-recheck/removal state machine. Use to build or operate camera-based work-zone validation (e.g. as a WZDx quality/validation signal in an exchange like MITRE iNODE). Produces WZDx-compatible x_camera_* verification fields.
---

# Camera validation of work zones — full method

**Goal.** Given a reported work zone (e.g. a WZDx `RoadEventFeature`), decide independently whether
**actively-deployed traffic control is visible on the roadway right now**, using a public traffic
camera near the zone plus a single vision inference. Output a machine-readable verification with
provenance, and keep it current with a daily re-check that can also detect when the zone is finished.

This is a **corroborating** signal: a camera near a zone is not guaranteed to be pointed at it, so a
positive detection is strong evidence the zone is real, while a non-detection is soft (it does not by
itself prove the zone is inactive — the one exception is the daily-removal rule below).

This document specifies the method end to end so it can be implemented in any stack.

---

## 1. Inputs & prerequisites

1. **Work zones to validate** — a list of zones, each with: a stable `id`, roadway/route name
   (e.g. `I-80`), geometry (LineString or point → derive a representative lat/lon), and an active
   window (`start_date`, optional `end_date`).
2. **Camera inventory** — a list of traffic cameras, each with: `id`, route name, location
   `[lat, lon]`, and a **still-image URL** that returns a current JPEG (most state DOT CCTV feeds
   expose one). No PTZ/heading is assumed.
3. **A vision model** — any image-capable LLM (e.g. a small/cheap multimodal model) **or** a
   self-hosted object detector (e.g. YOLO). Requirements: accept one image, return the JSON in §4.
4. **A durable key-value store** — for the per-zone state (§6). Any DB or table works.

---

## 2. Candidate selection

Only validate zones that are **active now**: `start_date ≤ now` and (`end_date` is null or `now ≤
end_date`). Skip zones outside their window — do not spend inference on them.

---

## 3. Camera matching (free, geometry only — no network)

For each active zone, find the **nearest camera on the same route within a distance threshold**:

- Normalize route identifiers so `I-80`, `I 80`, `I80` compare equal; require the camera's route to
  match the zone's route when both are known (drops cross-route cameras at interchanges).
- Compute great-circle distance from the zone's representative point to each candidate camera;
  keep the closest.
- If the closest exceeds **`MATCH_MAX_M` (default 1500 m)**, there is no usable camera → skip
  (no check, no cost).

Output of this step: `{camera, distanceMeters}` or none.

---

## 4. Vision inference (one call, cached, gated)

Fetch the matched camera's still image. **Cache the result per image URL** for a short TTL
(**`DETECT_TTL` default 10 min**) so repeat checks in a window never re-bill. Then run **one**
inference with the following contract.

### 4.1 The prompt (verbatim — the deployed-vs-stored distinction is the crux)

> This is a highway traffic camera still. Look for TEMPORARY traffic-control devices (arrow-board,
> cones, barrels, drums, signs, workers, tma) and decide whether they are ACTIVELY DEPLOYED for a
> live work zone or only STORED/STAGED. Deployed = cones or barrels arranged in a line/taper along or
> across the travel lanes (a real closure), an arrow-board lit and facing traffic, or workers/
> equipment in the roadway. Stored/staged = cones or barrels piled, stacked, bundled, or clustered on
> the shoulder, median, ditch, ramp, or a staging area and NOT arranged along a lane; an arrow-board
> that is dark or blank. Reply ONLY compact JSON:
> `{"work_zone":true|false,"deployed":true|false,"staged_only":true|false,"devices":[any of
> arrow-board,cones,barrels,drums,signs,workers,tma],"confidence":0..1}`.
> Set work_zone:true ONLY for an actively deployed closure. If devices are merely piled/stored off the
> roadway, set staged_only:true, deployed:false, work_zone:false. If no temporary devices at all, all
> false and devices:[].

### 4.2 Response contract

```json
{ "work_zone": true, "deployed": true, "staged_only": false,
  "devices": ["cones","arrow-board"], "confidence": 0.86 }
```
Parse defensively (extract the first `{...}` block; default all-false on parse failure). Filter
`devices` to the known vocabulary.

### 4.3 Object-detector alternative

If using a detector instead of an LLM, map its labels to the same vocabulary and infer `deployed`
from geometry (are cones roughly collinear along a lane vs. clustered?). If the detector cannot judge
deployment, treat any positive as `deployed:true` — accepting a higher false-positive rate — or run a
lightweight arrangement heuristic. The LLM path is preferred because it judges arrangement directly.

---

## 5. Decision rule

A frame **verifies** the zone iff:

```
seen = work_zone AND deployed AND NOT staged_only
```

A pile of stored cones off the shoulder therefore does **not** verify a zone. Enforce this in code
even if the model sets `work_zone:true` while also setting `staged_only:true` — the AND wins.

---

## 6. Confirmation state machine (why a single frame is not enough)

A camera may not be aimed at the zone, and one frame is noisy. Maintain per-zone state and follow a
phase policy. Persist for each zone: `checks` (initial-phase attempt count), `seen` (ever confirmed),
`removed` (camera saw it gone), `first_check_at`, `last_check_at`, and the confirming detection detail
(`camera_id`, `image_url`, `devices`, `detected_at`).

Per active zone, per scan pass, decide the phase:

| Condition | Phase | Action |
|---|---|---|
| Never confirmed, at/near start (or first sight of a multi-day zone) | **initial** | run inference; `checks += 1` |
| `checks == 1`, not yet seen, `FOLLOWUP` elapsed since first check | **followup** | run inference; `checks += 1` |
| `checks ≥ 2` and never `seen` | — | **give up** (stop spending; zone never confirmed at start) |
| `seen` and single-day zone | — | **done** (re-stamp verified for free, no inference) |
| `seen` and multi-day and `DAILY` elapsed since last check | **daily** | run inference to detect removal |
| `removed == true` | — | skip permanently |

Rules:
- **Initial/follow-up** confirm a new zone is real, capped at **≤2 inferences total**.
- **Free re-stamp:** a `seen` zone re-applies its `x_camera_*` fields from the store on every pass
  with **no new inference** — this keeps the validation persistent across feed rebuilds.
- **Daily removal (the only demotion):** on a `daily` check that now returns `seen = false`, set
  `removed = true` → the zone is finished (traffic control gone) even if the source feed still lists
  it. Drop it from the validated output / mark it `suspect-inactive`.

---

## 7. Output (WZDx-compatible verification)

On a verified zone, attach these extension fields to the zone's `properties`:

| Field | Meaning |
|---|---|
| `x_camera_verified` | `true` |
| `x_camera_detected` | array of devices seen, e.g. `["cones","arrow-board"]` |
| `x_camera_checked_at` | ISO timestamp of the confirming detection |
| `x_camera_url` | the camera still URL (live proof snapshot) |
| `x_camera_id` | the camera id |
| *(and)* | add `"camera"` to a `x_verification` list on the zone |

On removal: set `x_tc_removed = true` and/or a `suspect-inactive` activity flag; remove from the
elevated/validated set. Do **not** delete history — keep the store record so a later re-sighting can
re-verify.

---

## 8. Parameters (defaults)

| Name | Default | Purpose |
|---|---|---|
| `MATCH_MAX_M` | 1500 m | max zone→camera distance to attempt a check |
| `INITIAL_WINDOW` | ~configurable (hours) | how close to `start_date` counts as "initial" |
| `FOLLOWUP` | ~configurable (minutes/hours) | delay before the 2nd initial attempt |
| `DAILY` | 24 h | re-check cadence for multi-day confirmed zones |
| `MAX_ATTEMPTS` | 2 | initial-phase cap before giving up |
| `DETECT_TTL` | 10 min | per-image cache to avoid re-billing |
| `MAX_PER_PASS` | 25 | cap on inferences per scan pass (cost guardrail) |

---

## 9. Cost & safety controls

- **Gate:** do nothing (zero cost) unless a vision provider is configured.
- **One inference per due zone per pass**, cached per image URL; cap the pass at `MAX_PER_PASS`.
- **Cheapest capable model + small max-tokens** (JSON is tiny). Detail/quality low is fine.
- **On-demand / scheduled only** — never loop vision on every request; run on a scan schedule or when
  a consumer opens the validated layer.

---

## 10. Invariants (must hold)

1. **Positive-only**, with exactly one exception: the §6 daily-removal demotion. Absence of a
   detection never otherwise demotes a zone.
2. **Deployed ≠ present.** Stored/staged devices must not verify a zone (§5).
3. **Same-route matching** — never validate a zone with a camera on a different route.
4. **The store is the source of truth**; the `x_camera_*` fields on the zone object are transient and
   re-applied each pass.
5. **Do not make camera validations permanently sticky.** Unlike device/probe/DMS corroboration
   (which can accumulate and never demote), camera validation MUST retain its daily-removal ability —
   it is the system's only affirmative "the zone is finished" signal.

---

## 11. End-to-end pseudocode

```text
for zone in work_zones:
    if not active_now(zone): continue
    match = nearest_camera_same_route(zone, cameras, MATCH_MAX_M)
    if not match: continue
    st = store.get(zone.id)
    if st and st.removed: continue
    if st and st.seen:
        restamp_verified(zone, st)                     # free, no inference
    phase = decide_phase(zone, st, now)                # §6 table
    if not phase: continue
    if inferences_this_pass >= MAX_PER_PASS: break
    img = fetch_cached(match.camera.image_url, DETECT_TTL)
    det = vision(img, PROMPT)                           # §4 → JSON
    seen = det.work_zone and det.deployed and not det.staged_only
    store.record(zone.id, phase, seen, match.camera, det)
    if seen:
        set_verified(zone, det, match.camera)          # §7
    elif phase == "daily":
        set_removed(zone)                              # §6 demotion
```

---

## 12. Reference implementation

A production implementation of this method exists in the CCAI Connected Corridor platform:
`services/camera-validation.js` (match + gated/cached vision, provider-swappable Anthropic/OpenAI/
YOLO), `services/camera-scan.js` (the §6 state machine), `services/camera-check-ledger.js` (the store).
The validated output is served as WZDx v4.2 at `GET /api/cwz/events` — see
`docs/VALIDATED_WORK_ZONES_DEV_SPEC.md` for the full feed schema and how `camera` composes with the
device / TomTom / DMS validators (multi-source agreement = highest confidence).
