# ATMS data collection

The ATMS reuses the collectors in this repository. Its standalone and embedded
servers now collect four independent streams from Corridor Communicator:

| Stream | Existing endpoint | Existing implementation reused |
| --- | --- | --- |
| Events | `/api/events?slim=false` | Existing event cache and state integrations |
| Equipment | `/api/devices` | `services/device-adapters.js`, `device-ingest.js`, device validation and matching |
| Traffic measurements | `/api/traffic/mn/detectors?limit=10000` | `services/mn-traffic-detectors.js`: IRIS XML configuration, station and detector samples |
| Iowa ITS inventory | `/api/its-equipment?stateKey=ia` | Existing GIS imports and the `its_equipment` table; cameras, DMS, RWIS and sensors |

The existing device registry includes ArcGIS, WZDx device feeds, CARS/511,
IBI/OneStop public-map integrations and custom state adapters. Iowa collection
now includes fixed signs as well as portable devices. The device endpoint retains
state, inventory flag, portability, source-adapter identity and supplied MULTI.
It reports each attempted adapter as `ok`, `unavailable`, `skipped` or
`empty-unverified`. Several legacy adapters internally turn failures into empty
arrays; those are explicitly unverified rather than reported healthy. The roster
can refresh even when the event list is empty. No new independent national poller
or mandatory external subscription was added.

## Use it

For a live standalone workspace, set `ATMS_SOURCE_URL` to the Corridor
Communicator server origin (default `http://127.0.0.1:3001`). Existing live-mode
identity, agency, persistent storage and control-gateway settings still apply.
Supply any state-feed keys to the existing collector server. URLs with embedded
credentials are rejected; credentials are not sent to the browser.

Open **Data collection → Collect latest data** as an operator. Collection is
on demand. **Refresh readings** only reads retained ATMS data; it does not poll
the DOTs. Training imports synthetic events and detector readings and labels
them synthetic. There is no automatic background collection schedule in this
release.

Each request has an 18-second fetch timeout and a 30 MB response limit. Streams
run concurrently and succeed/fail independently. A missing/malformed event feed
does not erase existing events or block device/measurement imports. A partial
event snapshot does not mark missing reports absent. A truncated detector
response is partial. Unknown or missing collection clocks remain unknown.

## Stored evidence and quality

The Iowa inventory connector preserves GIS-derived asset types, locations,
manufacturer/model, external identifiers and source attributes. Database edit
dates, saved sign messages, camera URLs and `active`/`inactive` labels are
inventory attributes, not present device observations. Inventory rows use a
separate device-ID namespace, so they cannot overwrite a telemetry record.
RWIS locations do not establish access to live weather readings. Historical
camera URLs are retained for review and are not automatically played.

The local folder includes `temp/iowa_cameras.geojson`, active/inactive DMS
extracts, a sensor-layer GeoJSON, and fiber geometry. Some other exported layer
files are zero bytes. Several usable files use projected coordinates; the
existing database imports supply WGS84 point locations. The connector reuses
that imported inventory. It does not reinterpret projected GIS coordinates as
longitude/latitude or turn fiber lines into point devices. The export filename
dates from 2025; collection now does not make the source survey current.

To inspect the existing local inventory without changing `states.db`, import
into a separate review workspace:

```sh
node scripts/atms-import-its-inventory.cjs --source-db states.db --atms-db /private/tmp/iowa-inventory-review.sqlite --agency LOCAL_REVIEW --mode training
```

The source database is opened read-only. The destination, agency and mode must
be explicit; source and destination cannot be the same file. Live imports only
create read-only inventory assets and still require a separate accepted gateway
for any control. The local 2026-10-20 review imported 3,149 records with zero
rejections: 1,617 camera records, 543 DMS records, 139 RWIS records, 809 traffic
sensor records and 41 work-zone sensor records. Existing imports overlap: these
are source-record counts, not a deduplicated physical-device inventory. Automatic
merging with live telemetry is deliberately not performed based on proximity.

The SQLite workspace retains compressed JSON snapshots, SHA256 hashes and
normalized observation history, with indexes scoped to agency and source.
Snapshots contain **JSON received at the ATMS boundary**. Existing upstream
collectors may already have transformed vendor payloads; this is not a claim
that original vendor XML, HTTP bytes or every rejected upstream row is retained.
Hashes cover the compact UTF-8 JSON returned as `payload`, before compression.
They detect changes against the retained digest; they are not digital signatures.

Normalization preserves source record IDs, state, device class, coordinates,
route, direction, supplied lane, source adapter, inventory flag, exact supplied
plain-text message, measurement timestamp, collection timestamp, source snapshot
timestamp and sampling period. Supported measurement mappings are speed in mph,
flow in vehicles/hour and occupancy in percent. Zeros remain zeros. Missing,
nonnumeric or invalid values never become measured zeros. Full source fields
remain available in the captured snapshot.

Inventory does not acquire a telemetry observation timestamp. Missing message
text remains unknown rather than a claimed blank. Unknown locations, missing or
invalid measurement clocks, future timestamps, invalid measurements, stale
readings, synthetic data and absence from a complete snapshot have explicit
quality flags. Traffic freshness uses five minutes; other current profiles use
15 minutes. Freshness is recalculated when queried, never reset by downloading
or replaying a batch.

A failed/partial snapshot retains previous asset presence. A complete snapshot
can mark an asset absent while preserving its last reading; absence is not a
blank display, offline proof or incident clearance. Older source/record timestamps
are archived without replacing newer observations. Duplicate payload snapshots
do not create duplicate history rows. Duplicate record IDs make the stream
partial. Training and live workspaces remain separate databases.

History retention is bounded to at most 24 batches and 100,000 observation rows
per source stream; oldest batches are removed first. Latest observation/asset
records remain separately retained. This is local evidence retention, not a
long-term data warehouse. Export snapshots before they age out if longer history
is required. SQLite backups include these tables.

## Authenticated endpoints

All endpoints use the existing ATMS individual identity and agency boundary:

| Method / path under `/api/atms` | Result |
| --- | --- |
| `POST /sources/refresh` | Operator collects and imports configured streams |
| `GET /collections` | Stream health, clocks, counts and latest batch reference |
| `GET /collections/observations` | Latest normalized records; `sourceId`, `type`, `limit` (1–200), `offset` filters |
| `GET /collections/observations/:id/history` | Retained versions for one observation; optional `limit` (1–200) |
| `GET /collections/batches/:id` | Integrity-checked captured JSON and provenance |
| `POST /collections/batches/:id/replay` | Operator-only normalization preview, first 200 rows, original clocks, no writes |

Replay deduplicates record IDs using the same normalizer. It returns a preview
and never imports into live operations, refreshes measurement clocks, replays
commands or establishes field confirmation. Viewer accounts can inspect and
download agency data but cannot collect or replay. Do not share exported payloads
outside the agency without reviewing their contents.

Imported equipment is read-only. It cannot replace an existing commissioned
gateway/simulator device with the same ID or verify a command. This collection
layer does not add serial/PMPP drivers, proprietary-controller access, direct
RWIS polling, ONVIF discovery or universal device support. Those can be added as
separate connectors once actual interfaces and sample data are available.

## Validation

`npm run test:atms` exercises normalization, source failures, independent streams,
retention, SQLite reopen, payload integrity, agency isolation, authenticated
routes, operator/viewer separation and replay without writes, alongside the
existing mixed-device interoperability and operations tests.
`node --test tests/mn-traffic-detectors.test.js` verifies the reused IRIS parser.
Public upstream endpoints and every state adapter were not revalidated by these
fixture tests; availability and coverage still need deployment-specific checks.
