'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { Operations } = require('../../services/atms/core');
const { VideoBroker, configuredVideo } = require('../../services/atms/video');
const { createRouter } = require('../../services/atms/router');
const actor = { id: 'operator', role: 'operator', agency: 'A' }, supervisor = { ...actor, id: 'supervisor', role: 'supervisor' };
const at = Date.parse('2026-10-20T12:00:00Z');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZkAAAAASUVORK5CYII=', 'base64');
const row = { id: 'cam', agency: 'A', name: 'Test camera', type: 'hls', url: 'https://video.example/camera/index.m3u8?token=SECRET', headers: { Authorization: 'Bearer SERVER_SECRET' } };
const playlist = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:1\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin?auth=SECRET"\n#EXT-X-PROGRAM-DATE-TIME:2026-10-20T12:00:00Z\n#EXTINF:2,\nsegment.ts\n';
function setup(t, extra = {}) { const ops = new Operations({ mode: extra.mode || 'live', now: () => at }); t.after(() => ops.close()); const video = new VideoBroker({ ops, sources: [row], now: () => at, ...extra }); return { ops, video }; }
const prefix = '/api/atms/video/cameras/cam/media/';

test('video metadata hides addresses and credentials and separates inventory from configured viewing', t => {
  const { ops, video } = setup(t);
  ops.registerDevice('A', { id: 'inventory', name: 'Inventory camera', type: 'camera', driver: 'readonly', controlEnabled: false, inventory: true });
  const catalog = video.catalog(actor), encoded = JSON.stringify(catalog);
  assert.equal(catalog.unconnectedInventory, 1); assert.equal(catalog.cameras[0].status.receivedAt, null);
  assert.ok(!encoded.includes('SECRET')); assert.ok(!encoded.includes('video.example'));
  assert.throws(() => video.source({ ...actor, agency: 'B' }, 'cam'), e => e.status === 404);
});
test('video HLS rewrites segments, variants, maps and encryption keys into scoped media references', async t => {
  const calls = [], { video } = setup(t, { fetcher: async (url, options) => { calls.push({ url, headers: options.headers }); return new Response(url.includes('index.m3u8') ? playlist : Buffer.from('segment'), { headers: { 'Content-Type': url.includes('index.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t' } }); } });
  const source = video.source(actor, 'cam'), result = await video.media(actor, source, 'index', prefix);
  const body = result.bytes.toString(); assert.ok(body.includes('#EXT-X-PROGRAM-DATE-TIME')); assert.ok(!body.includes('SECRET')); assert.ok(!body.includes('video.example')); assert.ok(body.includes('URI="' + prefix));
  const segment = body.trim().split('\n').at(-1).split('/').at(-1);
  assert.equal((await video.media(actor, source, segment, prefix)).bytes.toString(), 'segment');
  assert.equal(calls[0].headers.Authorization, 'Bearer SERVER_SECRET');
  assert.equal(video.metadata(actor, source).status.capturedAt, null);
  const nested = video.rewrite(source, '#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,URI="audio.m3u8"\n#EXT-X-MAP:URI="init.mp4"\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nvariant.m3u8\n', source.url, prefix);
  assert.ok(!nested.includes('audio.m3u8')); assert.ok(!nested.includes('init.mp4')); assert.ok(!nested.includes('variant.m3u8'));
});
test('video rejects malicious playlist locations and redirects, invalid ranges and expired or cross-source references', async t => {
  let now = at;
  const { video } = setup(t, { now: () => now, fetcher: async () => new Response(playlist, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } }) });
  const source = video.source(actor, 'cam');
  for (const uri of ['http://169.254.169.254/latest/meta-data', 'https://evil.example/camera/file.ts', '../private/file.ts', 'https://video.example/camera/%2fprivate.ts', 'file:///etc/passwd']) {
    assert.throws(() => video.rewrite(source, '#EXTM3U\n' + uri, source.url, prefix), e => e.status === 502);
  }
  assert.throws(() => video.rewrite(source, '#EXTM3U\n#EXT-X-CONTENT-STEERING:SERVER-URI="https://evil.example/"', source.url, prefix), e => e.status === 502);
  await assert.rejects(video.media(actor, source, 'index', prefix, 'bytes=0-10,20-30'), e => e.status === 400);
  await assert.rejects(video.media({ ...actor, agency: 'B' }, source, 'index', prefix), e => e.status === 404);
  const id = video.resource(source, 'segment.ts', source.url); now += 21 * 60000;
  await assert.rejects(video.media(actor, source, id, prefix), e => e.status === 410);
  const redirect = setup(t, { fetcher: async () => new Response(null, { status: 302, headers: { Location: 'https://evil.example/file' } }) });
  await assert.rejects(redirect.video.media(actor, redirect.video.source(actor, 'cam'), 'index', prefix), e => e.status === 502);
});
test('video credentials never follow a playlist to a different approved CDN origin', async t => {
  const calls = [], { video } = setup(t, { sources: [{ ...row, allowedMedia: [{ origin: 'https://cdn.example', prefix: '/camera/' }] }], fetcher: async (url, options) => { calls.push(options.headers); return new Response(Buffer.from('media'), { headers: { 'Content-Type': 'video/mp2t' } }); } });
  const source = video.source(actor, 'cam'), id = video.resource(source, 'https://cdn.example/camera/segment.ts', source.url);
  await video.media(actor, source, id, prefix); assert.equal(calls[0].Authorization, undefined);
});
test('snapshot capture time requires an explicitly configured header and preserves original image bytes', async t => {
  const { video } = setup(t, { sources: [{ ...row, type: 'snapshot', captureTimeHeader: 'x-camera-captured' }], fetcher: async () => new Response(png, { headers: { 'Content-Type': 'image/png', 'X-Camera-Captured': '2026-10-20T11:59:00Z' } }) });
  const result = await video.media(actor, video.source(actor, 'cam'), 'index', prefix);
  assert.deepEqual(result.bytes, png); assert.equal(result.capturedAt, '2026-10-20T11:59:00.000Z');
});
test('video failures never retain a current success and synthetic frames cannot enter live mode', async t => {
  const { video } = setup(t, { fetcher: async () => new Response('<html>down</html>', { headers: { 'Content-Type': 'text/html' } }) });
  await assert.rejects(video.media(actor, video.source(actor, 'cam'), 'index', prefix), e => e.status === 502);
  assert.ok(video.catalog(actor).cameras[0].status.error); assert.equal(video.catalog(actor).cameras[0].status.receivedAt, null);
  assert.throws(() => new VideoBroker({ ops: video.ops, sources: [{ ...row, synthetic: true, type: 'snapshot' }] }), /training/);
  const training = new Operations({ mode: 'training', now: () => at }); t.after(() => training.close());
  const broker = configuredVideo(training, {}), source = broker.source({ agency: 'TRAINING' }, 'training-camera');
  assert.equal((await broker.media({ agency: 'TRAINING' }, source, 'index', prefix)).type, 'image/png');
  assert.equal(broker.catalog({ agency: 'TRAINING' }).cameras[0].synthetic, true);
});
test('public video requires enabled service, configured distribution rights and an audited supervisor decision', t => {
  const { ops, video } = setup(t, { sources: [{ ...row, allowPublic: true }], publicEnabled: true }); const source = video.source(actor, 'cam');
  assert.throws(() => ops.saveVideoCamera(actor, source, { version: 0, public: true, rightsReference: 'Contract', note: 'Approved' }), e => e.status === 403);
  assert.throws(() => ops.saveVideoCamera(supervisor, source, { version: 0, public: true }), e => e.status === 400);
  let settings = ops.saveVideoCamera(supervisor, source, { version: 0, public: true, rightsReference: 'Distribution contract TEST', note: 'Release TEST footage' });
  const share = video.metadata(actor, source).shareId; assert.equal(video.published(share).id, 'cam');
  assert.ok(!JSON.stringify(video.metadata(actor, source, true)).includes('deviceId'));
  settings = ops.saveVideoCamera(actor, source, { version: settings.version, enabled: false });
  assert.throws(() => video.published(share), e => e.status === 404);
  settings = ops.saveVideoCamera(actor, source, { version: settings.version, enabled: true });
  ops.saveVideoCamera(supervisor, source, { version: settings.version, public: false });
  assert.throws(() => video.published(share), e => e.status === 404); assert.equal(ops.verifyAudit('A').valid, true);
});
test('camera profile linking validates type, agency and optimistic version without granting device control', t => {
  const { ops, video } = setup(t), source = video.source(actor, 'cam');
  const wrong = ops.saveArchitectureAsset(actor, { version: 0, name: 'Cabinet', type: 'cabinet' });
  assert.throws(() => ops.saveVideoCamera(actor, source, { version: 0, assetId: wrong.id }), e => e.status === 400);
  const camera = ops.saveArchitectureAsset(actor, { version: 0, name: 'Camera profile', type: 'camera' });
  const settings = ops.saveVideoCamera(actor, source, { version: 0, assetId: camera.id });
  assert.equal(video.metadata(actor, source).assetId, camera.id); assert.equal(ops.get('A', 'architecture-asset', camera.id).deviceId, null);
  assert.throws(() => ops.saveVideoCamera(actor, source, { version: 0, enabled: false }), e => e.status === 409);
  assert.equal(settings.version, 1);
});
test('video HTTP protects media, supports authorized sharing and stops a withdrawn public feed', async t => {
  const { ops, video } = setup(t, { sources: [{ ...row, allowPublic: true }], publicEnabled: true, fetcher: async () => new Response(playlist, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl' } }) });
  const app = express(); app.use('/api/atms', createRouter({ ops, video, authenticate: (req, res, next) => req.get('Authorization') ? next() : res.sendStatus(401), resolveActor: req => ({ ...actor, agency: req.get('X-Agency') || 'A', role: req.get('X-Role') || 'viewer' }) }));
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/atms/video', headers = { Authorization: 'test' };
  assert.equal((await fetch(base + '/cameras/cam/media/index')).status, 401);
  assert.equal((await fetch(base + '/cameras/cam/media/index', { headers: { ...headers, 'X-Agency': 'B' } })).status, 404);
  const response = await fetch(base + '/cameras/cam/media/index', { headers }); assert.equal(response.status, 200); assert.ok(!(await response.text()).includes('SECRET')); assert.ok(response.headers.get('cache-control').includes('no-store'));
  const source = video.source(actor, 'cam'); let settings = ops.saveVideoCamera(supervisor, source, { version: 0, public: true, rightsReference: 'TEST contract', note: 'TEST release' });
  const share = video.metadata(actor, source).shareId;
  const publicMedia = await fetch(base + '/public/' + share + '/media/index'); assert.equal(publicMedia.status, 200); assert.ok((await publicMedia.text()).includes('/video/public/' + share + '/media/'));
  ops.saveVideoCamera(supervisor, source, { version: settings.version, public: false });
  assert.equal((await fetch(base + '/public/' + share + '/media/index')).status, 404);
});
