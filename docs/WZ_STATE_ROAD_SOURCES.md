# Work-zone builders: per-state road source discovery

## Why this exists

The milepost layer each state builder queries contains **only posted state routes**.
"Nearest marker wins" therefore answers the wrong question: standing on a residential
street it returns whichever highway is closest, and the builder stamped that street with
the highway's route and milepost. Iowa does not have this bug because it queries RAMS
`Road_Network_View`, which carries **every** road system plus a `ROAD_SYSTEM_DESC` class
field, so the builder can tell "you are on a local street" from "you are on I-80".

Commit 0056008 added distance guards that use only each state's existing data:

* **line-source states (18)** -- cutoff tightened 500m -> 60m. This closes the bug for
  them, because the click is projected onto a continuous centreline and perpendicular
  offset is a real answer.
* **point-source states (29)** -- added a 1200m cutoff where there was none at all.
  This is an improvement (the query box is ~3.3km) but **does not close the bug**:
  markers sit ~1 mile apart, so no radius can be tight enough, and in a city a
  residential street within 1200m of a highway still picks it up.

Closing it for the 29 needs a per-state road centreline, which is what this directory
is for.

## What counts as a usable source

Two shapes work; either is fine:

1. **State-system-only centreline.** The gate is distance: nearest feature within ~60m
   means you are on a state route. (Same test the 18 line-source states already pass.)
2. **All-roads centreline WITH a system/class field.** The gate is the class of the
   nearest road. This is the Iowa pattern and is strictly better, because it also yields
   the local street's name for the CWZ 1.0 cross-street field.

An all-roads layer **without** a class field is NOT usable -- it accepts everything and
defeats the purpose. Caltrans `All_Roads` and NM `NM911_Road_Centerlines` are in this
category and need their class field identified before use.

## Method

`find_centerlines.py` crawls each state's ArcGIS catalog (the milepost service's own
server) and relevance-ranks polyline services. `verify_centerlines.py` scores each
candidate against ground truth: points taken from that state's **own posted mile
markers** are definitively on the state system and must be accepted; points offset 700m
must not be. Ground truth comes from the state's data, never from the builder's own
output -- an earlier attempt at this failed precisely because it trusted the builder's
mislabelled output as truth.

Caveat on the off-route probe: 700m from a rural marker is usually empty in any layer,
so a low off-route rate does **not** by itself prove a layer is state-system-only. That
still needs checking per state, which is why the table below says "candidate" and not
"done".

## Status

| state | status | layer | on-route hit | off-route hit |
|---|---|---|---|---|
| adot | candidate found | Intersect_of_State_Highway_System_and_Maintenance_Units | 1.00 | 0.17 |
| akdot | no markers |  |  |  |
| caltrans | candidate found | All Roads | 1.00 | 0.17 |
| cdot | candidate found | Routes | 1.00 | 0.0 |
| ctdot | no markers |  |  |  |
| hidot | no working layer found |  |  |  |
| idot | no working layer found |  |  |  |
| indot | no working layer found |  |  |  |
| itd | candidate found | State Highway System (SHS) Primary | 1.00 | 0.0 |
| mainedot | candidate found | TOM_TOM_PRIRTESYS | 1.00 | 0.17 |
| massdot | no working layer found |  |  |  |
| mdotsha | no markers |  |  |  |
| mdt | candidate found | MT Statewide Routes | 1.00 | 0.17 |
| midot | no working layer found |  |  |  |
| mndot | candidate found | ROUTES_PRIMARY_MEASURES | 1.00 | 0.33 |
| ncdot | no markers |  |  |  |
| nddot | no markers |  |  |  |
| nedot | candidate found | Highways | 1.00 | 0.33 |
| njdot | candidate found | NJ Roadway Network | 1.00 | 0.33 |
| nmdot | candidate found | NM911 Road Centerlines | 1.00 | 0.17 |
| nvdot | candidate found | Statewide Routes | 1.00 | 0.5 |
| ordot | candidate found | Highways_INVV_SEQ | 1.00 | 0.0 |
| penndot | no working layer found |  |  |  |
| tdot | candidate found | TDOT County Log Network (State Routes & Interstates) | 1.00 | 0.0 |
| txdot | no working layer found |  |  |  |
| udot | no working layer found |  |  |  |
| wisdot | no working layer found |  |  |  |
| wsdot | no markers |  |  |  |
| wydot | no markers |  |  |  |

Not yet wired into any builder. Known blockers found so far:

* **mndot** -- the `ROUTES_*` services return `499 Token Required` at the service root,
  though the query endpoint answered. Needs confirming before it can be relied on.
* **7 states** (akdot, ctdot, mdotsha, ncdot, nddot, wsdot, wydot) -- the ground-truth
  marker pull returned nothing, so nothing could be scored. Their milepost services
  need their query shape worked out first; this is a tooling gap, not evidence the
  states lack data. NCDOT and CTDOT in particular surfaced excellent-looking layers
  (`NCDOT_StateMaintainedRoadsQtr`, `CTDOT_State_Maintained_Highways`).
* **8 states** (hidot, idot, indot, massdot, midot, penndot, txdot, udot, wisdot) --
  no candidate passed. For several the catalog crawl found nothing matching, which
  usually means the centreline lives on a different server than the milepost service.
