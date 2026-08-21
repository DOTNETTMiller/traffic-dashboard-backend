// Live ingest of Iowa DOT connected field devices (iCone/Ver-Mac arrow boards and
// portable message signs) from the DMS_View FeatureServer, normalized for the
// device↔work-zone matcher.
//
// IMPORTANT: DMS_View returns its `geometry` in Web Mercator, but the WGS84
// coordinates live in the `lat_`/`long_` ATTRIBUTE fields — so we request
// returnGeometry=false and read the attributes (a bug Field Escort documented:
// reading geometry.x/y as degrees places every device thousands of miles away).

const https = require('https');
const matcher = require('./device-workzone-matcher');

const DMS_VIEW_URL = 'https://services.arcgis.com/8lRhdTsQyJpO52F1/ArcGIS/rest/services/DMS_View/FeatureServer/0/query'
  + '?where=1%3D1&outFields=DeviceName,Route,Direction,SignType,msgtext,lat_,long_,EditDate'
  + '&returnGeometry=false&f=json&resultRecordCount=2000';

function getJSON(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`DMS_View parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('DMS_View request timeout')); });
  });
}

/**
 * Fetch Iowa connected devices, normalized via the matcher's deviceFromFeature.
 * By default returns only the work-zone-deployed units (SignType 'Portable-Contractor'
 * and iCone arrow boards); pass { all: true } to get every device (fixed DMS included).
 */
async function fetchIowaDevices(opts = {}) {
  const j = await getJSON(opts.url || DMS_VIEW_URL);
  const feats = (j && j.features) || [];
  const devices = [];
  for (const f of feats) {
    const a = { ...(f.attributes || {}) };
    // EditDate is epoch ms → ISO so the matcher's freshness check works.
    if (typeof a.EditDate === 'number') a.EditDate = new Date(a.EditDate).toISOString();
    const isPortable = /Portable-Contractor/i.test(a.SignType || '') || /-\s*AB\b|arrow/i.test(a.DeviceName || '');
    if (!opts.all && !isPortable) continue;
    const d = matcher.deviceFromFeature({ properties: a });
    if (!d.coordinates) continue;                 // no usable WGS84 position
    d.signType = a.SignType || null;
    devices.push(d);
  }
  return devices;
}

module.exports = { fetchIowaDevices, DMS_VIEW_URL };
