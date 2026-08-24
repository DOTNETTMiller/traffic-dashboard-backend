import { useEffect, useState, Fragment } from 'react';
import { Marker, Popup, Tooltip, Polyline } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// "Validated Work Zones" layer — the elevated closures from the CWZ 1.0 feed, verified by
// one or more INDEPENDENT sources: a connected device on site (🔗), a camera that sees the
// traffic control (📷), and/or an independent TomTom construction/closure report (🚗).
// Each marker highlights the zone on the map and its popup spells out exactly HOW it was
// validated, per source. Loads once when toggled on (no polling).
//
// The camera <img> is fetched by the browser directly from the DOT host — $0 server egress.

// Per-source color + priority. When a zone has multiple sources it's drawn in its
// strongest source's color (device > camera > TomTom) with a gold border to flag "multi".
const SOURCE_META = {
  device: { glyph: '🔗', label: 'device', color: '#2563eb' },  // blue — hardware on site
  camera: { glyph: '📷', label: 'camera', color: '#16a34a' },  // green — visual truth
  tomtom: { glyph: '🚗', label: 'TomTom', color: '#d97706' }   // amber — independent report
};
const PRIORITY = ['device', 'camera', 'tomtom'];
const primarySource = (sources) => PRIORITY.find(s => sources.includes(s)) || 'camera';

function verifiedIcon(sources) {
  const glyphs = sources.map(s => (SOURCE_META[s] || {}).glyph).filter(Boolean).join('');
  const strong = sources.length >= 2;           // 2+ independent sources = higher confidence
  const color = (SOURCE_META[primarySource(sources)] || {}).color || '#16a34a';
  return L.divIcon({
    className: 'validated-closure-icon',
    html: `<div style="display:flex;align-items:center;gap:2px;
      background:${color};color:#fff;
      border:2px solid ${strong ? '#fde047' : '#fff'};border-radius:12px;padding:1px 5px;font-size:11px;font-weight:700;
      box-shadow:0 1px 4px rgba(0,0,0,.4);white-space:nowrap;">✓ ${glyphs || '✔'}</div>`,
    iconSize: [48, 20],
    iconAnchor: [24, 10]
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

// LineString → [[lat,lng],...] for a highlight polyline (null if not a line).
function featureLine(f) {
  const g = f.geometry;
  if (!g || g.type !== 'LineString' || !Array.isArray(g.coordinates)) return null;
  const pts = g.coordinates.filter(c => Array.isArray(c) && c.length >= 2).map(c => [c[1], c[0]]);
  return pts.length >= 2 ? pts : null;
}

export default function ValidatedClosuresLayer({ visible = false, sources: enabled = null, onCounts = null }) {
  const [features, setFeatures] = useState([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api.get('/api/cwz/events')
      .then((res) => {
        if (cancelled) return;
        const feats = (res && res.data && res.data.features) || [];
        setFeatures(feats);
        if (onCounts) {
          const counts = { device: 0, camera: 0, tomtom: 0, total: feats.length };
          feats.forEach(f => (f.properties?.x_verification || []).forEach(s => { if (counts[s] != null) counts[s]++; }));
          onCounts(counts);
        }
      })
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
        // Source filter: show a zone if ANY of its validators is enabled (null = show all).
        if (enabled && !sources.some(s => enabled[s])) return null;
        const devices = p.x_connected_devices || [];
        const cameraSeen = p.x_camera_detected || [];
        const line = featureLine(f);
        const strong = sources.length >= 2;
        const color = (SOURCE_META[primarySource(sources)] || {}).color || '#16a34a';
        const road = (c.road_names || []).join(', ');
        const howShort = sources.map(s => `${(SOURCE_META[s] || {}).glyph || ''} ${(SOURCE_META[s] || {}).label || s}`).join(' + ') || 'verified';

        return (
          <Fragment key={`vwz-${f.id || i}`}>
            {line && (
              <Polyline positions={line}
                pathOptions={{ color, weight: strong ? 7 : 5, opacity: 0.8 }} />
            )}
            <Marker position={ll} icon={verifiedIcon(sources)}>
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                ✓ {road} — validated by {howShort}
              </Tooltip>
              <Popup maxWidth={300}>
                <div style={{ fontSize: 13, minWidth: 240 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>
                    ✓ Validated Work Zone {strong && <span style={{ color: '#15803d' }}>· multi-source</span>}
                  </div>
                  <div style={{ color: '#555', marginBottom: 6 }}>
                    {road} {c.direction || ''}
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                    How this was validated ({sources.length} source{sources.length === 1 ? '' : 's'}):
                  </div>

                  {sources.includes('device') && (
                    <div style={{ background: '#eff6ff', borderRadius: 6, padding: '5px 8px', marginBottom: 5 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>🔗 Connected device on site</div>
                      {devices.slice(0, 4).map((d, j) => (
                        <div key={j} style={{ color: '#334155' }}>{d.device_id} · {d.confidence}%</div>
                      ))}
                      {p.x_connected_confidence != null && <div style={{ color: '#555' }}>best match {p.x_connected_confidence}%</div>}
                    </div>
                  )}

                  {sources.includes('camera') && (
                    <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '5px 8px', marginBottom: 5 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>
                        📷 Camera {cameraSeen.length ? `saw: ${cameraSeen.join(', ')}` : 'view'}
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

                  {sources.includes('tomtom') && (
                    <div style={{ background: '#fefce8', borderRadius: 6, padding: '5px 8px', marginBottom: 5 }}>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>🚗 Independent TomTom report</div>
                      <div style={{ color: '#334155' }}>
                        {p.x_tomtom_category || 'Roadwork'}{p.x_tomtom_distance_m != null ? ` · ${p.x_tomtom_distance_m}m away` : ''}
                      </div>
                      {p.x_tomtom_delay_s != null && (
                        <div style={{ color: '#b45309' }}>traffic delay {Math.round(p.x_tomtom_delay_s / 60)} min</div>
                      )}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}
