# Validated ATMS feed publishing

The dedicated ATMS now prepares and releases two road-event profiles:

- `wzdx-4.2`: WorkZoneFeed, using pinned USDOT WZDx 4.2 JSON Schemas.
- `cwz-1.0`: WorkZoneFeed, using schemas/1.0 from ITE's published CWZ archive.

These profiles have distinct metadata and geometry requirements. Validation is
against the exact local artifacts recorded in services/atms/standards/manifest.json,
plus the publication checks described below. It is not certification of every
CWZ operational, field-device, institutional, or interoperability requirement.
The device feed, TMDD, DATEX II, and navigation-provider exporters are outside
this implementation. The older Corridor Communicator feed routes are unchanged.

## Console workflow

Open **Feed publishing** in the ATMS console.

1. A supervisor enters the actual publisher, source organization, public contact,
   stable source ID, authorized license URL, and intended refresh interval.
   No agency identity or data license is invented. Training suggestions are
   explicitly synthetic and must still be saved by a supervisor.
2. The incident owner or a supervisor prepares publication details. Explicitly
   classify the record as work-zone, detour, or excluded. Ordinary incidents and
   closures are never silently reclassified as construction. Existing source
   fields can be copied for review; missing fields stay missing.
3. Supply actual observation time, start/expected start, end/expected end, and
   appropriate vehicle impact/location method. Times are stored as UTC. A save
   does not refresh an observation. Optional public description is separately
   authored; internal incident descriptions, notes, usernames, and message
   contents do not appear in the public feature.
4. Review the geometry in Operations. This exporter requires a continuous,
   operator-reviewed LineString for one travel direction. Split disconnected
   carriageways, bidirectional zones, or changing lane configurations into
   separate incident segments. There is no automatic guessed segmentation.
5. Supply optional observations only when known. If lanes are supplied, include
   every lane and confirm consecutive left-to-right ordering in the travel
   direction. Confirm required properties and lane configuration are uniform
   throughout the segment. The application checks completeness/order; it cannot
   establish physical lane configuration remotely.
6. Validate current records and inspect every held-record reason. Download the
   internal validation report if needed. The report groups issues and optional
   payload coverage by source, with a work-zone-only coverage denominator.
7. A supervisor reviews the current preview and releases it with a decision note.
   Reusing a stale preview is rejected. Partial release requires an explicit
   decision; omitted selected records are counted and recorded. Empty releases
   require explicit authorization and a fresh empty-inventory observation in
   publisher settings. An empty document never means every roadway is clear.

All verification booleans default to false. A true position flag requires actual
position-measurement evidence; geometry snapping and operator map review are not
GPS verification. True time flags likewise require confirmation evidence. The
operator supplies evidence references and remains responsible for their truth.
Optional worker presence, restrictions, speed, lane data, and work types are not
fabricated. Missing optional observations are reported, not padded with guesses.

## Publication behavior

A release is a persistent, reviewed snapshot with a SHA-256 digest, approval
identity/time, input revisions, pinned-schema-manifest digest, validation summary,
and expiry. Released payloads are retained as agency-scoped feed-artifact records
for audit/backup even after a newer snapshot replaces the active release.

Serving rechecks artifact integrity/schema, publisher version, included incident
geometry/direction/state, publication-details revisions, source presence,
source-location review, source freshness, and expiry. Invalidated, expired,
withdrawn, or absent releases return HTTP 503 with a JSON error; they never turn
into an apparently successful empty feed. Geometry edits and incident resolution
invalidate an included snapshot immediately. Resolved/closed incidents are
omitted from the next active-event release. This version does not retain ended
features for a one-hour completion-notification window; a consumer that requires
that workflow needs an agreed extension before onboarding.

Snapshots expire at the declared refresh interval (maximum 900 seconds), or
sooner when observation freshness/event end requires it. There is no automatic
release scheduler in this version. Arrange explicit operator releases for a
controlled pilot; continuous unattended feeds require an agency-approved refresh
and observation process. A freshly generated feed header does not refresh its
underlying observation times.

Training feeds carry `x_training: true` and a synthetic-data notice. The loopback
training service cannot enable the anonymous public feed route.

## Endpoints

These routes use existing individual JWT authorization and agency membership:

- `GET /api/atms/feeds/:profile/preview`: current ready/held report and ready-record
  preview; always recomputed, never a published availability claim.
- `POST /api/atms/feeds/settings`: supervisor publisher settings with revision.
- `POST /api/atms/incidents/:id/feed-details`: owned incident draft; supply both
  incidentVersion and the details version (0 for a new draft).
- `POST /api/atms/feeds/:profile/publish`: supervisor release with previewHash,
  decision note, and optional explicit allowPartial/allowEmpty booleans.
- `GET /api/atms/feeds/:profile/release`: release availability and metadata.
- `GET /api/atms/feeds/:profile/geojson`: current validated release, or 503.
- `POST /api/atms/feeds/:profile/withdraw`: supervisor withdrawal with version/note.

Mutations use the standard ATMS JSON client header and idempotency key. Exports
contain no mutation capability and are not transmitted to third parties.

## Optional public consumption

Public access is OFF by default. After agency authorization, TLS deployment,
license review, consumer acceptance, and an operational refresh process, the live
service can explicitly enable a read-only route with:

```
ATMS_PUBLIC_FEED_ENABLED=true
ATMS_AGENCY=YOUR-AGENCY
```

`GET /api/atms/feeds/public/:profile` then serves only that configured agency's
released GeoJSON. Query parameters cannot select another agency. No preview,
internal validation report, incident record, command, or mutation becomes public.
The route allows cross-origin read access, uses no cookies, performs availability
checks on every request, and emits no-store headers plus the artifact digest and
valid-until header. Use an agency TLS reverse proxy and appropriate availability
monitoring/rate limits. Nothing is deployed, exposed beyond the existing bind
address, or registered with USDOT/navigation providers by enabling the software
feature in a local training build.
