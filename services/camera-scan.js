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
const DAILY_MS = (parseInt(process.env.CAMERA_DAILY_MIN, 10) || 1440) * 60000; // 24h
const MULTIDAY_MS = 24 * 3600e3;

// A closure that spans more than a day (or has been active >1 day with no end date).
function isMultiDay(ev, now) {
  const s = Date.parse(ev.startTime || ev.startDate || '');
  const e = Date.parse(ev.endTime || ev.endDate || '');
  if (Number.isFinite(s) && Number.isFinite(e)) return (e - s) > MULTIDAY_MS;
  if (Number.isFinite(s)) return (now - s) > MULTIDAY_MS;
  return false;
}

async function scanActive(events, opts = {}) {
  const maxPerScan = opts.maxPerScan || parseInt(process.env.CAMERA_SCAN_MAX, 10) || 25;
  const now = Date.now();
  const cams = await cameraAdapters.getCameras();
  let due = 0, checked = 0, elevated = 0, tcRemoved = 0;
  const actions = [];

  for (const ev of (events || [])) {
    if (cv.isActiveNow(ev) !== true) continue;               // WZDx says active now
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
    await ledger.record(id, { phase, seen, camera: m.camera.id, cameraUrl: m.camera.imageUrl, devices: det.devices, detectedAt: det.checkedAt });
    if (seen) {
      ev.x_camera_verified = true;
      ev.x_camera_detected = det.devices;
      ev.x_camera_checked_at = det.checkedAt;
      ev.x_camera_url = m.camera.imageUrl;
      ev.x_camera_id = m.camera.id;
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
    actions.push({ eventId: id, phase, camera: m.camera.id, distanceM: m.distanceM, seen, devices: det.devices,
      tcRemoved: (phase === 'daily' && !seen) || undefined });
  }
  return { due, checked, elevated, tcRemoved, actions };
}

module.exports = { scanActive };
