import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleMarker, Marker, Polyline, Popup, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

/**
 * Road-service layer: winter conditions, plows, and the maintenance fleet's own photos.
 *
 * Motivated by PennDOT's friction study, which found road-service operations — plow
 * activity, treatment material, time since last service — outweighed every meteorological
 * variable in predicting what the road surface does next.
 *
 * Three things are drawn, answering different questions:
 *
 *   CONDITIONS — winter road condition reports from nine state DOTs in one free layer.
 *   Reports carry a CURRENT/STALE status, and stale is drawn differently rather than mixed
 *   in: a stale winter report describes a road that may since have been treated, which is
 *   worse than no report at all.
 *
 *   PLOWS — live positions, coloured by what the truck is doing rather than merely where it
 *   is. A truck with material going down is operationally different from one deadheading,
 *   and that is the distinction the popup leads with.
 *
 *   FLEET PHOTOS — geotagged frames from the trucks. This is the part that works
 *   year-round: the same vehicles run maintenance in summer, so the corridor gets
 *   photographed continuously by a camera that MOVES. Fixed cameras only see where somebody
 *   mounted one.
 *
 * Outside winter the first two are nearly empty, and that is correct — it means no treatment
 * is happening, not that data is missing. The layer says so rather than looking broken.
 */

// Photos are dense (a thousand an hour statewide), so they only load once the map is close
// enough for individual frames to be distinguishable.
const MIN_PHOTO_ZOOM = 8;

const COND_STYLE = {
  current: { color: '#0369a1', weight: 3, opacity: 0.85 },
  stale: { color: '#94a3b8', weight: 2, opacity: 0.5, dashArray: '4,4' }
};

// Colour by activity, not by vehicle. Treating > plowing > merely present.
function plowColor(p) {
  if (p.treating) return '#15803d';
  if (p.plowDown) return '#0284c7';
  return '#64748b';
}
const plowIcon = (p) => L.divIcon({
  className: '',
  iconSize: [22, 22], iconAnchor: [11, 11],
  html: `<div style="background:${plowColor(p)};color:#fff;border:2px solid #fff;border-radius:50%;`
    + `width:22px;height:22px;line-height:19px;text-align:center;font-size:11px;`
    + `box-shadow:0 1px 4px rgba(0,0,0,.4)">🚛</div>`
});

const photoIcon = L.divIcon({
  className: '',
  iconSize: [12, 12], iconAnchor: [6, 6],
  html: '<div style="background:#f97316;border:1.5px solid #fff;border-radius:2px;width:12px;height:12px;'
    + 'box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>'
});

function MapWatcher({ onChange }) {
  const map = useMapEvents({
    moveend: () => onChange(map.getBounds(), map.getZoom()),
    zoomend: () => onChange(map.getBounds(), map.getZoom())
  });
  useEffect(() => { onChange(map.getBounds(), map.getZoom()); }, []);
  return null;
}

