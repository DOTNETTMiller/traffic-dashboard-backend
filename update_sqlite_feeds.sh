#!/bin/bash
# Update SQLite database with correct TX and OK feeds

sqlite3 /app/data/states.db <<'EOF'
UPDATE states
SET api_url='https://api.drivetexas.org/api/conditions.wzdx.geojson',
    api_type='WZDx',
    format='geojson'
WHERE state_key='tx';

UPDATE states
SET api_url='https://oktraffic.org/api/Geojsons/workzones?&access_token=feOPynfHRJ5sdx8tf3IN5yOsGz89TAUuzHsN3V0jo1Fg41LcpoLhIRltaTPmDngD',
    api_type='WZDx',
    format='geojson'
WHERE state_key='ok';

SELECT state_key, substr(api_url, 1, 70) as url, api_type FROM states WHERE state_key IN ('tx', 'ok');
EOF
