/**
 * Validation coverage: how many work zones in a given scope are corroborated, against how many
 * there are — by state, by route, or nationally.
 *
 * The platform could already say "here are the validated work zones" and could not say what
 * share of the work zones that was. Those are very different claims. 400 validated zones is a
 * headline; 400 of 6,000 is a programme, and 400 of 450 is a different programme.
 *
 * THREE-STATE, because two-state arithmetic lies here. A zone divides into:
 *   validated     at least one independent source corroborates it
 *   unvalidated   nothing corroborates it, and it was genuinely checkable
 *   NOT EVALUABLE  it could never have been corroborated, so counting it as a failure
 *                  understates every rate that includes it
 *
 * A zone is not evaluable when its publisher is frozen (x_stale_source — the feed has not
 * updated in STALE_SOURCE_DAYS, so "no camera saw activity" says nothing about the zone) or
 * when it has no usable position, since every validator matches on geometry. Utah alone
 * contributes several hundred of the first kind. Folding those into the denominator would have
 * made Utah look like a validation failure when it is a publishing failure.
 *
 * WHAT THE DENOMINATOR IS, stated because it is the whole argument: active WORK ZONES. Not all
 * events. Incidents and crashes are not work zones and are not what the validators are built to
 * confirm, so including them would deflate every rate for no reason. Callers can see the
 * excluded counts rather than having to trust the filter.
 *
 * Per-validator counts OVERLAP on purpose — a zone confirmed by a camera and a device counts in
 * both — so they sum to more than `validated`. That is the point: it shows which sources are
 * doing the work in a given state, which is the thing that tells you what to invest in.
 */

const SOURCES = ['device', 'camera', 'tomtom', 'dms', 'worker-presence'];

function isWorkZone(e) {
  const t = String(e.eventType || e.type || '').toLowerCase();
  return t.includes('work') || t.includes('construction') || t.includes('roadwork');
}

// Mirrors the validator set the CWZ feed publishes. Kept in one place so a new validator
// cannot be added to the feed and silently missed by the coverage number.
function sourcesFor(e) {
  const out = [];
  if (e.x_cwz_connected) out.push('device');
  if (e.x_camera_verified) out.push('camera');
  if (e.x_tomtom_corroborated) out.push('tomtom');
  if (e.x_dms_corroborated) out.push('dms');
  if (e.x_workers_present) out.push('worker-presence');
  return out;
}

// Number(null) is 0 and Number('') is 0, so a finite-check on a coerced value reports a
// missing coordinate as a valid position at 0,0 -- in the Gulf of Guinea, where no validator
// will ever match it, so the zone reads as a validation FAILURE rather than as unjudgeable.
// Reject null/undefined/empty explicitly, and reject the 0,0 null island on its own merits.
function num(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function hasPosition(e) {
  const g = e.geometry && e.geometry.coordinates;
  if (Array.isArray(g) && g.length) {
    const flat = JSON.stringify(g).match(/-?\d+(\.\d+)?/g);
    if (flat && flat.length >= 2) return true;
  }
  const lon = num(e.longitude), lat = num(e.latitude);
  if (Number.isNaN(lon) || Number.isNaN(lat)) return false;
  return !(lon === 0 && lat === 0);
}

// Normalized interstate designation, or null. Deliberately strict: a loose match would put two
// unrelated roads in one bucket and the per-route rate is the number people will quote.
function routeOf(e) {
  const t = `${e.corridor || ''} ${e.road || ''} ${e.route || ''} ${e.location || ''}`;
  const m = t.toUpperCase().match(/\bI[-\s]?(\d{1,3})\b/);
  return m ? `I-${parseInt(m[1], 10)}` : null;
}

// The `state` on an event is a DISPLAY LABEL from the feed config, not a state identity, and
// grouping on it raw splits one state across several rows. Observed in a live run: 'CA' and
// 'OH' as bare codes next to 'North Carolina' as a name, plus 'Iowa WZDx' and
// 'Arizona (Maricopa)' carrying the feed's name rather than the state's. A per-state rate that
// reports Iowa twice is worse than no per-state rate, because someone will quote one of them.
const CODE_TO_NAME = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts',
  MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};
