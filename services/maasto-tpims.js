'use strict';

const axios = require('axios');

/**
 * MAASTO TPIMS — multi-state real-time truck parking feed.
 *
 * MAASTO is a coalition of 8 Midwest state DOTs that publish TPIMS V2.2
 * data per the spec at:
 *   https://transportal.cee.wisc.edu/tpims/TPIMS_TruckParking_Data_Interface_V2.2.pdf
 *
 * Each state publishes two REST endpoints:
 *   - Static  (site metadata: lat/lng, name, capacity, amenities)
 *   - Dynamic (volatile: reportedAvailable, trend, open status)
 *
 * Records share a `siteId` key so we join Dynamic ⨯ Static client-side.
 *
 * Of the 8 MAASTO states, only 3 publish keyless public feeds the dashboard
 * can consume directly (IL, KY, MN). The remainder are gated:
 *   - WI: WisDOT lists endpoints in its dev docs but they 404 publicly —
 *     production access is by request via tpims@topslab.wisc.edu.
 *   - IA / KS / MI: per-agency key registration required.
 *   - IN: publishes a non-spec GeoJSON sign-message feed at
 *     content.trafficwise.org/json/tpims.json — different normalization,
 *     not handled here.
 *
 * Update cadence per spec: Dynamic 1-5min, Static rarely.
 */

const SOURCES = {
  IL: {
    state: 'IL',
    name: 'Illinois DOT (TravelMidwest)',
    static:  'https://truckparking.travelmidwest.com/TPIMS_Static.json',
    dynamic: 'https://truckparking.travelmidwest.com/TPIMS_Dynamic.json'
  },
  KY: {
    state: 'KY',
    name: 'Kentucky TRIMARC',
    static:  'http://www.trimarc.org/dat/tpims/TPIMS_Static.json',
    dynamic: 'http://www.trimarc.org/dat/tpims/TPIMS_Dynamic.json'
  },
  MN: {
    state: 'MN',
    name: 'MnDOT IRIS',
    static:  'http://iris.dot.state.mn.us/iris/TPIMS_static',
    dynamic: 'http://iris.dot.state.mn.us/iris/TPIMS_dynamic'
  }
};

function fetchJson(url) {
  return axios.get(url, {
    timeout: 15000,
    validateStatus: s => s >= 200 && s < 300,
    headers: { 'User-Agent': 'DOT-Corridor-Communicator/1.0 (mattmilleriowa@gmail.com)' }
  }).then(r => r.data);
}

/**
 * The TPIMS spec wraps payloads as `{ "sites": [...] }` but some
 * implementations return the array at the root. Normalize both.
 */
function unwrapSites(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.sites)) return payload.sites;
  if (Array.isArray(payload?.SITES)) return payload.SITES;
  return [];
}

function parseAvailable(reportedAvailable, capacity) {
  if (typeof reportedAvailable === 'number') return reportedAvailable;
  if (typeof reportedAvailable === 'string') {
    if (/^\d+$/.test(reportedAvailable)) return Number(reportedAvailable);
    if (/^low$/i.test(reportedAvailable))     return Math.max(1, Math.round((capacity || 0) * 0.1));
    if (/^unknown$/i.test(reportedAvailable)) return null;
  }
  return null;
}

function normalizeRecord(staticRec, dynamicRec, source) {
  const loc = staticRec.location || {};
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  const capacity = Number(staticRec.capacity ?? dynamicRec?.capacity);
  const available = parseAvailable(dynamicRec?.reportedAvailable, capacity);
  const open = dynamicRec?.open === true || dynamicRec?.open === 'true';
  const trustData = dynamicRec?.trustData === true || dynamicRec?.trustData === 'true';

  return {
    site_id: staticRec.siteId,
    state: source.state,
    agency: source.name,
    name: staticRec.name || staticRec.siteId,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    relevant_highway: staticRec.relevantHighway || null,
    direction: staticRec.directionOfTravel || null,
    exit: staticRec.exitID || null,
    reference_post: staticRec.referencePost || null,
    ownership: staticRec.ownership || null,
    capacity: Number.isFinite(capacity) ? capacity : null,
    available: available,
    occupancy_rate: (Number.isFinite(capacity) && capacity > 0 && Number.isFinite(available))
      ? Math.max(0, Math.min(1, (capacity - available) / capacity))
      : null,
    trend: dynamicRec?.trend || null,
    open: open,
    trust_data: trustData,
    amenities: Array.isArray(staticRec.amenities) ? staticRec.amenities : [],
    timestamp: dynamicRec?.timeStamp || null,
    static_timestamp: staticRec.timeStamp || dynamicRec?.timeStampStatic || null
  };
}

async function fetchSourceSafe(source) {
  try {
    const [staticPayload, dynamicPayload] = await Promise.all([
      fetchJson(source.static),
      fetchJson(source.dynamic)
    ]);

    const staticBySite  = new Map(unwrapSites(staticPayload).map(s => [s.siteId, s]));
    const dynamicBySite = new Map(unwrapSites(dynamicPayload).map(d => [d.siteId, d]));

    // Use static as the authoritative site list — dynamic-only siteIds
    // (no metadata, no coordinates) are not useful in the UI.
    const records = [];
    for (const [siteId, staticRec] of staticBySite.entries()) {
      const dynamicRec = dynamicBySite.get(siteId) || null;
      records.push(normalizeRecord(staticRec, dynamicRec, source));
    }
    return records;
  } catch (err) {
    console.warn(`MAASTO TPIMS ${source.state} fetch failed: ${err.message}`);
    return [];
  }
}

async function fetchAllSites() {
  const sources = Object.values(SOURCES);
  const results = await Promise.all(sources.map(fetchSourceSafe));
  return results.flat();
}

module.exports = { fetchAllSites, SOURCES };
