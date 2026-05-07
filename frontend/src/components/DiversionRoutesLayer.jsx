import { Fragment, useEffect, useMemo, useState } from 'react';
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

// Each entry is [exitOnMainRoute, viaOnAlternateRoute, reentryOnMainRoute].
// A real diversion is shaped that way: traffic exits the main corridor at
// A, travels the alternate via the midpoint, and rejoins the main corridor
// downstream at B. With 3 points OSRM will route through the alternate
// instead of just snapping A→B back to the main corridor.
const SEED_ROUTE_FALLBACKS = {
  // Exit I-35 at S Des Moines, divert east via I-80 East, re-enter I-35 N at Ankeny
  'I-35 to I-80 East (Iowa)':              [[41.5500, -93.6100], [41.6011, -93.5500], [41.7297, -93.6065]],
  // Exit I-35 at Lamoni IA, divert east via US-69, re-enter I-35 in Bethany MO
  'I-35 to US-69 (Iowa-Missouri Border)':  [[40.6195, -93.6189], [40.7400, -93.7400], [40.4000, -93.9500]],
  // Exit I-35 at Faribault MN, divert west via US-75, re-enter I-35 at Owatonna
  'I-35 to US-75 (Minnesota)':             [[44.3000, -93.2700], [44.2300, -95.6200], [44.0800, -93.2300]],
  // Exit I-70 at Goodland KS, divert north via US-40, re-enter I-70 at Burlington CO
  'I-70 to US-40 (Kansas-Colorado)':       [[39.3500, -101.7100], [39.4400, -101.9000], [39.3000, -102.2700]],
  // Exit I-80 west of Des Moines, divert south via I-35, end at Indianola
  'I-80 to I-35 South (Iowa)':             [[41.6000, -93.7900], [41.6005, -93.6100], [41.3600, -93.5600]],
  // Exit I-80 at Grand Island NE, divert north via US-30 through Columbus, re-enter I-80 at York
  'I-80 to US-30 (Nebraska)':              [[40.9200, -98.3400], [41.4300, -97.3700], [40.8700, -97.5900]]
};

function resolveEndpoints(route) {
  // 1. GeoJSON wins
  const g = route.geometry_geojson;
  if (g && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const coords = g.coordinates.map(c => [c[1], c[0]]);
    return { polyline: coords, via: null, isFromGeoJSON: true, approximate: false };
  }
  // 2. Real start/end coords
  const sLat = parseFloat(route.start_lat);
  const sLon = parseFloat(route.start_lon);
  const eLat = parseFloat(route.end_lat);
  const eLon = parseFloat(route.end_lon);
  if ([sLat, sLon, eLat, eLon].every(Number.isFinite)) {
    return { polyline: [[sLat, sLon], [eLat, eLon]], via: null, isFromGeoJSON: false, approximate: false };
  }
  // 3. Seed fallback by route name — 3-point shape (exit, via, reentry)
  const fb = SEED_ROUTE_FALLBACKS[route.route_name];
  if (fb) {
    return {
      polyline: [fb[0], fb[2]],   // visible markers stay at A and B (exit/reentry)
      via: fb[1],                  // forces OSRM through the alternate
      isFromGeoJSON: false,
      approximate: true
    };
  }
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
      const viaParam = item.via
        ? `&viaLat=${item.via[0]}&viaLon=${item.via[1]}`
        : '';
      fetch(`${config.apiUrl}/api/osrm/route?startLat=${sLat}&startLon=${sLon}&endLat=${eLat}&endLon=${eLon}${viaParam}`)
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
          // Fragment, not <div> — react-leaflet's MapContainer expects
          // Leaflet layer components as children. Wrapping in a DOM <div>
          // sneaks a non-layer node into the tree and trips the reconciler
          // ("r.map is not a function" surfaces from the children walk).
          <Fragment key={route.id}>
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
          </Fragment>
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
