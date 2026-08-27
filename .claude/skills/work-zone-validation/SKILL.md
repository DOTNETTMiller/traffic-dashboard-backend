---
name: work-zone-validation
description: Orchestrate multi-source, independent validation of reported work zones (WZDx) into a higher-confidence "validated" feed. Runs the four validator capabilities (device, camera, probe/TomTom, DMS), composes their evidence into a per-zone verification set + confidence, applies positive-only semantics with sticky accumulation (except camera's daily removal), and emits a WZDx v4.2 / CWZ 1.0 feed. Use to build or operate the end-to-end work-zone validation pipeline, e.g. in MITRE iNODE. Points to the per-validator skills for the how of each source.
---

# Work-zone validation (orchestrator) — full method

**Goal.** Turn a raw set of reported work zones (ingested WZDx from many DOTs) into a **validated**
feed: each zone independently corroborated by one or more sources that are *operationally separate*
from the DOT export, with machine-readable provenance and a confidence model. This is the top-level
capability; each source's method lives in its own skill.

**Core idea.** "A feed *says* there's a work zone here" ≠ "this work zone is **independently confirmed
live right now**." Agreement between *different* systems is what makes corroboration meaningful.

---

## 1. The four validators (independent signal classes)

| Source | Signal class | Skill | Can demote? |
|---|---|---|---|
| **device** | Connected field device on site (arrow board / DMS / sensor) | `device-validation` | No |
| **camera** | AI vision on a public traffic-camera still | `camera-validation` | **Yes — daily** |
| **probe** (`tomtom`) | Commercial traffic-incident provider | `probe-validation` | No |
| **dms** | Operator-posted dynamic message sign text | `dms-validation` | No |

Each is a different operational system, so two agreeing is strong corroboration rather than one source
echoing itself. Run each skill's method; each stamps its own `x_*` fields and adds its key to the
zone's `x_verification` array.

---

## 2. Compose the verification set

For each active zone, after running the validators, `x_verification` is the ordered list of source
keys whose flag is set: `["device","camera","tomtom","dms"]` (subset). A zone is **elevated** into the
validated feed iff `x_verification.length ≥ 1`.

---

## 3. Confidence model (what a consumer should apply)

- **`length ≥ 2` → strong / multi-source agreement** — two independent systems confirm the same zone.
  Highest confidence; style/treat distinctly.
- **`length == 1` → single-source** — still elevated; weight by source: `device` and `camera` are
  on-site/visual (strongest single sources); `probe` and `dms` are proximity corroboration (strong
  positive, soft standalone).
- **Never** treat the *absence* of a validator as evidence a zone is inactive (see §4).

---

## 4. Positive-only + the one demotion

- Validators **elevate**; absence of a signal never demotes a zone.
- **Exactly one exception:** the camera validator's daily re-check can affirm a zone is **finished**
  (`x_tc_removed`) when a camera sees the traffic control gone — the only "it's gone" signal. That
  demotes the zone from the elevated set even if the DOT feed still lists it.

---

## 5. Sticky accumulation (persistence) vs. camera daily re-check

- **device / probe / dms → sticky.** Once a zone is corroborated by one of these, record it in a
  durable ledger and **re-apply on every build** — it persists across cache rebuilds, refreshes, and
  (for probe) provider credit outages, and is **never demoted**. Re-applied validations carry
  `x_*_sticky:true` so a consumer can distinguish a live hit from an accumulated one.
- **camera → NOT sticky.** Camera confirmations are re-stamped for free from its own check-ledger, but
  must retain the daily re-check + removal ability (§4). Never add camera to the sticky ledger.

This division is the key design decision: accumulate the sources that have no "it's gone" signal;
keep the one source that does (camera) able to demote.

---

## 6. Output — the validated feed

Emit a WZDx v4.2 `FeatureCollection` (CWZ 1.0 profile) containing **only elevated zones**. Each feature
= a WZDx `RoadEventFeature` with the validators' `x_*` extension fields and `x_verification`. Standard
WZDx parsers read `core_details` directly; the `x_*` fields are additive. Stable `id` /
`core_details.name` is safe as an exchange key. See `docs/VALIDATED_WORK_ZONES_DEV_SPEC.md` for the
exact schema, endpoints (`/api/cwz/events`, `/api/cwz/devices`, `/api/tomtom/status`), and iNODE
integration guidance.

---

## 7. Orchestration pseudocode

```text
zones = ingest_wzdx(all_dot_feeds)            # raw reported zones
active = [z for z in zones if active_now(z)]

run device_validation(active)                 # each skill stamps x_* + x_verification
run camera_validation(active)                 # (the only demotable source)
run probe_validation(active)
run dms_validation(active)

for z in zones:
    apply_sticky(z, sources=[device, probe, dms])   # §5 re-apply, never demote
    # camera is NOT sticky — its ledger handles re-stamp + daily removal

elevated = [z for z in zones if len(z.x_verification) >= 1 and not z.x_tc_removed]
emit_wzdx_feed(elevated)                       # §6
```

---

## 8. Operational notes

- **Cadence:** validators run lazily / on a scan schedule + cache; consumers need not poll. Probe pull
  cadence and budget are tunable and breaker-protected (`probe-validation`).
- **Coverage varies by state** — camera/DMS/device feeds exist for a subset; WZDx ingest is broad.
  `x_verification` is authoritative for what actually fired on a given zone.
- **Extensibility:** add a fifth signal class (e.g. connected-safety-alert / responder broadcast) by
  writing another validator skill that stamps its own key into `x_verification`; the confidence model
  and sticky rules apply unchanged (decide per source whether it can demote).

---

## 9. Reference implementation

CCAI Connected Corridor: validators in `services/{camera-validation,camera-scan,camera-check-ledger,
tomtom-incidents,tomtom-corroboration,dms-corroboration}.js` + the device matcher; sticky ledger in
`services/validation-ledger.js`; feed in `services/cwz-roadevent-feed.js` served at
`GET /api/cwz/events`. Full spec: `docs/VALIDATED_WORK_ZONES_DEV_SPEC.md`.
