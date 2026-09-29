/**
 * Cross-source duplicate detection for the merged event set.
 *
 * The refresh deduplicates on `event.id` and nothing else. That is correct for a single
 * publisher — its ids are authoritative — but it cannot see the case this file exists for:
 * the SAME physical work zone arriving from two different systems under two different ids.
 * We ingest overlapping sources on purpose, so that case is routine rather than exceptional.
 *
 * Measured 2026-09-29, a state's own WZDx feed against its own 511 construction layer,
 * interstate zones only, 300 m:
 *   Idaho      WZDx 125  /  511  32  ->  22 of the 32 were the same zone   (69%)
 *   Utah       WZDx  18  /  511  34  ->   3 of the 34
 *   Louisiana  WZDx   5  /  511  23  ->   0 of the 23
 * So overlap is real but it is a property of the SOURCE PAIR, not of the pipeline. Dropping
 * either adapter would have cost Utah 31 zones and Louisiana all 23 to save Idaho's 22 —
 * which is why this is done here, per event, instead of by removing a feed.
 *
 * Duplicates are MERGED, NOT DISCARDED. Two independent state systems reporting the same
 * zone is exactly what corroboration means, so the survivor carries `x_also_reported_by`
 * and that becomes evidence rather than something thrown away to tidy a count. Deleting the
 * loser silently would also make the platform's own event totals unauditable.
 *
 * Deliberately conservative — a false merge hides a real closure from a traveller, which is
 * far worse than showing one zone twice. Every gate below must pass:
 *   - different `source` (never merges within a publisher; its ids already decide)
 *   - same normalized interstate corridor, both resolvable
 *   - same direction, when both are known
 *   - overlapping active windows, when both are dated
 *   - representative geometries within `maxM`
 */

const DEFAULT_MAX_M = 250;

// Normalized interstate designation, or null. Bare/loose forms are deliberately NOT accepted
// here: a corridor guess is what would let two unrelated zones share a bucket.
function corridorOf(ev) {
  const t = `${ev.corridor || ''} ${ev.road || ''} ${ev.route || ''} ${ev.location || ''}`;
  const m = t.toUpperCase().match(/\bI[-\s]?(\d{1,3})\b/);
  return m ? `I-${parseInt(m[1], 10)}` : null;
}

function dirOf(ev) {
  const t = String(ev.direction || '').trim().toUpperCase();
  if (!t || /UNKNOWN|BOTH|ALL/.test(t)) return null;
  const c = t[0];
  return 'NSEW'.includes(c) ? c : null;
}

// Every coordinate we can cheaply get. A LineString compared only at its midpoint would
// miss a long zone that overlaps another only near one end.
function pointsOf(ev) {
  const g = ev.geometry;
  if (g && g.type === 'LineString' && Array.isArray(g.coordinates)) {
    return g.coordinates.filter((c) => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]));
  }
  if (g && g.type === 'Point' && Array.isArray(g.coordinates) && Number.isFinite(g.coordinates[0])) {
    return [g.coordinates];
  }
  const p = ev.coordinates || (Number.isFinite(ev.longitude) ? [ev.longitude, ev.latitude] : null);
  return (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) ? [p] : [];
}

function metersBetween(a, b) {
  const dx = (a[0] - b[0]) * 111320 * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  const dy = (a[1] - b[1]) * 110540;
  return Math.hypot(dx, dy);
}

function minDistance(pa, pb, cutoff) {
  let best = Infinity;
  for (const a of pa) {
    for (const b of pb) {
      const d = metersBetween(a, b);
      if (d < best) best = d;
      if (best <= cutoff) return best;      // close enough; no need to keep looking
    }
  }
  return best;
}

// Unknown dates cannot exclude a match — most of these feeds leave end_date open — so an
// absent window is permissive. Only two KNOWN, disjoint windows reject.
function windowsOverlap(a, b) {
  const as = Date.parse(a.startTime || a.startDate || ''), ae = Date.parse(a.endTime || a.endDate || '');
  const bs = Date.parse(b.startTime || b.startDate || ''), be = Date.parse(b.endTime || b.endDate || '');
  if (Number.isFinite(ae) && Number.isFinite(bs) && ae < bs) return false;
  if (Number.isFinite(be) && Number.isFinite(as) && be < as) return false;
  return true;
}

// Which of two records to keep. Richer geometry first — a LineString states the extent of a
// closure, a point only asserts it exists somewhere — then field completeness.
function richness(ev) {
  let n = 0;
  if (ev.geometry && ev.geometry.type === 'LineString') n += 100;
  const pts = pointsOf(ev);
  n += Math.min(pts.length, 50);
  for (const f of ['description', 'startTime', 'endTime', 'direction', 'roadStatus', 'severity', 'lanes']) {
    if (ev[f] != null && ev[f] !== '') n += 2;
  }
  return n;
}

