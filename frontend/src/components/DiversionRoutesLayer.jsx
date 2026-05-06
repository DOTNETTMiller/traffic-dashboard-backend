import { useEffect, useMemo, useState } from 'react';
import { Polyline, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';
import { config } from '../config';

/**
 * Diversion Routes layer for the main map.
 *
 * Fetches /api/diversion-routes once when visible, resolves coordinates
 * (DB-supplied geometry_geojson > start/end coords > seed fallback by
 * route_name), and asks /api/osrm/route to snap the start/end to actual
 * road geometry — the same pipeline events use. Each route renders as
 * a distinct orange polyline with a click-popup summarizing the route.
 *
 * The same SEED_ROUTE_FALLBACKS list lives in DiversionRoutePanel.jsx
 * for the inline-detail preview; both light up the same routes when the
 * DB rows lack coordinates.
 */

const SEED_ROUTE_FALLBACKS = {
  'I-35 to I-80 East (Iowa)':                   [[41.6005, -93.6092], [41.7297, -93.6065]],
  'I-35 to US-69 (Iowa-Missouri Border)':       [[40.6500, -93.6200], [40.4000, -93.7500]],
  'I-35 to US-75 (Minnesota)':                  [[46.3000, -94.3000], [46.5500, -94.4500]],
  'I-70 to US-40 (Kansas-Colorado)':            [[39.0000, -101.9000], [39.0500, -101.7500]],
  'I-80 to I-35 South (Iowa)':                  [[41.6005, -93.6092], [41.4200, -93.6300]],
  'I-80 to US-30 (Nebraska)':                   [[41.0000, -98.0000], [41.1500, -98.2000]]
};

function resolveEndpoints(route) {
  // 1. GeoJSON wins
  const g = route.geometry_geojson;
  if (g && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const coords = g.coordinates.map(c => [c[1], c[0]]);
    return { polyline: coords, isFromGeoJSON: true, approximate: false };
  }
  // 2. Real start/end coords
  const sLat = parseFloat(route.start_lat);
  const sLon = parseFloat(route.start_lon);
  const eLat = parseFloat(route.end_lat);
  const eLon = parseFloat(route.end_lon);
  if ([sLat, sLon, eLat, eLon].every(Number.isFinite)) {
    return { polyline: [[sLat, sLon], [eLat, eLon]], isFromGeoJSON: false, approximate: false };
  }
  // 3. Seed fallback by route name
  const fb = SEED_ROUTE_FALLBACKS[route.route_name];
  if (fb) return { polyline: fb, isFromGeoJSON: false, approximate: true };
  return null;
}

const startIcon = L.divIcon({
  html: `<div style="
    width: 16px; height: 16px; border-radius: 50%;
    background: #16a34a; border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    color: white; font-size: 9px; font-weight: 700;
    text-align: center; line-height: 12px;">A</div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

const endIcon = L.divIcon({
  html: `<div style="
    width: 16px; height: 16px; border-radius: 50%;
    background: #D32F2F; border: 2px solid white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    color: white; font-size: 9px; font-weight: 700;
    text-align: center; line-height: 12px;">B</div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

export default function DiversionRoutesLayer({ visible = false }) {
  const [routes, setRoutes] = useState([]);
  const [snapped, setSnapped] = useState({});  // { [routeId]: [[lat, lng], ...] }

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    api.get('/api/diversion-routes').then(res => {
      if (cancelled) return;
      const list = Array.isArray(res?.data?.routes) ? res.data.routes : [];
      setRoutes(list.filter(r => r.approval_status === 'approved' || !r.approval_status));
    }).catch(err => {
      console.warn('DiversionRoutesLayer fetch failed:', err.message);
    });
    return () => { cancelled = true; };
  }, [visible]);

  // Resolve endpoints for each route up front (cheap; no network).
  const resolved = useMemo(() => {
    return routes
      .map(r => {
        const ends = resolveEndpoints(r);
        return ends ? { route: r, ...ends } : null;
      })
      .filter(Boolean);
  }, [routes]);

  // For routes whose polyline is just two endpoints (no GeoJSON), kick
  // off a road-snap. Each result populates `snapped[routeId]` and the
  // polyline render upgrades automatically. Server caches via
  // osrm_geometry_cache so this is idempotent across page loads.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    for (const item of resolved) {
      if (item.isFromGeoJSON) continue;             // already a real polyline
      if (snapped[item.route.id]) continue;         // already snapped
      const [[sLat, sLon], [eLat, eLon]] = item.polyline;
      fetch(`${config.apiUrl}/api/osrm/route?startLat=${sLat}&startLon=${sLon}&endLat=${eLat}&endLon=${eLon}`)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          if (data?.success && Array.isArray(data.coordinates) && data.coordinates.length >= 2) {
            setSnapped(s => ({
              ...s,
              [item.route.id]: data.coordinates.map(c => [c[1], c[0]])  // [lng,lat] → [lat,lng]
            }));
          }
        })
        .catch(() => { /* keep the straight line silently */ });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, visible]);

  if (!visible) return null;

  return (
    <>
      {resolved.map(({ route, polyline, approximate }) => {
        const positions = snapped[route.id] || polyline;
        const start = positions[0];
        const end = positions[positions.length - 1];

        return (
          <div key={route.id}>
            <Polyline
              positions={positions}
              pathOptions={{
                color: '#F08230',
                weight: 5,
                opacity: 0.85,
                dashArray: approximate ? '8 6' : null  // dashed when seed-fallback
              }}
            >
              <Tooltip sticky direction="top" offset={[0, -4]}>
                <strong>{route.route_name}</strong>
                <br />
                {route.primary_route} → {route.diversion_route}
              </Tooltip>
              <Popup>
                <div style={{ minWidth: 200, fontFamily: 'var(--font-sans)' }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 14, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.02em',
                    color: 'var(--accent)', marginBottom: 6,
                    paddingBottom: 4, borderBottom: '2px solid var(--accent)'
                  }}>
                    {route.route_name}
                  </div>
                  <Row label="Primary" value={route.primary_route} />
                  <Row label="Diversion" value={route.diversion_route} />
                  <Row label="Distance" value={route.distance_miles ? `${route.distance_miles} mi` : '—'} />
                  <Row label="Est. delay" value={route.estimated_delay_minutes ? `${route.estimated_delay_minutes} min` : '—'} />
                  <Row label="States" value={(route.states_involved || []).join(', ') || '—'} />
                  {approximate && (
                    <div style={{ marginTop: 6, fontSize: 10, color: '#a55e10' }}>
                      ⚠ Coordinates are approximate — DB row has no start/end fields yet.
                    </div>
                  )}
                </div>
              </Popup>
            </Polyline>
            <Marker position={start} icon={startIcon}>
              <Tooltip direction="top" offset={[0, -8]}>{route.start_location || 'Start'}</Tooltip>
            </Marker>
            <Marker position={end} icon={endIcon}>
              <Tooltip direction="top" offset={[0, -8]}>{route.end_location || 'End'}</Tooltip>
            </Marker>
          </div>
        );
      })}
    </>
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
