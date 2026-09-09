/**
 * Chronically blocked grade crossings, from FRA's Blocked Crossing Incident Reporter.
 *
 * WHY THIS AND NOT LIVE DETECTION. Nothing public says "this crossing is blocked right
 * now" -- railroads do not publish train positions, and the Amtrak feed covers passenger
 * only. But FRA collects public reports of blockages, 158,697 of them, and those ARE
 * mostly freight: sampling the newest 200 gives UP 65, NS 33, BNSF 30, CSX 27. 89% are
 * "a stationary train".
 *
 * The live layer is thin -- roughly 6 reports an hour nationally -- so it cannot tell you
 * a crossing is clear, only that someone complained. The HISTORY is the useful part: which
 * crossings routinely swallow an hour or more. For routing a detour across a track that is
 * a better question than "is a train there this second", because it is answerable and it
 * does not depend on catching an event live.
 *
 * Reports are public-submitted, so this measures REPORTED blockage, which is a blend of how
 * often a crossing blocks and how motivated locals are to report it. A busy urban crossing
 * will out-report an identical rural one. Read it as a nuisance ranking, not a census.
 */

const API = 'https://www.fra.dot.gov/blockedcrossings/api/incidents';

// The API reports duration as a bucket, never a number. Midpoints, with the open-ended top
// bucket deliberately not extrapolated beyond its floor -- guessing "12+ hours" means 18
// would invent severity the data does not support.
const DURATION_MIN = {
  '0-15 minutes': 7.5,
  '16-30 minutes': 23,
  '31-60 minutes': 45,
  '1-2 hours': 90,
  '2-6 hours': 240,
  '6-12 hours': 540,
  '12+ hours': 720
};

// www.fra.dot.gov serves ONLY its leaf certificate -- no intermediate (openssl reports
// "unable to verify the first certificate", code 21). macOS curl succeeds because it chases
// the certificate's AIA extension to fetch the missing issuer; Node's OpenSSL does not, and
// nor does a typical Linux container, so this fails everywhere Node runs unless the chain is
// completed for it.
//
// The issuer is Entrust OV TLS Issuing RSA CA 2, published at the AIA URL in the leaf. We
// fetch it once over plain HTTP -- which is safe, because a CA certificate is not trusted
// for being delivered securely; it still has to chain to a root already in the trust store,
// and verification stays ON throughout. This is what curl does silently.
const AIA_URL = 'http://crt.sectigo.com/EntrustOVTLSIssuingRSACA2.crt';
let caChain = null;

function fetchIntermediate() {
  if (caChain) return Promise.resolve(caChain);
  return new Promise(resolve => {
    require('http').get(AIA_URL, { timeout: 15000 }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const der = Buffer.concat(chunks);
          const b64 = der.toString('base64').match(/.{1,64}/g).join('\n');
          caChain = [`-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`];
          resolve(caChain);
        } catch (e) { resolve(null); }
      });
    }).on('error', () => resolve(null)).on('timeout', function () { this.destroy(); resolve(null); });
  });
}

