import { useEffect, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

/**
 * CBP Border Wait Times map layer.
 *
 * Renders each US-Canada and US-Mexico land port of entry as a marker
 * with current commercial-truck-lane wait time as the headline label.
 * Click for full breakdown across commercial / FAST / passenger /
 * pedestrian lanes.
 *
 * Marker color is keyed off the worst-case commercial truck delay so
 * operators planning a freight route see ports under pressure at a
 * glance:
 *
 *   green   ≤ 15 min    flowing
 *   yellow  16-30 min   moderate delay
 *   orange  31-60 min   significant delay
 *   red     > 60 min    severe delay or closed
 *   gray    no data / port closed
 */

const TONE = {
  flowing:    { bg: '#16a34a', label: 'Flowing'  },
  moderate:   { bg: '#ca8a04', label: 'Moderate' },
  significant:{ bg: '#ea580c', label: 'Heavy'    },
  severe:     { bg: '#dc2626', label: 'Severe'   },
  unknown:    { bg: '#6b7280', label: 'No data'  }
};

function tone(port) {
  if (port.port_status && port.port_status.toLowerCase() !== 'open') return TONE.unknown;
  const delay = port.commercial?.delay_minutes;
  if (!Number.isFinite(delay)) return TONE.unknown;
  if (delay <= 15) return TONE.flowing;
  if (delay <= 30) return TONE.moderate;
  if (delay <= 60) return TONE.significant;
  return TONE.severe;
}

function flagFor(border) {
  if (/canadian/i.test(border)) return '🇨🇦';
  if (/mexican/i.test(border)) return '🇲🇽';
  return '';
}

const buildIcon = (port) => {
  const t = tone(port);
  const delay = Number.isFinite(port.commercial?.delay_minutes)
    ? `${port.commercial.delay_minutes}m`
    : '—';
  return L.divIcon({
    html: `<div style="
      width: 36px; height: 36px; border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      background: ${t.bg};
      border: 2px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        transform: rotate(45deg);
        color: white; font-weight: 700; font-size: 11px;
        font-family: 'JetBrains Mono', monospace;
      ">${delay}</div>
    </div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

export default function BorderWaitTimesLayer({ visible = false }) {
  const [ports, setPorts] = useState([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/api/border-wait-times');
        if (!cancelled) setPorts(res?.data?.ports || []);
      } catch {
        if (!cancelled) setPorts([]);
      }
    };
    load();
    // 5-min refresh — matches server-side cache TTL.
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {ports
        .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
        .map(p => (
          <Marker key={p.port_number} position={[p.latitude, p.longitude]} icon={buildIcon(p)}>
            <Tooltip direction="top" offset={[0, -32]}>
              <strong>{flagFor(p.border)} {p.port_name}{p.crossing_name ? ` — ${p.crossing_name}` : ''}</strong>
              <br />
              {tone(p).label} · {p.commercial?.delay_minutes ?? '—'} min commercial
            </Tooltip>
            <Popup>
              <PortPopup port={p} />
            </Popup>
          </Marker>
        ))}
    </>
  );
}

function PortPopup({ port }) {
  return (
    <div style={{ minWidth: 240, fontFamily: 'var(--font-sans)' }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.02em',
        color: 'var(--accent)', marginBottom: 6,
        paddingBottom: 4, borderBottom: '2px solid var(--accent)'
      }}>
        {flagFor(port.border)} {port.port_name}
      </div>
      {port.crossing_name && (
        <div style={{ fontSize: 12, color: '#374151', marginBottom: 8 }}>{port.crossing_name}</div>
      )}
      <Row label="Status" value={port.port_status || '—'} />
      <Row label="Hours" value={port.hours || '—'} />
      <LaneBlock title="Commercial truck" lanes={port.commercial} />
      <LaneBlock title="Passenger vehicle" lanes={port.passenger} />
      <LaneBlock title="Pedestrian" lanes={port.pedestrian} />
      <div style={{ marginTop: 8, fontSize: 10, color: '#6b7280' }}>
        Updated {port.updated_at ? new Date(port.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} · CBP
      </div>
    </div>
  );
}

function LaneBlock({ title, lanes }) {
  if (!lanes || (lanes.lanes_open === 0 && lanes.delay_minutes === 0 && lanes.operational_status === 'N/A')) {
    return null;
  }
  return (
    <div style={{
      marginTop: 8, padding: '6px 8px',
      background: '#f9fafb', borderRadius: 6,
      fontSize: 11
    }}>
      <div style={{ fontWeight: 700, marginBottom: 3, color: '#1d1d1f' }}>{title}</div>
      <Row label="Standard" value={`${lanes.lanes_open}/${lanes.maximum_lanes} lanes · ${lanes.delay_minutes}m delay · ${lanes.operational_status}`} small />
      {lanes.fast_or_ready_lanes_open > 0 && (
        <Row label="FAST/Ready" value={`${lanes.fast_or_ready_lanes_open} lanes · ${lanes.fast_or_ready_delay_minutes}m · ${lanes.fast_or_ready_status}`} small />
      )}
    </div>
  );
}

function Row({ label, value, small }) {
  return (
    <div style={{ fontSize: small ? 11 : 12, marginBottom: 3 }}>
      <strong style={{ color: '#1d1d1f' }}>{label}:</strong>{' '}
      <span style={{ color: '#374151' }}>{value}</span>
    </div>
  );
}
