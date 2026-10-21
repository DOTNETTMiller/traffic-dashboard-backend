# PurposeBuilt ATMS

An operational ATMS foundation built alongside Corridor Communicator. It has a
dedicated React/Leaflet console, a persistent SQLite operations store, a
transactional command workflow, and the existing normalized source adapters as
its observation layer. It runs locally in a clearly labeled training workspace.

## Run

The **Simulated agency** desk adds external CAD/traffic observations, illustrative
camera views or local recorded clips, responders and notification recipients.
Six isolated acceptance exercises produce downloadable evidence reports. See
[SIMULATION.md](SIMULATION.md) for operation, requirements and remaining limits.


From the repository root, with the existing dependencies installed:

```sh
npm --prefix frontend run build
npm run start:atms
```

Open <http://127.0.0.1:4432/atms.html>. The standalone service defaults to
training, binds only to loopback, and creates a separate database under
`products/atms/runtime/training.sqlite`. It never sends physical device commands.
State and audit records persist across refreshes and restarts. Mode metadata
prevents a training database from being reopened as a live workspace.

The existing dashboard also has a PurposeBuilt ATMS navigation shortcut to
`/atms.html`. Its normal production build includes both applications. The
integrated operational API remains disabled until explicitly configured.

Installation, commissioning, and the messaging architecture are documented in
[INSTALLATION.md](INSTALLATION.md). Run `npm run check:atms-install` with the live
environment for a read-only local readiness report.

Feed validation, release controls, endpoints, and operational limits are documented
in [FEEDS.md](FEEDS.md).

## What works

- PurposeBuilt branding using the same logo asset as StormCheck.
- Incident-linked operator messaging with explicit recipient acknowledgment,
  unacknowledged-message alarms, and supervisor-approved DMS wording templates.
- Versioned commissioning evidence, independent installation acceptance, and
  live-control gates that invalidate on device or gateway configuration changes.
- Source road geometry retained through promotion, mapped road segments,
  reviewed agency-catalog lookup, and alarms for location changes. See [GEOMETRY.md](GEOMETRY.md).
- Pinned-schema WZDx 4.2 and CWZ 1.0 road-event publishing with ready/held
  reports, explicit supervisor releases, source attribution, and stale-release gates.
- Operator incident reports and promotion from source observations, with
  original source observation/update timestamps and a stable source link.
- Agency isolation, individual identities, explicit workspace membership,
  viewer/operator/supervisor permissions, and optimistic record revisions.
- Incident ownership, accepted ownership handoffs, an ordered incident
  lifecycle, required response tasks, operational notes, and after-action export.
- Source-inbox search and pagination. Source removals raise review conditions;
  they never automatically resolve an active incident.
- DMS requests with per-device plain-text limits, validity periods, priority,
  independent supervisor approval, transactional dispatch, gateway evidence,
  exact-message readback, and uncertain-outcome reconciliation.
- Alarm occurrences, acknowledgments, time-limited supervisor shelving, and
  reset acknowledgment when a cleared condition returns.
- Shift briefings with explicit incoming acceptance and snapshots of active
  incident IDs, outstanding command IDs, and alarm counts.
- Append-only application audit records with a per-agency SHA-256 hash chain,
  integrity verification, downloadable checkpoints, and incident audit export.
- A mixed loopback NTCIP 1203 / SNMPv1, v2c and encrypted v3 controller lab. The adapter discovers sign
  capabilities, writes and validates a MULTI message, activates it, and reads the
  controller's current buffer over UDP. Results remain simulated. Devices has
  controls for communication failures, validation rejection, local control,
  lost acknowledgments, field override, and expiry. See `NTCIP.md` and
  `INTEROPERABILITY.md` for the compatibility matrix and read-only bench tool.
- Esri imagery and road labels by default, following the existing work-zone
  builders. An agency can configure its own licensed tile URL and attribution.
  No OpenStreetMap tile-server dependency remains in the ATMS console.

## Exercise the workspace

The **ITS architecture** desk links equipment to connection/port records,
authenticated photographs, inspection evidence and data calculation lineage.
See [ARCHITECTURE.md](ARCHITECTURE.md) for workflows, limits and endpoints.

The **Data collection** desk reuses existing state equipment adapters and MnDOT
IRIS measurements, with retained JSON, quality flags, history and replay preview.
See [COLLECTIONS.md](COLLECTIONS.md) for coverage, configuration and endpoints.

1. Choose **Training operator**. Open the major I-80 incident, which is already
   owned by this identity. Advance to verified with an explanatory note.
2. Open response tasks and record evidence for each completed action.
3. Request a message on an online virtual DMS. Use at most 3 lines of 18
   characters. Requests may be prepared before verification; approval requires
   a verified/responding/monitoring incident.
