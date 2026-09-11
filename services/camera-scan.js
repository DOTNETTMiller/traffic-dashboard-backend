/**
 * Camera scan policy (cost-minimal, per user):
 *   - Only zones WZDx says are active now (isActiveNow), that have a nearby camera.
 *   - Check #1 only AROUND the start time (started within CAMERA_INITIAL_WINDOW_MIN).
 *   - If #1 sees a work zone → elevate, done (1 check).
 *   - If #1 sees nothing → ONE follow-up after CAMERA_FOLLOWUP_MIN (default 30) to confirm.
 *   - Hard cap: at most 2 vision checks per closure, ever (enforced by camera-check-ledger).
 *
 * No timer here — scanActive() is invoked by the caller (event refresh and/or /api/cameras/scan).
 * The ledger makes cost independent of how often it's called: only DUE zones ever hit vision,
 * and never more than twice per closure. A non-detection (vision off) does NOT consume a check.
 */

const cv = require('./camera-validation');
const cameraAdapters = require('./camera-adapters');
const ledger = require('./camera-check-ledger');
const { FLEET_PROMPT } = require('./fleet-camera-validate');

// The maintenance fleet is the SECOND camera, used only where the first one does not exist.
// Fixed cameras cap this at the handful of places somebody mounted one -- 52 zones, measured.
// The plow fleet drives the network instead, so a zone with no camera anywhere near it can
// still be looked at. It is deliberately a FALLBACK, not an addition: a zone that already has
// a fixed camera is never also checked from a truck, so no closure costs two images per check.
const FLEET_ON = process.env.CAMERA_FLEET_SCAN !== 'false';
// Its own per-scan ceiling, separate from maxPerScan. A busy plow day must not be able to
// spend the whole vision budget that the fixed cameras also draw on.
const FLEET_SCAN_MAX = parseInt(process.env.CAMERA_FLEET_SCAN_MAX, 10) || 4;

const FOLLOWUP_MS = (parseInt(process.env.CAMERA_FOLLOWUP_MIN, 10) || 30) * 60000;
const INITIAL_WINDOW_MS = (parseInt(process.env.CAMERA_INITIAL_WINDOW_MIN, 10) || 90) * 60000;
const DAILY_MS = (parseInt(process.env.CAMERA_DAILY_MIN, 10) || 1440) * 60000; // 24h
const MULTIDAY_MS = 24 * 3600e3;

// A closure that spans more than a day (or has been active >1 day with no end date).
function isMultiDay(ev, now) {
  const s = Date.parse(ev.startTime || ev.startDate || '');
  const e = Date.parse(ev.endTime || ev.endDate || '');
  if (Number.isFinite(s) && Number.isFinite(e)) return (e - s) > MULTIDAY_MS;
  if (Number.isFinite(s)) return (now - s) > MULTIDAY_MS;
  // No start date: fall back to how long this event has been in the feed. These run to a
  // median of 21 days and a maximum of 69, so they are emphatically multi-day -- and without
  // this they were classed single-day and never entered the daily re-check that detects a
  // zone whose traffic control has come down.
  const seen = Date.parse((ev._lifecycle || {}).firstSeen || '');
  if (Number.isFinite(seen)) return (now - seen) > MULTIDAY_MS;
  return false;
}

