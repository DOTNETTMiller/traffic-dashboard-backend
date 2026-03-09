-- Migration: Add Freight Impact Tagging (CCAI UC #14)
-- Date: 2026-03-03
-- Description: Adds freight-specific classification to events for NASCO corridor management

-- Add freight impact classification column to events
ALTER TABLE IF EXISTS events ADD COLUMN IF NOT EXISTS freight_impact VARCHAR(20);
ALTER TABLE IF EXISTS events ADD COLUMN IF NOT EXISTS freight_impact_reasons TEXT[];

-- Add freight notification preferences to user profiles
ALTER TABLE IF EXISTS user_profiles ADD COLUMN IF NOT EXISTS freight_notifications_enabled BOOLEAN DEFAULT false;

-- Create index for freight filtering
CREATE INDEX IF NOT EXISTS idx_events_freight_impact ON events(freight_impact) WHERE freight_impact IS NOT NULL;

-- Add comments
COMMENT ON COLUMN events.freight_impact IS 'Freight impact classification: critical, significant, minor, none. Based on CCAI UC #14.';
COMMENT ON COLUMN events.freight_impact_reasons IS 'Array of reasons why event impacts freight operations';

-- Example values for freight_impact_reasons:
-- - 'bridge_clearance_conflict'
-- - 'truck_route_closure'
-- - 'hazmat_restriction'
-- - 'weight_limit_exceeded'
-- - 'osow_permit_required'
-- - 'truck_parking_affected'
-- - 'long_duration_delay'
-- - 'detour_not_truck_suitable'

-- Update existing high-severity events that likely impact freight
UPDATE events
SET freight_impact = 'critical',
    freight_impact_reasons = ARRAY['truck_route_closure']
WHERE severity = 'high'
  AND (route LIKE 'I-%' OR route LIKE 'US-%')
  AND freight_impact IS NULL;

-- Update events near truck parking facilities
UPDATE events e
SET freight_impact = 'significant',
    freight_impact_reasons = ARRAY['truck_parking_affected']
FROM (
  SELECT DISTINCT ON (e2.id) e2.id
  FROM events e2
  CROSS JOIN parking_facilities pf
  WHERE ST_DWithin(
    ST_SetSRID(ST_MakePoint(e2.longitude, e2.latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(pf.longitude, pf.latitude), 4326)::geography,
    5000 -- 5km radius
  )
  AND e2.freight_impact IS NULL
) AS nearby
WHERE e.id = nearby.id;

-- Tag hazmat events
UPDATE events
SET freight_impact = 'critical',
    freight_impact_reasons = CASE
      WHEN freight_impact_reasons IS NULL THEN ARRAY['hazmat_restriction']
      ELSE array_append(freight_impact_reasons, 'hazmat_restriction')
    END
WHERE (description ILIKE '%hazmat%' OR description ILIKE '%hazardous%')
  AND (freight_impact IS NULL OR freight_impact != 'critical');
