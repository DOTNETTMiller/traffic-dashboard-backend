-- Migration: Cross-State CCTV Sharing (CCAI UC #3)
-- Date: 2026-03-03
-- Description: Camera inventory and cross-state access control for situational awareness

-- CCTV Camera Inventory
CREATE TABLE IF NOT EXISTS cctv_cameras (
  id SERIAL PRIMARY KEY,
  camera_id VARCHAR(100) NOT NULL UNIQUE,
  camera_name VARCHAR(255) NOT NULL,
  owner_state VARCHAR(2) NOT NULL,
  location VARCHAR(255),
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  route VARCHAR(50),
  mile_marker NUMERIC(10,2),
  direction VARCHAR(20), -- 'northbound', 'southbound', 'eastbound', 'westbound'
  stream_url VARCHAR(500),
  snapshot_url VARCHAR(500),
  camera_type VARCHAR(50), -- 'fixed', 'ptz', 'thermal'
  status VARCHAR(20) DEFAULT 'active',
  is_public BOOLEAN DEFAULT false,
  shared_with_states TEXT[], -- States that have access
  capabilities TEXT[], -- 'pan', 'tilt', 'zoom', 'infrared', 'hd'
  last_health_check TIMESTAMP,
  installed_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('active', 'offline', 'maintenance', 'decommissioned'))
);

-- CCTV Access Permissions (Cross-State)
CREATE TABLE IF NOT EXISTS cctv_access_permissions (
  id SERIAL PRIMARY KEY,
  camera_id VARCHAR(100) REFERENCES cctv_cameras(camera_id) ON DELETE CASCADE,
  requesting_state VARCHAR(2) NOT NULL,
  access_level VARCHAR(20) DEFAULT 'read-only',
  granted_by VARCHAR(255),
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  access_reason TEXT,
  is_active BOOLEAN DEFAULT true,
  last_accessed TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  CONSTRAINT valid_access_level CHECK (access_level IN ('read-only', 'ptz-control', 'full'))
);

-- CCTV Access Log
CREATE TABLE IF NOT EXISTS cctv_access_log (
  id SERIAL PRIMARY KEY,
  camera_id VARCHAR(100),
  accessing_state VARCHAR(2),
  user_email VARCHAR(255),
  access_type VARCHAR(50), -- 'view', 'snapshot', 'ptz-control'
  accessed_at TIMESTAMP DEFAULT NOW(),
  duration_seconds INTEGER,
  incident_reference VARCHAR(255) -- Event ID if related to incident
);

