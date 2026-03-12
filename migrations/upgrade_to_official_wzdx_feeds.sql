/**
 * Upgrade State Feeds to Official USDOT WZDx Registry URLs
 *
 * Updates all state feed configurations to use official WZDx v4.x feeds
 * from the USDOT Work Zone Data Feed Registry.
 *
 * Source: https://datahub.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Feed-Registry/69qe-yiui
 * Date: March 2026
 */

-- Backup current state configurations
CREATE TABLE IF NOT EXISTS states_backup_20260311 AS
SELECT * FROM states;

-- Update CARS states to use WZDx feeds instead of FEU-G
UPDATE states
SET
  api_url = 'https://iowa-atms.cloud-q-free.com/api/rest/dataprism/wzdx/wzdxfeed',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'ia';

UPDATE states
SET
  api_url = 'https://in.carsprogram.org/carsapi_v1/api/wzdx',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'in';

UPDATE states
SET
  api_url = 'https://ks.carsprogram.org/carsapi_v1/api/wzdx',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'ks';

UPDATE states
SET
  api_url = 'https://mn.carsprogram.org/carsapi_v1/api/wzdx',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'mn';

-- Update California to 511.org WZDx feed
UPDATE states
SET
  api_url = 'https://api.511.org/traffic/wzdx?api_key=',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'ca';

-- Colorado: Keep BOTH CWZ (primary - connected vehicles) AND WZDx (secondary - traditional)
-- CWZ 1.0 is the NEW USDOT/ITE connected work zone standard for V2X/automated vehicles

-- Update primary Colorado entry to use CWZ 1.0 (the future standard!)
UPDATE states
SET
  api_url = 'https://data.cotrip.org/api/v1/cwz?apiKey=',
  api_type = 'CWZ',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'co';

-- Add Colorado WZDx feed as separate entry for traditional consumers
INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES (
  'co-wzdx',
  'Colorado DOT (WZDx Traditional)',
  'https://data.cotrip.org/api/v1/wzdx?apiKey=',
  'WZDx',
  'json',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  updated_at = CURRENT_TIMESTAMP;

-- Update Illinois to Tollway WZDx 4.2
UPDATE states
SET
  api_url = 'https://tims2go.tollway.state.il.us/wzdx/v4.2?api_key=',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'il';

-- Update New Jersey to NJIT WZDx feed
UPDATE states
SET
  api_url = 'https://smartworkzones.njit.edu/nj/wzdx',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'nj';

-- Update Ohio to WZDx 4.2
UPDATE states
SET
  api_url = 'https://publicapi.ohgo.com/api/work-zones/wzdx/4.2?api-key=',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'oh';

-- Update Pennsylvania to Turnpike WZDx feed
UPDATE states
SET
  api_url = 'https://atms.paturnpike.com/api/WZDxWorkZoneFeed?api_key=',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'pa';

-- Update Texas to TxDOT statewide WZDx 4.2
UPDATE states
SET
  api_url = 'https://api.drivetexas.org/api/conditions.wzdx.geojson?key=',
  api_type = 'WZDx',
  format = 'geojson',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'tx';

-- Update Florida (already using One.Network but confirm URL)
UPDATE states
SET
  api_url = 'https://us-datacloud.one.network/fdot/feed.json?app_key=',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'fl';

-- Update Oklahoma (already correct but ensure consistency)
UPDATE states
SET
  api_url = 'https://oktraffic.org/api/Geojsons/workzones?&access_token=',
  api_type = 'WZDx',
  format = 'geojson',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'ok';

-- Update Virginia (already correct but ensure consistency)
UPDATE states
SET
  api_url = 'https://data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads/workzone/workZoneJSON/current/workZone.json?token=',
  api_type = 'WZDx',
  format = 'json',
  updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'va';

-- Add Michigan (missing from our config)
INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES (
  'mi',
  'Michigan DOT',
  'https://mdotridedata.state.mi.us/api/v1/organization/michigan_department_of_transportation/dataset/work_zone_information/query',
  'WZDx',
  'json',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  updated_at = CURRENT_TIMESTAMP;

-- Create view for WZDx version tracking
CREATE OR REPLACE VIEW wzdx_feed_versions AS
SELECT
  state_key,
  state_name,
  api_url,
  api_type,
  CASE
    WHEN api_url LIKE '%wzdx/v4.2%' OR api_url LIKE '%wzdx/4.2%' THEN '4.2'
    WHEN api_url LIKE '%wzdx_v4.1%' OR api_url LIKE '%wzdx/v4.1%' THEN '4.1'
    WHEN api_url LIKE '%wzdx/v4%' OR api_url LIKE '%wzdx/udot/v40%' THEN '4.0'
    WHEN api_url LIKE '%cwz%' THEN 'CWZ 1.0'
    WHEN api_type = 'WZDx' THEN '4.x (unspecified)'
    ELSE 'Unknown'
  END as wzdx_version,
  enabled,
  updated_at
FROM states
WHERE api_type IN ('WZDx', 'CWZ')
ORDER BY state_key;

-- Add comments
COMMENT ON VIEW wzdx_feed_versions IS 'Tracks WZDx version for each state feed';

-- Summary report
SELECT
  'Upgrade Summary' as report,
  COUNT(*) FILTER (WHERE api_type = 'WZDx') as wzdx_feeds,
  COUNT(*) FILTER (WHERE api_type = 'CWZ') as cwz_feeds,
  COUNT(*) FILTER (WHERE api_url LIKE '%4.2%') as v4_2_feeds,
  COUNT(*) FILTER (WHERE api_url LIKE '%4.1%') as v4_1_feeds,
  COUNT(*) FILTER (WHERE api_url LIKE '%4.0%' OR api_url LIKE '%v4/%' OR api_url LIKE '%v40%') as v4_0_feeds
FROM states
WHERE enabled = true;
