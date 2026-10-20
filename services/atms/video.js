'use strict';
const fs = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fault = (status, message) => { const e = new Error(message); e.status = status; throw e; };
const clean = (v, max = 180) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);

class VideoBroker {
  constructor({ ops, sources = [], publicEnabled = false, fetcher = fetch, now = () => Date.now() }) {
    this.ops = ops; this.publicEnabled = publicEnabled && ops.mode === 'live'; this.fetcher = fetcher; this.now = now;
    this.sources = new Map(); this.resources = new Map(); this.health = new Map(); this.active = 0;
    if (!Array.isArray(sources) || sources.length > 1000) throw new Error('Video configuration supports up to 1,000 sources.');
    for (const row of sources) {
      if (!validId(row.id) || !row.agency || !clean(row.name) || !['hls', 'snapshot'].includes(row.type) || this.sources.has(row.agency + ':' + row.id)) throw new Error('Invalid or duplicate video source configuration.');
      if (row.synthetic && (ops.mode !== 'training' || row.type !== 'snapshot')) throw new Error('Generated camera snapshots are available only in training.');
      const source = { ...row, name: clean(row.name), headers: row.headers || {} };
      if (!row.synthetic) {
        const url = new URL(row.url);
        if ((url.protocol !== 'https:' && !(row.allowHttp === true && url.protocol === 'http:')) || url.username || url.password || url.hash) throw new Error('Video sources need HTTPS; private HTTP gateways require explicit allowHttp. Credentials belong in server headers.');
        source.url = url.href;
        const prefix = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
        source.allowed = [{ origin: url.origin, prefix }, ...(row.allowedMedia || [])].map(a => {
          const origin = new URL(a.origin);
          if (origin.origin !== a.origin || !['https:', ...(row.allowHttp ? ['http:'] : [])].includes(origin.protocol) || typeof a.prefix !== 'string' || !a.prefix.startsWith('/') || !a.prefix.endsWith('/')) throw new Error('Media origins require exact origins and directory prefixes.');
          return { origin: a.origin, prefix: a.prefix };
        });
      }
      source.revision = digest([source.url, source.headers, source.allowed, source.type, source.synthetic, source.allowPublic]);
      this.sources.set(row.agency + ':' + row.id, source);
    }
  }
  source(actor, id) { return this.sources.get(actor.agency + ':' + id) || fault(404, 'Camera source not found in this agency.'); }
  settings(source) { return this.ops.get(source.agency, 'video-camera', source.id) || { id: source.id, version: 0, enabled: true, assetId: null, public: false }; }
  metadata(actor, source, publicView = false) {
    const settings = this.settings(source), device = source.deviceId ? this.ops.get(actor.agency, 'device', source.deviceId) : null;
    const asset = settings.assetId ? this.ops.get(actor.agency, 'architecture-asset', settings.assetId) : this.ops.list(actor.agency, 'architecture-asset').find(a => a.deviceId && a.deviceId === source.deviceId);
    const released = this.publicEnabled && source.allowPublic === true && settings.public && settings.publicFingerprint === source.revision && settings.enabled;
    const result = { id: source.id, name: settings.name || source.name, route: source.route || device?.route || '', type: source.type, synthetic: !!source.synthetic,
      enabled: settings.enabled, version: settings.version, status: this.health.get(source.agency + ':' + source.id) || { receivedAt: null, capturedAt: null, error: null },
      public: !!released, publicEligible: this.publicEnabled && source.allowPublic === true, shareId: released ? settings.shareId : null };
    return publicView ? { name: result.name, route: result.route, type: result.type, synthetic: result.synthetic, status: result.status } : { ...result, deviceId: source.deviceId || null, assetId: asset?.id || null, assetName: asset?.name || null, latitude: device?.latitude ?? source.latitude ?? null, longitude: device?.longitude ?? source.longitude ?? null };
  }
  catalog(actor) {
    return { cameras: [...this.sources.values()].filter(s => s.agency === actor.agency).map(s => this.metadata(actor, s)), unconnectedInventory: this.ops.list(actor.agency, 'device').filter(d => d.type === 'camera' && ![...this.sources.values()].some(s => s.agency === actor.agency && s.deviceId === d.id)).length };
  }
  published(shareId) {
    if (!this.publicEnabled || !validId(shareId)) fault(404, 'Camera sharing is not available.');
    for (const source of this.sources.values()) {
      const settings = this.settings(source);
      if (settings.shareId === shareId && this.metadata({ agency: source.agency }, source).public) return source;
    }
    fault(404, 'This camera is not currently shared.');
  }
  allow(source, raw) {
    let url; try { url = new URL(raw); } catch { fault(502, 'Camera returned an invalid media address.'); }
    if (url.username || url.password || url.hash || /%2e|%2f|%5c|\\/i.test(url.pathname) || !source.allowed.some(a => url.origin === a.origin && url.pathname.startsWith(a.prefix))) fault(502, 'Camera requested media outside its approved locations.');
    return url;
  }
  resource(source, raw, base) {
    const url = this.allow(source, new URL(raw, base).href), id = digest([source.agency, source.id, source.revision, url.href]);
    this.resources.delete(id); this.resources.set(id, { sourceKey: source.agency + ':' + source.id, revision: source.revision, url: url.href, expires: this.now() + 20 * 60000 });
    while (this.resources.size > 10000) this.resources.delete(this.resources.keys().next().value);
    return id;
  }
  rewrite(source, text, base, prefix) {
    if (!text.startsWith('#EXTM3U') || Buffer.byteLength(text) > 512 * 1024 || /\{\$|#EXT-X-CONTENT-STEERING|#EXT-X-DEFINE/.test(text)) fault(502, 'Unsupported camera playlist.');
    return text.split(/\r?\n/).map(line => {
      const value = line.trim(); if (!value) return '';
      if (!value.startsWith('#')) return prefix + this.resource(source, value, base);
      if (!value.startsWith('#EXT')) return ''; // Provider comments can contain private addresses.
      const rewritten = value.replace(/URI="([^"]*)"/g, (_, uri) => 'URI="' + prefix + this.resource(source, uri, base) + '"');
      if (/https?:\/\/|rtsp:\/\//i.test(rewritten)) fault(502, 'Unsupported external address in camera playlist metadata.');
      return rewritten;
    }).join('\n');
  }
  async media(actor, source, id, prefix, range, signal) {
    if (actor && actor.agency !== source.agency) fault(404, 'Camera source not found in this agency.');
    if (!this.settings(source).enabled) fault(409, 'This camera is disabled.');
    if (this.active >= 16) fault(429, 'Video service is busy. Try again shortly.');
    if (range && !/^bytes=\d+-\d*$/.test(range)) fault(400, 'Use a single forward byte range.');
    this.active++;
    try {
      if (source.synthetic) {
        if (id !== 'index') fault(404, 'Training frame not found.');
        const seconds = Math.floor(this.now() / 1000), x = seconds * 17 % 540;
        const bytes = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#202529"/><path d="M-80 520L1020 80" stroke="#595d60" stroke-width="180"/><path d="M-80 520L1020 80" stroke="#d0b36b" stroke-width="3" stroke-dasharray="22 18"/><rect x="${120 + x}" y="${350 - x * .4}" width="35" height="18" rx="3" fill="#ff8a3d"/><rect width="960" height="65" fill="#121214"/><text x="30" y="40" fill="#ffaf77" font-size="22" font-family="sans-serif">PURPOSEBUILT · SYNTHETIC CAMERA</text><text x="30" y="505" fill="white" font-size="19" font-family="sans-serif">${new Date(this.now()).toISOString()} · Generated snapshot · No physical camera</text></svg>`)).png().toBuffer();
        const capturedAt = new Date(this.now()).toISOString(); this.health.set(source.agency + ':' + source.id, { receivedAt: capturedAt, capturedAt, error: null });
        return { bytes, type: 'image/png', status: 200, capturedAt };
      }
      let raw = source.url;
      if (id !== 'index') { const resource = this.resources.get(id); if (!resource || resource.sourceKey !== source.agency + ':' + source.id || resource.revision !== source.revision || resource.expires < this.now()) fault(410, 'Media reference expired. Reconnect the camera.'); raw = resource.url; }
      let response, url = this.allow(source, raw);
      const timeout = AbortSignal.timeout(12000), combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      for (let n = 0; n < 4; n++) {
        response = await this.fetcher(url.href, { signal: combined, redirect: 'manual', headers: { ...(url.origin === new URL(source.url).origin ? source.headers : {}), ...(range ? { Range: range } : {}), 'Accept-Encoding': 'identity' } });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location'); await response.body?.cancel(); if (!location) fault(502, 'Camera returned an invalid redirect.'); url = this.allow(source, new URL(location, url).href);
      }
      if (!response.ok || response.status !== 200 && response.status !== 206) { await response.body?.cancel(); fault(502, 'Camera source is unavailable.'); }
      const limit = source.type === 'snapshot' ? 5 * 1024 * 1024 : 8 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); fault(502, 'Camera response exceeds the media limit.'); }
      const chunks = []; let length = 0;
      for await (const chunk of response.body) { length += chunk.length; if (length > limit) fault(502, 'Camera response exceeds the media limit.'); chunks.push(chunk); }
      let bytes = Buffer.concat(chunks), type = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
      let capturedAt = null;
      if (source.captureTimeHeader) { const stamp = response.headers.get(source.captureTimeHeader); if (stamp && Number.isFinite(Date.parse(stamp)) && Date.parse(stamp) <= this.now() + 60000) capturedAt = new Date(stamp).toISOString(); }
      if (source.type === 'snapshot') {
        let metadata; try { metadata = await sharp(bytes, { limitInputPixels: 40000000 }).metadata(); } catch { fault(502, 'Camera did not return a usable snapshot.'); }
        if (!['jpeg', 'png'].includes(metadata.format) || metadata.pages > 1) fault(502, 'Camera did not return a JPEG or PNG snapshot.');
        type = metadata.format === 'png' ? 'image/png' : 'image/jpeg';
      } else if (bytes.subarray(0, 7).toString() === '#EXTM3U') { bytes = Buffer.from(this.rewrite(source, bytes.toString('utf8'), url.href, prefix)); type = 'application/vnd.apple.mpegurl'; }
      else if (!/^(video\/|audio\/|application\/(octet-stream|mp4))/.test(type)) fault(502, 'Camera returned an unsupported media response.');
      this.health.set(source.agency + ':' + source.id, { receivedAt: new Date(this.now()).toISOString(), capturedAt, error: null });
      return { bytes, type, status: response.status, capturedAt, contentRange: response.headers.get('content-range') };
    } catch (e) {
      const message = e.status ? e.message : 'Camera source could not be reached.';
      this.health.set(source.agency + ':' + source.id, { receivedAt: this.health.get(source.agency + ':' + source.id)?.receivedAt || null, capturedAt: this.health.get(source.agency + ':' + source.id)?.capturedAt || null, error: message });
      fault(e.status || 502, message);
    } finally { this.active--; }
  }
}
function configuredVideo(ops, env = process.env) {
  const rows = env.ATMS_VIDEO_CONFIG ? JSON.parse(fs.readFileSync(env.ATMS_VIDEO_CONFIG, 'utf8')) : [];
  if (!Array.isArray(rows)) throw new Error('ATMS_VIDEO_CONFIG must contain an array.');
  const sources = rows.map(row => {
    if (!row.authorizationEnv) return row;
    if (!/^[A-Z][A-Z0-9_]+$/.test(row.authorizationEnv) || !env[row.authorizationEnv]) throw new Error('Missing video source credential environment variable.');
    return { ...row, headers: { Authorization: env[row.authorizationEnv] } };
  });
  if (ops.mode === 'training') sources.push({ id: 'training-camera', agency: 'TRAINING', name: 'Synthetic I-80 camera', route: 'I-80', type: 'snapshot', synthetic: true, latitude: 41.65, longitude: -93.49 });
  return new VideoBroker({ ops, sources, publicEnabled: env.ATMS_PUBLIC_VIDEO_ENABLED === 'true' });
}
function install(Operations, { requireRole, Fault }) {
  Operations.prototype.saveVideoCamera = function (actor, source, input) {
    requireRole(actor, 'operator');
    return this.db.transaction(() => {
      if (source.agency !== actor.agency) throw new Fault(404, 'Camera source not found.');
      const old = this.get(actor.agency, 'video-camera', source.id) || { id: source.id, version: 0, enabled: true, public: false };
      if (input.version !== old.version) throw new Fault(409, 'Camera settings changed. Refresh before saving.');
      const next = { ...old };
      if (input.enabled !== undefined) { if (typeof input.enabled !== 'boolean') throw new Fault(400, 'Choose whether this camera is enabled.'); next.enabled = input.enabled; }
      if (input.assetId !== undefined) { if (input.assetId) { const a = this.need(actor.agency, 'architecture-asset', input.assetId); if (a.type !== 'camera') throw new Fault(400, 'Link a camera architecture profile.'); } next.assetId = input.assetId || null; }
      if (input.public !== undefined) {
        requireRole(actor, 'supervisor');
        if (typeof input.public !== 'boolean' || input.public && source.allowPublic !== true) throw new Fault(400, 'This source is not approved for public distribution.');
        if (input.public && (!clean(input.rightsReference, 1000) || !clean(input.note, 1000))) throw new Fault(400, 'Document distribution rights and the release decision.');
        next.public = input.public; next.publicFingerprint = source.revision; next.shareId = old.shareId || randomUUID();
        next.rightsReference = clean(input.rightsReference, 1000); next.releaseNote = clean(input.note, 1000); next.releasedBy = actor.id; next.releasedAt = this.iso();
      }
      const saved = this.put(actor.agency, 'video-camera', next, old.version || undefined);
      this.audit(actor, source.id, 'video.settings_saved', { enabled: saved.enabled, assetId: saved.assetId || null, public: saved.public, rightsReference: saved.rightsReference || null });
      return { id: saved.id, version: saved.version, enabled: saved.enabled, assetId: saved.assetId || null, public: saved.public };
    }).immediate();
  };
}
module.exports = { VideoBroker, configuredVideo, install };
