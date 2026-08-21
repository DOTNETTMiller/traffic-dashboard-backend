import { useEffect, useState } from 'react';
import { Marker, Popup, Tooltip, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// Connected field devices (iCone/Ver-Mac arrow boards + portable message signs)
// auto-associated to work-zone events. Renders each device, and for matched
// devices a connector line to the exact point on the zone it links to — so you
// can see WHERE the association was made and on what basis.

const COLORS = {
  auto: '#16a34a',      // green  — auto-linked (>=75%)
  review: '#d97706',    // amber  — needs review (60-74%)
  unmatched: '#6b7280'  // grey   — no zone matched
};

// A small arrow-board glyph; color encodes match state.
function deviceIcon(color, displaying) {
  const glow = displaying ? `box-shadow:0 0 0 3px ${color}33;` : 'opacity:0.7;';
  return L.divIcon({
    className: 'connected-device-icon',
    html: `<div style="width:16px;height:16px;border-radius:3px;background:${color};
      border:2px solid #fff;${glow}display:flex;align-items:center;justify-content:center;
      color:#fff;font-size:10px;font-weight:700;line-height:1;">▤</div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

const toLatLng = (c) => (Array.isArray(c) && c.length >= 2 ? [c[1], c[0]] : null); // [lon,lat] -> [lat,lng]

export default function ConnectedDevicesLayer({ visible = false }) {
  const [data, setData] = useState({ devices: [], links: [], review: [], counts: null });

  // Load once when the layer becomes visible (no polling — matches app convention).
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api.get('/api/devices')
      .then((res) => { if (!cancelled) setData((res && res.data) || {}); })
      .catch((err) => console.error('ConnectedDevicesLayer load failed:', err.message));
    return () => { cancelled = true; };
  }, [visible]);

  if (!visible) return null;

  const linkByDevice = new Map((data.links || []).map((l) => [l.device, l]));
  const reviewByDevice = new Map((data.review || []).map((l) => [l.device, l]));

  return (
    <>
      {/* Connector lines: device -> the point on the zone it matched (where + why). */}
      {[...(data.links || []), ...(data.review || [])].map((l, i) => {
        if (!l.connector || l.connector.length < 2) return null;
        const pts = l.connector.map(toLatLng).filter(Boolean);
        if (pts.length < 2) return null;
        const isReview = reviewByDevice.has(l.device);
        return (
          <Polyline
            key={`conn-${l.device}-${i}`}
            positions={pts}
            pathOptions={{ color: isReview ? COLORS.review : COLORS.auto, weight: 2, dashArray: '4 4', opacity: 0.8 }}
          >
            <Tooltip>{`${l.device} → ${l.corridor} (${l.confidence}%, ${l.distanceM}m upstream)`}</Tooltip>
          </Polyline>
        );
      })}

      {/* The matched point on each zone (small dot at the link target). */}
      {[...(data.links || []), ...(data.review || [])].map((l, i) => {
        const p = toLatLng(l.zoneRef);
        if (!p) return null;
        return <CircleMarker key={`ref-${l.device}-${i}`} center={p} radius={3}
          pathOptions={{ color: '#111', fillColor: '#fff', fillOpacity: 1, weight: 1 }} />;
      })}

      {/* Device markers. */}
      {(data.devices || []).map((d, i) => {
        const p = toLatLng(d.coordinates);
        if (!p) return null;
        const link = linkByDevice.get(d.id);
        const review = reviewByDevice.get(d.id);
        const color = link ? COLORS.auto : review ? COLORS.review : COLORS.unmatched;
        const match = link || review;
        return (
          <Marker key={`dev-${d.id}-${i}`} position={p} icon={deviceIcon(color, d.mode && d.mode.displaying)}>
            <Popup>
              <div style={{ minWidth: 220, fontSize: 13 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.id}</div>
                <div style={{ color: '#555', marginBottom: 6 }}>
                  {d.signType || d.deviceType} · {d.route || '—'} {d.direction || ''}
                </div>
                {d.mode && d.mode.displaying
                  ? <div style={{ marginBottom: 6 }}><b>Displaying:</b> {d.mode.pattern}</div>
                  : <div style={{ marginBottom: 6, color: '#888' }}>Blank / not displaying</div>}
                {match ? (
                  <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontWeight: 700, color: link ? COLORS.auto : COLORS.review }}>
                      {link ? 'Auto-linked' : 'Needs review'} — {match.confidence}%
                    </div>
                    <div style={{ margin: '2px 0' }}>→ zone <code>{match.road_event_id}</code> ({match.corridor})</div>
                    <div style={{ color: '#555' }}>{match.distanceM} m · {match.reasons.join(' · ')}</div>
                  </div>
                ) : (
                  <div style={{ color: '#888' }}>No work zone matched within range.</div>
                )}
                {d.updated && <div style={{ marginTop: 6, color: '#999', fontSize: 11 }}>Updated {new Date(d.updated).toLocaleString()}</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
