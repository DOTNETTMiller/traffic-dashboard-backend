/**
 * Vision training-data logger (for building a future YOLO dataset for free).
 *
 * Every on-demand camera detection can append a weak-labeled record — the LLM's
 * detection PLUS ground-truth corroboration (was the zone device-connected? scheduled
 * active?) — so over time you accumulate a dataset curated by real signals, ready to
 * train/fine-tune a self-hosted detector.
 *
 * OPT-IN and cost-free by default:
 *   - VISION_TRAINING_LOG=/path/to/labels.jsonl   → append one JSON line per detection
 *   - VISION_TRAINING_IMAGES=/path/to/images/     → also save the snapshot JPEG (pixels
 *     must be captured at detection time — the live camera URL returns a different image later)
 * With neither set, this does nothing (no disk, no cost). Never throws.
 */

const fs = require('fs');
const path = require('path');

function enabled() {
  return !!(process.env.VISION_TRAINING_LOG || process.env.VISION_TRAINING_IMAGES);
}

function safeId(s) {
  return String(s || 'img').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

// Append a weak-labeled record + (optionally) the image bytes. meta = context from the
// endpoint; detection = the provider result; imageBuffer = the exact pixels scored.
function record(meta, detection, imageBuffer) {
  if (!enabled()) return;
  try {
    const id = safeId(`${meta.state || ''}_${meta.cameraId || ''}_${Date.now()}`);
    const row = {
      ts: new Date().toISOString(),
      id,
      state: meta.state || null,
      route: meta.route || null,
      cameraId: meta.cameraId || null,
      imageUrl: meta.imageUrl || null,
      eventId: meta.eventId || null,
      distanceM: meta.distanceM ?? null,
      activeNow: meta.activeNow ?? null,             // WZDx-scheduled active
      deviceCorroborated: !!meta.deviceCorroborated, // a connected device also confirmed this zone
      // weak label from the current provider:
      work_zone: !!(detection && detection.work_zone),
      devices: (detection && detection.devices) || [],
      confidence: detection ? detection.confidence : null,
      provider: (detection && detection.provider) || null,
      imageFile: null
    };
    const imgDir = process.env.VISION_TRAINING_IMAGES;
    if (imgDir && imageBuffer && imageBuffer.length) {
      fs.mkdirSync(imgDir, { recursive: true });
      const file = path.join(imgDir, `${id}.jpg`);
      fs.writeFileSync(file, imageBuffer);
      row.imageFile = file;
    }
    const logPath = process.env.VISION_TRAINING_LOG;
    if (logPath) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
    }
  } catch (e) {
    console.error('vision-training-log skipped:', e.message);
  }
}

module.exports = { record, enabled };
