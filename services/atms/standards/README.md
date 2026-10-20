# Pinned feed schemas

These files are unmodified third-party JSON Schemas used for offline validation.
Their original `$id` URLs remain intact; the runtime resolves those URLs from
locally registered schemas, without network access.

- WZDx 4.2: USDOT JPO ODE, commit
  `be5a8001b03c057bd84cb326fd0a452a7047aec2`, schemas/4.2. Upstream LICENSE included.
- CWZ 1.0 schema files: ITE's publicly linked `cwz_schemas.zip`, schemas/1.0,
  retrieved 2026-10-18. These are the archive's schema artifacts, not a claim
  that the application implements every requirement of the CWZ standard.
- GeoJSON LineString, MultiPoint, and Point: geojson.org published JSON Schemas,
  retrieved 2026-10-18, pinned by content digest.

`manifest.json` records source URLs and SHA-256 digests for every vendored file
and the downloaded ITE archive. Compilation verifies the digests of all schemas
used by the selected profile. Missing or altered files fail validation startup.
Updates require deliberate review, replacement of the artifact and manifest,
and regression tests. No runtime schema download or automatic version upgrade
is performed. The release record retains the schema-manifest digest.

Upstream sources:
https://github.com/usdot-jpo-ode/wzdx/tree/be5a8001b03c057bd84cb326fd0a452a7047aec2/schemas/4.2
https://www.ite.org/technical-resources/standards/cwz/
https://www.ite.org/ITEORG/assets/File/cwz_schemas.zip
https://geojson.org/schema/
