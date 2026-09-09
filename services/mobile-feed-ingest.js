// DRAFT — Mobile / fast-refresh WZDx feed ingest.
//
// The existing plugin poller (scheduler-service.js) checks hourly and parses CIFS
// XML. This module adds the missing pieces for a fast, transient WZDx GeoJSON feed
// like Field Escort (John Deere Operations Center mobile work zones):
//   1) sub-hour polling — per-feed timer honoring plugin_data_feeds.refresh_interval
//   2) UPSERT — re-publishing the same machine UPDATES its row (no duplicates)
//   3) expiry cleanup — prune events past expires_at so the table doesn't grow
//
// Inert until wired in. Requires migration add_mobile_feed_support.sql.
// Geometry correction (ARNOLD / iowa-geometry-service) already runs downstream when
// events are served via /api/events — nothing to add here.
//
// Wire-in (e.g. in start.js after the DB + scheduler are ready):
//   const MobileFeedIngest = require('./services/mobile-feed-ingest');
//   new MobileFeedIngest(db).start();
//
// Register a feed (existing API) — set a short refresh_interval for mobile data:
//   POST /api/cifs/feed/subscribe
//   { "feed_url":"https://purposebuiltsystems.github.io/field-escort-feed/feed.json",
//     "feed_type":"work_zone", "state_codes":["IA"], "polling_interval":120 }

const FETCH_TIMEOUT_MS = 20000;
const MIN_INTERVAL_SEC = 60;          // floor on poll cadence
const CLEANUP_EVERY_MS = 10 * 60 * 1000;

class MobileFeedIngest {
  constructor(db) {
    this.db = db;
    this.timers = new Map();
    this.cleanupTimer = null;
  }

  /** Pull a numeric lat/lon from a WZDx feature (LineString uses first vertex). */
  static firstLatLon(feature) {
    const coords = feature?.geometry?.coordinates;
    if (!Array.isArray(coords)) return [null, null];
    const head = Array.isArray(coords[0]) ? coords[0] : coords; // LineString | Point
    if (Array.isArray(head) && head.length >= 2) return [Number(head[1]), Number(head[0])]; // [lat, lon]
    return [null, null];
  }

  /**
   * Upsert one WZDx feature keyed by (feed_id, external_id) so the same machine
   * updates in place. Expires at the feature's end_date.
   */
  async upsertEvent(providerId, feedId, feature, stateCode) {
    const externalId = String(feature?.id ?? '');
    if (!externalId || feature?.type !== 'Feature') return;

    const cd = feature.properties?.core_details || {};
    const [lat, lon] = MobileFeedIngest.firstLatLon(feature);
    const startTime = feature.properties?.start_date || new Date().toISOString();
    const endTime = feature.properties?.end_date || null;

    await this.db.runAsync(
      `INSERT INTO plugin_events
         (provider_id, feed_id, external_id, event_data, event_type, state_code,
          latitude, longitude, start_time, end_time, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(feed_id, external_id) DO UPDATE SET
         event_data = excluded.event_data,
         event_type = excluded.event_type,
         state_code = excluded.state_code,
         latitude   = excluded.latitude,
         longitude  = excluded.longitude,
         start_time = excluded.start_time,
         end_time   = excluded.end_time,
         expires_at = excluded.expires_at`,
      [
        providerId, feedId, externalId,
        JSON.stringify(feature),
        cd.event_type || feature.type || 'work-zone',
        stateCode,
        Number.isFinite(lat) ? lat : null,
        Number.isFinite(lon) ? lon : null,
        startTime, endTime,
        endTime, // expires_at = end_date; re-poll refreshes it
      ]
    );
  }

  /** Fetch one WZDx feed URL and upsert its features. */
  async pollFeed(feed) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(feed.endpoint_url, { signal: ctrl.signal });
      if (!res.ok) {
        console.error(`[mobile-feed] feed ${feed.feed_id} HTTP ${res.status}`);
        return;
      }
      const json = await res.json();
      const features = Array.isArray(json.features) ? json.features : [];
      let state = null;
      try { state = (JSON.parse(feed.state_codes || '[]')[0]) || null; } catch { /* */ }

      for (const f of features) {
        await this.upsertEvent(feed.provider_id, feed.feed_id, f, state);
      }
      await this.db.runAsync(
        `UPDATE plugin_data_feeds SET last_updated = datetime('now') WHERE feed_id = ?`,
        [feed.feed_id]
      );
      console.log(`[mobile-feed] feed ${feed.feed_id}: upserted ${features.length} event(s)`);
    } catch (err) {
      console.error(`[mobile-feed] poll failed feed ${feed.feed_id}:`, err.message);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Delete events past their expiry so the table stays bounded. */
  async cleanupExpired() {
    try {
      const r = await this.db.runAsync(
        `DELETE FROM plugin_events
         WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`
      );
      if (r && r.changes) console.log(`[mobile-feed] pruned ${r.changes} expired event(s)`);
    } catch (err) {
      console.error('[mobile-feed] cleanup failed:', err.message);
    }
  }

  /**
   * Start per-feed timers at each feed's refresh_interval, plus periodic cleanup.
   * Polls only enabled feeds that have an endpoint_url (the pull-based mobile ones).
   */
  async start() {
    const feeds = await this.db.allAsync(
      `SELECT feed_id, provider_id, endpoint_url, refresh_interval, state_codes
         FROM plugin_data_feeds
        WHERE is_enabled = 1 AND endpoint_url IS NOT NULL`
    );
    for (const feed of feeds) {
      const ms = Math.max(MIN_INTERVAL_SEC, feed.refresh_interval || 300) * 1000;
      await this.pollFeed(feed);
      this.timers.set(feed.feed_id, setInterval(() => this.pollFeed(feed), ms));
    }
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), CLEANUP_EVERY_MS);
    console.log(`[mobile-feed] started: polling ${feeds.length} feed(s)`);
  }

  stop() {
    for (const t of this.timers.values()) clearInterval(t);
    this.timers.clear();
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

module.exports = MobileFeedIngest;
