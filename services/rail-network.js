/**
 * The rail network as a traversable graph, with chainage computed here.
 *
 * WHY THIS EXISTS. Projecting a train with a bearing cone cannot tell parallel tracks apart.
 * At Boone the UP mainline and the Boone & Scenic Valley tourist line run a few hundred
 * metres apart; at any yard, diamond or junction the cone is worse. The only honest way to
 * say "this crossing is ahead of this train" is to put the train ON a track and walk it.
 *
 * WHY WE COMPUTE MEASURES OURSELVES. The obvious plan was to reuse Iowa's linear
 * referencing: Rail_Line_Active_View advertises hasM:true and Rail_Crossing_View carries
 * ROUTE_ID + MEASURE. Both turned out to be dead ends, and it is worth recording why so
 * nobody tries again:
 *
 *   - The M values are declared but EMPTY. Across 1,182 vertices fetched around Boone,
 *     zero were non-null; every vertex comes back [lon, lat, 0, null].
 *   - The crossings' ROUTE_ID/MEASURE is ROADWAY referencing, not rail. "M075041590N" at
 *     measure 0.465 is a short city street -- it says where the crossing sits along the
 *     ROAD, which is useless for along-track projection. Adjacent crossings on one rail
 *     corridor carry different ROUTE_IDs.
 *
 * So chainage is accumulated over the geometry here. Crossings are joined to track
 * geometrically, which the data supports well: sampled crossings snap to a line at a median
 * of about 1 m, 7 of 10 within 25 m.
 *
 * THE SHAPE OF THE DATA, which dictates the traversal:
 *   - Segments are short -- median 0.17 mi, max 3.5 mi -- so a 12-mile projection crosses
 *     dozens of them and needs connectivity, not a single feature.
 *   - Yard track OUTNUMBERS main track (80 Yard vs 74 Main around Boone). A through train
 *     must not be walked down a yard lead, so track type ranks continuations.
 *   - Owner marks differ BETWEEN LAYERS: the crossing domain says "BSVY" where the line
 *     layer says "BSV". Compared naively that reads as two railroads. Canonicalised below.
 */

// NATIONAL. This was Iowa's Rail_Line_Active_View, which quietly made the whole projection
// engine stop at the state line: a train outside Iowa found no track to snap to, so it
// produced no impacts at all -- indistinguishable from "no crossings ahead". Measured before
// the switch: 0 of 22 active trains snapped nationwide.
//
// NARN covers North America. Iowa's layer is richer where it applies (a real TRACK_TYPE
// field, a cleaner owner) but a corridor tool cannot be state-shaped.
const LINES_URL =
  'https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0/query';

// NARN's NET code -> the track classes the traversal ranks by. Main line carries through
// movements; yard and industrial track exists to be avoided when choosing a continuation.
const NET_TO_TRACK = { M: 'Main', S: 'Siding', Y: 'Yard', I: 'Industrial', O: 'Other', A: 'Abandoned' };

// Same railroad, different reporting mark depending on which layer you ask.
const OWNER_CANON = {
  BSVY: 'BSV', UPRR: 'UP', 'UNION PACIFIC': 'UP', BNSFR: 'BNSF',
  CPKC: 'CP', SOO: 'CP', AMTK: 'AMTRAK', CNW: 'UP', ICG: 'CN'
};
const canonOwner = v => {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).toUpperCase().trim();
  return OWNER_CANON[s] || s;
};

// A through movement follows main line. Yard and industrial track exist to be avoided when
// choosing how a train continues through a junction.
// Ordered by how plausibly a through movement continues onto it. Abandoned track is last by
// a wide margin: NARN carries it, and nothing should ever be projected down a line that is
// not there any more.
const TRACK_RANK = {
  Main: 0, Siding: 1, Spur: 2, Turnout: 3, Industrial: 4, Yard: 5, Other: 6, Abandoned: 20
};
const trackRank = t => (TRACK_RANK[t] === undefined ? 6 : TRACK_RANK[t]);

const R_EARTH_M = 6371008.8;
const rad = d => d * Math.PI / 180;

