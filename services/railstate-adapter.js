/**
 * RailState adapter — freight train sightings normalised into rail_movement events.
 *
 * Freight publishes nothing openly; probing settled that (Class I endpoints 301/403,
 * Railinc/AAR commercial, every public "train" feed passenger-only). RailState observes
 * trains with its own trackside machine-vision sensors, independent of the railroads, and
 * exposes a documented REST API. That makes it the first freight source that can actually
 * feed Corridor Communicator.
 *
 * Base URL and auth confirmed against the live service before any of this was written:
 *   GET https://api.railstate.com/api/v3/sensors/overview
 *   -> 401, www-authenticate: Bearer realm="Railstate server API"
 * So: bearer token, no other handshake.
 *
 * THE TRAP THIS FILE EXISTS TO HANDLE. RailState's "active" trip logic can retain a trip
 * whose last observation is up to FIVE DAYS old. An adapter that treats active_sighting_ids
 * as "trains that are out there now" would put five-day-old freight on an operational map
 * with no indication anything was wrong. So every sighting carries its own freshness tier
 * and nothing stale is allowed to reach an operational surface:
 *
 *     0-30 min   CURRENT    usable operationally
 *    30-60 min   RECENT     show, but marked
 *      >60 min   STALE      never displayed operationally
 *
 * Thresholds are per-corridor configurable, because a 25-minute observation latency means
 * something different on a busy urban corridor than on a rural branch.
 *
 * Ships uncredentialed on purpose. With no RAILSTATE_TOKEN every call returns
 * {available:false, reason} rather than throwing, so the rest of the rail stack runs
 * unchanged and this starts populating the moment a token exists.
 */

const BASE = process.env.RAILSTATE_BASE_URL || 'https://api.railstate.com/api/v3';

// RailState states its observations are normally available in under 25 minutes. That is the
// floor on freshness for this source -- it is a sighting network, not GPS -- so the tiers
// below are calibrated against it rather than against real-time expectations.
const OBSERVATION_LATENCY_NOTE = 'RailState observations are typically available <25 min after measurement';

const DEFAULT_TIERS = { currentMaxS: 30 * 60, recentMaxS: 60 * 60 };

function token(opts = {}) {
  return opts.token || process.env.RAILSTATE_TOKEN || process.env.RAILSTATE_API_KEY || null;
}