async function httpsGetJSON(url, timeoutMs = 45000) {
  const ca = await fetchIntermediate();
  return new Promise((resolve, reject) => {
    // FRA's endpoint also rejects a request with no User-Agent (curl sends one, Node does
    // not), which silently produced an empty result set the first time round.
    const opts = {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'CorridorCommunicator/1.0', 'Accept': 'application/json' }
    };
    // Supply the fetched intermediate alongside the built-in roots. Verification stays on.
    if (ca) { opts.ca = [...require('tls').rootCertificates, ...ca]; }
    const req = require('https').get(url, opts, res => {
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

/**
 * Every reported incident for a state. Paged; the API caps a page, so this walks until it
 * has them all or hits maxPages.
 */
async function fetchIncidents(state, opts = {}) {
  const pageSize = opts.pageSize || 1000;
  const maxPages = opts.maxPages || 25;
  const out = [];
  let total = null;
  for (let page = 1; page <= maxPages; page++) {
    const url = `${API}?state=${encodeURIComponent(state || '')}&pageSize=${pageSize}&page=${page}`;
    let j;
    try { j = await httpsGetJSON(url, opts.timeoutMs); }
    catch (e) {
      if (page === 1) console.error('crossing-hotspots: first page failed —', e.message);
      break;                                   // partial data beats none
    }
    if (total === null) total = j.totalIncidents || 0;
    const items = j.items || [];
    out.push(...items);
    if (items.length < pageSize) break;
    if (out.length >= total) break;
  }
  return { incidents: out, reportedTotal: total };
}

/**
 * Rank crossings by how much reported blockage they account for.
 *
 * Score is total blocked MINUTES, not incident count: a crossing blocked twice for six
 * hours matters more to a detour than one blocked twenty times for ten minutes, and count
 * alone inverts that.
 */
function rank(incidents, opts = {}) {
  const sinceMs = opts.sinceDays ? Date.now() - opts.sinceDays * 86400000 : null;
  const byCrossing = new Map();

  for (const it of incidents) {
    const id = it.crossingID;
    if (!id) continue;
    // The API returns local-time strings with no offset, so treat these as approximate.
    const t = it.dateTime ? Date.parse(it.dateTime) : null;
    if (sinceMs && Number.isFinite(t) && t < sinceMs) continue;

    let e = byCrossing.get(id);
    if (!e) {
      e = {
        crossingId: id, street: it.street || null, city: it.city || null,
        state: it.state || null, county: it.county || null, railroad: it.railroad || null,
        latitude: Number(it.latitude), longitude: Number(it.longitude),
        incidents: 0, blockedMinutes: 0, longestBucket: null, reasons: {}, lastReported: null
      };
      byCrossing.set(id, e);
    }
    e.incidents++;
    const mins = DURATION_MIN[it.duration];
    if (mins) e.blockedMinutes += mins;
    if (it.duration && (!e.longestBucket || (DURATION_MIN[it.duration] || 0) > (DURATION_MIN[e.longestBucket] || 0))) {
      e.longestBucket = it.duration;
    }
    if (it.reason) e.reasons[it.reason] = (e.reasons[it.reason] || 0) + 1;
    if (Number.isFinite(t) && (!e.lastReported || t > e.lastReported)) e.lastReported = t;
  }

  const rows = [...byCrossing.values()].map(e => ({
    ...e,
    blockedHours: +(e.blockedMinutes / 60).toFixed(1),
    avgMinutes: e.incidents ? Math.round(e.blockedMinutes / e.incidents) : 0,
    lastReported: e.lastReported ? new Date(e.lastReported).toISOString() : null,
    topReason: Object.entries(e.reasons).sort((a, b) => b[1] - a[1])[0]?.[0] || null
  }));
  rows.sort((a, b) => b.blockedMinutes - a.blockedMinutes || b.incidents - a.incidents);
  return rows;
}

/** Convenience: fetch + rank for a state. */
async function hotspots(state, opts = {}) {
  const { incidents, reportedTotal } = await fetchIncidents(state, opts);
  const ranked = rank(incidents, opts);
  return {
    state: state || 'ALL',
    reportedTotal,
    incidentsAnalysed: incidents.length,
    crossings: ranked.length,
    hotspots: ranked.slice(0, opts.limit || 25)
  };
}

/** Is a point near a known hotspot? For flagging a detour that crosses one. */
function nearestHotspot(lat, lon, ranked, maxM = 200) {
  const R = 6371008.8, rad = d => d * Math.PI / 180;
  let best = null, bestD = Infinity;
  for (const h of ranked) {
    if (!Number.isFinite(h.latitude) || !Number.isFinite(h.longitude)) continue;
    const dLat = rad(h.latitude - lat), dLon = rad(h.longitude - lon);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(h.latitude)) * Math.sin(dLon / 2) ** 2;
    const d = 2 * R * Math.asin(Math.sqrt(s));
    if (d < bestD) { bestD = d; best = h; }
  }
  return (best && bestD <= maxM) ? { ...best, distanceM: Math.round(bestD) } : null;
}

module.exports = { hotspots, fetchIncidents, rank, nearestHotspot, DURATION_MIN, API };
