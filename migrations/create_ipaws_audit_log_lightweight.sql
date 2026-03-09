-- IPAWS Alert Audit Log (LIGHTWEIGHT VERSION)
-- Per SOP Section 11: Only essential compliance fields
-- 90% smaller than full schema

CREATE TABLE IF NOT EXISTS ipaws_alert_log_lite (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- Required by SOP Section 11
  alert_id TEXT NOT NULL UNIQUE,        -- Alert identifier
  user_id TEXT NOT NULL,                -- Who activated it
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- When

  -- Alert content (store as JSON for flexibility)
  alert_data TEXT NOT NULL,             -- JSON: { headline, instruction, event details }

  -- Geofence (store as JSON)
  geofence_data TEXT,                   -- JSON: { polygon, buffer, population }

  -- Channels used
  channels TEXT DEFAULT 'WEA',          -- Comma-separated: WEA, EAS, Public

  -- Lifecycle
  status TEXT DEFAULT 'draft',          -- draft, issued, cancelled, expired
  issued_at DATETIME,
  cancelled_at DATETIME,
  cancellation_reason TEXT,

  -- Duration (SOP Section 10)
  duration_minutes INTEGER,             -- Alert duration

  -- Compliance
  sop_version TEXT DEFAULT '2024-v1'
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_ipaws_lite_alert_id ON ipaws_alert_log_lite(alert_id);
CREATE INDEX IF NOT EXISTS idx_ipaws_lite_status ON ipaws_alert_log_lite(status);
CREATE INDEX IF NOT EXISTS idx_ipaws_lite_created ON ipaws_alert_log_lite(created_at);

-- View for active alerts
CREATE VIEW IF NOT EXISTS ipaws_active_alerts_lite AS
SELECT
  alert_id,
  user_id,
  json_extract(alert_data, '$.corridor') as corridor,
  json_extract(alert_data, '$.location') as location,
  json_extract(geofence_data, '$.population') as population,
  status,
  issued_at,
  created_at
FROM ipaws_alert_log_lite
WHERE status = 'issued'
  AND (cancelled_at IS NULL OR cancelled_at > datetime('now', '-4 hours'))
ORDER BY created_at DESC;

-- Compliance report (simplified)
CREATE VIEW IF NOT EXISTS ipaws_compliance_lite AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_alerts,
  SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) as issued,
  SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
  AVG(duration_minutes) as avg_duration_min
FROM ipaws_alert_log_lite
GROUP BY DATE(created_at)
ORDER BY date DESC;
