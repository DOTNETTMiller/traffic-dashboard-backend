# Operational acceptance and development priorities

See [new and legacy device interoperability](INTEROPERABILITY.md) for the
executable 48-check transport matrix, read-only bench inspector, supported
device boundaries and per-model physical acceptance requirements.

This build is a working ATMS foundation with a real persistent operations
workflow. “Best ATMS in the country” remains a product objective, not a measured
claim. Establish that claim through operator outcomes, transparent evidence,
interoperability testing, and dependable operation.

## Implemented boundary

The console, incident lifecycle, ownership, source promotion, tasks, command
approvals, evidence verification, alarms, shift acceptance, and audit/exports
are implemented. The local workspace runs synthetic scenarios. The main
application can supply its existing event/device cache through an explicitly
enabled live API. Public feeds remain read-only.

## Before an agency pilot

1. Choose the owning agency, operating corridor, support hours, and operational
   authority. Validate response-plan tasks and terminology with actual operators.
2. Connect individual sign-in, explicitly assign membership/roles, verify account
   removal and session behavior, and test network isolation and agency boundaries.
3. Validate each participating source against its upstream system. Exercise feed
   outages, schema drift, duplicates, empty responses, and event disappearance.
   Cache age and source-event confirmation age must remain distinguishable.
4. Validate roadway locations, directions, restrictions, and detours with the
   responsible agency. Inventory presence does not establish device health.
5. Test backups, restore, audit checkpoints, clock synchronization, disk-full
   behavior, abrupt shutdown, and command reconciliation after recovery.
6. Exercise keyboard, screen-reader, small-screen, interrupted-connection, and
   long-shift workflows. Finish browser end-to-end QA for every operational action.
7. Load-test the intended agency inventory and concurrent operator count. Define
   response-latency and availability targets, measure them, and retain results.

## Before physical control

Commission an actual gateway/driver on test equipment with the responsible
agency. Verify credentials, NTCIP/vendor interpretation, message capabilities,
priority arbitration, approval separation, validity/expiration, manual override,
actual readback, blanking, lost acknowledgments, delayed/out-of-order callbacks,
restarts, and network partitions. No request echo may be treated as field proof.
The current gateway contract needs a hardware implementation and acceptance
evidence. It does not claim protocol certification.
The limited NTCIP character-matrix adapter now runs against an independent local
UDP emulator; this demonstrates wire exchanges, not manufacturer compatibility.

## Work still needed for a full replacement ATMS

- Camera discovery, permitted video delivery, PTZ arbitration, and video-wall
  workflows integrated with actual agency equipment.
- Detector and RWIS time-series ingestion, equipment diagnostics, and durable
  incident/performance metrics with source-specific validity rules.
- Agency-authored diversion/response plans, policy approvals, lane impacts,
  authorized traveler-information publication, and center-to-center exchange.
- Live override reconciliation and command-priority conflict exercises against
  the selected gateway and controllers.
- Fleet-scale map clustering, incremental event/device updates, retention and
  archival controls, and migration to a transactional shared database before
  multiple active service instances or multi-region failover.
- Staffed monitoring/support, security review, accessibility acceptance,
  deployment/change controls, service objectives, and disaster-recovery drills.

## How to measure product quality

Use the same incident scenarios with this workspace and the incumbent workflow.
Measure time to verify, time to establish ownership, duplicate entry, task
completion errors, unacknowledged critical alarms, handoff omissions, and time
to determine actual sign state. A release should demonstrate improvement on
those tasks while producing no false field-confirmation claims in failure tests.
Publish measured results and operating limits rather than a feature-count claim.
