/**
 * wz-exceptions.js — turns the TomTom deviation scorecard (services/tomtom-deviation.js) from a
 * "here's your grade" readout into a "here's your fix-list and the button" work queue.
 *
 * Each deviation finding is root-caused into an actionable exception with:
 *   - kind / reason / fix        : what's wrong and the one known remedy
 *   - priority (1 highest)       : so a steward works the misleading ones first
 *   - builderUrl                 : a deep link that opens THAT state's self-contained builder
 *                                  pre-filled with the flagged zone (round-trip to correct it)
 *
 * This closes the loop the Corridor Communicator otherwise leaves open: detect → diagnose → route →
 * correct (in the builder) → re-verify. The builder carries the exception id back in its WZDx/JSON
 * payload (x_resolves_exception) so a submitted correction can be tied to the finding it answers.
 */

// 2-letter state → builder file prefix (Iowa is the hand-built cars511 tool; everyone else is generated).
const STATE_BUILDER = {
  al:'aldot', ak:'akdot', az:'adot', ar:'ardot', ca:'caltrans', co:'cdot', ct:'ctdot', de:'deldot',
  fl:'fdot', ga:'gdot', hi:'hidot', id:'itd', il:'idot', in:'indot', ia:'cars511', ks:'ksdot',
  ky:'kytc', la:'ladotd', me:'mainedot', md:'mdotsha', ma:'massdot', mi:'midot', mn:'mndot', ms:'msdot',
  mo:'modot', mt:'mdt', ne:'nedot', nv:'nvdot', nh:'nhdot', nj:'njdot', nm:'nmdot', ny:'nysdot',
  nc:'ncdot', nd:'nddot', oh:'ohdot', ok:'okdot', or:'ordot', pa:'penndot', ri:'ridot', sc:'scdot',
  sd:'sddot', tn:'tdot', tx:'txdot', ut:'udot', vt:'vtrans', va:'vdot', wa:'wsdot', wv:'wvdot', wi:'wisdot', wy:'wydot'
};

// Approximate [W,S,E,N] bounding boxes — used only to resolve which state a nav-only (tomtomOnly)
// incident sits in, since those have no DOT state tag. First containing box wins (good enough to route
// a "create this zone" link to the right builder; the steward confirms on the map anyway).
const STATE_BBOX = {
  al:[-88.5,30.1,-84.9,35.1], ak:[-179,51,-129,71.5], az:[-114.9,31.3,-109,37.1], ar:[-94.7,33,-89.6,36.6],
  ca:[-124.5,32.5,-114.1,42.1], co:[-109.1,36.9,-102,41.1], ct:[-73.8,40.9,-71.7,42.1], de:[-75.8,38.4,-75,39.9],
  fl:[-87.7,24.4,-79.9,31.1], ga:[-85.7,30.3,-80.8,35.1], hi:[-160.3,18.8,-154.7,22.3], id:[-117.3,41.9,-111,49.1],
  il:[-91.6,36.9,-87.4,42.6], in:[-88.1,37.7,-84.7,41.8], ia:[-96.7,40.3,-90.1,43.6], ks:[-102.1,36.9,-94.5,40.1],
  ky:[-89.6,36.4,-81.9,39.2], la:[-94.1,28.9,-88.8,33.1], me:[-71.1,42.9,-66.9,47.5], md:[-79.5,37.8,-75,39.8],
  ma:[-73.6,41.2,-69.9,42.9], mi:[-90.5,41.6,-82.3,48.3], mn:[-97.3,43.4,-89.4,49.5], ms:[-91.7,30.1,-88.1,35.1],
  mo:[-95.8,35.9,-89,40.7], mt:[-116.1,44.3,-104,49.1], ne:[-104.1,39.9,-95.3,43.1], nv:[-120.1,35,-114,42.1],
  nh:[-72.6,42.6,-70.6,45.4], nj:[-75.6,38.9,-73.9,41.4], nm:[-109.1,31.3,-103,37.1], ny:[-79.8,40.4,-71.8,45.1],
  nc:[-84.4,33.8,-75.4,36.6], nd:[-104.1,45.9,-96.5,49.1], oh:[-84.9,38.4,-80.5,42.4], ok:[-103.1,33.6,-94.4,37.1],
  or:[-124.6,41.9,-116.4,46.3], pa:[-80.6,39.7,-74.7,42.3], ri:[-71.9,41.1,-71.1,42.1], sc:[-83.4,32,-78.5,35.3],
  sd:[-104.1,42.4,-96.4,45.9], tn:[-90.4,34.9,-81.6,36.7], tx:[-106.7,25.8,-93.5,36.6], ut:[-114.1,36.9,-109,42.1],
  vt:[-73.5,42.7,-71.5,45.1], va:[-83.7,36.5,-75.2,39.5], wa:[-124.9,45.5,-116.9,49.1], wv:[-82.7,37.1,-77.7,40.7],
  wi:[-92.9,42.4,-86.8,47.1], wy:[-111.1,40.9,-104,45.1]
};

const NAME_TO_ABBR = { alabama:'al', alaska:'ak', arizona:'az', arkansas:'ar', california:'ca', colorado:'co',
  connecticut:'ct', delaware:'de', florida:'fl', georgia:'ga', hawaii:'hi', idaho:'id', illinois:'il', indiana:'in',
  iowa:'ia', kansas:'ks', kentucky:'ky', louisiana:'la', maine:'me', maryland:'md', massachusetts:'ma', michigan:'mi',
  minnesota:'mn', mississippi:'ms', missouri:'mo', montana:'mt', nebraska:'ne', nevada:'nv', 'new hampshire':'nh',
  'new jersey':'nj', 'new mexico':'nm', 'new york':'ny', 'north carolina':'nc', 'north dakota':'nd', ohio:'oh',
  oklahoma:'ok', oregon:'or', pennsylvania:'pa', 'rhode island':'ri', 'south carolina':'sc', 'south dakota':'sd',
  tennessee:'tn', texas:'tx', utah:'ut', vermont:'vt', virginia:'va', washington:'wa', 'west virginia':'wv',
  wisconsin:'wi', wyoming:'wy' };

