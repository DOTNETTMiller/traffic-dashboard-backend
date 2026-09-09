import { useEffect, useState } from 'react';
import { CircleMarker, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

/**
 * Rail grade crossings map layer.
 *
 * Two things are drawn, and they answer different questions:
 *
 *   HOTSPOTS (default on) — crossings ranked by how much REPORTED blockage they account
 *   for, from FRA's Blocked Crossing Incident Reporter. This is the layer that changes a
 *   decision: routing a detour over a crossing with 600 hours of reported blockage is a
 *   different proposition from one with two. It is historical, so it is always available
 *   and never goes stale mid-shift.
 *
 *   TRAINS (opt-in) — live Amtrak positions with the crossings ahead of each. Useful, but
 *   passenger only: freight causes most blockages and publishes no positions, so an empty
 *   map here does NOT mean the tracks are clear.
 *
 * Sizing is by blocked HOURS rather than incident count on purpose: a crossing blocked
 * twice for six hours matters more to a detour than one blocked twenty times for ten
 * minutes, and count alone inverts that.
 *
 * Reports are public-submitted, so a busy urban crossing out-reports an identical rural
 * one. The popup says so rather than presenting the ranking as a census.
 */

// Severity by total reported blocked hours at that crossing.
const TIERS = [
  { min: 100, bg: '#7f1d1d', label: 'Severe',   note: '100+ hours reported blocked' },
  { min: 25,  bg: '#dc2626', label: 'High',     note: '25-100 hours reported blocked' },
  { min: 5,   bg: '#ea580c', label: 'Moderate', note: '5-25 hours reported blocked' },
  { min: 0,   bg: '#ca8a04', label: 'Low',      note: 'under 5 hours reported blocked' }
];
const tierFor = (hours) => TIERS.find(t => (hours || 0) >= t.min) || TIERS[TIERS.length - 1];

// Radius grows with severity but is capped — an outlier like Ottumwa (600h) must not
// swallow the map.
const radiusFor = (hours) => Math.max(5, Math.min(16, 5 + Math.sqrt(hours || 0) * 0.9));

// Live train marker, coloured by whether its position agrees with its own published
// schedule. A disputed position still renders — hiding it would be worse than showing it
// with a caveat — but it is visibly distinct so nobody plans against it unknowingly.
const trainIcon = (t) => {
  const status = t.scheduleCheck?.status;
  const bg = status === 'on-route' ? '#1d4ed8'
    : status === 'off-route' ? '#b45309'
    : '#6b7280';
  const ring = status === 'off-route' ? 'dashed' : 'solid';
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html:
      `<div style="background:${bg};color:#fff;border:2px ${ring} #fff;border-radius:6px;` +
      `width:26px;height:26px;line-height:22px;text-align:center;font:700 10px system-ui;` +
      `box-shadow:0 1px 4px rgba(0,0,0,.4)">${String(t.trainNum || '?').slice(0, 4)}</div>`
  });
};

