-- Migration: Traveler Information API (CCAI UC #4)
-- Date: 2026-03-03
-- Description: Public-facing API for mobile apps and third-party integrations

-- API Keys table for authentication
CREATE TABLE IF NOT EXISTS traveler_api_keys (
  id SERIAL PRIMARY KEY,
  api_key VARCHAR(64) NOT NULL UNIQUE,
  api_secret VARCHAR(128),
  application_name VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  contact_email VARCHAR(255),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 100,
  rate_limit_per_day INTEGER DEFAULT 10000,
  allowed_origins TEXT[],
  allowed_ips TEXT[],
  scopes TEXT[] DEFAULT ARRAY['read:events', 'read:corridors'],
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  usage_count INTEGER DEFAULT 0
);

-- API usage log
CREATE TABLE IF NOT EXISTS traveler_api_usage (
  id SERIAL PRIMARY KEY,
  api_key_id INTEGER REFERENCES traveler_api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_ip VARCHAR(45),
  user_agent TEXT,
  query_params JSONB,
  response_status INTEGER,
  response_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- API rate limiting counters
CREATE TABLE IF NOT EXISTS traveler_api_rate_limits (
  id SERIAL PRIMARY KEY,
  api_key_id INTEGER REFERENCES traveler_api_keys(id) ON DELETE CASCADE,
  window_start TIMESTAMP NOT NULL,
  window_type VARCHAR(20) NOT NULL, -- 'minute' or 'day'
  request_count INTEGER DEFAULT 1,
  UNIQUE(api_key_id, window_start, window_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON traveler_api_keys(api_key) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON traveler_api_usage(api_key_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON traveler_api_usage(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON traveler_api_rate_limits(api_key_id, window_start, window_type);

-- Add comments
COMMENT ON TABLE traveler_api_keys IS 'API keys for public traveler information API. CCAI UC #4.';
COMMENT ON TABLE traveler_api_usage IS 'API usage logging for analytics and monitoring';
COMMENT ON TABLE traveler_api_rate_limits IS 'Rate limiting counters for API throttling';

-- Function to generate API key (simple random string)
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text);
END;
$$ LANGUAGE plpgsql;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_api_key_id INTEGER,
  p_window_type VARCHAR(20)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
  v_window_start TIMESTAMP;
BEGIN
  -- Get the rate limit for this key
  SELECT
    CASE
      WHEN p_window_type = 'minute' THEN rate_limit_per_minute
      ELSE rate_limit_per_day
    END INTO v_limit
  FROM traveler_api_keys
  WHERE id = p_api_key_id;

  -- Calculate window start
  IF p_window_type = 'minute' THEN
    v_window_start := DATE_TRUNC('minute', NOW());
  ELSE
    v_window_start := DATE_TRUNC('day', NOW());
  END IF;

  -- Get current count for this window
  SELECT COALESCE(request_count, 0) INTO v_count
  FROM traveler_api_rate_limits
  WHERE api_key_id = p_api_key_id
    AND window_start = v_window_start
    AND window_type = p_window_type;

  -- Check if under limit
  RETURN v_count < v_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment rate limit counter
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_api_key_id INTEGER,
  p_window_type VARCHAR(20)
)
RETURNS VOID AS $$
DECLARE
  v_window_start TIMESTAMP;
BEGIN
  -- Calculate window start
  IF p_window_type = 'minute' THEN
    v_window_start := DATE_TRUNC('minute', NOW());
  ELSE
    v_window_start := DATE_TRUNC('day', NOW());
  END IF;

  -- Upsert counter
  INSERT INTO traveler_api_rate_limits (api_key_id, window_start, window_type, request_count)
  VALUES (p_api_key_id, v_window_start, p_window_type, 1)
  ON CONFLICT (api_key_id, window_start, window_type)
  DO UPDATE SET request_count = traveler_api_rate_limits.request_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Insert sample API keys for testing
INSERT INTO traveler_api_keys (
  api_key,
  application_name,
  organization,
  contact_email,
  description,
  rate_limit_per_minute,
  rate_limit_per_day,
  scopes
) VALUES
(generate_api_key(), 'DOT Mobile App', 'State DOT', 'dev@example.com',
 'Official state DOT mobile application', 1000, 100000,
 ARRAY['read:events', 'read:corridors', 'read:parking', 'read:construction']),

(generate_api_key(), 'Third-Party Navigation App', 'Navigation Inc', 'api@navigation.com',
 'Commercial navigation application', 100, 10000,
 ARRAY['read:events', 'read:corridors']),

(generate_api_key(), 'Research Project', 'State University', 'research@university.edu',
 'Academic research on traffic patterns', 60, 5000,
 ARRAY['read:events', 'read:corridors'])
ON CONFLICT DO NOTHING;

-- Create view for active API keys summary
CREATE OR REPLACE VIEW traveler_api_keys_summary AS
SELECT
  id,
  api_key,
  application_name,
  organization,
  is_active,
  rate_limit_per_minute,
  rate_limit_per_day,
  usage_count,
  last_used_at,
  created_at,
  expires_at
FROM traveler_api_keys
ORDER BY created_at DESC;

-- Cleanup old rate limit records (keep last 2 days)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM traveler_api_rate_limits
  WHERE window_start < NOW() - INTERVAL '2 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old API usage logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM traveler_api_usage
  WHERE timestamp < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON traveler_api_keys TO PUBLIC;
GRANT SELECT, INSERT ON traveler_api_usage TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_key_count INTEGER;
  v_sample_key TEXT;
BEGIN
  SELECT COUNT(*) INTO v_key_count FROM traveler_api_keys;
  SELECT api_key INTO v_sample_key FROM traveler_api_keys LIMIT 1;

  RAISE NOTICE 'Traveler Information API Configured:';
  RAISE NOTICE '- % API keys created', v_key_count;
  RAISE NOTICE '- Rate limiting: 100 req/min, 10000 req/day (default)';
  RAISE NOTICE '- Usage logging enabled';
  RAISE NOTICE '- Sample API key: %...', LEFT(v_sample_key, 16);
  RAISE NOTICE '- Ready for public traveler information access';
END $$;
