# Installed ITS architecture workspace

Open **ITS architecture** in the ATMS navigation. The register connects specific
equipment to physical and information dependencies, photographs, inspection
records and collected observations. It uses the existing agency identity,
SQLite persistence, audit chain, and collection layer.

## Establish the architecture

1. Add an asset or link an existing imported/gateway device. Record its class,
   manufacturer, model, firmware, owner, contact and location. Cabinet, switch,
   controller, power, gateway, center and feed assets can exist without a device
   feed. A device can have one architecture profile in its agency.
2. Add directed connections from a supplying asset to its dependent asset. Record
   the physical/information/power layer, medium, source/destination ports,
   protocol, exchanged information and drawing or test reference. Add reverse
   flows separately where relevant; an Ethernet label does not establish routing
   or a bidirectional operational interface.
3. Attach actual JPEG/PNG device, cabinet, terminal, connector and wiring photos.
   Supply an actual capture time and descriptive caption. Associate a photo with
   an asset, or with a connection for which that asset is an endpoint.
4. An operator records documentation after attaching connection evidence or
   supplying an evidence reference. A different supervisor may verify the
   connection using a field-inspection or bench-test basis, observation time and
   note. As-built documentation alone stays documented until that inspection.

The diagram shows nearby declared dependencies, up to 40 assets and 100 edges.
Its colors represent candidate/documented/verified/invalidated evidence. It is
not a live network monitor. The register supports up to 2,000 architecture assets
and 5,000 connections per agency; the existing inventory can be larger, with
profiles established for the equipment being documented. Asset selection and
search connect the diagram to the equipment details.

The ARC-IT physical-object field is an explicitly **proposed** mapping. This
release does not validate entries against an ARC-IT catalog, import RAD-IT/SET-IT
projects or produce certified architecture files. The JSON register export is a
reviewable application record. The older converter now leaves unprovided
protocols, operational modes/ranges and standards-compliance flags unknown;
equipment class alone cannot establish NTCIP, DSRC or other conformance.

## Evidence and installation acceptance

Every connection starts as a candidate. Documentation and verification are
separate, audited records with optimistic version checks. Verification is bound
to endpoints' device linkage, type, manufacturer/model, firmware, protocol,
location and ARC-IT declaration, as well as ports, medium, layer, flow, evidence
reference, documentation identity/time and the attached connection-photo hashes.
Relevant profile changes or additional connection photographs invalidate prior
verification. Editing a connection returns it to candidate state. A supervisor
can revoke verification with a note. Inspector statements remain agency evidence
records; software cannot independently prove the physical wiring.

Architecture verification never enables device control, bypasses installation
acceptance, verifies a commanded display or establishes illuminated pixels.
The separate gateway, commissioning, approval and fresh-readback requirements
still apply. Imported GIS inventory remains read-only.

Original photos are stored as authenticated SQLite BLOBs with SHA256 integrity
checks, original capture time, upload identity/time and caption. HTTP uploads
are authenticated, agency-scoped and idempotent. Only JPEG/PNG files up to 5 MB
are accepted, with decoding/format checks and a 40-megapixel input limit.
Local photo storage is capped at 200 MB per agency. Photos are fetched only when
opened; no public URLs or credentials in query strings are used. Original image
metadata, including any EXIF, remains in the agency attachment. Do not put
credentials in photographs or free-text records.

Uploading a photo leaves it submitted; it does not automatically verify an
installation. No field photographs are fabricated or automatically sourced.
Photo deletion/replacement and general PDF/CAD attachments are outside this
release. Link a revised drawing in the evidence reference and record the new
inspection. SQLite backups include architecture entities, photographs and audit
records; the JSON register export includes photo metadata, not photo bytes.

## Observed and derivable data

A linked device's collection observation supplies actual measurement names,
units, timestamps, quality flags and retained batch lineage. Device state can
also expose its reported controller message and observation provenance. A
reported message is distinct from physical-display confirmation. Asset-class
templates do not imply that a specific controller exposes a field.

