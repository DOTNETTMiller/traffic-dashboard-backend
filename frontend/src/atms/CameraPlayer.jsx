import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, RefreshCw } from 'lucide-react';
import { cameraMediaPath, cameraAuthHeaders } from './api';
const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleTimeString() : 'Unknown';

export default function CameraPlayer({ camera, shareId }) {
  const video = useRef(null), [retry, setRetry] = useState(0), [state, setState] = useState({ kind: 'connecting', label: 'Connecting…' }), [image, setImage] = useState('');
  useEffect(() => {
    let active = true, failed = false, player, imageUrl, timer, loading = false, livePlaylist = null, lastAdvance = 0, lastTime = -1, receivedAt = null;
    const abort = new AbortController(), element = video.current, url = cameraMediaPath(camera.id, shareId);
    const update = next => { if (active) setState(next); };
    setImage(''); update({ kind: 'connecting', label: 'Connecting…' });
    async function snapshot() {
      if (loading || !active) return; loading = true;
      try {
        const response = await fetch(url, { credentials: 'omit', cache: 'no-store', headers: shareId ? {} : cameraAuthHeaders(url), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error('Snapshot unavailable');
        const next = URL.createObjectURL(await response.blob()); if (!active) { URL.revokeObjectURL(next); return; }
        if (imageUrl) URL.revokeObjectURL(imageUrl); imageUrl = next; setImage(next);
        const capturedAt = response.headers.get('X-ATMS-Captured-At');
        update({ kind: 'snapshot', label: camera.synthetic ? 'Synthetic snapshot' : 'Snapshot', capturedAt, receivedAt: new Date().toISOString(), stale: capturedAt ? Date.now() - Date.parse(capturedAt) > 30000 : false });
      } catch (e) { if (active) update({ kind: 'unavailable', label: 'Snapshot unavailable', detail: 'The last image may be old. Reconnect to try again.' }); }
      finally { loading = false; }
    }
    async function stream() {
      try {
        const { default: Hls } = await import('hls.js'); if (!active) return;
        if (!Hls.isSupported()) {
          if (shareId && element.canPlayType('application/vnd.apple.mpegurl')) { element.src = url; livePlaylist = null; element.play().catch(() => update({ kind: 'paused', label: 'Press play to view' })); }
          else { update({ kind: 'unsupported', label: 'Playback unavailable in this browser', detail: 'Use a browser with Media Source playback support for protected HLS video.' }); return; }
        } else {
          player = new Hls({ maxBufferLength: 15, backBufferLength: 15, lowLatencyMode: false, xhrSetup(xhr, resource) { if (!shareId) for (const [key, value] of Object.entries(cameraAuthHeaders(resource))) xhr.setRequestHeader(key, value); } });
          player.on(Hls.Events.LEVEL_UPDATED, (_, data) => { livePlaylist = data.details.live; });
          player.on(Hls.Events.FRAG_LOADED, () => { receivedAt = new Date().toISOString(); });
          player.on(Hls.Events.MANIFEST_PARSED, () => element.play().catch(() => update({ kind: 'paused', label: 'Press play to view' })));
          player.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) { failed = true; update({ kind: 'unavailable', label: 'Video unavailable', detail: 'The camera could not deliver a playable stream. Reconnect to try again.' }); player.destroy(); player = null; } });
          player.loadSource(url); player.attachMedia(element);
        }
        timer = setInterval(() => {
          if (!active || failed || element.error) return;
          if (element.currentTime > lastTime + .01) { lastTime = element.currentTime; lastAdvance = Date.now(); }
          if (!lastAdvance) return;
          if (element.paused) { update({ kind: 'paused', label: element.ended ? 'Recorded video ended' : 'Paused', receivedAt }); return; }
          if (Date.now() - lastAdvance > 6000) { update({ kind: 'stalled', label: 'Video stalled', detail: 'No playback progress. The visible frame may be old.', receivedAt }); return; }
          const playingDate = player?.playingDate, capturedAt = playingDate instanceof Date && Number.isFinite(playingDate.getTime()) && playingDate.getTime() <= Date.now() + 60000 ? playingDate.toISOString() : null;
          if (livePlaylist === false) update({ kind: 'recorded', label: 'Recorded video', capturedAt, receivedAt });
          else if (!capturedAt || livePlaylist === null) update({ kind: 'unknown-time', label: 'Playing · capture time unknown', receivedAt });
          else if (Date.now() - Date.parse(capturedAt) > 30000) update({ kind: 'delayed', label: 'Delayed video', capturedAt, receivedAt });
          else update({ kind: 'live', label: 'Live · source timestamp', capturedAt, receivedAt });
        }, 1000);
      } catch { update({ kind: 'unavailable', label: 'Video player unavailable' }); }
    }
    if (camera.enabled === false) update({ kind: 'disabled', label: 'Camera disabled' });
    else if (camera.type === 'snapshot') { snapshot(); timer = setInterval(snapshot, 5000); }
    else stream();
    return () => { active = false; clearInterval(timer); abort.abort(); player?.destroy(); if (imageUrl) URL.revokeObjectURL(imageUrl); if (element) { element.pause(); element.removeAttribute('src'); element.load(); } };
  }, [camera.id, camera.version, camera.enabled, shareId, retry]);
  const bad = ['unavailable', 'stalled', 'unsupported', 'disabled'].includes(state.kind);
  return <section className="camera-player" aria-label={camera.name + ' video viewer'}>
    <div className={'camera-stage ' + (bad ? 'is-unavailable' : '')}>
      {camera.type === 'snapshot' ? image ? <img src={image} alt={camera.name + ' camera snapshot'} /> : <div className="camera-placeholder"><Camera size={38} /><span>Waiting for camera</span></div> : <video ref={video} controls muted playsInline onError={() => setState({ kind: 'unavailable', label: 'Video unavailable' })} />}
      <div className={'camera-status ' + state.kind} role="status"><i />{state.label}</div>
      {camera.synthetic && <span className="camera-training-label">SYNTHETIC · NO PHYSICAL CAMERA</span>}
      {bad && <div className="camera-interruption"><AlertTriangle size={25} /><strong>{state.label}</strong><span>{state.detail || 'This feed is not currently available.'}</span><button className="ops-button" onClick={() => setRetry(v => v + 1)}><RefreshCw size={14} />Reconnect</button></div>}
    </div>
    <div className="camera-playback-meta"><span>Source capture <strong>{stamp(state.capturedAt)}</strong></span><span>Received here <strong>{stamp(state.receivedAt)}</strong></span>{state.stale && <span className="camera-delay-note">Snapshot is over 30 seconds old</span>}<button className="dru-text-button" onClick={() => setRetry(v => v + 1)}>Reconnect<RefreshCw size={12} /></button></div>
    <p className="camera-time-note">{camera.type === 'snapshot' ? 'Still images refresh every 5 seconds. Receipt time does not establish image capture time.' : '“Live” requires advancing playback and a source timestamp within 30 seconds. Transport receipt alone does not establish live imagery.'}</p>
  </section>;
}
