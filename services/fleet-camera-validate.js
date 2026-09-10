/**
 * Validate a work zone from the maintenance fleet's own dashcam frames.
 *
 * The fixed-camera validator can only ever see the handful of places somebody mounted a
 * camera — that is what capped it at 52 verified closures. The plow/maintenance fleet drives
 * the network instead, ~1,000 geotagged frames an hour in Iowa alone, so a zone with no fixed
 * camera anywhere near it can still get looked at. This asks the same question of those
 * frames that the fixed-camera validator asks of its own.
 *
 * IT REUSES THE EXISTING PIPELINE ON PURPOSE. Same vision call, same deployed-vs-staged
 * reasoning, same ledger. A confirmed detection is written to camera-check-ledger exactly as
 * a fixed-camera detection is, so it flows into x_camera_verified through the path that
 * already exists — no second validator to reconcile, and the durable ledger keeps it after
 * the frame ages out of the one-hour feed. Provenance is preserved in the camera id, which
 * records the truck ("fleet:A34364") rather than a fixed camera.
 *
 * NOTHING HERE RUNS ON ITS OWN. Vision costs money per image, so this is called only when
 * something explicitly asks for it, and it is capped every way that matters: frames must pass
 * the three gates first (close, facing the zone, taken while the closure was in effect), at
 * most a few per zone, and a hard ceiling on the run.
 */

const wrs = require('./winter-road-service');
const { askVision } = require('./camera-validation');
const ledger = require('./camera-check-ledger');

/**
 * The fixed-camera prompt asks about a stationary roadside view. This is a forward-facing
 * camera on a moving truck, which changes two things worth saying out loud: the zone is
 * usually AHEAD rather than off to one side, and the truck's own plough, mirrors and hood
 * are in shot and are not work-zone devices.
 *
 * The deployed-vs-staged distinction is carried over verbatim, because it is the one that
 * matters most: contractors pile cones on the shoulder when they are NOT working, and a pile
 * of stored cones must never read as a live closure.
 */
const FLEET_PROMPT =
  'This is a forward-facing dashcam still from a state DOT maintenance truck driving on a highway. '
  + 'A work zone is reported near this location, usually AHEAD of the vehicle. '
  + 'Ignore the truck itself — its plow blade, hood, mirrors and wipers are not work-zone devices. '
  + 'Look for TEMPORARY traffic-control devices (arrow-board, cones, barrels, drums, signs, workers, tma) '
  + 'and decide whether they are ACTIVELY DEPLOYED for a live work zone or only STORED/STAGED. '
  + 'Deployed = cones or barrels arranged in a line or taper along or across the travel lanes, '
  + 'an arrow-board lit and facing traffic, or workers/equipment in the roadway. '
  + 'Stored/staged = cones or barrels piled, stacked or clustered on the shoulder, median or a staging '
  + 'area and NOT arranged along a lane; an arrow-board that is dark or blank. '
  + 'Reply ONLY compact JSON: {"work_zone":true|false,"deployed":true|false,"staged_only":true|false,'
  + '"devices":[any of arrow-board,cones,barrels,drums,signs,workers,tma],"confidence":0..1}. '
  + 'Set work_zone:true ONLY for an actively deployed closure. If devices are merely piled off the '
  + 'roadway, set staged_only:true, deployed:false, work_zone:false. If you see no temporary devices, '
  + 'all false and devices:[].';

/**
 * Look at fleet frames for the given events and record what the model saw.
 *
 * @param {Array}  events  active work zones
 * @param {Object} opts
 *   limit        hard ceiling on vision calls for the whole run (default 6, max 25)
 *   maxPerZone   frames per zone (default 2)
 *   maxM/coneDeg/maxAgeMin  passed to the gate
 *   dryRun       resolve the candidates and return them WITHOUT calling vision
 * @returns {Promise<Object>} what was checked, what was confirmed, and why
 */
async function detectAtZones(events, opts = {}) {
  const limit = Math.min(opts.limit || 6, 25);
  const cams = await wrs.fetchPlowCams({ states: opts.states || null });
  const candidates = wrs.visionCandidates(events, cams, {
    maxM: opts.maxM || 150,
    coneDeg: opts.coneDeg || 50,
    maxAgeMin: opts.maxAgeMin || 360,
    maxPerZone: opts.maxPerZone || 2
  });

  if (opts.dryRun) {
    return { dryRun: true, frames: cams.length, candidateCount: candidates.length,
      wouldCheck: Math.min(candidates.length, limit), candidates: candidates.slice(0, limit) };
  }

  const results = [];
  let confirmed = 0, staged = 0, nothing = 0, failed = 0;
  for (const c of candidates.slice(0, limit)) {
    const v = await askVision(c.imageUrl, FLEET_PROMPT, opts);
    if (!v || v.available === false) { failed++; results.push({ ...c, verdict: 'unavailable', reason: v && v.reason }); continue; }
    const seen = v.work_zone === true && v.deployed === true;
    if (seen) confirmed++; else if (v.staged_only) staged++; else nothing++;

    // Written to the SAME ledger the fixed-camera validator uses, so a confirmation becomes
    // x_camera_verified through the existing path. The camera id records the truck, so the
    // provenance of the verdict is never lost.
    try {
      await ledger.record(c.eventId, {
        phase: 'followup',
        seen,
        camera: 'fleet:' + (c.truck || c.state || 'unknown'),
        cameraUrl: c.imageUrl,
        devices: v.devices || [],
        detectedAt: c.takenAt
      });
    } catch (_) { /* the ledger is durable storage, not a gate on the answer */ }

    results.push({
      eventId: c.eventId, corridor: c.corridor, route: c.route, milepost: c.milepost,
      truck: c.truck, imageUrl: c.imageUrl, takenAt: c.takenAt,
      distanceM: c.distanceM, bearingOffDeg: c.bearingOffDeg, closureSpanDays: c.closureSpanDays,
      verdict: seen ? 'work-zone-confirmed' : (v.staged_only ? 'devices-staged-only' : 'no-devices-seen'),
      devices: v.devices || [], confidence: v.confidence ?? null
    });
  }

  return {
    frames: cams.length,
    candidates: candidates.length,
    checked: results.length,
    confirmed, staged, nothing, failed,
    // A negative here is weak evidence and the wording says so. The truck may have passed
    // before setup or after teardown, the devices may be beyond the frame, or the zone may
    // simply be further along than the shot reaches.
    caveat: 'A confirmation is strong: devices were deployed in the roadway when the truck passed. '
          + 'A negative is weak — it means this frame showed none, not that the zone is absent.',
    results
  };
}

module.exports = { detectAtZones, FLEET_PROMPT };