function normState(s) {
  if (!s) return null;
  const t = String(s).trim().toLowerCase();
  if (t.length === 2 && STATE_BUILDER[t]) return t;
  if (NAME_TO_ABBR[t]) return NAME_TO_ABBR[t];
  return null;
}
function coordState(c) {
  if (!Array.isArray(c) || c.length < 2) return null;
  const [lng, lat] = c;
  let best = null, bestArea = Infinity;
  for (const [ab, b] of Object.entries(STATE_BBOX)) {
    if (lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]) {
      const area = (b[2] - b[0]) * (b[3] - b[1]);          // smallest containing box = best guess where boxes overlap
      if (area < bestArea) { best = ab; bestArea = area; }
    }
  }
  return best;
}
function isInterstate(r) { return /\bI[-\s]?\d/i.test(String(r || '')); }

function builderLink(base, ab, z, exId, kind) {
  const idprefix = ab && STATE_BUILDER[ab];
  if (!idprefix) return null;
  const p = new URLSearchParams();
  p.set('rt', '1');
  if (z.route) p.set('route', String(z.route));
  const c = z.coordinates;
  if (Array.isArray(c) && c.length >= 2) { p.set('blat', (+c[1]).toFixed(5)); p.set('blng', (+c[0]).toFixed(5)); }
  if (z.description) p.set('description', String(z.description).slice(0, 300));
  if (z.county) p.set('counties', String(z.county));
  p.set('ex', exId); p.set('exkind', kind);
  const file = idprefix === 'cars511' ? 'cars511-request.html' : idprefix + '-wz-request.html';
  return base.replace(/\/$/, '') + '/' + file + '?' + p.toString();
}

/**
 * classify(scorecard, opts) → prioritized exception queue.
 * opts.builderBase : URL prefix where the static builders are served (default '').
 * opts.now         : ISO string for "now" (testing).
 * opts.limit       : cap (default 200).
 */
function classify(scorecard, opts = {}) {
  const now = opts.now ? Date.parse(opts.now) : Date.now();
  const base = opts.builderBase || '';
  const limit = opts.limit || 200;
  const out = [];
  const push = (bucket, z, kind, reason, fix, priority, extra) => {
    const ab = normState(z.state) || coordState(z.coordinates);
    const exId = bucket + ':' + (z.id != null ? z.id : (out.length + 1));
    out.push({
      id: exId, bucket, kind, priority,
      route: z.route || null, state: ab, county: z.county || null,
      coordinates: Array.isArray(z.coordinates) ? z.coordinates : null,
      reason, fix,
      builderUrl: builderLink(base, ab, z, exId, kind),
      builderAvailable: !!(ab && STATE_BUILDER[ab]),
      ...(extra || {})
    });
  };

  // dotOnly — DOT publishes it, no nav source shows it → not reaching drivers. Root-cause by symptom.
  for (const z of scorecard.dotOnly || []) {
    const endMs = z.endDate ? Date.parse(z.endDate) : null;
    if (endMs && endMs < now) {
      push('dotOnly', z, 'stale-active',
        'End date has passed but the zone is still active in your feed — a ghost zone nav already dropped.',
        'Close/expire it, or extend the end date if the work is genuinely ongoing.', 1,
        { endDate: z.endDate });
    } else if (!Array.isArray(z.coordinates)) {
      push('dotOnly', z, 'bad-geometry',
        'Zone has no usable location, so nav systems cannot place it.',
        'Add or repair the zone geometry.', 2);
    } else {
      push('dotOnly', z, 'not-reaching',
        'You publish this zone but no nav source is showing it — the feed is not propagating to consumers.',
        'Confirm your WZDx feed includes this zone and that it is being ingested (fields valid, feed fresh).',
        isInterstate(z.route) ? 2 : 3);
    }
  }
  // timingGaps — reaches nav, but the time windows disagree.
  for (const z of scorecard.timingGaps || []) {
    push('timingGaps', z, 'timing-mismatch',
      'Zone reaches nav, but your end date and the nav source disagree — drivers may see it after it clears (or miss it while active).',
      'Correct the zone end date to match reality.', 2,
      { dotEnd: z.dotEnd || null, tomtomEnd: z.tomtomEnd || null });
  }
  // tomtomOnly — nav sees a work zone your feed doesn't → unreported closure.
  for (const z of scorecard.tomtomOnly || []) {
    push('tomtomOnly', z, 'missing-from-feed',
      'A nav source shows a work zone here that your feed does not — an unreported closure.',
      'If it is yours, author it in the builder (opens pre-filled at this location).',
      isInterstate(z.route) ? 1 : 3, { create: true });
  }

  out.sort((a, b) => a.priority - b.priority || String(a.state).localeCompare(String(b.state)));
  const byKind = {};
  for (const e of out) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  return {
    generatedAt: new Date(now).toISOString(),
    total: out.length,
    byKind,
    coveragePct: scorecard.summary ? scorecard.summary.coveragePct : null,
    actionable: out.filter(e => e.builderAvailable).length,
    exceptions: out.slice(0, limit)
  };
}

module.exports = { classify, normState, coordState, STATE_BUILDER };