4. Switch to **Training supervisor**. Review and approve the request in Command
   log. The result becomes **Simulated result**, never physical confirmation.
5. Switch back to the operator. Complete required tasks, move through responding
   and monitoring, and resolve/close the incident with notes.
6. Offer an incident handoff or prepare a shift briefing for
   `training.incoming`. Switch to **Incoming operator** to accept it. A briefing
   does not silently reassign incident ownership.
7. Review alarms and verify the audit chain. Export a completed incident record.

Use Source inbox → Refresh scenario observations to make a new, explicitly
synthetic observation. Refreshing the workspace alone never refreshes source
age. The identity selector exists only in the standalone loopback training
service. The live service has no training-session endpoint.

## Integrated live configuration

Set `ATMS_ENABLED=true`, a persistent `ATMS_DB_PATH`, `ATMS_AGENCY`, and a
32+ character `JWT_SECRET` on the main Corridor Communicator process. Explicitly
list individual usernames in `ATMS_OPERATOR_USERS`, `ATMS_SUPERVISOR_USERS`, and
`ATMS_VIEWER_USERS` (comma-separated). Existing administrator privileges and
shared state passwords do not grant ATMS membership or control authority.

The ATMS API uses the existing individual JWT sign-in. The console reads the
existing `authToken`; it does not use stored state passwords. Source inbox
imports the existing event/device cache directly, preserving its timestamp.
The bridge does not invoke the heavy nationwide refresh pipeline itself. Keep
that pipeline independently healthy and scheduled for agency operations.

For an independent live service, use `ATMS_MODE=live`, `ATMS_JWT_SECRET`, a
persistent `ATMS_DB_PATH`, `ATMS_AGENCY`, the same membership allowlists, and
`ATMS_SOURCE_URL`. Mount it behind the agency authentication/reverse-proxy setup.
It does not include a separate password enrollment or identity-provider service.
See `.env.example`; it is documentation, not an automatically loaded env file.

## DTCD closure push

Set `ATMS_DTCD_WEBHOOK_SECRET` (32+ characters) to accept signed closure
changes from DTCD at `POST /api/atms/dtcd/closures`. See `DTCD.md`.

## Device-control boundary

Public feeds populate read-only devices, regardless of any control fields in
source records. Control devices must be provisioned on the server with a
commissioned gateway. Configure `ATMS_GATEWAY_URL` (HTTPS),
`ATMS_GATEWAY_SECRET` (32+ characters, separate from JWT secrets), and
`ATMS_DEVICE_CONFIG` (server-local JSON array). Example device record:

```json
{
  "id": "AGENCY-DMS-001",
  "gatewayDeviceId": "gateway-address-001",
  "name": "I-80 EB upstream sign",
  "type": "dms",
  "route": "I-80",
  "latitude": 41.6,
  "longitude": -93.6,
  "columns": 18,
  "lines": 3,
  "controlEnabled": true
}
```

Configuration does not create telemetry. The gateway must provide signed,
recent device observations before control is enabled. See `GATEWAY.md` for the
wire contract. The repository includes a limited character-matrix NTCIP/SNMP
adapter exercised against independent local emulators. It is not commissioned
against hardware and is not yet a deployed production gateway service. No
physical signs, cameras, signals, or gates were operated in this build.

Approval, device freshness, and per-device command serialization are rechecked
before dispatch. A gateway HTTP 2xx is not an acknowledgment or verified display.
Delivery errors, timeouts, and restart recovery preserve an uncertain outcome
and prohibit automatic resend. Expiration never asserts physical clearance.
Outstanding uncertain or verified field commands block incident resolution.

## Verification and recovery

```sh
npm run test:atms
npm test
node scripts/atms-smoke.cjs
```

The smoke script requires the running local training service. It refuses remote
hosts and live mode, creates labeled training records, and retains their audit
history. It covers identity, permissions, forged-provenance rejection,
idempotency, concurrency, approval, simulated evidence, closure, shift acceptance,
and export. Core tests cover signed gateway evidence and failure/recovery paths.

Use SQLite's online backup facility rather than copying only the database file:

```sh
node products/atms/backup.cjs /persistent-volume/atms-live.sqlite /secure-backups/atms-NEW.sqlite
```

The helper refuses existing destinations and checks backup integrity. Store the
backup and an externally protected audit checkpoint in separate secure storage.
Restoration requires stopping the writer, restoring a tested snapshot, verifying
the chain against its external checkpoint, and reconciling all outstanding
field commands with actual readback before resuming control. The service marks
outstanding verified/in-flight live commands uncertain on restart.

SQLite operations currently require one service instance/writer on persistent
local storage. This build does not claim multi-region failover, certified NTCIP
interoperability, or nationwide load validation. Before operational commissioning,
complete the acceptance work in `ACCEPTANCE.md`.