// Local equirectangular metres. Distances here are at most tens of km, where this is
// accurate to well under a metre and far cheaper than repeated haversines.
function projector(refLat) {
  const kx = Math.cos(rad(refLat)) * 111320, ky = 110540;
  return {
    x: lon => lon * kx, y: lat => lat * ky,
    toM: (a, b) => Math.hypot((b.lon - a.lon) * kx, (b.lat - a.lat) * ky)
  };
}

function httpsGetJSON(url, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const req = require('https').get(url, { timeout: timeoutMs, headers: { 'User-Agent': 'CorridorCommunicator/1.0' } }, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let b = ''; res.setEncoding('utf8');
      res.on('data', d => { b += d; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// Endpoints within ~11 m are treated as the same junction. Rail segments that actually
// connect share a vertex, so this only has to absorb digitising noise.
const NODE_PRECISION = 4;
const nodeKey = (lon, lat) => `${lon.toFixed(NODE_PRECISION)},${lat.toFixed(NODE_PRECISION)}`;

/**
 * Load the active rail network around a point and index it for traversal.
 * @returns {{edges:Array, nodes:Map, proj:Object, truncated:boolean}}
 */
async function loadNetwork(lat, lon, radiusM) {
  const dLat = (radiusM / R_EARTH_M) * 180 / Math.PI;
  const dLon = dLat / Math.max(Math.cos(rad(lat)), 1e-6);
  const bb = [lon - dLon, lat - dLat, lon + dLon, lat + dLat].join(',');
  // PAGE IT. The service caps a response at 2,000 features and returns them in OBJECTID
  // order, so in a dense metro the cap silently drops track — including, in one observed
  // case, the very line the train was sitting on. Train 5 in Oakland failed to snap with
  // "not within 300 m of active rail" while the nearest rail was 2 METRES away, purely
  // because that segment fell past the cap. A truncated network does not just lose detail;
  // it produces a confident wrong answer.
  const PAGE = 2000;
  const MAX_FEATURES = 8000;        // enough for the densest junctions seen; bounded on purpose
  const feats = [];
  let truncated = false;
  for (let offset = 0; offset < MAX_FEATURES; offset += PAGE) {
    const url = LINES_URL +
      '?where=1%3D1&geometry=' + encodeURIComponent(bb) +
      '&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects' +
      '&outFields=' + encodeURIComponent('OBJECTID,RROWNER1,RROWNER2,RROWNER3,TRACKS,NET,SUBDIV,MILES,STATEAB') +
      '&returnGeometry=true&outSR=4326&resultRecordCount=' + PAGE + '&resultOffset=' + offset + '&f=json';
    const page = await httpsGetJSON(url);
    const got = (page && page.features) || [];
    feats.push(...got);
    if (got.length < PAGE) break;
    if (offset + PAGE >= MAX_FEATURES) { truncated = true; break; }
  }

  const proj = projector(lat);
  const edges = [];
  const nodes = new Map();

  for (const f of feats) {
    const a = f.attributes || {};
    for (const path of ((f.geometry && f.geometry.paths) || [])) {
      const pts = path.map(p => ({ lon: p[0], lat: p[1] })).filter(p => Number.isFinite(p.lon) && Number.isFinite(p.lat));
      if (pts.length < 2) continue;
      // Cumulative distance along this edge, so a position on it is a scalar.
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + proj.toM(pts[i - 1], pts[i]));
      const edge = {
        id: edges.length,
        objectId: a.OBJECTID,
        owner: canonOwner(a.RROWNER1),
        ownerRaw: a.RROWNER1 || null,
        // NARN names up to three owners on a segment, which is how it represents trackage
        // rights -- the case that makes "whose track is this" more than one string, and the
        // limitation flagged when the old owner heuristic was removed.
        owners: [a.RROWNER1, a.RROWNER2, a.RROWNER3].filter(Boolean).map(canonOwner),
        operator: a.SUBDIV || null,
        trackType: NET_TO_TRACK[a.NET] || 'Other',
        mains: a.TRACKS ?? null,
        state: a.STATEAB || null,
        pts, cum, lengthM: cum[cum.length - 1]
      };
      if (edge.lengthM <= 0) continue;
      edges.push(edge);
      for (const [end, p] of [['a', pts[0]], ['b', pts[pts.length - 1]]]) {
        const k = nodeKey(p.lon, p.lat);
        if (!nodes.has(k)) nodes.set(k, []);
        nodes.get(k).push({ edgeId: edge.id, end });
      }
      edge.nodeA = nodeKey(pts[0].lon, pts[0].lat);
      edge.nodeB = nodeKey(pts[pts.length - 1].lon, pts[pts.length - 1].lat);
    }
  }
  return { edges, nodes, proj, truncated };
}

/** Closest point on one edge to p: {distM, alongM, index, t}. */
function projectOnEdge(proj, edge, p) {
  let best = { distM: Infinity, alongM: 0 };
  for (let i = 0; i < edge.pts.length - 1; i++) {
    const a = edge.pts[i], b = edge.pts[i + 1];
    const ax = proj.x(a.lon), ay = proj.y(a.lat);
    const bx = proj.x(b.lon), by = proj.y(b.lat);
    const px = proj.x(p.lon), py = proj.y(p.lat);
    const vx = bx - ax, vy = by - ay;
    const L2 = vx * vx + vy * vy;
    let t = L2 ? ((px - ax) * vx + (py - ay) * vy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
    if (d < best.distM) {
      best = { distM: d, alongM: edge.cum[i] + t * (edge.cum[i + 1] - edge.cum[i]), index: i, t };
    }
  }
  return best;
}

/** Bearing of an edge at a given along-distance, in the stated direction of travel. */
function edgeBearingAt(edge, alongM, forward = true) {
  let i = 0;
  while (i < edge.cum.length - 2 && edge.cum[i + 1] < alongM) i++;
  const a = edge.pts[i], b = edge.pts[i + 1];
  const from = forward ? a : b, to = forward ? b : a;
  const y = Math.sin(rad(to.lon - from.lon)) * Math.cos(rad(to.lat));
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) -
    Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lon - from.lon));
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

const angleDelta = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/**
 * Put a movement on a specific track.
 *
 * Nearest track alone is not enough where several run together, so candidates are scored on
 * snap distance, track type (a through train belongs on main line, not a yard lead) and
 * agreement with the reported heading. The chosen edge's OWNER is the answer to "whose
 * crossings should be considered" -- which is a different question from who runs the train.
 */
function snapToNetwork(net, point, opts = {}) {
  const headingDeg = opts.headingDeg;
  const maxSnapM = opts.maxSnapM || 250;
  const cands = [];
  for (const edge of net.edges) {
    const pr = projectOnEdge(net.proj, edge, point);
    if (pr.distM > maxSnapM) continue;
    let headingPenalty = 0, forward = true;
    if (headingDeg !== undefined && headingDeg !== null) {
      const fwd = edgeBearingAt(edge, pr.alongM, true);
      const dF = angleDelta(headingDeg, fwd), dB = angleDelta(headingDeg, (fwd + 180) % 360);
      forward = dF <= dB;
      // Track is bidirectional, so only the ALIGNMENT matters, not which way it was drawn.
      headingPenalty = Math.min(dF, dB);
    }
    cands.push({
      edge, distM: pr.distM, alongM: pr.alongM, forward, headingPenalty,
      // Distance dominates; a wrong-alignment or yard track has to be much closer to win.
      score: pr.distM + trackRank(edge.trackType) * 40 + headingPenalty * 1.5
    });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.score - b.score);
  const best = cands[0];
  const runnerUp = cands[1] || null;

  // Confidence reflects how clear-cut the choice was: a tight snap that also beat its
  // nearest rival comfortably is trustworthy; two parallel tracks 8 m apart is not.
  const sep = runnerUp ? Math.min(1, (runnerUp.score - best.score) / 60) : 1;
  const tight = Math.max(0, 1 - best.distM / (opts.maxSnapM || 250));
  const aligned = best.headingPenalty ? Math.max(0, 1 - best.headingPenalty / 90) : 1;
  const confidence = +(0.25 + 0.35 * tight + 0.2 * sep + 0.2 * aligned).toFixed(3);

  return {
    edgeId: best.edge.id,
    trackOwner: best.edge.owner,
    trackOwnerRaw: best.edge.ownerRaw,
    trackOperator: best.edge.operator,
    trackType: best.edge.trackType,
    snapDistanceM: +best.distM.toFixed(1),
    alongM: best.alongM,
    forward: best.forward,
    bearing: edgeBearingAt(best.edge, best.alongM, best.forward),
    headingAgreementDeg: best.headingPenalty === 0 ? null : +best.headingPenalty.toFixed(1),
    candidates: cands.length,
    runnerUpDistanceM: runnerUp ? +runnerUp.distM.toFixed(1) : null,
    confidence: Math.min(1, confidence)
  };
}

/**
 * Walk the network forward from a snap, accumulating true along-track distance.
 *
 * At each junction the continuation is the one a train would actually take: straightest
 * first, then same owner, then main track over yard. Reversals are refused outright -- a
 * train does not double back through a switch mid-run, and allowing it lets the walk fold
 * back over itself and invent crossings behind the train.
 */
function traverse(net, snap, opts = {}) {
  const maxDistM = opts.maxDistM || 20000;
  const startEdge = net.edges[snap.edgeId];
  const path = [];
  const visited = new Set();

  let edge = startEdge;
  let forward = snap.forward;
  // Distance remaining on the starting edge, from the train's position to the edge end.
  let cumM = 0;
  let entryAlong = snap.alongM;

  while (edge && cumM < maxDistM) {
    if (visited.has(edge.id)) break;              // a loop; stop rather than spin
    visited.add(edge.id);

    const runM = forward ? (edge.lengthM - entryAlong) : entryAlong;
    path.push({
      edgeId: edge.id, edge, forward,
      entryAlong,
      startCumM: cumM,
      endCumM: cumM + runM
    });
    cumM += runM;
    if (cumM >= maxDistM) break;

    const exitNode = forward ? edge.nodeB : edge.nodeA;
    const exitBearing = edgeBearingAt(edge, forward ? edge.lengthM : 0, forward);

    const links = (net.nodes.get(exitNode) || []).filter(l => l.edgeId !== edge.id);
    let bestNext = null, bestScore = Infinity;
    for (const l of links) {
      const ne = net.edges[l.edgeId];
      if (!ne || visited.has(ne.id)) continue;
      const nextForward = (l.end === 'a');
      const inBearing = edgeBearingAt(ne, nextForward ? 0 : ne.lengthM, nextForward);
      const turn = angleDelta(exitBearing, inBearing);
      if (turn > 100) continue;                    // that is a reversal, not a continuation
      const score = turn
        + (ne.owner === edge.owner ? 0 : 45)
        + trackRank(ne.trackType) * 25;
      if (score < bestScore) { bestScore = score; bestNext = { edge: ne, forward: nextForward }; }
    }
    if (!bestNext) break;                          // end of track, or nothing plausible
    edge = bestNext.edge;
    forward = bestNext.forward;
    entryAlong = forward ? 0 : edge.lengthM;
  }
  return { path, reachedM: cumM, truncated: cumM >= maxDistM };
}

/**
 * Crossings that lie on the traversed path, with true along-track distance.
 * Only crossings within bufferM of the walked geometry count, so a crossing on a parallel
 * railroad is excluded by construction rather than by comparing owner strings.
 */
function crossingsAlongPath(net, walk, crossings, opts = {}) {
  const bufferM = opts.bufferM || 30;
  const out = [];
  const seen = new Set();
  for (const step of walk.path) {
    const edge = step.edge;
    for (const c of crossings) {
      if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
      if (seen.has(c.crossingId)) continue;
      const pr = projectOnEdge(net.proj, edge, c);
      if (pr.distM > bufferM) continue;
      // Only what lies ahead of where the train entered this edge.
      const aheadOnEdge = step.forward ? (pr.alongM - step.entryAlong) : (step.entryAlong - pr.alongM);
      if (aheadOnEdge < 0) continue;
      seen.add(c.crossingId);
      out.push({
        crossing: c,
        alongTrackM: step.startCumM + aheadOnEdge,
        offTrackM: +pr.distM.toFixed(1),
        edgeId: edge.id,
        trackOwner: edge.owner,
        trackType: edge.trackType
      });
    }
  }
  out.sort((a, b) => a.alongTrackM - b.alongTrackM);
  return out;
}

module.exports = {
  loadNetwork, snapToNetwork, traverse, crossingsAlongPath,
  projectOnEdge, edgeBearingAt, canonOwner, trackRank, LINES_URL
};
