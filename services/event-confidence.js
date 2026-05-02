/**
 * Event confidence scoring.
 *
 * Computes a 0–100 score per event reflecting how trustworthy / actionable
 * the event is. Pure function — no I/O, no state. Reuses the same kinds of
 * field validation already done by compliance-analyzer but shaped around
 * "should an operator trust this enough to act on it?" rather than
 * "is this spec-compliant?"
 *
 * Five weighted components:
 *
 *   1. Completeness (35%)        — critical fields present
 *   2. Geospatial precision (15%) — lat/lng + linestring geometry
 *   3. Temporal validity (20%)   — has startTime, end-time, not too stale
 *   4. Description quality (15%) — narrative length / specificity
 *   5. Verification (15%)        — DOT operator comments corroborate
 *
 * Returns a confidence level string for downstream filtering / display:
 *   VERIFIED (≥85), HIGH (70-84), MEDIUM (50-69), LOW (30-49), UNVERIFIED (<30)
 */

function levelFromScore(score) {
  if (score >= 85) return 'VERIFIED';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  if (score >= 30) return 'LOW';
  return 'UNVERIFIED';
}

function isFiniteNum(n) {
  const v = parseFloat(n);
  return Number.isFinite(v) && v !== 0;
}

function scoreCompleteness(event) {
  const fields = [
    !!event.id,
    !!event.eventType,
    !!(event.startTime || event.startDate),
    isFiniteNum(event.latitude) && isFiniteNum(event.longitude),
    !!event.description && String(event.description).trim().length >= 10,
    !!event.severity,
    !!(event.corridor || event.location)
  ];
  const present = fields.filter(Boolean).length;
  return Math.round((present / fields.length) * 100);
}

function scoreGeospatial(event) {
  const hasCoords = isFiniteNum(event.latitude) && isFiniteNum(event.longitude);
  const hasGeom = !!event.geometry &&
    (event.geometry.type === 'LineString' || event.geometry.type === 'MultiLineString') &&
    Array.isArray(event.geometry.coordinates) &&
    event.geometry.coordinates.length > 0;
  if (hasGeom) return 100;
  if (hasCoords) return 70;
  return 0;
}

function scoreTemporal(event, nowMs = Date.now()) {
  let s = 0;
  const startMs = event.startTime ? Date.parse(event.startTime) : (event.startDate ? Date.parse(event.startDate) : NaN);
  const endMs = event.endTime ? Date.parse(event.endTime) : (event.endDate ? Date.parse(event.endDate) : NaN);

  if (!Number.isNaN(startMs)) s += 60;        // valid start
  if (!Number.isNaN(endMs)) s += 25;          // explicit end window
  // Freshness: penalize events whose start was > 6 hours ago and have no end
  if (!Number.isNaN(startMs) && Number.isNaN(endMs)) {
    const hoursAgo = (nowMs - startMs) / 3_600_000;
    if (hoursAgo <= 6) s += 15;
    else if (hoursAgo <= 24) s += 8;
    // older: no bonus
  } else if (!Number.isNaN(endMs)) {
    s += 15;
  }
  return Math.min(100, s);
}

function scoreDescription(event) {
  const desc = String(event.description || '').trim();
  if (desc.length >= 60) return 100;
  if (desc.length >= 30) return 70;
  if (desc.length >= 10) return 40;
  return 0;
}

function scoreVerification(event, comments = []) {
  // Distinct non-system commenters corroborate the event.
  const ours = new Set();
  for (const c of comments) {
    const who = (c.state_name || c.stateName || '').trim();
    if (who && who !== 'Matt’s Experimental Sandbox' && who !== "Matt's Experimental Sandbox") {
      ours.add(who);
    }
  }
  if (ours.size >= 3) return 100;
  if (ours.size === 2) return 75;
  if (ours.size === 1) return 50;
  return 0;
}

const WEIGHTS = {
  completeness: 0.35,
  geospatial:  0.15,
  temporal:    0.20,
  description: 0.15,
  verification: 0.15
};

/**
 * Score one event.
 * @param {object} event - normalized event from eventsCache
 * @param {object} opts
 * @param {Array}  [opts.comments] - rows from event_comments for this event
 * @param {number} [opts.nowMs]    - injectable clock for tests
 * @returns scoring result
 */
function scoreEventConfidence(event, opts = {}) {
  if (!event || typeof event !== 'object') {
    return null;
  }
  const comments = Array.isArray(opts.comments) ? opts.comments : [];

  const components = {
    completeness: scoreCompleteness(event),
    geospatial:   scoreGeospatial(event),
    temporal:     scoreTemporal(event, opts.nowMs),
    description:  scoreDescription(event),
    verification: scoreVerification(event, comments)
  };

  const score = Math.round(
    Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + components[k] * w, 0)
  );

  // Estimated false-positive probability is the inverse of the score in the
  // bottom half, capped at 0.6 — gives a quick gut-check field for ops UIs.
  const falsePositiveProbability = Math.max(0, Math.min(0.6, (60 - score) / 100));

  return {
    score,
    level: levelFromScore(score),
    falsePositiveProbability: Math.round(falsePositiveProbability * 100) / 100,
    components,
    weights: WEIGHTS
  };
}

module.exports = {
  scoreEventConfidence,
  levelFromScore
};
