import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Popup, Tooltip } from 'react-leaflet';
import api from '../services/api';

/**
 * Major upcoming events (Ticketmaster) near the I-80 / I-35 corridors, shown as
 * demand-surge alerts on the map. Self-fetches /api/major-events once when first
 * made visible (no polling). Gated server-side on TICKETMASTER_API_KEY — without
 * a key the endpoint returns nothing, so this layer simply renders empty.
 *
 * Marker color = inferred impact (capacity-based today; PredictHQ-ready):
 *   high (≥40k) → red · medium (≥15k) → orange · low → grey
 */

const IMPACT_COLOR = { high: '#dc2626', medium: '#ea580c', low: '#6b7280' };
const IMPACT_RADIUS = { high: 12, medium: 9, low: 7 };

const fmtDate = (iso, localDate) => {
  const d = iso ? new Date(iso) : (localDate ? new Date(localDate + 'T00:00:00') : null);
  if (!d || isNaN(d)) return localDate || 'TBD';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtNum = (n) => (typeof n === 'number' ? n.toLocaleString() : n);

export default function MajorEventsLayer({ visible = true, corridor = 'Both' }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getMajorEvents(); // both corridors; filter client-side
        if (!cancelled) setEvents((data?.events || []).filter(e => e.latitude && e.longitude));
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  const shown = useMemo(
    () => events.filter(e => corridor === 'Both' || (e.corridor || '').toUpperCase() === corridor),
    [events, corridor]
  );

  if (!visible || shown.length === 0) return null;

  return (
    <>
      {shown.map(e => {
        const color = IMPACT_COLOR[e.impact] || IMPACT_COLOR.low;
        const radius = IMPACT_RADIUS[e.impact] || 7;
        const isWC = e.category === 'World Cup';
        return (
          <CircleMarker
            key={e.id}
            center={[e.latitude, e.longitude]}
            radius={radius}
            pathOptions={{ color: isWC ? '#7c3aed' : color, fillColor: color, fillOpacity: 0.55, weight: isWC ? 3 : 2 }}
          >
            <Tooltip>
              {isWC ? '🏆 ' : '🎟️ '}{e.name} · {fmtDate(e.date, e.localDate)}
            </Tooltip>
            <Popup>
              <div style={{ fontSize: '13px', lineHeight: 1.5, maxWidth: '240px' }}>
                <strong>{isWC ? '🏆 ' : '🎟️ '}{e.name}</strong><br />
                {fmtDate(e.date, e.localDate)}<br />
                {e.venueName || ''}{e.city ? ` · ${e.city}, ${e.state}` : ''}<br />
                <span style={{ color: '#6b7280' }}>{e.corridor} corridor · {e.category}</span><br />
                <span style={{ color }}>
                  ~{fmtNum(e.expectedAttendance)} expected · {e.impact} impact
                </span>
                <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                  {' '}({e.attendanceBasis === 'provider'
                    ? 'predicted'
                    : e.capacity
                      ? `est. ${Math.round(100 * e.expectedAttendance / e.capacity)}% of ${fmtNum(e.capacity)} seats`
                      : 'estimated'})
                </span><br />
                {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontSize: '12px' }}>Event details ↗</a> : null}
                <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px' }}>Source: Ticketmaster</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