export default function RailCrossingLayer({
  visible = false,
  state = 'IA',
  showTrains = false,
  limit = 150
}) {
  const [hotspots, setHotspots] = useState([]);
  const [trains, setTrains] = useState([]);
  const [ahead, setAhead] = useState({});      // trainNum -> crossings ahead
  const [error, setError] = useState(null);

  // Hotspots are historical: fetch once when the layer is switched on, never poll.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api.client.get(`/api/rail/hotspots?state=${encodeURIComponent(state)}&limit=${limit}`)
      .then(r => { if (!cancelled) setHotspots(r.data?.hotspots || []); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [visible, state, limit]);

  // Trains are live, and only fetched when the user actually asks for them.
  useEffect(() => {
    if (!visible || !showTrains) { setTrains([]); return; }
    let cancelled = false;
    api.client.get('/api/rail/trains')
      .then(r => { if (!cancelled) setTrains(r.data?.trains || []); })
      .catch(() => { /* live feed is optional; hotspots still render */ });
    return () => { cancelled = true; };
  }, [visible, showTrains]);

  if (!visible) return null;

  const loadAhead = (trainNum) => {
    if (ahead[trainNum]) return;
    api.client.get(`/api/rail/crossings-ahead?train=${encodeURIComponent(trainNum)}`)
      .then(r => setAhead(prev => ({ ...prev, [trainNum]: r.data })))
      .catch(() => setAhead(prev => ({ ...prev, [trainNum]: { ahead: [] } })));
  };

  return (
    <>
      {hotspots.map(h => {
        if (!Number.isFinite(h.latitude) || !Number.isFinite(h.longitude)) return null;
        const tier = tierFor(h.blockedHours);
        return (
          <CircleMarker
            key={`hs-${h.crossingId}`}
            center={[h.latitude, h.longitude]}
            radius={radiusFor(h.blockedHours)}
            pathOptions={{ color: '#fff', weight: 1.5, fillColor: tier.bg, fillOpacity: 0.8 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <b>{h.street || 'Crossing'}</b> — {h.blockedHours}h reported blocked
            </Tooltip>
            <Popup>
              <div style={{ font: '12px system-ui', minWidth: 230 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{h.street || 'Grade crossing'}</div>
                <div style={{ color: '#475569' }}>{h.city}{h.county ? `, ${h.county} County` : ''} {h.state}</div>
                <div style={{ margin: '6px 0', padding: '4px 6px', background: tier.bg, color: '#fff', borderRadius: 3 }}>
                  {tier.label} — {h.blockedHours} hours across {h.incidents} report{h.incidents === 1 ? '' : 's'}
                </div>
                <div>Average blockage: <b>{h.avgMinutes} min</b>{h.longestBucket ? ` · longest reported ${h.longestBucket}` : ''}</div>
                <div>Railroad: <b>{h.railroad || 'unknown'}</b> · FRA crossing <b>{h.crossingId}</b></div>
                {h.topReason && <div style={{ marginTop: 4 }}>Most common cause: {h.topReason}</div>}
                {h.lastReported && <div style={{ color: '#64748b' }}>Last reported {String(h.lastReported).slice(0, 10)}</div>}
                <div style={{ marginTop: 6, color: '#64748b', fontSize: 11 }}>
                  Public-reported to FRA. A busy crossing attracts more reports than an
                  identical quiet one — read this as a nuisance ranking, not a census.
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {showTrains && trains.map(t => {
        if (!Number.isFinite(t.lat) || !Number.isFinite(t.lon)) return null;
        const a = ahead[t.trainNum];
        return (
          <Marker
            key={`tr-${t.trainNum}`}
            position={[t.lat, t.lon]}
            icon={trainIcon(t)}
            eventHandlers={{ click: () => loadAhead(t.trainNum) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              Train {t.trainNum} — {t.route} · {t.speedMph} mph
            </Tooltip>
            <Popup>
              <div style={{ font: '12px system-ui', minWidth: 240 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Train {t.trainNum} — {t.route}</div>
                <div style={{ color: '#475569' }}>{t.origin} → {t.destination}</div>
                <div style={{ marginTop: 4 }}>{t.speedMph} mph, heading {t.heading}</div>
                {t.scheduleCheck && (
                  <div style={{ marginTop: 4 }}>
                    Position vs published schedule:{' '}
                    <b style={{ color: t.scheduleCheck.status === 'on-route' ? '#15803d' : '#b45309' }}>
                      {t.scheduleCheck.status}
                    </b>
                    {t.scheduleCheck.offRouteM != null && ` (${t.scheduleCheck.offRouteM} m off)`}
                  </div>
                )}
                {a ? (
                  a.ahead?.length ? (
                    <>
                      <div style={{ marginTop: 6, fontWeight: 600 }}>Crossings ahead</div>
                      {a.ahead.slice(0, 5).map(c => (
                        <div key={c.crossingId}>
                          {c.distanceMi} mi · ~{c.etaMin} min — {c.street || 'crossing'}, {c.city}
                        </div>
                      ))}
                      {a.driftMi != null && (
                        <div style={{ marginTop: 4, color: '#64748b', fontSize: 11 }}>
                          Position is {a.positionAgeS}s old — the train may already be {a.driftMi} mi
                          further on, so any ETA under that is inside the noise.
                        </div>
                      )}
                    </>
                  ) : <div style={{ marginTop: 6, color: '#64748b' }}>No crossings found ahead.</div>
                ) : <div style={{ marginTop: 6, color: '#64748b' }}>Click to load crossings ahead…</div>}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {error && null /* hotspot fetch failed; the rest of the map is unaffected */}
    </>
  );
}
