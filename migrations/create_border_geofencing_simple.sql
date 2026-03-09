-- Migration: Cross-Border Geofencing Alerts (CCAI UC #17) - Simplified
-- Date: 2026-03-03
-- Works without PostGIS

-- Border proximity configuration table
CREATE TABLE IF NOT EXISTS border_proximity_config (
  id SERIAL PRIMARY KEY,
  distance_threshold_miles INTEGER DEFAULT 50,
  auto_notify_enabled BOOLEAN DEFAULT true,
  notification_severity_threshold VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_severity CHECK (notification_severity_threshold IN ('low', 'medium', 'high'))
);

-- Insert default configuration
INSERT INTO border_proximity_config (distance_threshold_miles, auto_notify_enabled, notification_severity_threshold)
VALUES (50, true, 'medium')
ON CONFLICT DO NOTHING;

-- Border notification log
CREATE TABLE IF NOT EXISTS border_notifications (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  source_state VARCHAR(2) NOT NULL,
  notified_state VARCHAR(2) NOT NULL,
  distance_to_border_miles NUMERIC(10,2),
  notification_type VARCHAR(50) DEFAULT 'auto_geofence',
  notification_sent_at TIMESTAMP DEFAULT NOW(),
  message_id INTEGER,
  event_severity VARCHAR(20),
  event_type VARCHAR(100)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_border_notifications_event ON border_notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_border_notifications_states ON border_notifications(source_state, notified_state);
CREATE INDEX IF NOT EXISTS idx_border_notifications_date ON border_notifications(notification_sent_at DESC);

-- Add comments
COMMENT ON TABLE border_proximity_config IS 'Configuration for automatic border proximity notifications. CCAI UC #17.';
COMMENT ON TABLE border_notifications IS 'Log of all automatic border proximity notifications sent';

-- Completion message
SELECT 'Border Geofencing System Configured (Simplified)' as status;
SELECT 'Distance threshold: 50 miles' as config_1;
SELECT 'Auto-notify enabled: true' as config_2;
SELECT 'Notification logging: Enabled' as config_3;
