/**
 * Camera-based work-zone validation (the visual third validator).
 *
 * Two parts, both COST-CONSCIOUS and LOOP-FREE:
 *  1) matchCamera(event, cameras) — pure geometry: find the nearest camera on the same
 *     route within range. Free, no network, no loop.
 *  2) detect(camera) — fetch the camera's still snapshot and run ONE vision inference to
 *     list visible temporary traffic-control devices. This is the only cost, and it is:
 *       - GATED: does nothing (available:false, $0) unless a vision key is set.
 *       - CACHED per snapshot URL (TTL) so repeat checks never re-bill.
 *       - ON-DEMAND ONLY: called per request, never in a batch/loop/timer, never during
 *         the shared refresh. Uses the cheapest vision model + tiny token budget.
 *
 * proximity != line-of-sight (no PTZ/heading in most feeds), so a detection is
 * corroborating: strong as a positive ("cones visible → confirmed"), soft as a negative.
 */

const https = require('https');
const turf = require('@turf/turf');
const visionTrainingLog = require('./vision-training-log');

// route normalization (interstates)
function interstate(s) {
  const m = String(s || '').toUpperCase().match(/\bI[-\s]?(\d{1,3})\b/);
  return m ? `I-${parseInt(m[1], 10)}` : null;
}

// Is the WZDx event scheduled to be ACTIVE right now (per its start/end dates)?
// true = within window, false = not yet started / already ended, null = no start date
// (can't tell — don't spend a vision check on it).
function isActiveNow(event, now = Date.now()) {
  const s = Date.parse(event.startTime || event.startDate || event.start_date || '');
  const e = Date.parse(event.endTime || event.endDate || event.end_date || '');
  if (!Number.isFinite(s)) return null;
  if (now < s) return false;
  if (Number.isFinite(e) && now > e) return false;
  return true;
}

// ---- 1) matching (free) -----------------------------------------------------

/**
 * Nearest camera to an event, on the same interstate, within maxM (default 1500 m).
 * Returns { camera, distanceM } or null. Pure math — no network, no loop.
 */
function matchCamera(event, cameras, opts = {}) {
  const maxM = opts.maxM || 1500;
  const evPt = event.coordinates || (event.longitude != null ? [event.longitude, event.latitude] : null);
  if (!evPt || !Array.isArray(cameras)) return null;
  const evRoute = interstate(event.corridor || event.route || event.location);
  let best = null, bestD = Infinity;
  for (const c of cameras) {
    if (!c || !Array.isArray(c.coordinates)) continue;
    if (evRoute && c.route && interstate(c.route) !== evRoute) continue; // same interstate only
    const d = turf.distance(turf.point(evPt), turf.point(c.coordinates), { units: 'meters' });
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best || bestD > maxM) return null;
  return { camera: best, distanceM: Math.round(bestD) };
}

// ---- 2) vision detection (gated, cached, on-demand only) --------------------

// Provider is swappable with zero code change: 'anthropic' (default, Claude vision) or
// 'yolo' (self-hosted detector endpoint). Set VISION_PROVIDER / VISION_MODEL / VISION_YOLO_URL.
const VISION_PROVIDER = (process.env.VISION_PROVIDER || 'anthropic').toLowerCase();
const VISION_MODEL = process.env.VISION_MODEL || 'claude-haiku-4-5-20251001'; // cheapest vision-capable model
const detectCache = new Map();                     // imageUrl -> { at, result }
const DETECT_TTL = 10 * 60 * 1000;                 // 10 min — never re-bill the same snapshot
const TC_DEVICES = ['arrow-board', 'cones', 'barrels', 'drums', 'signs', 'workers', 'tma'];

function fetchBuffer(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('snapshot timeout')); });
  });
}

const DETECT_PROMPT =
  'This is a highway traffic camera still. Reply ONLY compact JSON: '
  + '{"work_zone":true|false,"devices":[any of arrow-board,cones,barrels,drums,signs,workers,tma],"confidence":0..1}. '
  + 'Detect only TEMPORARY traffic-control devices actually visible. If none, devices:[] and work_zone:false.';

function parseJsonBlock(txt) {
  const m = txt && txt.match(/\{[\s\S]*\}/);
  return m ? JSON.parse(m[0]) : { work_zone: false, devices: [], confidence: 0 };
}

// --- provider: Anthropic (Claude vision) ---
function callAnthropic(base64, apiKey, timeoutMs = 20000) {
  const body = JSON.stringify({
    model: VISION_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: DETECT_PROMPT }
      ]
    }]
  });
  return new Promise((resolve, reject) => {
    const req = https.request('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const txt = j.content && j.content[0] && j.content[0].text;
          resolve(parseJsonBlock(txt));
        } catch (e) { reject(new Error('vision parse')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('vision timeout')); });
    req.write(body); req.end();
  });
}

