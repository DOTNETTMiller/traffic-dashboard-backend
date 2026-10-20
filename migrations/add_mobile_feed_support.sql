-- DRAFT migration — mobile/fast-refresh WZDx feed support (e.g. Field Escort JD Ops).
-- Additive & non-destructive: adds an external_id to plugin_events so a feed that
-- re-publishes the same machine every minute UPDATES its row instead of duplicating.
-- Existing rows get external_id = NULL (distinct in a unique index, so no conflict).
--
-- Works on SQLite (dev) and PostgreSQL (prod) — the db adapter already translates
-- datetime('now')/ON CONFLICT used elsewhere in plugin-service.js.

ALTER TABLE plugin_events ADD COLUMN external_id TEXT;

-- Upsert key: one row per (feed, external WZDx id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_plugin_events_feed_external
  ON plugin_events (feed_id, external_id);

-- (expiry index idx_plugin_events_expires already exists from add_plugin_system.sql)

-- Register with the migration runner per your convention, e.g.:
-- INSERT INTO schema_migrations (version, description, applied_at)
-- VALUES ('0XX_add_mobile_feed_support', 'Mobile WZDx feed upsert support', CURRENT_TIMESTAMP);
