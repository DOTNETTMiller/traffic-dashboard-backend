import { Fragment, useEffect, useState } from 'react';
import { Marker, Polyline, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

/**
 * Field Escort — farm equipment currently on a public road.
 *
 * A combine at 3 mph on a two-lane highway is the same hazard a work zone is: a closing-speed
 * problem a driver meets around a curve with no warning. Field Escort turns manufacturer
 * telematics into a public WZDx feed of machines that are ON a road right now, and this draws
 * them beside the closures.
 *
 * TWO GEOMETRIES, AND THEY MEAN DIFFERENT THINGS. The marker is the machine's last actual GPS
 * fix. The line is a FORWARD PROJECTION of where it is likely heading, dead-reckoned from that
 * fix — a prediction, not a track it has driven. It is drawn dashed, and the popup says so,
 * because a solid line here would read as observed history.
 *
 * LOADS ONCE, WHEN OPENED. No polling: the layer fetches when it is switched on and not again.
 * Closing and reopening re-reads it, which is the deliberate way to refresh.
 */

// Amber: a hazard to be warned about, distinct from the green/blue of validated closures.
const LIVE = '#b45309';
const STALE = '#a8a29e';

// A fix older than this is drawn muted — the machine has probably moved on, and the
// projection ahead of it is proportionally less believable.
const STALE_MIN = 15;

function tractorIcon(t, stale) {
  const color = stale ? STALE : LIVE;
  const rot = Number.isFinite(t.headingDeg) ? t.headingDeg : null;
  // The heading arrow only appears when a heading was actually reported; an arrow pointing
  // north by default would invent a direction the feed never gave.
  const arrow = rot === null ? '' :
    `<div style="position:absolute;left:50%;top:50%;width:0;height:0;
      transform:translate(-50%,-50%) rotate(${rot}deg) translateY(-15px);
      border-left:4px solid transparent;border-right:4px solid transparent;
      border-bottom:7px solid ${color};"></div>`;
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div style="position:absolute;transform:translate(-50%,-50%);width:26px;height:26px;">
      ${arrow}
      <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
        background:${color};color:#fff;border:2px solid #fff;border-radius:50%;
        width:22px;height:22px;line-height:19px;text-align:center;font-size:12px;
        box-shadow:0 1px 4px rgba(0,0,0,.4);">🚜</div>
    </div>`
  });
}

export default function FieldEscortLayer({ visible = false, onCounts }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!visible) return;               // nothing is fetched until the layer is opened
    let cancelled = false;
    api.client.get('/api/field-escort/tractors')
      .then((r) => {
        if (cancelled) return;
        setData(r.data || null);
        if (onCounts) onCounts(r.data && r.data.counts);
      })
      .catch(() => { if (!cancelled) setData({ available: false, tractors: [] }); });
    return () => { cancelled = true; };
  }, [visible]);

  if (!visible || !data) return null;

  return (
    <>
      {(data.tractors || []).map((t, i) => {
        const stale = Number.isFinite(t.fixAgeMin) && t.fixAgeMin > STALE_MIN;
        const color = stale ? STALE : LIVE;
        const machine = [t.make, t.model].filter(Boolean).join(' ') || 'Farm equipment';
        return (
          <Fragment key={t.id || i}>
            {t.path && t.path.length >= 2 && (
              <Polyline
                positions={t.path}
                pathOptions={{ color, weight: 4, opacity: stale ? 0.35 : 0.7, dashArray: '6,6' }}
              >
                <Tooltip sticky>
                  Projected path ahead of {machine} — not a driven track
                </Tooltip>
              </Polyline>
            )}
            <Marker position={t.fix} icon={tractorIcon(t, stale)}>
              <Tooltip direction="top" offset={[0, -14]}>
                {machine}{t.speedMph != null ? ` — ${t.speedMph} mph` : ''}{t.road ? ` on ${t.road}` : ''}
              </Tooltip>
              <Popup>
                <div style={{ font: '12px system-ui', minWidth: 230 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{machine}</div>
                  {t.unit && <div style={{ color: '#64748b' }}>{t.unit}</div>}
                  <div style={{ color, fontWeight: 600, marginTop: 3 }}>
                    {t.speedMph != null ? `${t.speedMph} mph` : 'speed not reported'}
                    {t.road ? ` on ${t.road}` : ''}
                    {t.direction && t.direction !== 'unknown' ? ` · ${t.direction}` : ''}
                  </div>

                  {/* The distinction that keeps the line honest. */}
                  {t.path && t.path.length >= 2 && (
                    <div style={{ marginTop: 6, paddingTop: 5, borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 600 }}>The dashed line is a forecast</div>
                      <div style={{ color: '#475569' }}>
                        {t.projectionMi != null ? `${t.projectionMi} mi ` : ''}
                        projected ahead from the last fix
                        {t.geometryBasis === 'road'
                          ? ', following the road centerline'
                          : t.geometryBasis ? `, basis: ${t.geometryBasis}` : ''}
                        {t.confidence ? ` (${t.confidence} confidence)` : ''}. It is where the
                        machine is likely heading, not where it has been.
                      </div>
                    </div>
                  )}

                  <div style={{ color: stale ? '#b45309' : '#94a3b8', fontSize: 11, marginTop: 5 }}>
                    {t.fixAgeMin != null
                      ? `last position fix ${t.fixAgeMin} min ago${stale ? ' — likely moved on' : ''}`
                      : 'fix age not reported'}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>
                    Field Escort · manufacturer telematics
                  </div>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}
