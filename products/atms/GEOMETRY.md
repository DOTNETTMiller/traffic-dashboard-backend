# Road geometry and operator review

The ATMS preserves valid WGS84 Point, LineString, and MultiLineString geometry
from Corridor Communicator, including geometry that its existing DOT/ARNOLD
services have already enriched. Import does not repeat nationwide road queries.
A line without a separate latitude/longitude can now be promoted to an incident;
its beginning coordinate supplies the map anchor. Separate MultiLineString parts
remain separate; the ATMS never draws an invented connector between them.

Geometry must contain finite numeric longitude/latitude, valid coordinate ranges,
and at most 10,000 vertices. Two-point lines remain lines. Invalid geometry cannot
establish road limits; valid standalone source coordinates can still locate the
report as a point. A point cannot be accepted as a closure's affected segment.

## Evidence and changes

Source method, observation time, geometry fingerprint, and any source-reported
beginning/end verification booleans are retained independently of ATMS review.
Known road-network enrichment tags are labeled derived. Source assertions never
become an ATMS operator signature. The geometry statuses are source_reported,
derived, operator_supplied, missing, and operator_reviewed.

The incident inspector shows the geometry source, method, status, and reviewer.
Lines are dashed until operator-reviewed and solid afterward. Selecting an
incident fits the map to its line. Use **Review or update geometry** to:

- Confirm the displayed road, travel direction, and limits, with an evidence note.
- Derive a segment from a server-configured agency road catalog.
- Provide GeoJSON geometry for an operator-established location or road segment.
- Adopt the latest source geometry after comparing it with the retained incident.

Only the incident owner or a supervisor can change geometry. Revision checks,
agency isolation, individual identities, idempotency, and the audit chain apply.
Resolved/closed incidents are locked. Changing geometry clears its prior review.
Operator review is not a claim of physical survey accuracy or feed certification.

Source imports do not silently overwrite incident geometry. If source geometry,
route, or direction changes after review, an alarm calls for comparison and a new
review. Source removal and staleness remain separate conditions. Adoption requires
a present, current source observation. The incident export includes geometry and
its evidence, and the audit records each geometry mutation.

## Agency road catalog

Set these server environment variables, then restart the service:

```
ATMS_ROAD_NETWORK_PATH=/secure-config/agency-corridor-roads.geojson
ATMS_ROAD_NETWORK_SOURCE=Agency GIS dataset URL or identifier, edition/date, attribution
```

The file is a corridor-sized GeoJSON FeatureCollection. Each feature must have a
continuous LineString and these normalized properties:

```json
{
  "type": "Feature",
  "properties": {
    "id": "AGENCY-I80-EB-001",
    "route": "I-80",
    "direction": "eastbound"
  },
  "geometry": {
    "type": "LineString",
    "coordinates": [[-93.63,41.628],[-93.61,41.629],[-93.59,41.633]]
  }
}
```

The sample coordinates illustrate the format; they are not surveyed geometry.
Obtain agency road geometry from an authorized DOT GIS/LRS export or other
licensed source, map its route/direction fields, and preserve dataset attribution.
Direction describes the carriageway, independently of vertex order. Use `both`
only for a dataset segment that actually represents the reported bidirectional
roadway. Divided carriageways should be separate features with their directions.
Split disconnected geometry into independent features with unique IDs.

The catalog is limited to 20 MB, 10,000 features, and 250,000 total vertices.
Invalid or duplicate segments fail startup. It is read locally once; catalog
queries do not make external requests or write to the road dataset.

Lookup requires matching route and direction, and both supplied endpoints within
75 metres of a single continuous feature. The result is clipped along the road
between those endpoints and ordered beginning-to-end. Competing matches within
25 metres of the best combined endpoint distance are rejected. Missing coverage,
wrong direction, gaps, and distant endpoints require better inputs or a corrected
catalog. No arbitrary cross-segment stitching or straight-line fallback is used.
Derived geometry always requires operator review; proximity does not prove that
the correct road, ramp, or work-zone limits were selected.

This implementation accepts coordinate limits. It does not yet resolve arbitrary
state LRS route IDs/mileposts, calibrate measure systems, or guarantee lane-level
accuracy. Those require agency-specific adapters and acceptance testing.

## Training and API

The loopback training service loads a corridor snapshot of Iowa DOT RAMS All Routes
from fixtures/des-moines-road-alignment.geojson by default. The simulator uses
these real reference alignments with explicitly simulated assets and event limits.
The older fixtures/road-network.geojson remains illustrative example data. Live
service mode never selects a training catalog automatically. Operator-provided
catalogs replace the default training catalog.

`GET /api/atms/incidents/:id/geometry` returns the retained geometry/evidence and
latest source observation, even when the source is outside the inbox's page.
`POST` to the same path accepts `version`, `note`, and an `action`:

- `derive`: supply `start` and `end` longitude/latitude arrays.
- `replace`: supply a GeoJSON `geometry` object.
- `adopt_source`: use the server's latest source observation.
- `review`: record the owner's review of the retained geometry.

These outputs support downstream feed exporters; they do not by themselves
establish WZDx/CWZ, TMDD, or other standard conformance.
