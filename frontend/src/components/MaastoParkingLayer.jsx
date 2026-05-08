import { useEffect, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import api from '../services/api';

/**
 * MAASTO TPIMS real-time truck parking layer.
 *
 * Renders live multi-state Midwest truck-parking sites (IL/KY/MN public
 * feeds via the MAASTO coalition's TPIMS V2.2 endpoints). Distinct from
 * the existing internal ParkingLayer:
 *
 *   - Internal ParkingLayer is database-backed (predictions + observations).
 *   - This layer is direct from each state DOT, with `trend` and `open`
 *     status and the spec's `trustData` flag.
 *
 * Marker color follows occupancy:
 *   green  ≤50% occupied · plenty available
 *   amber  51-80% occupied · filling
 *   red    >80% occupied · nearly full
 *   gray   closed / no data / sensor untrusted
 */

const TONE = {
  open:    { bg: '#16a34a' },
  filling: { bg: '#ca8a04' },
  full:    { bg: '#dc2626' },
  closed:  { bg: '#6b7280' }
};

function tone(site) {
  if (!site.open) return TONE.closed;
  if (!site.trust_data) return TONE.closed;
  const r = site.occupancy_rate;
  if (!Number.isFinite(r)) return TONE.closed;
  if (r <= 0.5) return TONE.open;
  if (r <= 0.8) return TONE.filling;
  return TONE.full;
}

const TREND_ICON = {
  CLEARING: '↓',
  FILLING:  '↑',
  STEADY:   '→'
};

const buildIcon = (site) => {
  const t = tone(site);
  const label = Number.isFinite(site.available)
    ? String(site.available)
    : '?';
  return L.divIcon({
    html: `<div style="
      width: 30px; height: 30px;
      border-radius: 50%;
      background: ${t.bg};
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 700; font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
    ">${label}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

export default function MaastoParkingLayer({ visible = false }) {
  const [sites, setSites] = useState([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/api/maasto-tpims');
        if (!cancelled) setSites(res?.data?.sites || []);
      } catch {
        if (!cancelled) setSites([]);
      }
    };
    load();
    const id = setInterval(load, 90 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [visible]);

  if (!visible) return null;

  const placed = sites.filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));

  return (
    <MarkerClusterGroup chunkedLoading maxClusterRadius={40}>
      {placed.map(site => (
        <Marker key={site.site_id} position={[site.latitude, site.longitude]} icon={buildIcon(site)}>
          <Tooltip direction="top" offset={[0, -14]}>
            <strong>{site.name}</strong>
            <br />
            {Number.isFinite(site.available) ? `${site.available} of ${site.capacity ?? '?'} open` : 'Status unknown'}
            {site.trend && site.trend !== 'Unknown' && ` · ${TREND_ICON[site.trend] || ''} ${site.trend.toLowerCase()}`}
          </Tooltip>
          <Popup>
            <SitePopup site={site} />
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  );
}

function SitePopup({ site }) {
  return (
    <div style={{ minWidth: 240, fontFamily: 'var(--font-sans)' }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.02em',
        color: 'var(--accent)', marginBottom: 6,
        paddingBottom: 4, borderBottom: '2px solid var(--accent)'
      }}>
        {site.name}
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
        {site.state} · {site.relevant_highway || '—'}{site.direction ? ` ${site.direction}` : ''}{site.exit ? ` · Exit ${site.exit}` : ''}
      </div>

      <Big
        primary={Number.isFinite(site.available) ? site.available : '?'}
        secondary={`of ${site.capacity ?? '?'} spaces`}
      />

      <Row label="Status" value={site.open ? 'Open' : 'Closed'} />
      {site.trend && site.trend !== 'Unknown' && (
        <Row label="Trend" value={`${TREND_ICON[site.trend] || ''} ${site.trend}`} />
      )}
      {site.ownership && (
        <Row label="Ownership" value={site.ownership === 'PR' ? 'Private' : 'Public'} />
      )}
      {!site.trust_data && (
        <div style={{ marginTop: 6, fontSize: 10, color: '#92400e', background: '#fef3c7', padding: '4px 6px', borderRadius: 4 }}>
          Sensor data flagged untrusted by source agency.
        </div>
      )}
      {Array.isArray(site.amenities) && site.amenities.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#374151' }}>
          <strong>Amenities:</strong> {site.amenities.join(', ')}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 10, color: '#6b7280' }}>
        Updated {site.timestamp ? new Date(site.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} · {site.agency}
      </div>
    </div>
  );
}

function Big({ primary, secondary }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28, fontWeight: 800,
        color: 'var(--accent)'
      }}>{primary}</span>
      <span style={{ fontSize: 12, color: '#374151', marginLeft: 6 }}>{secondary}</span>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ fontSize: 12, marginBottom: 3 }}>
      <strong style={{ color: '#1d1d1f' }}>{label}:</strong>{' '}
      <span style={{ color: '#374151' }}>{value}</span>
    </div>
  );
}