The first three calculation recipes are versioned previews:

| Recipe | Required inputs | Method / limits |
| --- | --- | --- |
| Speed reduction | Fresh speed in mph, entered reference speed | `max(0, 1 - speed/reference) × 100`; reference is an assumption |
| Segment travel time | Fresh positive speed, entered segment length | `length/speed × 60`; assumes the point speed represents the entire segment |
| Segment delay | Travel-time inputs plus reference speed | Difference from travel at the entered reference speed, floored at zero |

Every result retains the source observation and batch IDs, observation and
collection times, entered assumptions, unit and recipe version. The screen
labels these estimates as not independently calibrated. Missing measurements,
unknown/stale/future clocks, inventory-only records and other collection quality
flags block calculations. Zero speed blocks division-based travel-time/delay
estimates. Queue length remains unavailable until calibrated spatial observations
are supplied. Calculations do not create incidents, publish feeds or issue signs.

**Collect source readings** uses the existing on-demand collector import. A
training detector demonstrates the recipes using synthetic observations and
refreshes through the simulated agency's source collection. Training assets,
connections, inspection records and attachments remain visibly synthetic. Live
workspaces start without a fabricated topology or connection proof.

## Dependency exploration

**Explore failed connection** evaluates directed dependencies with that link
removed, lists potentially affected downstream assets, identifies upstream data
and available derived outputs using the declared path, and checks for alternate
declared paths. Traversal handles cycles. Candidate links are included and are
explicitly disclosed in the result. It does not assert an actual outage, verify
redundancy, model traffic routing or validate electrical/network engineering.
Actual reachability, protection switching and field behavior require inspection
or separate monitoring integrations.

## Authenticated API

All paths below are under `/api/atms`; existing individual identity and agency
boundaries apply. Asset/connection/review writes use JSON, `X-ATMS-Client:
workspace` and an `Idempotency-Key`.

| Method / path | Purpose |
| --- | --- |
| `GET /architecture` | Asset, connection and photo-metadata register |
| `POST /architecture/assets` | Operator creates/edits a profile, with `version` |
| `POST /architecture/connections` | Operator creates/edits directed connections |
| `POST /architecture/connections/:id/review` | Document, independently verify, or revoke |
| `GET /architecture/assets/:id/capabilities` | Observations, declared protocol and calculation provenance |
| `GET /architecture/connections/:id/impact` | Hypothetical dependency analysis without mutations |
| `POST /architecture/assets/:id/photos` | Operator multipart upload: `photo`, `caption`, `capturedAt`, optional `connectionId` |
| `GET /architecture/photos/:id/content` | Agency-scoped, integrity-checked original photo |

Photo uploads use `multipart/form-data` with the same client header and
idempotency key; no shared state-password identity is accepted. Viewer accounts
can inspect agency records and images; only operators write, and verification
requires the independent supervisor role.

Validation covers role/agency isolation, asset linkage, concurrency, evidence
state transitions/invalidation, photo encoding/integrity/idempotency, SQLite
backup/reopen, derivation gates and lineage, graph cycles/alternate paths,
training/live separation and removal of invented standards-compliance defaults.

## DRU field documentation

The ITS architecture desk accepts Digital ROW Utilities schema-1 `.dru-session`
exports. In DRU, export a session bundle; use the full photo export to retain
full resolution. ATMS preserves the exact uploaded archive and its SHA-256.
Compact DRU exports can contain resized images; ATMS preserves those exported
bytes and does not claim to recover camera originals.

Choose **Add field documentation**, then follow **Choose capture → Match equipment → Review & save**. All features start
skipped. Select features to create architecture assets or attach evidence to
existing profiles. Confirm the asset class suggestion. Existing equipment
settings are preserved; imported geometry, accuracy declarations, ownership,
collection metadata, inspections and QA reviews appear under **Field
documentation**. Photos retain their capture time, EXIF declarations, source
filename and content hash. For an existing asset, optionally associate its
photos with an existing connection. Source geometry is retained verbatim with
its datum/profile declarations; no coordinate transformation or automatic
connection inference occurs.

