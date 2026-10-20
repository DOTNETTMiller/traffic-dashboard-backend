# Mobile WZDx Feed Integration (Field Escort / JD Ops)

How to ingest a fast-refresh, transient mobile work-zone feed (e.g. Field Escort,
which projects John Deere Operations Center equipment into WZDx work zones) into the
Corridor Communicator, so it gets ARNOLD/Iowa geometry correction + CIFS/WZDx
distribution like any other source.

## What was added (all additive / inert until activated)
| File | Purpose |
|------|---------|
| `migrations/add_mobile_feed_support.sql` | Adds `plugin_events.external_id` + unique index `(feed_id, external_id)` → enables UPSERT so a feed re-publishing the same machine updates its row instead of duplicating. |
| `services/mobile-feed-ingest.js` | Polls each enabled feed at its `refresh_interval` (sub-hour, unlike the hourly CIFS poller), parses WZDx GeoJSON, UPSERTs events, and prunes expired ones. |
| Wire-in in `backend_proxy_server.js` `initScheduler()` | Starts the module. Wrapped in try/catch; only polls feeds with an `endpoint_url` (none until one is registered). |

Geometry correction (`arnold-geometry-service` / `iowa-geometry-service`) already
runs downstream when events are served via `/api/events` — nothing to add there.

## Why these were needed
The existing plugin poller targets static state feeds: it checks hourly, parses CIFS
XML, and INSERTs (no dedup). A mobile feed refreshing every 1–15 min needs:
1. **Sub-hour polling** — per-feed timer at `refresh_interval`.
2. **Upsert** — same machine id updates in place, no duplicate rows.
3. **Expiry cleanup** — prune events past `end_date` so the table stays bounded.

## Activation (test on a copy/staging first — this is a live platform)
1. **Run the migration** `migrations/add_mobile_feed_support.sql`.
   - Verify on PostgreSQL that `ALTER TABLE ADD COLUMN` + the unique index apply.
   - Existing rows have `external_id = NULL` (NULLs are distinct in a unique index → no conflict).
2. **Apply the wire-in** in `backend_proxy_server.js`:
   - Add `let mobileFeedIngest = null;` beside `let schedulerService = null;`
   - In `initScheduler()`, after `schedulerService.start();`, add:
     ```js
     try {
       const MobileFeedIngest = require('./services/mobile-feed-ingest');
       mobileFeedIngest = new MobileFeedIngest(db);
       mobileFeedIngest.start();
     } catch (err) {
       console.error('Mobile feed ingest failed to start:', err.message);
     }
     ```
3. **Deploy.** Still inert — no feeds have an `endpoint_url` yet.
4. **Register the feed:**
   ```
   POST /api/cifs/feed/subscribe
   { "feed_url":"https://purposebuiltsystems.github.io/field-escort-feed/feed.json",
     "feed_type":"work_zone", "state_codes":["IA"], "polling_interval":120 }
   ```
5. **Confirm** in logs: `[mobile-feed] feed N: upserted X event(s)`, then check
   `/api/events?state=iowa` for the events (geometry-corrected).

## Verify before trusting in prod
- `db.runAsync` / `db.allAsync` exist on the global `db` (they do for `PluginService`,
  given the same handle) — confirm a query runs on staging.
- WZDx feature `id` is stable per machine (it is: `jdops-<machineId>`) so upsert keys correctly.
- `expires_at` is set from the feature's `end_date`; tune the feed's zone window if
  you want stale machines to drop faster.

## Rollback
Remove the wire-in (or set the feed `is_enabled = 0`). The migration is additive and
harmless to leave in place. To fully revert: drop index `idx_plugin_events_feed_external`
and column `external_id`.
