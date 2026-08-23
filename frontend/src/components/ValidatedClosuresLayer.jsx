import { useEffect, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// "Validated Work Zones" layer — the elevated closures from the CWZ 1.0 feed (device- or
// camera-verified). Each marker's popup shows the evidence: connected devices and/or the
// live camera snapshot that saw the zone. Loads once when toggled on (no polling).
//
// The camera <img> is fetched by the browser directly from the DOT camera host, so it costs
// the server nothing.

function verifiedIcon(sources) {
  const cam = sources.includes('camera');
  const dev = sources.includes('device');
  const glyph = cam && dev ? '📷🔗' : cam ? '📷' : '🔗';
  return L.divIcon({
    className: 'validated-closure-icon',
    html: `<div style="display:flex;align-items:center;gap:2px;background:#16a34a;color:#fff;
      border:2px solid #fff;border-radius:12px;padding:1px 5px;font-size:11px;font-weight:700;
      box-shadow:0 1px 4px rgba(0,0,0,.4);white-space:nowrap;">✓ ${glyph}</div>`,
    iconSize: [44, 20],
    iconAnchor: [22, 10]
  });
}

// Representative [lat,lng] for a WZDx feature (Point, or midpoint of a LineString).
function featureLatLng(f) {
  const g = f.geometry;
  if (!g || !Array.isArray(g.coordinates)) return null;
  if (g.type === 'Point') return [g.coordinates[1], g.coordinates[0]];
  if (g.type === 'LineString' && g.coordinates.length) {
    const c = g.coordinates[Math.floor(g.coordinates.length / 2)];
    return Array.isArray(c) ? [c[1], c[0]] : null;
  }
  return null;
}

export default function ValidatedClosuresLayer({ visible = false }) {
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api.get('/api/cwz/events')
      .then((res) => { if (!cancelled) setFeatures((res && res.data && res.data.features) || []); })
      .catch((err) => console.error('ValidatedClosuresLayer load failed:', err.message));
    return () => { cancelled = true; };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {features.map((f, i) => {
        const ll = featureLatLng(f);
        if (!ll) return null;
        const p = f.properties || {};
        const c = p.core_details || {};
        const sources = p.x_verification || [];
        const devices = p.x_connected_devices || [];
        const cameraSeen = p.x_camera_detected || [];
        return (
          <Marker key={`vwz-${f.id || i}`} position={ll} icon={verifiedIcon(sources)}>
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              ✓ Validated {(c.road_names || []).join(', ')} — {sources.join(' + ') || 'verified'}
            </Tooltip>
            <Popup maxWidth={280}>
              <div style={{ fontSize: 13, minWidth: 230 }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                  ✓ Validated Work Zone
                </div>
                <div style={{ color: '#555', marginBottom: 6 }}>
                  {(c.road_names || []).join(', ')} {c.direction || ''} · {sources.map(s => s === 'camera' ? '📷 camera' : '🔗 device').join(' + ')}
                </div>

                {devices.length > 0 && (
                  <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '5px 8px', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>Connected devices ({devices.length})</div>
                    {devices.slice(0, 4).map((d, j) => (
                      <div key={j} style={{ color: '#334155' }}>{d.device_id} · {d.confidence}%</div>
                    ))}
                    {p.x_connected_confidence != null && <div style={{ color: '#555' }}>best match {p.x_connected_confidence}%</div>}
                  </div>
                )}

                {p.x_camera_verified && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>
                      Camera {cameraSeen.length ? `saw: ${cameraSeen.join(', ')}` : 'view'}
                    </div>
                    {p.x_camera_url && (
                      <img src={p.x_camera_url} alt="camera view of work zone"
                        style={{ width: '100%', borderRadius: 6, display: 'block' }}
                        onError={(e) => { e.target.style.display = 'none'; }} />
                    )}
                    {p.x_camera_checked_at && (
                      <div style={{ color: '#999', fontSize: 11, marginTop: 3 }}>
                        checked {new Date(p.x_camera_checked_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