The import is atomic and audited. Version checks reject changed target profiles;
request keys make retries idempotent. An exact archive can be imported only once
per agency. A revised export can be imported as additional evidence, keeping
prior versions. Saved previews and imported bundles can be reopened from the
importer, and source archives can be downloaded with authenticated agency access.
DRU certification metadata and signature images remain in the original archive;
sign-offs are source declarations, not verified ATMS identities, installation
acceptance or command authorization. Associated connection photos invalidate an
existing verification fingerprint and require review. Unassociated photos do
not assert a connection. No device control or telemetry is created by import.

Limits: 50 MB uploaded ZIP, 100 MB expanded total, 5 MB per entry, 500 features,
500 photo references, 1,100 ZIP entries; 50 retained bundles / 500 MB per agency.
The existing 200 MB agency photograph limit also applies. JSON requests retain
the workspace's 64 KB limit; split unusually large mapping requests into separate
session exports. ZIP64, encrypted/multipart archives, symbolic links, unsafe or
duplicate paths, unexpected files and invalid checksums are rejected. ZIP entries
are read in bounded memory and never extracted to disk. JPEG/PNG photographs
must decode within the existing 40-megapixel limit. Missing referenced files are
explicit preview warnings, matching DRU's best-effort exporter; orphan photos
remain in the source bundle and are not attached. Newer schema versions fail
with an explicit error. Other export formats and automatic mobile sync are not
implemented by this importer.

API (authenticated, agency scoped):

- `GET /api/atms/architecture/dru/bundles` — saved upload summaries.
- `POST /api/atms/architecture/dru/bundles` — multipart `bundle`; operator,
  workspace header and idempotency key required; stages a preview only.
- `GET /api/atms/architecture/dru/bundles/:id` — preview and import result.
- `GET /api/atms/architecture/dru/bundles/:id/content` — original archive,
  integrity checked before download.
- `POST /api/atms/architecture/dru/bundles/:id/import` — JSON `mappings` array:
  each row has `sourceAssetId` and either `name`/`type` for a new profile or
  `assetId`/`version` for an existing profile; optional `connectionId` associates
  that feature's photos with a connection incident to its target asset.

Validation: `node --test tests/atms/dru.test.js` covers source/byte preservation,
agency/role boundaries, retries, version conflicts, rollback, verification
invalidation, malformed and hostile archives, missing photos and the HTTP flow.

### Field documentation interface

The workspace uses the shared PurposeBuilt charcoal/steel ramp and #FF8A3D
brand accent from DRU / BridgeCheck. Status colours remain distinct from brand
accents. The documentation flow is isolated from the topology while open, with
recent captures, eight-record pages, search, lazy authenticated photo previews,
a final selection summary and links to the saved equipment. Missing photos
remain visible as attention items; provenance and source sign-offs are available
in disclosures. Geometry and source metadata are preserved unchanged.

Matching suggestions use prior DRU source asset IDs first, exact equipment names
second, and same-type linked devices within 75 metres only for explicitly
declared WGS84 point captures. Ambiguous matches remain separate suggestions.
No match is selected automatically. Geographic proximity is a convenience for
review, not installation proof. Users confirm equipment and optional connection
associations before saving. Source documentation is displayed as **Needs review**;
this label does not replace the independent connection verification process.

`GET /api/atms/architecture/dru/bundles/:id/photos/:index` provides an
authenticated, agency-scoped preview from the integrity-checked source archive.
Only the requested image is decompressed for a preview; originals are not
resized or replaced. Object URLs are revoked on unmount, images load near the
viewport, and phone layouts use the same review steps.