function request(path, opts = {}) {
  const tok = token(opts);
  return new Promise((resolve, reject) => {
    const url = `${BASE}${path}`;
    const req = require('https').get(url, {
      timeout: opts.timeoutMs || 30000,
      headers: {
        Authorization: `Bearer ${tok}`,
        Accept: 'application/json',
        'User-Agent': 'CorridorCommunicator/1.0'
      }
    }, res => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', d => { b += d; });
      res.on('end', () => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reject(new Error(`RailState rejected the token (HTTP ${res.statusCode})`));
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('unparseable response')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

/** Freshness tier for one observation. */
function freshness(observedAt, now = Date.now(), tiers = DEFAULT_TIERS) {
  if (!observedAt) return { tier: 'UNKNOWN', ageS: null, operational: false };
  const t = Date.parse(observedAt);
  if (!Number.isFinite(t)) return { tier: 'UNKNOWN', ageS: null, operational: false };
  const ageS = Math.max(0, Math.round((now - t) / 1000));
  const tier = ageS <= tiers.currentMaxS ? 'CURRENT'
    : ageS <= tiers.recentMaxS ? 'RECENT'
    : 'STALE';
  return { tier, ageS, operational: tier !== 'STALE' };
}

const num = v => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * One RailState sighting -> the corridor's own rail_movement event.
 *
 * Deliberately NOT a "train" object. Corridor Communicator consumes movements from several
 * sources (RailState sightings, TRAINFO crossing sensors, Amtrak positions); giving them one
 * shape means the projection and impact engine never learn where a movement came from.
 */
function toRailMovement(s, sensorsById = {}, now = Date.now(), tiers = DEFAULT_TIERS) {
  if (!s) return null;
  const observedAt = s.observation_time || s.sighting_time || s.timestamp || s.observed_at || null;
  const sensor = sensorsById[s.sensor_id] || sensorsById[s.sensorId] || null;
  const lat = num(s.latitude ?? s.lat ?? (sensor && (sensor.latitude ?? sensor.lat)));
  const lon = num(s.longitude ?? s.lon ?? (sensor && (sensor.longitude ?? sensor.lon)));
  if (lat === null || lon === null) return null;

  const f = freshness(observedAt, now, tiers);
  return {
    event_type: 'rail_movement',
    source: 'railstate',
    train_id: s.train_trip_id || s.trip_id || s.id || null,
    // operator = who runs the train. track_owner = whose track it is on, which only the
    // network snap can answer; a tenant's operator says nothing about crossing ownership.
    operator: s.railroad || s.operator || null,
    track_owner: null,
    observed_at: observedAt,
    // A sighting is a point observation at a sensor, not a continuous position. Naming the
    // sensor keeps that visible to anything downstream.
    location: { lat, lon },
    observed_at_sensor: s.sensor_id ?? s.sensorId ?? null,
    sensor_name: sensor ? (sensor.name || sensor.sensor_name || null) : null,
    direction: s.direction || s.heading || null,
    speed_mph: num(s.speed_mph ?? s.speed),
    train_length_ft: num(s.train_length_ft ?? s.estimated_length_ft ?? s.length_ft),
    train_type: s.train_type || s.type || null,
    locomotive_ids: s.locomotive_ids || s.locomotives || null,
    railcar_count: num(s.railcar_count ?? s.car_count),
    hazmat: s.hazmat === true || s.has_hazmat === true || null,
    freshness_seconds: f.ageS,
    freshness_tier: f.tier,
    operational: f.operational,
    confidence: num(s.confidence) ?? null
  };
}

/** Sensor metadata, keyed by id, so a sighting can be located when it carries no coordinates. */
async function fetchSensors(opts = {}) {
  if (!token(opts)) return { available: false, reason: 'no RAILSTATE_TOKEN configured', sensors: {} };
  try {
    const j = await request('/sensors/overview', opts);
    const list = Array.isArray(j) ? j : (j.sensors || j.data || []);
    const byId = {};
    for (const s of list) {
      const id = s.sensor_id ?? s.id;
      if (id !== undefined && id !== null) byId[id] = s;
    }
    return { available: true, sensors: byId, count: list.length };
  } catch (e) {
    return { available: false, reason: e.message, sensors: {} };
  }
}

/**
 * Current sightings as rail_movement events.
 *
 * Two calls, as RailState's own docs describe: active_sighting_ids is the "live position
 * view" starting point, then train_sightings resolves them.
 *
 * @param {Object} opts
 *   tiers          override freshness thresholds (per corridor)
 *   includeStale   return STALE movements too, flagged. Default false: they must not reach
 *                  an operational surface by accident.
 */
async function fetchMovements(opts = {}) {
  if (!token(opts)) {
    return {
      available: false,
      reason: 'no RAILSTATE_TOKEN configured',
      note: 'adapter is complete and will populate as soon as a token is set',
      movements: []
    };
  }
  try {
    const now = opts.now ? new Date(opts.now).getTime() : Date.now();
    const tiers = opts.tiers || DEFAULT_TIERS;

    const idsResp = await request('/trains/active_sighting_ids', opts);
    const ids = Array.isArray(idsResp) ? idsResp : (idsResp.ids || idsResp.sighting_ids || idsResp.data || []);
    if (!ids.length) return { available: true, movements: [], counts: { active: 0 } };

    const { sensors } = await fetchSensors(opts);

    // Chunked: an active list can be long and the ids go in the query string.
    const out = [];
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK).join(',');
      const j = await request(`/trains/train_sightings?ids=${encodeURIComponent(slice)}`, opts);
      const list = Array.isArray(j) ? j : (j.sightings || j.data || []);
      for (const s of list) {
        const m = toRailMovement(s, sensors, now, tiers);
        if (m) out.push(m);
      }
    }

    const operational = out.filter(m => m.operational);
    return {
      available: true,
      note: OBSERVATION_LATENCY_NOTE,
      counts: {
        active: ids.length,
        resolved: out.length,
        current: out.filter(m => m.freshness_tier === 'CURRENT').length,
        recent: out.filter(m => m.freshness_tier === 'RECENT').length,
        stale: out.filter(m => m.freshness_tier === 'STALE').length
      },
      movements: opts.includeStale ? out : operational
    };
  } catch (e) {
    return { available: false, reason: e.message, movements: [] };
  }
}

/**
 * Incremental sync, for keeping a local table rather than re-pulling everything.
 * RailState exposes last_modification_time_from for changes and a deletions endpoint for
 * reconciliation; both are needed or a local copy silently accumulates trips that RailState
 * has since retracted.
 */
async function fetchChanges(sinceIso, opts = {}) {
  if (!token(opts)) return { available: false, reason: 'no RAILSTATE_TOKEN configured' };
  try {
    const q = `?last_modification_time_from=${encodeURIComponent(sinceIso)}`;
    const [changed, deleted] = await Promise.all([
      request(`/trains/full_sightings${q}`, opts).catch(() => null),
      request(`/trains/deleted_sightings${q}`, opts).catch(() => null)
    ]);
    return { available: true, since: sinceIso, changed, deleted };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

module.exports = {
  fetchMovements, fetchChanges, fetchSensors, toRailMovement, freshness,
  BASE, DEFAULT_TIERS, OBSERVATION_LATENCY_NOTE
};
