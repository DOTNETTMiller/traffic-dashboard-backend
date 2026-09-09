/**
 * Seed truck_parking_facilities from Iowa DOT open data.
 *
 * Nothing ever populated that table -- it is only written by the POST endpoint in
 * backend_proxy_server.js -- so it sat empty, and until the `address` column drift was
 * fixed every write to it failed anyway. Iowa DOT publishes the facilities openly, so
 * there is no reason to hand-enter them.
 *
 * Source: Rest_Area_View on Iowa DOT's public ArcGIS org (the same org as RAMS). Chosen
 * over the neighbouring layers by reading what each actually carries:
 *   Rest_Area_View     33 features WITH counts -- NUM_TRUCK_PARKING, NUM_CAR_PARKING,
 *                      ADDRESS, ROUTE, MILEPOST, FACILITY_TYPE, amenities.  <-- this one
 *   Rest_Area_TPIMS    14 features, TPIMS participants incl. private truck stops, but its
 *                      parking fields are Yes/No flags, not counts.
 *   Rest_Areas_All     14 features, same schema as the view but a subset.
 *   Parking_Area_View  14 features, same schema, subset.
 *
 * Free and lazy: one CORS-open ArcGIS query returning ~33 rows, run once per boot. The
 * upsert is ON CONFLICT DO UPDATE, so re-running only refreshes.
 */

const SOURCE =
  'https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/Rest_Area_View/FeatureServer/0/query' +
  '?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=500&f=json';

function httpsGetJSON(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = require('https').get(url, { timeout: timeoutMs }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', d => { buf += d; });
      res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** Amenities the layer records as Yes/No, collapsed to a comma list of what is present. */
function amenitiesOf(a) {
  const map = {
    ADA_FACILITIES: 'ADA', FAMILY_RESTROOM: 'family restroom', PUBLIC_PHONE: 'phone',
    WEATHER: 'weather info', RV_DUMP: 'RV dump', VENDING: 'vending', WIFI: 'wifi',
    PET_AREA: 'pet area', PICNIC: 'picnic'
  };
  const on = [];
  for (const [k, label] of Object.entries(map)) {
    if (String(a[k] || '').trim().toLowerCase() === 'yes') on.push(label);
  }
  return on.length ? on.join(', ') : null;
}

function toFacility(f) {
  const a = f.attributes || {};
  const g = f.geometry || {};
  const lat = num(g.y), lon = num(g.x);
  if (lat === null || lon === null) return null;
  // INVENTORY_ID is Iowa's own stable key for the site; prefix so ids stay unique if
  // another state is added to the same table later.
  const id = a.INVENTORY_ID ? `IA-${a.INVENTORY_ID}` : `IA-OBJ${a.OBJECTID}`;
  const car = num(a.NUM_CAR_PARKING), truck = num(a.NUM_TRUCK_PARKING);
  const name = a.REST_AREAS || a.NEAREST_CITY || id;
  const route = a.ROUTE ? String(a.ROUTE).trim() : null;
  const mp = num(a.MILEPOST);
  return {
    facilityId: id,
    facilityName: route ? `${name} (${route}${mp !== null ? ` MP ${mp}` : ''})` : String(name),
    state: 'IA',
    latitude: lat,
    longitude: lon,
    address: a.ADDRESS || null,
    // total = every marked stall we know about, so an occupancy ratio has a denominator
    totalSpaces: (car !== null || truck !== null) ? (car || 0) + (truck || 0) + (num(a.NUM_ADA_PARKING) || 0) : null,
    truckSpaces: truck,
    amenities: amenitiesOf(a),
    facilityType: a.FACILITY_TYPE || 'Rest Area'
  };
}

/**
 * Fetch and upsert. Never throws -- a seeding failure must not affect startup.
 * @returns {Promise<{fetched:number, written:number, withTruckSpaces:number, error?:string}>}
 */
async function seedIowaRestAreas(db) {
  const out = { fetched: 0, written: 0, withTruckSpaces: 0 };
  try {
    const j = await httpsGetJSON(SOURCE);
    const rows = ((j && j.features) || []).map(toFacility).filter(Boolean);
    out.fetched = rows.length;
    for (const r of rows) {
      try {
        const res = await db.addParkingFacility(r);
        if (!res || res.success !== false) {
          out.written++;
          if (r.truckSpaces) out.withTruckSpaces++;
        }
      } catch (e) { /* one bad row must not stop the rest */ }
    }
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

module.exports = { seedIowaRestAreas, toFacility, SOURCE };
