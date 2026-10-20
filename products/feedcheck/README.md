# PurposeBuilt FeedCheck

A standalone transportation road-event feed review product. The application is
an approximately 60 KB HTML file with embedded CSS and JavaScript. No database,
AI API, map provider, framework, package installation, or server is required.
The optional Node.js runner reuses the same assessment engine.

## Use and build

Open `dist/feedcheck.html` directly in a desktop browser. For development:

```sh
npm test
npm run build
npm start
```

Preview: `http://127.0.0.1:4317/`. Product-page preview: `/site/`.
`FEEDCHECK_PORT` changes the local preview port. No npm installation is needed.

`node package.cjs` builds two separate deliverables:

- `dist/purposebuilt-feedcheck-local-v0.1.0.zip`: customer application, quickstart,
  and optional CLI/engine. Deliver after purchase or under an agency agreement.
- `dist/purposebuilt-feedcheck-site-v0.1.0.zip`: product page and illustrative
  demo for a `/feedcheck/` directory on the existing PurposeBuilt website.

All generated files are derived from `src/`. Run the build/package scripts after
changing source. The parent Corridor Communicator application is not a runtime
dependency and was not modified.

## Product scope

See `QUICKSTART.txt` and the in-app methodology. Supported checks are selected
operational diagnostics, not full JSON Schema validation or certification.
WZDx-style parsing follows `properties.core_details` for road names, type, and
update time; start/end dates are read from event properties. Both `feed_info`
and the older `road_event_feed_info` metadata names are recognized.
Reference: <https://github.com/usdot-jpo-ode/wzdx/tree/main/schemas/4.2>.

Missing IDs, malformed records, duplicate IDs, date failures, geometry failures,
age flags, and lifecycle review flags retain JSON paths and remediation text.
Unknown envelopes are rejected rather than silently interpreted as an empty
feed. The source is never rewritten. Cross-snapshot matching requires unique
IDs and a consistent source label. Fingerprints are stable, noncryptographic
content hashes; they are change hints, not tamper evidence.

CSV exports include all findings even when the UI is filtered or paginated.
Print renders all findings. Browser JSON reports omit fingerprint entries;
snapshots explicitly include IDs/fingerprints. Exported source URLs omit query
strings, fragments, and credentials. Arbitrary input is escaped in the UI;
spreadsheet formula prefixes are neutralized in CSV.

## PurposeBuilt sales handoff

The product page uses the existing PurposeBuilt contact address for license
inquiries. It does not assert a price, promise support terms, collect payment,
or include a fake checkout. No emails are sent automatically.

The deliverables remain in this repository. The existing marketing repository
and production site have not been changed or deployed.

Suggested first offering: one downloadable Local Edition for internal agency
or consultant use, with a separately priced feed-review/onboarding service.
The technical product requires no subscription. Set an initial price and
license/support terms before publishing a purchase link.

To integrate with `purposebuilt-marketing`, copy only `dist/site/index.html`
and `dist/site/demo.html` into a new `feedcheck/` directory, add a product link,
and use that repository's established deployment workflow. The page's links are
relative and support this path without a build. Existing navigation, pricing,
and other products need not change.

Keep the customer ZIP and `dist/feedcheck.html` outside public hosting if access
is meant to be paid. The sample demo disables custom input in its UI; it is
not DRM or a license enforcement system. This is ordinary downloadable software
and source can be inspected. Payment-link checkout plus private digital-file
delivery can be added when the sales model and processor are selected.

## Validation

`npm test` exercises assessment and comparison behavior, malformed input,
timestamp/calendar validation, safe CSV, source sanitization, CLI outcomes and
overwrite protection, plus standalone build output. The suite uses Node's
built-in test runner. No parent-app dependencies or state databases are used.

Browser QA must cover sample, paste/file input, finding filters, report exports,
print pagination, comparison, CORS failures, offline file opening, and mobile
layout. `test/verification.txt` records checks completed for this build.