async function scanActive(events, opts = {}) {
  const maxPerScan = opts.maxPerScan || parseInt(process.env.CAMERA_SCAN_MAX, 10) || 25;
  const fleetMax = opts.fleetMax != null ? opts.fleetMax : FLEET_SCAN_MAX;
  const fleetOn = opts.fleet != null ? opts.fleet : FLEET_ON;
  const now = Date.now();
  const cams = await cameraAdapters.getCameras();
  let due = 0, checked = 0, elevated = 0, tcRemoved = 0, fleetChecked = 0;
  const actions = [];

  // ONE frame per zone, resolved once for the whole scan. visionCandidates applies the three
  // gates -- close enough, pointing at the zone, and taken while the closure was in effect --
  // so anything it returns is a frame that could actually show the work. Asking for one (not
  // the default three) is what holds a closure to at most two images ever: one per check,
  // and the ledger allows at most two checks.
  const fleetBest = new Map();
  if (fleetOn) {
    try {
      const wrs = require('./winter-road-service');
      const frames = await wrs.fetchPlowCams();
      if (frames.length) {
        for (const c of wrs.visionCandidates(events, frames, { maxPerZone: 1 })) {
          if (!fleetBest.has(c.eventId)) fleetBest.set(c.eventId, c);
        }
      }
    } catch (_) { /* fleet imagery is a bonus source; its absence must not stop the scan */ }
  }

  for (const ev of (events || [])) {
    // Eligible unless the feed positively says otherwise. Requiring the feed to ASSERT the
    // zone is active excluded the 408 events that carry no start date -- the very zones whose
    // status nothing else can establish. See couldBeActive().
    if (!cv.couldBeActive(ev, now)) continue;
    const id = ev.id || ev.road_event_id;
    if (!id) continue;
    const led = await ledger.get(id);
    if (led && led.tc_removed) continue;                     // camera already saw TC removed — done

    // FREE re-stamp: a previously-confirmed zone stays camera-verified across cache rebuilds.
    // The x_camera_* fields live on the transient event object; the ledger is the source of
    // truth, so re-apply them every scan with no new vision call. (This is what makes the
    // Validated Work Zones layer persist — the flag is otherwise wiped on each refresh.)
    if (led && led.seen) {
      ev.x_camera_verified = true;
      if (led.devices) { try { ev.x_camera_detected = JSON.parse(led.devices); } catch (_) { /* ignore */ } }
      ev.x_camera_checked_at = led.detected_at || led.last_check_at;
      if (led.camera_url) ev.x_camera_url = led.camera_url;
      if (led.camera_id) ev.x_camera_id = led.camera_id;
      // A 'fleet:' id is a photograph from a moving truck, not a fixed roadside camera. The
      // popup shows the image either way, so it has to be able to say which it is looking at.
      if (led.camera_id) ev.x_camera_source = String(led.camera_id).startsWith('fleet:') ? 'fleet' : 'fixed';
      if (!ev.x_zone_activity || ev.x_zone_activity === 'suspect-inactive') ev.x_zone_activity = 'confirmed-active';
    }

    if (led && led.checks >= 2 && !led.seen) continue;       // gave up (never confirmed at start)

    // Decide which check (if any) is due.
    let phase = null;
    if (led && led.seen) {
      // Confirmed real. Single-day → done. Multi-day → one check per day to catch TC removal.
      if (isMultiDay(ev, now) && (now - Date.parse(led.last_check_at)) >= DAILY_MS) phase = 'daily';
    } else if (!led || led.checks === 0) {
      // Initial "validate once": new zones around their start, PLUS any multi-day zone we
      // haven't checked yet (so long-running closures get validated once and enter the daily
      // monitoring). Single-day zones we missed the start of are skipped (they'll end soon).
      const s = Date.parse(ev.startTime || ev.startDate || '');
      const nearStart = !Number.isFinite(s) || (now - s) <= INITIAL_WINDOW_MS;
      if (nearStart || isMultiDay(ev, now)) phase = 'initial';
    } else if (led.checks === 1 && !led.seen &&
               (now - Date.parse(led.first_check_at)) >= FOLLOWUP_MS) {
      phase = 'followup';
    }
    if (!phase) continue;

    // Fixed camera first; a fleet frame only where there is no fixed camera to ask.
    const m = cv.matchCamera(ev, cams);
    const fc = m ? null : fleetBest.get(id);
    if (!m && !fc) continue;
    due++;
    if (checked >= maxPerScan) continue;                     // safety cap this pass; picked up next scan
    if (fc && fleetChecked >= fleetMax) continue;            // fleet's own ceiling; retried next scan

    let det, camId, camUrl;
    if (m) {
      camId = m.camera.id; camUrl = m.camera.imageUrl;
      det = await cv.detect(m.camera, {
        openaiClient: opts.openaiClient,
        trainingContext: { eventId: id, activeNow: true, deviceCorroborated: !!ev.x_cwz_connected, route: ev.corridor, distanceM: m.distanceM }
      });
    } else {
      // Same API, same model, same deployed-vs-staged question -- a different prompt only
      // because the lens is on a moving truck, so the zone is usually ahead and the plough
      // and hood are in shot and are not work-zone devices.
      camId = 'fleet:' + (fc.truck || fc.state || 'unknown'); camUrl = fc.imageUrl;
      const v = await cv.askVision(camUrl, FLEET_PROMPT, { openaiClient: opts.openaiClient });
      det = (!v || v.available === false)
        ? { available: false, reason: v && v.reason }
        : { available: true, work_zone: v.work_zone === true && v.deployed === true,
            devices: v.devices || [], staged_only: !!v.staged_only,
            // The PHOTO's timestamp, not the moment we asked. For a frame from a truck that
            // drove past an hour ago, when the shutter fired is the fact that matters.
            checkedAt: fc.takenAt || new Date().toISOString() };
    }
    if (!det.available) continue;                            // vision off/unconfigured → don't burn a check
    checked++;
    if (fc) fleetChecked++;
    const seen = !!det.work_zone;
    await ledger.record(id, { phase, seen, camera: camId, cameraUrl: camUrl, devices: det.devices, stagedOnly: det.staged_only, detectedAt: det.checkedAt });
    // The verdict is a statement about the zone's CURRENT activity, from a look at it rather
    // than from the feed's dates. Recorded on every check, positive or negative, so a zone
    // whose status the feed never gave still ends up with an answer and a timestamp for it.
    ev.x_activity_checked_at = det.checkedAt;
    ev.x_activity_source = m ? 'fixed-camera' : 'fleet-camera';
    ev.x_activity_verdict = seen ? 'active' : (det.staged_only ? 'devices-staged-only' : 'no-devices-seen');
    if (seen) {
      ev.x_camera_verified = true;
      ev.x_camera_detected = det.devices;
      ev.x_camera_checked_at = det.checkedAt;
      ev.x_camera_url = camUrl;
      ev.x_camera_id = camId;
      ev.x_camera_source = m ? 'fixed' : 'fleet';
      if (fc) { ev.x_camera_truck = fc.truck || null; ev.x_camera_distance_m = Math.round(fc.distanceM); }
      if (!ev.x_zone_activity || ev.x_zone_activity === 'suspect-inactive') ev.x_zone_activity = 'confirmed-active';
      delete ev.x_tc_removed;
      elevated++;
    } else if (phase === 'daily') {
      // Was confirmed earlier; camera now sees NO traffic control → zone appears done/removed
      // even though WZDx still lists it. Demote out of the elevated feed and flag it.
      ev.x_tc_removed = true;
      ev.x_zone_activity = 'suspect-inactive';
      ev.x_camera_checked_at = det.checkedAt;
      delete ev.x_camera_verified;
      tcRemoved++;
    }
    actions.push({ eventId: id, phase, camera: camId, source: m ? 'fixed' : 'fleet',
      distanceM: Math.round(m ? m.distanceM : fc.distanceM), seen, devices: det.devices,
      stagedOnly: det.staged_only || undefined,
      tcRemoved: (phase === 'daily' && !seen) || undefined });
  }
  return { due, checked, fleetChecked, fleetAvailable: fleetBest.size, elevated, tcRemoved, actions };
}

module.exports = { scanActive };
