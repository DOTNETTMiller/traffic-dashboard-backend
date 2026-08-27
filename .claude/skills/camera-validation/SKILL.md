---
name: camera-validation
description: Work on the camera-based work-zone validation (the AI-vision third validator) — debug why a zone is/ isn't camera-verified, tune the vision prompt or provider, read/repair the check-ledger, add camera feeds for a state, or reason about the daily re-check and demotion behavior. Use whenever a task touches services/camera-validation.js, camera-scan.js, camera-check-ledger.js, camera-adapters.js, or the x_camera_* fields in /api/cwz/events.
---

# Camera validation (the vision validator)

Camera validation is the **visual third validator** in the work-zone validation stack (alongside
device, TomTom, DMS). It matches an active WZDx zone to the nearest traffic camera, runs **one**
vision inference on that camera's still image, and — only if *actively deployed* traffic control is
visible — stamps the zone `x_camera_verified`. It is the **one validator that can demote** a zone
(a camera can see a zone is finished). Everything is cost-conscious, gated, and loop-free.

## Files (source of truth)

| File | Role |
|---|---|
| `services/camera-validation.js` | `matchCamera()` (free geometry match) + `detect()` (the gated/cached vision call). Provider-swappable. |
| `services/camera-scan.js` | `scanActive(events, opts)` — the policy: which zones are due, which phase, calls `detect()`, sets `x_camera_*`, handles `tc_removed`. |
| `services/camera-check-ledger.js` | Durable per-zone ledger (sqlite/pg): `checks` cap, `seen`, `tc_removed`, and the confirming detection detail for free re-stamping. |
| `services/camera-adapters.js` | `getCameras()` — the state camera still-image feeds. Add a state's cameras here. |
| `services/vision-training-log.js` | Optional weak-labeled training capture (gated by `VISION_TRAINING_LOG`). |

## How it works (data flow)

1. **Match (free, no network):** `matchCamera(event, cameras, {maxM:1500})` → nearest camera on the
   **same interstate** within 1500 m. Proximity ≠ line-of-sight, so a hit is corroborating: strong as
   a positive, soft as a negative.
2. **Gate:** `detect()` does nothing ($0, `available:false`) unless a vision key is configured.
3. **Detect (one inference, cached per snapshot URL, on-demand only):** fetch the camera still, ask
   the model for compact JSON. The prompt separates **deployed** devices (cones in a line/taper on the
   travel lanes, arrow board lit & facing traffic, workers in the roadway) from **stored/staged**
   (cones piled off the shoulder, dark arrow board). Only `work_zone && deployed && !staged_only`
   counts — a pile of stored cones does NOT verify a zone.
4. **Policy & persistence (`scanActive`):** per active zone, the ledger decides the phase:
   - `initial` / `followup` — near the start, confirm the zone is real (**≤2 attempts total**).
   - `daily` — for multi-day confirmed zones, **one check per day** to catch traffic-control removal.
   - A confirmed zone is **re-stamped for free** from the ledger on every scan (no new inference) —
     this is what makes the Validated Work Zones layer persist across cache rebuilds.
   - On a `daily` check that now **sees nothing**, `tc_removed` flips → the zone demotes to
     `suspect-inactive` and drops from the elevated feed (even if WZDx still lists it).

## Output (consumed by /api/cwz/events)

On a verified zone `properties` carries: `x_camera_verified:true`, `x_camera_detected:[…]`
(e.g. `["cones","arrow-board"]`), `x_camera_checked_at`, `x_camera_url` (live snapshot),
`x_camera_id`; and `camera` is added to `x_verification`. Camera is **excluded** from the sticky
validation-ledger on purpose (it must be able to demote) — see `services/validation-ledger.js`.

## Config / env

| Env | Purpose |
|---|---|
| `CAMERA_SCAN=true` | **Gate.** Without it, `scanActive` never runs. (LIVE in prod.) |
| `VISION_PROVIDER` | `anthropic` (default) · `openai` · `yolo`. Auto-resolves from whichever key/url is present. |
| `VISION_MODEL` | default `claude-haiku-4-5-…` (cheapest vision-capable). |
| `OPENAI_MODEL` | default `gpt-4o-mini` (used with `detail:low` = cheapest). |
| `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` / `OPENAI_API_KEY` / `VISION_YOLO_URL` | provider credentials. |
| `CAMERA_SCAN_MAX` | max vision checks per scan pass (default 25). |
| `CAMERA_INITIAL_WINDOW_MIN` / `CAMERA_FOLLOWUP_MIN` / `CAMERA_DAILY_MIN` | phase timing. |
| `VISION_TRAINING_LOG` / `VISION_TRAINING_IMAGES` | opt-in training capture to the `/data` volume. |

## Invariants (do not break)

- **Positive-only**, except the camera `daily` demotion (`tc_removed`) — the platform's only "it's gone" signal.
- **One inference per due zone per pass**, cached per snapshot URL (10-min TTL). Never loop/batch vision on the shared refresh beyond `CAMERA_SCAN_MAX`.
- **Deployed vs stored** distinction must stay in `DETECT_PROMPT`; `detect()` enforces `work_zone && deployed && !staged_only`.
- **Ledger is the source of truth**; `x_camera_*` on the event object is transient and re-stamped each scan.
- Camera must **not** be added to `validation-ledger.js` (that would make it permanently sticky and defeat daily demotion).

## Runbook

**"Why isn't zone X camera-verified?"** Check in order:
1. `CAMERA_SCAN=true` set? Is a vision key configured (`detect()` returns `available:false` otherwise)?
2. Is the zone **active now** (`isActiveNow`)? Only active zones are scanned.
3. Is there a camera **on the same interstate within 1500 m**? (`matchCamera` returns null otherwise → no check.)
4. Ledger state (`camera-check-ledger.get(id)`): `checks>=2 && !seen` = gave up (never confirmed at start); `tc_removed=1` = demoted (camera saw it gone).
5. Did vision see only **stored** devices? Then `staged_only` → not verified (by design). Check the scan `actions[].stagedOnly`.

**Tune the vision prompt:** edit `DETECT_PROMPT` in `camera-validation.js`. Keep the deployed/stored
JSON contract (`work_zone, deployed, staged_only, devices, confidence`) — `detect()` and `parseJsonBlock`
depend on those keys.

**Swap provider:** set `VISION_PROVIDER` + the matching key/model. `callAnthropic` / `callOpenAI` /
`callYolo` are drop-in; YOLO expects `{detections:[{label,score}]}` or the same JSON shape.

**Add a state's cameras:** add an adapter in `camera-adapters.js` returning `{id, route, coordinates:[lon,lat], imageUrl, state}`. `getCameras()` aggregates all adapters; matching is automatic.

**Verify live (no secrets):**
```bash
BASE=https://corridor-communication-dashboard-production.up.railway.app
# camera-verified zones in the feed + their detections
curl -s $BASE/api/cwz/events | jq -r '.features[] | select(.properties.x_camera_verified) |
  [.id, (.properties.x_camera_detected|join("+")), .properties.x_camera_url] | @tsv'
```

**Cost note:** cheapest model + tiny token budget + per-snapshot cache + `CAMERA_SCAN_MAX` cap. Absence
of a vision key = the `camera` source is simply unavailable (no cost, no false negatives asserted).

## Related

- Validation stack overview & feed schema: `docs/VALIDATED_WORK_ZONES_DEV_SPEC.md`
- Sticky accumulation for the other validators (device/tomtom/dms): `services/validation-ledger.js`
