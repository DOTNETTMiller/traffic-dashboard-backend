import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Popup, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import api from '../services/api';

/**
 * Historical crash points (NHTSA FARS) for the I-80 / I-35 corridors.
 *
 * Self-fetches /api/crashes/historical once when first made visible (no
 * polling). Renders clustered CircleMarkers so thousands of points stay light
 * on the map and on the wire. Marker color encodes the attributes the corridor
 * team cares about, in priority order:
 *   • commercial-vehicle involved → amber
 *   • work-zone crash            → orange
 *   • other fatal crash          → grey
 *
 * FARS is fatal-crashes-only; that caveat is surfaced in the popup.
 */

const COLORS = {
  cmv: '#b45309',       // commercial vehicle
  workZone: '#d97706',  // work zone
  other: '#6b7280'      // other fatal crash
};

function crashColor(c) {
  if (c.commercial_vehicle) return COLORS.cmv;
  if (c.work_zone >= 1) return COLORS.workZone;
  return COLORS.other;
}

export default function HistoricalCrashesLayer({ visible = false, corridor = 'Both', year = 'all', onYearsLoaded }) {
  const [crashes, setCrashes] = useState([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        // Load ALL corridor points once; corridor/year filtering is client-side
        // below, so changing the on-map filter makes no new network call.
        const data = await api.getHistoricalCrashes({ limit: 5000 });
        if (!cancelled) setCrashes((data?.crashes || []).filter(c => c.latitude && c.longitude));
      } catch (err) {
        // 404 = data not loaded yet; just render nothing.
        if (!cancelled) setCrashes([]);
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  // Report the available years up to the on-map control.
  useEffect(() => {
    if (!onYearsLoaded) return;
    const ys = Array.from(new Set(crashes.map(c => c.year))).sort((a, b) => b - a);
    onYearsLoaded(ys);
  }, [crashes, onYearsLoaded]);

  const shown = useMemo(() => crashes.filter(c => {
    const corridorOk = corridor === 'Both' || (c.corridor || '').toUpperCase() === corridor;
    const yearOk = year === 'all' || c.year === Number(year);
    return corridorOk && yearOk;
  }), [crashes, corridor, year]);

  if (!visible || shown.length === 0) return null;

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={50}
      showCoverageOnHover={false}
      zoomToBoundsOnClick={true}
    >
      {shown.map(c => {
        const color = crashColor(c);
        return (
          <CircleMarker
            key={c.id}
            center={[c.latitude, c.longitude]}
            radius={c.fatals > 1 ? 7 : 5}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 1 }}
          >
            <Tooltip>
              {c.year} · {c.corridor} · {c.fatals} {c.fatals === 1 ? 'fatality' : 'fatalities'}
              {c.commercial_vehicle ? ' · 🚛 CMV' : ''}
            </Tooltip>
            <Popup>
              <div style={{ fontSize: '13px', lineHeight: 1.5 }}>
                <strong>{c.corridor} fatal crash · {c.year}</strong><br />
                {c.county ? `${c.county}, ` : ''}{c.state}<br />
                Fatalities: <strong>{c.fatals}</strong><br />
                {c.commercial_vehicle ? <span style={{ color: COLORS.cmv }}>🚛 Commercial vehicle involved<br /></span> : null}
                {c.work_zone >= 1 ? <span style={{ color: COLORS.workZone }}>🚧 Work zone: {c.work_zone_name || 'yes'}<br /></span> : null}
                {c.tway_id ? <span style={{ color: '#9ca3af' }}>{c.tway_id}<br /></span> : null}
                <span style={{ color: '#9ca3af', fontSize: '11px' }}>Source: NHTSA FARS</span>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MarkerClusterGroup>
  );
}