function normalizeState(raw) {
  let t = String(raw || '').trim();
  if (!t) return '(unknown)';
  // A feed covering several states cannot be split without per-event attribution, which these
  // events do not carry. Keep the label rather than inventing one, so the row is obviously
  // multi-state to anyone reading it.
  if (/\//.test(t) && /\(/.test(t)) return t;
  t = t.replace(/\s*\([^)]*\)\s*/g, ' ').trim();          // 'Arizona (Maricopa)' -> 'Arizona'
  t = t.replace(/\s+(WZDx|LCS|API|511|DOT|Feed)$/i, '').trim(); // 'Iowa WZDx' -> 'Iowa'
  const up = t.toUpperCase();
  if (CODE_TO_NAME[up]) return CODE_TO_NAME[up];
  return t;
}

function blank() {
  const bySource = {};
  for (const s of SOURCES) bySource[s] = 0;
  return { total: 0, validated: 0, unvalidated: 0, notEvaluable: 0, multiSource: 0, bySource,
    notEvaluableReasons: { staleSource: 0, noPosition: 0 } };
}

function tally(bucket, e) {
  const src = sourcesFor(e);
  // Order matters: a stale-source zone is unjudgeable even if something corroborated it
  // earlier, because the sticky ledger would keep reporting that credit indefinitely.
  if (e.x_stale_source) {
    bucket.total++; bucket.notEvaluable++; bucket.notEvaluableReasons.staleSource++; return;
  }
  if (!hasPosition(e)) {
    bucket.total++; bucket.notEvaluable++; bucket.notEvaluableReasons.noPosition++; return;
  }
  bucket.total++;
  if (src.length) {
    bucket.validated++;
    if (src.length >= 2) bucket.multiSource++;
    for (const s of src) bucket.bySource[s]++;
  } else bucket.unvalidated++;
}

// Rate over the EVALUABLE population, not over total. Dividing by total would quietly punish a
// state for its publisher being frozen, which is a different problem with a different owner.
function finish(b) {
  const evaluable = b.total - b.notEvaluable;
  b.evaluable = evaluable;
  b.rate = evaluable > 0 ? Math.round((1000 * b.validated) / evaluable) / 10 : null;
  b.multiSourceRate = evaluable > 0 ? Math.round((1000 * b.multiSource) / evaluable) / 10 : null;
  if (evaluable === 0) b.note = 'NOT EVALUATED — no judgeable work zones in this scope';
  return b;
}

/**
 * @param events   the cached event set
 * @param opts     { state, route, by: 'state'|'route'|'none', workZonesOnly=true }
 * Returns { scope, national, groups, excluded }
 */
function coverage(events, opts = {}) {
  const list = Array.isArray(events) ? events : [];
  const by = opts.by || 'none';
  const wantState = opts.state ? String(opts.state).toLowerCase() : null;
  const wantRoute = opts.route ? String(opts.route).toUpperCase().replace(/\s+/g, '-') : null;

  const national = blank();
  const groups = new Map();
  const excluded = { notWorkZone: 0, outOfScope: 0 };

  for (const e of list) {
    if (opts.workZonesOnly !== false && !isWorkZone(e)) { excluded.notWorkZone++; continue; }
    const st = String(e.state || '').toLowerCase();
    const rt = routeOf(e);
    // Match on the normalized name, the raw label, or a two-letter code, so ?state=IA,
    // ?state=Iowa and ?state="Iowa WZDx" all select the same zones.
    if (wantState) {
      const norm = normalizeState(e.state).toLowerCase();
      const want = wantState.length === 2 ? (CODE_TO_NAME[wantState.toUpperCase()] || wantState).toLowerCase() : wantState;
      if (norm !== want && st !== want) { excluded.outOfScope++; continue; }
    }
    if (wantRoute && rt !== wantRoute) { excluded.outOfScope++; continue; }

    tally(national, e);
    if (by === 'state' || by === 'route') {
      // A zone with no resolvable route still counts nationally; it just cannot be placed in a
      // route bucket, and inventing one would be worse than leaving it out of the breakdown.
      const key = by === 'state' ? normalizeState(e.state) : rt;
      if (key) {
        let g = groups.get(key);
        if (!g) groups.set(key, g = blank());
        tally(g, e);
      }
    }
  }

  const out = { scope: { state: opts.state || null, route: opts.route || null, by },
    national: finish(national), excluded };
  if (by !== 'none') {
    out.groups = [...groups.entries()]
      .map(([k, v]) => ({ key: k, ...finish(v) }))
      .sort((a, b) => b.total - a.total);
  }
  return out;
}

module.exports = { coverage, sourcesFor, routeOf, isWorkZone, normalizeState, SOURCES };