// --- provider: OpenAI (GPT-4o-mini vision, detail:low = cheapest) ---
function callOpenAI(base64, apiKey, timeoutMs = 20000) {
  const body = JSON.stringify({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: DETECT_PROMPT },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' } }
      ]
    }]
  });
  return new Promise((resolve, reject) => {
    const req = https.request('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
    }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const txt = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
          resolve(parseJsonBlock(txt));
        } catch (e) { reject(new Error('openai parse')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('openai timeout')); });
    req.write(body); req.end();
  });
}

// --- provider: self-hosted YOLO (or any detector) endpoint ---
// POSTs the JPEG bytes; expects JSON {work_zone?, devices:[...], confidence} or
// {detections:[{label,score}]}. Written to spec — swap in later with no other changes.
function callYolo(buffer, url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'POST', headers: { 'content-type': 'image/jpeg', 'content-length': buffer.length } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (Array.isArray(j.detections)) {
            const devices = j.detections.map((x) => x.label).filter(Boolean);
            resolve({ work_zone: devices.length > 0, devices, confidence: j.detections[0] && j.detections[0].score });
          } else resolve(j);
        } catch (e) { reject(new Error('yolo parse')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('yolo timeout')); });
    req.write(buffer); req.end();
  });
}

/**
 * Run (or reuse cached) vision detection on a camera snapshot. Provider-swappable
 * (VISION_PROVIDER), GATED + CACHED + ON-DEMAND. Returns
 * { available, work_zone, devices, confidence, provider, cached, checkedAt } — or
 * { available:false, reason } when disabled/failed (never throws, always $0 when off).
 * opts.trainingContext { eventId, activeNow, deviceCorroborated, route } → logs a weak-
 * labeled training record (only if VISION_TRAINING_LOG/IMAGES is set; otherwise no-op).
 */
// Pick the provider: explicit override → VISION_PROVIDER env → whatever key/url is present.
function resolveProvider(opts) {
  if (opts.provider) return opts.provider.toLowerCase();
  if (process.env.VISION_PROVIDER) return process.env.VISION_PROVIDER.toLowerCase();
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY) return 'anthropic';
  if (process.env.VISION_YOLO_URL) return 'yolo';
  return 'none';
}

async function detect(camera, opts = {}) {
  const provider = resolveProvider(opts);
  const openaiKey = opts.openaiKey || process.env.OPENAI_API_KEY;
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const yoloUrl = opts.yoloUrl || process.env.VISION_YOLO_URL;
  if (provider === 'openai' && !openaiKey) return { available: false, reason: 'vision disabled (no OPENAI_API_KEY)' };
  if (provider === 'anthropic' && !apiKey) return { available: false, reason: 'vision disabled (no ANTHROPIC_API_KEY)' };
  if (provider === 'yolo' && !yoloUrl) return { available: false, reason: 'vision disabled (no VISION_YOLO_URL)' };
  if (provider === 'none') return { available: false, reason: 'vision disabled (no provider key configured)' };
  const url = camera && camera.imageUrl;
  if (!url) return { available: false, reason: 'no snapshot url' };
  const hit = detectCache.get(url);
  if (hit && (Date.now() - hit.at) < DETECT_TTL) return { ...hit.result, cached: true };
  try {
    const buf = await fetchBuffer(url);
    const out = provider === 'yolo' ? await callYolo(buf, yoloUrl)
      : provider === 'openai' ? await callOpenAI(buf.toString('base64'), openaiKey)
      : await callAnthropic(buf.toString('base64'), apiKey);
    const devices = Array.isArray(out.devices) ? out.devices.filter((d) => TC_DEVICES.includes(d)) : [];
    const result = {
      available: true, provider,
      work_zone: !!out.work_zone,
      devices,
      confidence: typeof out.confidence === 'number' ? out.confidence : null,
      checkedAt: new Date().toISOString()
    };
    detectCache.set(url, { at: Date.now(), result });
    if (detectCache.size > 500) detectCache.delete(detectCache.keys().next().value); // cap
    // Free training-data capture (opt-in via env): weak label + ground-truth context + pixels.
    if (opts.trainingContext && visionTrainingLog.enabled()) {
      visionTrainingLog.record(
        { ...opts.trainingContext, cameraId: camera.id, state: camera.state, route: opts.trainingContext.route || camera.route, imageUrl: url },
        result, buf
      );
    }
    return { ...result, cached: false };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

module.exports = { matchCamera, detect, interstate, isActiveNow, VISION_MODEL, VISION_PROVIDER };
