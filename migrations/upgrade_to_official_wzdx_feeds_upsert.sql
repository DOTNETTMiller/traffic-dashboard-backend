/**
 * Upgrade State Feeds to Official USDOT WZDx Registry URLs
 *
 * Uses UPSERT (INSERT ... ON CONFLICT) to add/update state feed configurations
 * to use official WZDx v4.x feeds from the USDOT Work Zone Data Feed Registry.
 *
 * Source: https://datahub.transportation.gov/Roadways-and-Bridges/Work-Zone-Data-Feed-Registry/69qe-yiui
 * Date: March 2026
 */

-- CARS states to use WZDx feeds instead of FEU-G
INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('IA', 'Iowa DOT', 'https://iowa-atms.cloud-q-free.com/api/rest/dataprism/wzdx/wzdxfeed', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('IN', 'Indiana DOT', 'https://in.carsprogram.org/carsapi_v1/api/wzdx', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('KS', 'Kansas DOT', 'https://ks.carsprogram.org/carsapi_v1/api/wzdx', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('MN', 'Minnesota DOT', 'https://mn.carsprogram.org/carsapi_v1/api/wzdx', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

-- Illinois to Tollway WZDx 4.2
INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('IL', 'Illinois DOT', 'https://tims2go.tollway.state.il.us/wzdx/v4.2?api_key=', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

-- New Jersey to NJIT WZDx feed
INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('NJ', 'New Jersey DOT', 'https://smartworkzones.njit.edu/nj/wzdx', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

-- Ohio to WZDx 4.2
INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('OH', 'Ohio DOT', 'https://publicapi.ohgo.com/api/work-zones/wzdx/4.2?api-key=', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

-- Texas to TxDOT statewide WZDx 4.2
INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('TX', 'Texas DOT', 'https://api.drivetexas.org/api/conditions.wzdx.geojson?key=', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

-- California to 511.org WZDx feed
INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('CA', 'California DOT', 'https://api.511.org/traffic/wzdx?api_key=', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

-- Pennsylvania to Turnpike WZDx feed
INSERT INTO states (state_key, state_name, api_url, api_type, format, enabled, created_at, updated_at)
VALUES ('PA', 'Pennsylvania DOT', 'https://atms.paturnpike.com/api/WZDxWorkZoneFeed?api_key=', 'WZDx', 'geojson', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (state_key) DO UPDATE SET
  api_url = EXCLUDED.api_url,
  api_type = EXCLUDED.api_type,
  format = EXCLUDED.format,
  updated_at = CURRENT_TIMESTAMP;

-- Florida (already using One.Network but confirm URL and type)
UPDATE states
SET api_url = 'https://us-datacloud.one.network/fdot/feed.json?app_key=',
    api_type = 'WZDx',
    format = 'geojson',
    updated_at = CURRENT_TIMESTAMP
WHERE state_key = 'fl';

-- Oklahoma (already correct but ensure consistency)
UPDATE states
SET api_url = 'https://oktraffic.org/api/Geojsons/workzones?&access_token=',
    api_type = 'WZDx',
    format = 'geojson',
    updated_at = CURRENT_TIMESTAMP
WHERE UPPER(state_key) = 'OK';

-- Virginia (already correct but ensure consistency)
UPDATE states
SET api_url = 'https://data.511-atis-ttrip-prod.iteriscloud.com/smarterRoads/workzone/workZoneJSON/current/workZone.json?token=',
    api_type = 'WZDx',
    format = 'geojson',
    updated_at = CURRENT_TIMESTAMP
WHERE UPPER(state_key) = 'VA';

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
