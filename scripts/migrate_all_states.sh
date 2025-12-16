#!/bin/bash
# Migrate all states to production database

sqlite3 /app/data/states.db <<'EOF'
INSERT OR REPLACE INTO states (state_key, state_name, api_url, api_type, format, enabled) VALUES
  ('nv', 'Nevada', 'https://www.nvroads.com/api/v2/get/roadconditions', 'Nevada DOT', 'json', 1),
  ('oh', 'Ohio', 'https://publicapi.ohgo.com/api/v1/constructions', 'Ohio DOT', 'json', 1),
  ('nj', 'New Jersey', 'https://511nj.org/client/rest/rss/RSSAllNJActiveEvents', 'NJ 511', 'xml', 1),
  ('ia', 'Iowa', 'https://ia.carsprogram.org/hub/data/feu-g.xml', 'CARS', 'xml', 1),
  ('ks', 'Kansas', 'https://kscars.kandrive.gov/hub/data/feu-g.xml', 'CARS', 'xml', 1),
  ('ne', 'Nebraska', 'https://ne.carsprogram.org/hub/data/feu-g.xml', 'CARS', 'xml', 1),
  ('in', 'Indiana', 'https://inhub.carsprogram.org/data/feu-g.xml', 'CARS', 'xml', 1),
  ('mn', 'Minnesota', 'https://mn.carsprogram.org/hub/data/feu-g.xml', 'CARS', 'xml', 1),
  ('ut', 'Utah', 'https://udottraffic.utah.gov/wzdx/udot/v40/data', 'WZDx', 'json', 1),
  ('il', 'Illinois', 'https://travelmidwest.com/lmiga/incidents.json?path=GATEWAY.IL', 'Travel Midwest', 'json', 1),
  ('tx', 'Texas', 'https://api.drivetexas.org/api/conditions.wzdx.geojson', 'WZDx', 'geojson', 1),
  ('ok', 'Oklahoma', 'https://oktraffic.org/api/Geojsons/workzones?&access_token=feOPynfHRJ5sdx8tf3IN5yOsGz89TAUuzHsN3V0jo1Fg41LcpoLhIRltaTPmDngD', 'WZDx', 'geojson', 1),
  ('ca', 'California', 'https://cwwp2.dot.ca.gov/data/d*/lcsdata.json', 'Caltrans LCS', 'json', 1),
  ('pa', 'Pennsylvania', 'https://www.511pa.com/feeds/RoadConditions.xml', 'PennDOT RCRS', 'xml', 1);

SELECT 'Migration complete! Total states: ' || COUNT(*) FROM states;
SELECT 'Enabled: ' || COUNT(*) FROM states WHERE enabled = 1;
SELECT '';
SELECT 'Updated states (by state_key):';
SELECT '  ' || state_key || ': ' || state_name || ' (' || api_type || ')' FROM states WHERE state_key IN ('nv','oh','nj','ia','ks','ne','in','mn','ut','il','tx','ok','ca','pa') ORDER BY state_key;
EOF