-- CCTV Sharing Requests
CREATE TABLE IF NOT EXISTS cctv_sharing_requests (
  id SERIAL PRIMARY KEY,
  requesting_state VARCHAR(2) NOT NULL,
  owner_state VARCHAR(2) NOT NULL,
  camera_id VARCHAR(100),
  corridor_name VARCHAR(255),
  justification TEXT NOT NULL,
  requested_access_level VARCHAR(20) DEFAULT 'read-only',
  requested_duration_days INTEGER DEFAULT 365,
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(255),
  response_notes TEXT,
  CONSTRAINT valid_request_status CHECK (status IN ('pending', 'approved', 'denied', 'expired'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cctv_location ON cctv_cameras(owner_state, route, mile_marker);
CREATE INDEX IF NOT EXISTS idx_cctv_status ON cctv_cameras(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_cctv_shared ON cctv_cameras USING GIN(shared_with_states);
CREATE INDEX IF NOT EXISTS idx_cctv_permissions_camera ON cctv_access_permissions(camera_id, requesting_state);
CREATE INDEX IF NOT EXISTS idx_cctv_log_camera ON cctv_access_log(camera_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_cctv_requests_state ON cctv_sharing_requests(requesting_state, status);

-- Comments
COMMENT ON TABLE cctv_cameras IS 'CCTV camera inventory for cross-state sharing. CCAI UC #3.';
COMMENT ON TABLE cctv_access_permissions IS 'Cross-state camera access permissions';
COMMENT ON TABLE cctv_access_log IS 'Audit log of camera access by state operators';
COMMENT ON TABLE cctv_sharing_requests IS 'Requests for cross-state camera access';

-- Function to find cameras near incident
CREATE OR REPLACE FUNCTION find_cameras_near_incident(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_radius_miles NUMERIC DEFAULT 5
)
RETURNS TABLE(
  camera_id VARCHAR(100),
  camera_name VARCHAR(255),
  distance_miles NUMERIC,
  stream_url VARCHAR(500),
  owner_state VARCHAR(2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.camera_id,
    c.camera_name,
    ROUND(
      SQRT(
        POWER((c.latitude - p_latitude) * 69, 2) +
        POWER((c.longitude - p_longitude) * 54.6, 2)
      ),
      2
    ) as distance_miles,
    c.stream_url,
    c.owner_state
  FROM cctv_cameras c
  WHERE c.status = 'active'
    AND c.latitude IS NOT NULL
    AND c.longitude IS NOT NULL
    AND SQRT(
      POWER((c.latitude - p_latitude) * 69, 2) +
      POWER((c.longitude - p_longitude) * 54.6, 2)
    ) <= p_radius_miles
  ORDER BY distance_miles ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to check camera access permission
CREATE OR REPLACE FUNCTION check_camera_access(
  p_camera_id VARCHAR(100),
  p_requesting_state VARCHAR(2)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_access BOOLEAN;
  v_is_public BOOLEAN;
  v_owner_state VARCHAR(2);
BEGIN
  -- Get camera info
  SELECT is_public, owner_state, p_requesting_state = ANY(shared_with_states)
  INTO v_is_public, v_owner_state, v_has_access
  FROM cctv_cameras
  WHERE camera_id = p_camera_id AND status = 'active';

  -- Check access
  IF v_owner_state = p_requesting_state THEN
    RETURN true; -- Own state always has access
  ELSIF v_is_public THEN
    RETURN true; -- Public cameras accessible to all
  ELSIF v_has_access THEN
    RETURN true; -- Explicitly shared
  ELSE
    RETURN false;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to log camera access
CREATE OR REPLACE FUNCTION log_camera_access(
  p_camera_id VARCHAR(100),
  p_state VARCHAR(2),
  p_user VARCHAR(255),
  p_access_type VARCHAR(50),
  p_incident VARCHAR(255) DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO cctv_access_log (camera_id, accessing_state, user_email, access_type, incident_reference)
  VALUES (p_camera_id, p_state, p_user, p_access_type, p_incident);

  -- Update last access on permission record
  UPDATE cctv_access_permissions
  SET last_accessed = NOW(),
      access_count = access_count + 1
  WHERE camera_id = p_camera_id
    AND requesting_state = p_state
    AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to grant camera access
CREATE OR REPLACE FUNCTION grant_camera_access(
  p_camera_id VARCHAR(100),
  p_requesting_state VARCHAR(2),
  p_granted_by VARCHAR(255),
  p_duration_days INTEGER DEFAULT 365
)
RETURNS INTEGER AS $$
DECLARE
  v_permission_id INTEGER;
BEGIN
  -- Create permission record
  INSERT INTO cctv_access_permissions (
    camera_id,
    requesting_state,
    granted_by,
    expires_at,
    is_active
  ) VALUES (
    p_camera_id,
    p_requesting_state,
    p_granted_by,
    NOW() + (p_duration_days || ' days')::INTERVAL,
    true
  ) RETURNING id INTO v_permission_id;

  -- Add state to camera's shared list
  UPDATE cctv_cameras
  SET shared_with_states = array_append(shared_with_states, p_requesting_state)
  WHERE camera_id = p_camera_id
    AND NOT (p_requesting_state = ANY(shared_with_states));

  RETURN v_permission_id;
END;
$$ LANGUAGE plpgsql;

-- Insert sample CCTV cameras
INSERT INTO cctv_cameras (
  camera_id, camera_name, owner_state, location, latitude, longitude,
  route, mile_marker, direction, status, capabilities, shared_with_states
) VALUES
('CAM-IA-I35-087-N', 'I-35 MM 87 Northbound', 'IA', 'I-35 Mile Marker 87', 41.5868, -93.6250,
 'I-35', 87.0, 'northbound', 'active', ARRAY['pan', 'tilt', 'zoom', 'hd'], ARRAY['MN', 'MO']),

('CAM-IA-I35-087-S', 'I-35 MM 87 Southbound', 'IA', 'I-35 Mile Marker 87', 41.5868, -93.6250,
 'I-35', 87.0, 'southbound', 'active', ARRAY['pan', 'tilt', 'zoom'], ARRAY['MN', 'MO']),

('CAM-IA-I80-137', 'I-80 Exit 137 Overview', 'IA', 'I-80 Mile Marker 137', 41.5912, -93.6037,
 'I-80', 137.0, 'eastbound', 'active', ARRAY['fixed', 'hd'], ARRAY['NE', 'IL']),

('CAM-MN-I35-001', 'I-35W Minneapolis Metro', 'MN', 'I-35W Minneapolis', 44.9778, -93.2650,
 'I-35', 12.5, 'northbound', 'active', ARRAY['pan', 'tilt', 'zoom', 'infrared'], ARRAY['IA', 'WI']),

('CAM-TX-I35-200', 'I-35 Austin Downtown', 'TX', 'I-35 Austin', 30.2672, -97.7431,
 'I-35', 200.0, 'northbound', 'active', ARRAY['ptz', 'hd'], ARRAY['OK'])
ON CONFLICT (camera_id) DO NOTHING;

-- Grant some initial permissions
DO $$
DECLARE
  v_cam RECORD;
BEGIN
  FOR v_cam IN SELECT camera_id, shared_with_states FROM cctv_cameras WHERE shared_with_states IS NOT NULL LOOP
    -- Grant permissions for each shared state
    FOR i IN 1..array_length(v_cam.shared_with_states, 1) LOOP
      INSERT INTO cctv_access_permissions (camera_id, requesting_state, granted_by, access_level, is_active)
      VALUES (v_cam.camera_id, v_cam.shared_with_states[i], 'System', 'read-only', true)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Grant permissions
GRANT SELECT ON cctv_cameras TO PUBLIC;
GRANT SELECT, INSERT ON cctv_access_log TO PUBLIC;
GRANT SELECT ON cctv_access_permissions TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON cctv_sharing_requests TO PUBLIC;

-- Completion message
DO $$
DECLARE
  v_camera_count INTEGER;
  v_shared_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_camera_count FROM cctv_cameras WHERE status = 'active';
  SELECT COUNT(*) INTO v_shared_count FROM cctv_access_permissions WHERE is_active = true;

  RAISE NOTICE 'Cross-State CCTV Sharing System Configured:';
  RAISE NOTICE '- % active cameras in inventory', v_camera_count;
  RAISE NOTICE '- % cross-state access permissions granted', v_shared_count;
  RAISE NOTICE '- Camera proximity search enabled';
  RAISE NOTICE '- Access control and audit logging enabled';
  RAISE NOTICE '- Sharing request workflow ready';
END $$;
