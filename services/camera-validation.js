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

// route normalization (interstates)
function interstate(s) {
  const m = String(s || '').toUpperCase().match(/\bI[-\s]?(\d{1,3})\b/);
  return m ? `I-${parseInt(m[1], 10)}` : null;
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

const VISION_MODEL = 'claude-haiku-4-5-20251001'; // cheapest vision-capable model
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

function callVision(base64, apiKey, timeoutMs = 20000) {
  const body = JSON.stringify({
    model: VISION_MODEL,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text:
          'This is a highway traffic camera still. Reply ONLY compact JSON: '
          + '{"work_zone":true|false,"devices":[any of arrow-board,cones,barrels,drums,signs,workers,tma],"confidence":0..1}. '
          + 'Detect only TEMPORARY traffic-control devices actually visible. If none, devices:[] and work_zone:false.' }
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
          const m = txt && txt.match(/\{[\s\S]*\}/);
          resolve(m ? JSON.parse(m[0]) : { work_zone: false, devices: [], confidence: 0 });
        } catch (e) { reject(new Error('vision parse')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('vision timeout')); });
    req.write(body); req.end();
  });
}

/**
 * Run (or reuse cached) vision detection on a camera snapshot. GATED + CACHED + ON-DEMAND.
 * Returns { available, work_zone, devices, confidence, cached, checkedAt } — or
 * { available:false, reason } when disabled/failed (never throws, always $0 without a key).
 */
async function detect(camera, opts = {}) {
  const apiKey = opts.apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) return { available: false, reason: 'vision disabled (no ANTHROPIC_API_KEY)' };
  const url = camera && camera.imageUrl;
  if (!url) return { available: false, reason: 'no snapshot url' };
  const hit = detectCache.get(url);
  if (hit && (Date.now() - hit.at) < DETECT_TTL) return { ...hit.result, cached: true };
  try {
    const buf = await fetchBuffer(url);
    const out = await callVision(buf.toString('base64'), apiKey);
    const devices = Array.isArray(out.devices) ? out.devices.filter((d) => TC_DEVICES.includes(d)) : [];
    const result = {
      available: true,
      work_zone: !!out.work_zone,
      devices,
      confidence: typeof out.confidence === 'number' ? out.confidence : null,
      checkedAt: new Date().toISOString()
    };
    detectCache.set(url, { at: Date.now(), result });
    if (detectCache.size > 500) detectCache.delete(detectCache.keys().next().value); // cap
    return { ...result, cached: false };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

module.exports = { matchCamera, detect, interstate, VISION_MODEL };