export default function WinterRoadLayer({ visible = false, showPhotos = true, maxAgeMin = 120 }) {
  const [conditions, setConditions] = useState([]);
  const [plows, setPlows] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [zoomedEnough, setZoomedEnough] = useState(false);
  const lastKey = useRef(null);

  // Conditions and plows are statewide and small; fetch once when the layer opens, never
  // poll. Photos follow the viewport because there are far more of them.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api.client.get('/api/winter/conditions?geometry=1')
      .then(r => { if (!cancelled) setConditions(r.data?.conditions || []); })
      .catch(() => {});
    api.client.get('/api/winter/plows')
      .then(r => { if (!cancelled) setPlows(r.data?.plows || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visible]);

  const onMapChange = useCallback((bounds, zoom) => {
    if (!visible || !showPhotos) return;
    const ok = zoom >= MIN_PHOTO_ZOOM;
    setZoomedEnough(ok);
    if (!ok) { setPhotos([]); lastKey.current = null; return; }
    const key = String(Math.round(zoom));
    if (key === lastKey.current) return;
    lastKey.current = key;
    api.client.get(`/api/winter/cams?maxAgeMin=${maxAgeMin}`)
      .then(r => setPhotos(r.data?.cams || []))
      .catch(() => {});
  }, [visible, showPhotos, maxAgeMin]);

  if (!visible) return null;

  const inView = zoomedEnough ? photos : [];

  return (
    <>
      <MapWatcher onChange={onMapChange} />

      {conditions.map((c, i) => {
        const coords = c.geometry?.coordinates || [];
        if (coords.length < 2) return null;
        const style = c.current ? COND_STYLE.current : COND_STYLE.stale;
        return (
          <Polyline key={`wc-${i}`} positions={coords.map(p => [p[1], p[0]])} pathOptions={style}>
            <Tooltip sticky>
              <b>{c.route || 'Route'}</b> — {c.headline || 'condition report'}
              {!c.current && <> · <i>stale</i></>}
            </Tooltip>
            <Popup>
              <div style={{ font: '12px system-ui', minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.route || 'Route'}{c.segment ? ` · ${c.segment}` : ''}</div>
                <div style={{ color: '#475569' }}>{c.state}</div>
                {c.headline && <div style={{ marginTop: 4, fontWeight: 600 }}>{c.headline}</div>}
                {c.description && <div style={{ color: '#475569', marginTop: 2 }}>{c.description}</div>}
                {c.updatedAt && (
                  <div style={{ color: c.current ? '#64748b' : '#b45309', marginTop: 4, fontSize: 11 }}>
                    updated {new Date(c.updatedAt).toLocaleString()}{!c.current ? ' — reported stale by the source' : ''}
                  </div>
                )}
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {plows.map((p, i) => (
        <Marker key={`pl-${p.id || i}`} position={[p.lat, p.lon]} icon={plowIcon(p)}>
          <Tooltip direction="top" offset={[0, -8]}>
            {p.treating ? 'Applying material' : p.plowDown ? 'Plowing' : 'Maintenance vehicle'}
          </Tooltip>
          <Popup>
            <div style={{ font: '12px system-ui', minWidth: 210 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Truck {p.id}</div>
              <div style={{ color: plowColor(p), fontWeight: 600, marginTop: 2 }}>
                {p.treating ? 'Applying material' : p.plowDown ? 'Plow down' : 'No treatment reported'}
              </div>
              {p.material && (p.material.solid || p.material.liquid) && (
                <div style={{ marginTop: 3 }}>
                  {p.material.solid && <div>solid: {p.material.solid}{p.material.solidRate ? ` @ ${p.material.solidRate}` : ''}</div>}
                  {p.material.liquid && <div>liquid: {p.material.liquid}{p.material.liquidRate ? ` @ ${p.material.liquidRate}` : ''}</div>}
                </div>
              )}
              {(p.roadTempF != null || p.airTempF != null) && (
                <div style={{ marginTop: 3 }}>
                  {p.roadTempF != null && <>road {p.roadTempF}°F</>}
                  {p.airTempF != null && <> · air {p.airTempF}°F</>}
                </div>
              )}
              {p.speedMph != null && <div style={{ color: '#64748b' }}>{Math.round(p.speedMph)} mph</div>}
              {p.winterRoute && <div style={{ color: '#64748b' }}>route {p.winterRoute}</div>}
              {p.observedAt && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>{new Date(p.observedAt).toLocaleString()}</div>}
            </div>
          </Popup>
        </Marker>
      ))}

      {inView.map((c, i) => (
        <Marker key={`ph-${c.id || i}`} position={[c.lat, c.lon]} icon={photoIcon}>
          <Popup>
            <div style={{ font: '12px system-ui', width: 260 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>
                {c.route || 'Fleet camera'}{c.milepost != null ? ` · MP ${c.milepost}` : ''}
              </div>
              <img src={c.imageUrl} alt="view from a maintenance vehicle"
                style={{ width: '100%', borderRadius: 6, display: 'block', marginTop: 4 }}
                onError={(e) => { e.target.style.display = 'none'; }} />
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>
                {c.state}{c.county ? ` · ${c.county} County` : ''}{c.speedMph != null ? ` · ${Math.round(c.speedMph)} mph` : ''}
              </div>
              {c.takenAt && (
                <div style={{ color: '#94a3b8', fontSize: 11 }}>
                  taken {new Date(c.takenAt).toLocaleString()}{c.truck ? ` · truck ${c.truck}` : ''}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
