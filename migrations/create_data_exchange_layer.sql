-- Migration: Minimum Interstate Data Exchange Layer (CCAI UC #12)
-- Date: 2026-03-03
-- Description: Standardized API for interoperable operational data exchange

-- Data Exchange Endpoints Registry
CREATE TABLE IF NOT EXISTS data_exchange_endpoints (
  id SERIAL PRIMARY KEY,
  endpoint_id VARCHAR(100) NOT NULL UNIQUE,
  state VARCHAR(2) NOT NULL,
  endpoint_type VARCHAR(50) NOT NULL, -- 'incidents', 'work-zones', 'weather', 'lanes', 'cameras', 'parking'
  api_url VARCHAR(500) NOT NULL,
  api_version VARCHAR(20) DEFAULT 'v1',
  data_format VARCHAR(20) DEFAULT 'json', -- 'json', 'xml', 'geojson'
  authentication_type VARCHAR(50), -- 'api-key', 'oauth2', 'mutual-tls', 'none'
  authentication_endpoint VARCHAR(500),
  status VARCHAR(20) DEFAULT 'active',
  uptime_percentage NUMERIC(5,2),
  avg_response_time_ms INTEGER,
  last_health_check TIMESTAMP,
  data_update_frequency_minutes INTEGER,
  coverage_area TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_endpoint_type CHECK (endpoint_type IN (
    'incidents', 'work-zones', 'weather', 'lane-closures',
    'cameras', 'parking', 'travel-times', 'dms-messages'
  )),
  CONSTRAINT valid_status CHECK (status IN ('active', 'degraded', 'offline', 'maintenance'))
);

-- Data Exchange Subscriptions (State-to-State)
CREATE TABLE IF NOT EXISTS data_exchange_subscriptions (
  id SERIAL PRIMARY KEY,
  subscriber_state VARCHAR(2) NOT NULL,
  provider_state VARCHAR(2) NOT NULL,
  endpoint_id VARCHAR(100) REFERENCES data_exchange_endpoints(endpoint_id) ON DELETE CASCADE,
  data_type VARCHAR(50) NOT NULL,
  subscription_status VARCHAR(20) DEFAULT 'active',
  polling_interval_seconds INTEGER DEFAULT 300,
  last_sync TIMESTAMP,
  total_records_received INTEGER DEFAULT 0,
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  subscribed_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_subscription_status CHECK (subscription_status IN ('active', 'paused', 'error', 'cancelled'))
);

-- Data Exchange Transactions Log
CREATE TABLE IF NOT EXISTS data_exchange_transactions (
  id SERIAL PRIMARY KEY,
  transaction_id VARCHAR(100) NOT NULL UNIQUE,
  endpoint_id VARCHAR(100),
  requesting_state VARCHAR(2),
  providing_state VARCHAR(2),
  data_type VARCHAR(50),
  request_timestamp TIMESTAMP DEFAULT NOW(),
  response_timestamp TIMESTAMP,
  response_time_ms INTEGER,
  http_status INTEGER,
  records_returned INTEGER,
  data_size_kb NUMERIC(10,2),
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Data Exchange Quality Metrics
CREATE TABLE IF NOT EXISTS data_exchange_quality_metrics (
  id SERIAL PRIMARY KEY,
  endpoint_id VARCHAR(100) REFERENCES data_exchange_endpoints(endpoint_id) ON DELETE CASCADE,
  metric_date DATE DEFAULT CURRENT_DATE,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  max_response_time_ms INTEGER,
  uptime_percentage NUMERIC(5,2),
  total_data_transferred_mb NUMERIC(10,2),
  unique_consumers INTEGER,
  UNIQUE(endpoint_id, metric_date)
);

-- Data Schema Mappings (for interoperability)
CREATE TABLE IF NOT EXISTS data_schema_mappings (
  id SERIAL PRIMARY KEY,
  schema_name VARCHAR(100) NOT NULL UNIQUE,
  data_type VARCHAR(50) NOT NULL,
  version VARCHAR(20) DEFAULT '1.0',
  schema_definition JSONB NOT NULL,
  example_payload JSONB,
  field_descriptions JSONB,
  is_standard BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exchange_endpoints_state ON data_exchange_endpoints(state, endpoint_type);
CREATE INDEX IF NOT EXISTS idx_exchange_endpoints_type ON data_exchange_endpoints(endpoint_type, status);
CREATE INDEX IF NOT EXISTS idx_exchange_subs_subscriber ON data_exchange_subscriptions(subscriber_state, subscription_status);
CREATE INDEX IF NOT EXISTS idx_exchange_subs_provider ON data_exchange_subscriptions(provider_state, data_type);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_time ON data_exchange_transactions(request_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_transactions_endpoint ON data_exchange_transactions(endpoint_id, success);
CREATE INDEX IF NOT EXISTS idx_exchange_quality_date ON data_exchange_quality_metrics(metric_date DESC);

-- Comments
COMMENT ON TABLE data_exchange_endpoints IS 'Registry of interstate data exchange API endpoints. CCAI UC #12.';
COMMENT ON TABLE data_exchange_subscriptions IS 'State-to-state data subscriptions and sync status';
COMMENT ON TABLE data_exchange_transactions IS 'Audit log of all data exchange transactions';
COMMENT ON TABLE data_exchange_quality_metrics IS 'Daily quality metrics for data exchange endpoints';
COMMENT ON TABLE data_schema_mappings IS 'Standardized data schema definitions for interoperability';

-- Function to calculate endpoint uptime
CREATE OR REPLACE FUNCTION calculate_endpoint_uptime(
  p_endpoint_id VARCHAR(100),
  p_days INTEGER DEFAULT 7
)
RETURNS NUMERIC AS $$
DECLARE
  v_uptime NUMERIC;
BEGIN
  SELECT
    ROUND(
      (SUM(CASE WHEN success THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)::NUMERIC) * 100,
      2
    ) INTO v_uptime
  FROM data_exchange_transactions
  WHERE endpoint_id = p_endpoint_id
    AND request_timestamp >= NOW() - (p_days || ' days')::INTERVAL;

  RETURN COALESCE(v_uptime, 100.0);
END;
$$ LANGUAGE plpgsql;

-- Function to get endpoint health status
CREATE OR REPLACE FUNCTION get_endpoint_health(
  p_endpoint_id VARCHAR(100)
)
RETURNS TABLE(
  endpoint_id VARCHAR(100),
  status VARCHAR(20),
  uptime_pct NUMERIC,
  avg_response_ms INTEGER,
  last_success TIMESTAMP,
  error_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.endpoint_id,
    e.status,
    calculate_endpoint_uptime(e.endpoint_id, 1) as uptime_pct,
    e.avg_response_time_ms,
    (
      SELECT MAX(request_timestamp)
      FROM data_exchange_transactions
      WHERE endpoint_id = e.endpoint_id AND success = true
    ) as last_success,
    ROUND(
      (
        SELECT (COUNT(*) FILTER (WHERE NOT success)::NUMERIC / COUNT(*)::NUMERIC) * 100
        FROM data_exchange_transactions
        WHERE endpoint_id = e.endpoint_id
          AND request_timestamp >= NOW() - INTERVAL '1 day'
      ),
      2
    ) as error_rate
  FROM data_exchange_endpoints e
  WHERE e.endpoint_id = p_endpoint_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log data exchange transaction
CREATE OR REPLACE FUNCTION log_data_exchange(
  p_endpoint_id VARCHAR(100),
  p_requesting_state VARCHAR(2),
  p_providing_state VARCHAR(2),
  p_data_type VARCHAR(50),
  p_response_time_ms INTEGER,
  p_http_status INTEGER,
  p_records INTEGER,
  p_success BOOLEAN
)
RETURNS VARCHAR(100) AS $$
DECLARE
  v_transaction_id VARCHAR(100);
BEGIN
  v_transaction_id := 'TXN-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || substring(md5(random()::text), 1, 8);

  INSERT INTO data_exchange_transactions (
    transaction_id,
    endpoint_id,
    requesting_state,
    providing_state,
    data_type,
    response_timestamp,
    response_time_ms,
    http_status,
    records_returned,
    success
  ) VALUES (
    v_transaction_id,
    p_endpoint_id,
    p_requesting_state,
    p_providing_state,
    p_data_type,
    NOW(),
    p_response_time_ms,
    p_http_status,
    p_records,
    p_success
  );

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Insert standard data schemas
INSERT INTO data_schema_mappings (schema_name, data_type, version, is_standard, schema_definition, field_descriptions) VALUES
('ccai-incident-v1', 'incidents', '1.0', true,
 '{
   "id": "string",
   "type": "string",
   "severity": "string",
   "location": "string",
   "latitude": "number",
   "longitude": "number",
   "route": "string",
   "direction": "string",
   "description": "string",
   "startTime": "timestamp",
   "estimatedDuration": "number",
   "lanesAffected": "array"
 }'::jsonb,
 '{
   "id": "Unique incident identifier",
   "severity": "Classification: low, medium, high",
   "lanesAffected": "Array of affected lane numbers"
 }'::jsonb),

('ccai-work-zone-v1', 'work-zones', '1.0', true,
 '{
   "id": "string",
   "projectName": "string",
   "location": "string",
   "route": "string",
   "startDate": "date",
   "endDate": "date",
   "restrictions": "object",
   "impactLevel": "string"
 }'::jsonb,
 '{
   "impactLevel": "Expected impact: low, medium, high, severe",
   "restrictions": "Lane closures, speed limits, detours"
 }'::jsonb),

('ccai-weather-v1', 'weather', '1.0', true,
 '{
   "id": "string",
   "weatherType": "string",
   "severity": "string",
   "roadCondition": "string",
   "visibility": "number",
   "affectedRoutes": "array",
   "startTime": "timestamp",
   "endTime": "timestamp"
 }'::jsonb,
 '{
   "weatherType": "snow, ice, fog, wind, flooding",
   "roadCondition": "clear, wet, icy, snow-covered, impassable"
 }'::jsonb),

('ccai-lane-closure-v1', 'lane-closures', '1.0', true,
 '{
   "id": "string",
   "route": "string",
   "direction": "string",
   "lanesTotal": "number",
   "lanesClosed": "array",
   "closureType": "string",
   "startTime": "timestamp",
   "duration": "number",
   "reason": "string"
 }'::jsonb,
 '{
   "closureType": "planned, emergency, incident-related",
   "lanesClosed": "Array of lane numbers (1=left, 2=center, etc)"
 }'::jsonb)
ON CONFLICT (schema_name) DO NOTHING;

-- Insert sample data exchange endpoints
INSERT INTO data_exchange_endpoints (
  endpoint_id, state, endpoint_type, api_url, status,
  data_update_frequency_minutes, coverage_area
) VALUES
('EP-IA-INCIDENTS', 'IA', 'incidents', 'https://api.iowadot.gov/v1/incidents', 'active', 2, 'Statewide'),
('EP-IA-WORKZONES', 'IA', 'work-zones', 'https://api.iowadot.gov/v1/work-zones', 'active', 60, 'Statewide'),
('EP-IA-WEATHER', 'IA', 'weather', 'https://api.iowadot.gov/v1/weather', 'active', 5, 'Statewide'),
('EP-IA-CAMERAS', 'IA', 'cameras', 'https://api.iowadot.gov/v1/cameras', 'active', 0, 'I-35, I-80 corridors'),

('EP-MN-INCIDENTS', 'MN', 'incidents', 'https://api.dot.state.mn.us/v1/incidents', 'active', 2, 'Statewide'),
('EP-MN-WORKZONES', 'MN', 'work-zones', 'https://api.dot.state.mn.us/v1/work-zones', 'active', 60, 'Statewide'),
('EP-MN-LANES', 'MN', 'lane-closures', 'https://api.dot.state.mn.us/v1/lanes', 'active', 5, 'Metro area'),

('EP-TX-INCIDENTS', 'TX', 'incidents', 'https://api.txdot.gov/v1/incidents', 'active', 2, 'Statewide'),
('EP-TX-PARKING', 'TX', 'parking', 'https://api.txdot.gov/v1/truck-parking', 'active', 10, 'I-35 corridor'),

('EP-MO-INCIDENTS', 'MO', 'incidents', 'https://api.modot.org/v1/incidents', 'active', 3, 'Statewide')
ON CONFLICT (endpoint_id) DO NOTHING;

-- Insert sample subscriptions
INSERT INTO data_exchange_subscriptions (
  subscriber_state, provider_state, endpoint_id, data_type, subscription_status, polling_interval_seconds
) VALUES
('IA', 'MN', 'EP-MN-INCIDENTS', 'incidents', 'active', 120),
('IA', 'MO', 'EP-MO-INCIDENTS', 'incidents', 'active', 180),
('MN', 'IA', 'EP-IA-INCIDENTS', 'incidents', 'active', 120),
('MN', 'IA', 'EP-IA-WORKZONES', 'work-zones', 'active', 600),
('TX', 'IA', 'EP-IA-INCIDENTS', 'incidents', 'active', 300)
ON CONFLICT DO NOTHING;

-- Insert sample transaction history
INSERT INTO data_exchange_transactions (
  transaction_id, endpoint_id, requesting_state, providing_state,
  data_type, request_timestamp, response_timestamp, response_time_ms,
  http_status, records_returned, success
) VALUES
('TXN-20260303-001', 'EP-MN-INCIDENTS', 'IA', 'MN', 'incidents', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes', 245, 200, 12, true),
('TXN-20260303-002', 'EP-IA-INCIDENTS', 'MN', 'IA', 'incidents', NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '8 minutes', 198, 200, 8, true),
('TXN-20260303-003', 'EP-MO-INCIDENTS', 'IA', 'MO', 'incidents', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes', 312, 200, 15, true),
('TXN-20260303-004', 'EP-IA-WORKZONES', 'MN', 'IA', 'work-zones', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes', 567, 200, 23, true)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT ON data_exchange_endpoints TO PUBLIC;
GRANT SELECT ON data_exchange_subscriptions TO PUBLIC;
GRANT SELECT, INSERT ON data_exchange_transactions TO PUBLIC;
GRANT SELECT ON data_exchange_quality_metrics TO PUBLIC;
GRANT SELECT ON data_schema_mappings TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_endpoint_count INTEGER;
  v_subscription_count INTEGER;
  v_schema_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_endpoint_count FROM data_exchange_endpoints WHERE status = 'active';
  SELECT COUNT(*) INTO v_subscription_count FROM data_exchange_subscriptions WHERE subscription_status = 'active';
  SELECT COUNT(*) INTO v_schema_count FROM data_schema_mappings WHERE is_standard = true;

  RAISE NOTICE 'Interstate Data Exchange Layer Configured:';
  RAISE NOTICE '- % active data exchange endpoints', v_endpoint_count;
  RAISE NOTICE '- % active state subscriptions', v_subscription_count;
  RAISE NOTICE '- % standardized data schemas', v_schema_count;
  RAISE NOTICE '- Transaction logging enabled';
  RAISE NOTICE '- Quality metrics tracking enabled';
  RAISE NOTICE '- Interoperable data exchange ready';
END $$;
