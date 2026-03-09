-- Migration: Connected Vehicle Message Generation (CCAI UC #5)
-- Date: 2026-03-03
-- Description: SAE J2735 TIM message generation for V2X/CV infrastructure

-- Connected Vehicle Messages table
CREATE TABLE IF NOT EXISTS cv_messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(64) NOT NULL UNIQUE,
  message_type VARCHAR(20) DEFAULT 'TIM',
  event_id VARCHAR(255),
  sae_j2735_version VARCHAR(10) DEFAULT '2020',
  message_payload JSONB NOT NULL,
  geographic_region JSONB,
  broadcast_priority INTEGER DEFAULT 5,
  ttl_minutes INTEGER DEFAULT 60,
  target_rsus TEXT[],
  broadcast_status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  broadcast_at TIMESTAMP,
  expires_at TIMESTAMP,
  active BOOLEAN DEFAULT true,
  CONSTRAINT valid_message_type CHECK (message_type IN (
    'TIM', 'BSM', 'RSA', 'SPAT', 'MAP', 'SSM'
  )),
  CONSTRAINT valid_priority CHECK (broadcast_priority BETWEEN 1 AND 10),
  CONSTRAINT valid_broadcast_status CHECK (broadcast_status IN (
    'pending', 'broadcasting', 'expired', 'cancelled'
  ))
);

-- CV Message transmission log
CREATE TABLE IF NOT EXISTS cv_message_transmissions (
  id SERIAL PRIMARY KEY,
  cv_message_id INTEGER REFERENCES cv_messages(id) ON DELETE CASCADE,
  rsu_id VARCHAR(100),
  rsu_location VARCHAR(255),
  transmitted_at TIMESTAMP DEFAULT NOW(),
  transmission_status VARCHAR(20) DEFAULT 'sent',
  vehicles_reached INTEGER,
  acknowledgments_received INTEGER,
  CONSTRAINT valid_transmission_status CHECK (transmission_status IN (
    'sent', 'failed', 'acknowledged', 'retransmitted'
  ))
);

-- RSU (Roadside Unit) inventory
CREATE TABLE IF NOT EXISTS rsu_inventory (
  id SERIAL PRIMARY KEY,
  rsu_id VARCHAR(100) NOT NULL UNIQUE,
  rsu_name VARCHAR(255),
  location VARCHAR(255),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  route VARCHAR(50),
  state VARCHAR(2),
  ip_address VARCHAR(45),
  status VARCHAR(20) DEFAULT 'active',
  firmware_version VARCHAR(50),
  last_heartbeat TIMESTAMP,
  installed_date DATE,
  capabilities TEXT[],
  coverage_radius_meters INTEGER DEFAULT 300,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN (
    'active', 'inactive', 'maintenance', 'offline'
  ))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cv_messages_event ON cv_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_cv_messages_active ON cv_messages(active, expires_at);