/**
 * Find and merge cross-source duplicates.
 * Returns { events, merged, groups } — `events` is the surviving set, in input order.
 * Pure with respect to ordering: the survivor of a group is chosen by richness, not position.
 */
function dedupe(events, opts = {}) {
  const maxM = opts.maxM || DEFAULT_MAX_M;
  const list = Array.isArray(events) ? events : [];
  if (list.length < 2) return { events: list, merged: 0, groups: [] };

  // Bucket by corridor + a coarse geographic cell, so only plausible pairs are ever compared.
  // Cell is sized to maxM and each event is registered in its own cell plus the eight around
  // it, which is what keeps a pair straddling a cell boundary from being missed.
  const CELL = Math.max(maxM / 111320, 0.001);
  const buckets = new Map();
  const meta = new Array(list.length);
  for (let i = 0; i < list.length; i++) {
    const ev = list[i];
    const corridor = corridorOf(ev);
    const pts = pointsOf(ev);
    meta[i] = { corridor, pts, dir: dirOf(ev) };
    if (!corridor || !pts.length) continue;              // unresolvable: never a merge candidate
    const cells = new Set();
    for (const p of pts) {
      const cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) cells.add(`${corridor}|${cx + dx}:${cy + dy}`);
    }
    for (const k of cells) {
      let b = buckets.get(k);
      if (!b) buckets.set(k, b = []);
      b.push(i);
    }
  }

  // Collect confirmed pairs, then merge by DIRECT pairing only — deliberately not a
  // clustering. The first version of this used union-find, and transitive closure wrecked it:
  // two zones from the SAME publisher, which the source guard means are never compared to each
  // other, both matched one shared cross-source record and were therefore pulled into one
  // group through it. On Idaho's I-84 that collapsed 34 distinct WZDx zones into a single
  // event. Chaining A~B~C along a corridor does the same thing wherever zones sit closer
  // together than maxM, which on a busy corridor is normal.
  //
  // So: a record is only ever dropped by the record it was directly compared against, and a
  // record that has already been dropped can absorb nothing. Same-source records can then
  // never merge, whatever they have in common. Closest pairs are settled first so the
  // strongest evidence wins, and the result does not depend on input order.
  const compared = new Set();
  const pairs = [];
  for (const idxs of buckets.values()) {
    for (let x = 0; x < idxs.length; x++) {
      for (let y = x + 1; y < idxs.length; y++) {
        const i = idxs[x], j = idxs[y];
        const pk = i < j ? `${i},${j}` : `${j},${i}`;
        if (compared.has(pk)) continue;
        compared.add(pk);
        const a = list[i], b = list[j], ma = meta[i], mb = meta[j];
        if (String(a.source || '') === String(b.source || '')) continue;   // same publisher
        if (ma.dir && mb.dir && ma.dir !== mb.dir) continue;
        if (!windowsOverlap(a, b)) continue;
        const d = minDistance(ma.pts, mb.pts, maxM);
        if (d > maxM) continue;
        pairs.push({ i, j, d });
      }
    }
  }
  pairs.sort((p, q) => p.d - q.d);

  const drop = new Set();
  const groups = [];
  const groupOf = new Map();          // survivor index -> group record
  for (const { i, j } of pairs) {
    if (drop.has(i) || drop.has(j)) continue;
    const keep = richness(list[i]) >= richness(list[j]) ? i : j;
    const lose = keep === i ? j : i;
    // A survivor may absorb several records from OTHER sources, but only ones it was measured
    // against directly. Never absorb a second record from a source it already absorbed.
    const g = groupOf.get(keep);
    const loserSource = String(list[lose].source || '');
    if (g && g.sources.has(loserSource)) continue;
    drop.add(lose);
    const survivor = list[keep];
    const also = survivor.x_also_reported_by ? survivor.x_also_reported_by.slice() : [];
    also.push({ source: list[lose].source || null, id: list[lose].id, state: list[lose].state || null });
    survivor.x_also_reported_by = also;
    survivor.x_cross_source_count = 1 + also.length;
    if (g) { g.dropped.push(list[lose].id); g.sources.add(loserSource); }
    else {
      const rec = { kept: survivor.id, corridor: meta[keep].corridor, dropped: [list[lose].id], sources: new Set([loserSource]) };
      groupOf.set(keep, rec); groups.push(rec);
    }
  }
  for (const g of groups) delete g.sources;

  return {
    events: list.filter((_, i) => !drop.has(i)),
    merged: drop.size,
    groups
  };
}

module.exports = { dedupe, corridorOf, dirOf, pointsOf, minDistance, windowsOverlap, richness, DEFAULT_MAX_M };
