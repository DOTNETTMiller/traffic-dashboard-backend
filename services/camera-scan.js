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

const FOLLOWUP_MS = (parseInt(process.env.CAMERA_FOLLOWUP_MIN, 10) || 30) * 60000;
const INITIAL_WINDOW_MS = (parseInt(process.env.CAMERA_INITIAL_WINDOW_MIN, 10) || 90) * 60000;

async function scanActive(events, opts = {}) {
  const maxPerScan = opts.maxPerScan || parseInt(process.env.CAMERA_SCAN_MAX, 10) || 25;
  const now = Date.now();
  const cams = await cameraAdapters.getCameras();
  let due = 0, checked = 0, elevated = 0;
  const actions = [];

  for (const ev of (events || [])) {
    if (cv.isActiveNow(ev) !== true) continue;               // WZDx says active now
    const id = ev.id || ev.road_event_id;
    if (!id) continue;
    const led = ledger.get(id);
    if (led && (led.seen || led.checks >= 2)) continue;      // confirmed, or already used both checks

    // Decide which check (if any) is due.
    let phase = null;
    if (!led || led.checks === 0) {
      const s = Date.parse(ev.startTime || ev.startDate || '');
      const nearStart = !Number.isFinite(s) || (now - s) <= INITIAL_WINDOW_MS; // only around start
      if (nearStart) phase = 'initial';
    } else if (led.checks === 1 && !led.seen &&
               (now - Date.parse(led.first_check_at)) >= FOLLOWUP_MS) {
      phase = 'followup';
    }
    if (!phase) continue;

    const m = cv.matchCamera(ev, cams);
    if (!m) continue;
    due++;
    if (checked >= maxPerScan) continue;                     // safety cap this pass; picked up next scan

    const det = await cv.detect(m.camera, {
      openaiClient: opts.openaiClient,
      trainingContext: { eventId: id, activeNow: true, deviceCorroborated: !!ev.x_cwz_connected, route: ev.corridor, distanceM: m.distanceM }
    });
    if (!det.available) continue;                            // vision off/unconfigured → don't burn a check
    checked++;
    const seen = !!det.work_zone;
    ledger.record(id, { seen, elevated: seen });
    if (seen) {
      ev.x_camera_verified = true;
      ev.x_camera_detected = det.devices;
      ev.x_camera_checked_at = det.checkedAt;
      if (!ev.x_zone_activity || ev.x_zone_activity === 'suspect-inactive') ev.x_zone_activity = 'confirmed-active';
      elevated++;
    }
    actions.push({ eventId: id, phase, camera: m.camera.id, distanceM: m.distanceM, seen, devices: det.devices });
  }
  return { due, checked, elevated, actions };
}

module.exports = { scanActive };
