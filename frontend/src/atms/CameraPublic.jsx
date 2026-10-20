import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import CameraPlayer from './CameraPlayer';
import './atms.css';
function CameraPublic() {
  const shareId = new URLSearchParams(location.search).get('feed'), [camera, setCamera] = useState(null), [error, setError] = useState('');
  useEffect(() => { let active = true; if (!/^[a-zA-Z0-9_-]{1,80}$/.test(shareId || '')) { setError('This camera link is not valid.'); return; }
    fetch('/api/atms/video/public/' + encodeURIComponent(shareId), { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15000) }).then(async r => { if (!r.ok) throw new Error('This camera is not currently shared.'); return r.json(); }).then(c => { if (active) setCamera({ ...c, enabled: true }); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; };
  }, [shareId]);
  return <main className="camera-public-page"><header><img src="/assets/purposebuilt-logo.png" alt="PurposeBuilt Systems"/><span>PURPOSEBUILT <strong>CAMERA VIEW</strong></span></header>{error ? <div className="ops-empty"><h1>Camera unavailable</h1><p>{error}</p></div> : camera ? <><span className="dru-kicker">PUBLIC ROADWAY VIEW</span><h1>{camera.name}</h1><p>{camera.route}</p><CameraPlayer camera={camera} shareId={shareId}/></> : <p role="status">Connecting to camera…</p>}</main>;
}
createRoot(document.getElementById('root')).render(<CameraPublic/>);