CREATE INDEX IF NOT EXISTS idx_cv_messages_created ON cv_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_transmissions_message ON cv_message_transmissions(cv_message_id);
CREATE INDEX IF NOT EXISTS idx_cv_transmissions_rsu ON cv_message_transmissions(rsu_id, transmitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsu_inventory_location ON rsu_inventory(state, route);
CREATE INDEX IF NOT EXISTS idx_rsu_inventory_status ON rsu_inventory(status) WHERE status = 'active';

-- Add comments
COMMENT ON TABLE cv_messages IS 'Connected vehicle messages in SAE J2735 format. CCAI UC #5.';
COMMENT ON TABLE cv_message_transmissions IS 'Log of CV message transmissions to RSUs';
COMMENT ON TABLE rsu_inventory IS 'Roadside Unit inventory for V2X infrastructure';
COMMENT ON COLUMN cv_messages.message_payload IS 'SAE J2735 TIM/BSM message in JSON format';
COMMENT ON COLUMN cv_messages.geographic_region IS 'GeoJSON polygon defining broadcast region';

-- Function to generate TIM message ID
CREATE OR REPLACE FUNCTION generate_tim_id()
RETURNS VARCHAR(64) AS $$
BEGIN
  RETURN 'TIM-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || substring(md5(random()::text), 1, 8);
END;
$$ LANGUAGE plpgsql;

-- Function to convert event to TIM message (SAE J2735)
CREATE OR REPLACE FUNCTION event_to_tim_message(
  p_event_id VARCHAR(255),
  p_event_type VARCHAR(100),
  p_severity VARCHAR(20),
  p_description TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_route VARCHAR(50)
)
RETURNS JSONB AS $$
DECLARE
  v_tim JSONB;
  v_itis_code INTEGER;
  v_priority INTEGER;
BEGIN
  -- Map severity to priority
  v_priority := CASE
    WHEN p_severity = 'high' THEN 9
    WHEN p_severity = 'medium' THEN 5
    ELSE 3
  END;

  -- Map event type to ITIS code (simplified)
  v_itis_code := CASE
    WHEN p_event_type ILIKE '%crash%' THEN 769 -- Accident
    WHEN p_event_type ILIKE '%construction%' THEN 785 -- Road work
    WHEN p_event_type ILIKE '%weather%' THEN 515 -- Weather conditions
    WHEN p_event_type ILIKE '%closure%' THEN 775 -- Road closed
    ELSE 513 -- Generic incident
  END;

  -- Build SAE J2735 TIM message
  v_tim := jsonb_build_object(
    'messageId', generate_tim_id(),
    'messageType', 'TravelerInformation',
    'j2735Version', '2020',
    'packetID', substring(md5(random()::text || clock_timestamp()::text), 1, 16),
    'urlB', null,
    'dataFrames', jsonb_build_array(
      jsonb_build_object(
        'frameType', 'advisory',
        'msgId', jsonb_build_object(
          'roadSignID', jsonb_build_object(
            'position', jsonb_build_object(
              'lat', p_latitude * 10000000, -- Convert to 1/10th microdegree
              'long', p_longitude * 10000000,
              'elevation', 0
            ),
            'viewAngle', '1111111111111111',
            'mutcdCode', 'warning'
          )
        ),
        'startTime', EXTRACT(EPOCH FROM NOW())::INTEGER,
        'durationTime', 3600, -- 1 hour default
        'priority', v_priority,
        'content', jsonb_build_object(
          'advisory', jsonb_build_array(
            jsonb_build_object(
              'item', jsonb_build_object(
                'itis', v_itis_code
              )
            ),
            jsonb_build_object(
              'item', jsonb_build_object(
                'text', LEFT(p_description, 500)
              )
            )
          )
        ),
        'regions', jsonb_build_array(
          jsonb_build_object(
            'name', 'affected-area',
            'regulatorID', 0,
            'segmentID', 0,
            'anchorPosition', jsonb_build_object(
              'lat', p_latitude * 10000000,
              'long', p_longitude * 10000000,
              'elevation', 0
            ),
            'laneWidth', 366, -- 3.66m standard lane
            'directionality', 3, -- Both directions
            'closedPath', false,
            'direction', '0000000000000000',
            'description', jsonb_build_object(
              'path', jsonb_build_object(
                'scale', 0,
                'offset', jsonb_build_object(
                  'xy', jsonb_build_array(
                    jsonb_build_object('node-xy', jsonb_build_array(0, 0))
                  )
                )
              ),
              'geometry', jsonb_build_object(
                'extent', 1, -- 1 = useFor500m
                'laneWidth', 366
              )
            )
          )
        )
      )
    )
  );

  RETURN v_tim;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearby RSUs for event location
CREATE OR REPLACE FUNCTION find_nearby_rsus(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_radius_miles NUMERIC DEFAULT 5
)
RETURNS TABLE(
  rsu_id VARCHAR(100),
  rsu_name VARCHAR(255),
  distance_miles NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.rsu_id,
    r.rsu_name,
    -- Simple distance calculation (approximate)
    ROUND(
      SQRT(
        POWER((r.latitude - p_latitude) * 69, 2) +
        POWER((r.longitude - p_longitude) * 54.6, 2)
      ),
      2
    ) as distance_miles
  FROM rsu_inventory r
  WHERE r.status = 'active'
    AND r.latitude IS NOT NULL
    AND r.longitude IS NOT NULL
    AND SQRT(
      POWER((r.latitude - p_latitude) * 69, 2) +
      POWER((r.longitude - p_longitude) * 54.6, 2)
    ) <= p_radius_miles
  ORDER BY distance_miles ASC;
END;
$$ LANGUAGE plpgsql;

-- Insert sample RSUs (based on existing ITS equipment if available)
INSERT INTO rsu_inventory (
  rsu_id,
  rsu_name,
  location,
  latitude,
  longitude,
  route,
  state,
  status,
  capabilities,
  coverage_radius_meters
) VALUES
('RSU-IA-I35-001', 'I-35 Exit 87 NB', 'I-35 Mile Marker 87 Northbound', 41.5868, -93.6250, 'I-35', 'IA', 'active',
 ARRAY['TIM', 'BSM', 'RSA'], 300),

('RSU-IA-I35-002', 'I-35 Exit 87 SB', 'I-35 Mile Marker 87 Southbound', 41.5868, -93.6250, 'I-35', 'IA', 'active',
 ARRAY['TIM', 'BSM', 'RSA'], 300),

('RSU-IA-I80-001', 'I-80 Exit 137', 'I-80 Mile Marker 137', 41.5912, -93.6037, 'I-80', 'IA', 'active',
 ARRAY['TIM', 'BSM'], 300),

('RSU-MN-I35-001', 'I-35 Twin Cities Metro', 'I-35W Minneapolis', 44.9778, -93.2650, 'I-35', 'MN', 'active',
 ARRAY['TIM', 'BSM', 'SPAT', 'MAP'], 300),

('RSU-TX-I35-001', 'I-35 Austin Metro', 'I-35 Austin', 30.2672, -97.7431, 'I-35', 'TX', 'active',
 ARRAY['TIM', 'BSM'], 300)
ON CONFLICT (rsu_id) DO NOTHING;

-- Trigger to auto-expire old messages
CREATE OR REPLACE FUNCTION expire_old_cv_messages()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cv_messages
  SET active = false,
      broadcast_status = 'expired'
  WHERE expires_at < NOW()
    AND active = true;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON cv_messages TO PUBLIC;
GRANT SELECT, INSERT ON cv_message_transmissions TO PUBLIC;
GRANT SELECT ON rsu_inventory TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_rsu_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_rsu_count FROM rsu_inventory WHERE status = 'active';

  RAISE NOTICE 'Connected Vehicle System Configured:';
  RAISE NOTICE '- SAE J2735 TIM message generation enabled';
  RAISE NOTICE '- % active RSUs configured', v_rsu_count;
  RAISE NOTICE '- Event-to-TIM conversion ready';
  RAISE NOTICE '- V2X broadcast infrastructure ready';
  RAISE NOTICE '- Geographic region calculation enabled';
END $$;
