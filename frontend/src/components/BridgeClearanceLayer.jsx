import { useEffect, useState, useMemo } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// Haversine distance in km.
const distanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Pull [lat, lon] from an event whether it exposes scalar fields or only a
// GeoJSON-style coordinates pair ([lon, lat]).
const eventLatLon = (e) => {
  let lat = Number(e.latitude);
  let lon = Number(e.longitude);
  if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && Array.isArray(e.coordinates) && e.coordinates.length >= 2) {
    lon = Number(e.coordinates[0]);
    lat = Number(e.coordinates[1]);
  }
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
};

// Flag bridges whose recorded clearance may be outdated because active
// construction is within the watch radius. Done client-side against events the
// map already loaded — no extra server calls or egress.
const annotateWithConstruction = (bridges, events) => {
  const construction = (events || [])
    .filter(e => e && e.eventType === 'Construction')
    .map(e => ({ e, ll: eventLatLon(e) }))
    .filter(x => x.ll);

  return bridges.map(bridge => {
    const lat = Number(bridge.latitude);
    const lon = Number(bridge.longitude);
    const radius = Number(bridge.watch_radius_km) || 10;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || construction.length === 0) {
      return { ...bridge, construction_nearby: false, nearby_construction: [], nearby_construction_count: 0 };
    }
    const nearby = [];
    for (const { e, ll } of construction) {
      const d = distanceKm(lat, lon, ll[0], ll[1]);
      if (d <= radius) {
        nearby.push({
          event_id: e.id,
          state: e.state,
          description: e.description || e.location || 'Construction activity',
          distance_km: Math.round(d * 10) / 10
        });
      }
    }
    nearby.sort((a, b) => a.distance_km - b.distance_km);
    return {
      ...bridge,
      construction_nearby: nearby.length > 0,
      nearby_construction: nearby.slice(0, 5),
      nearby_construction_count: nearby.length
    };
  });
};

// Create custom bridge icon. When `flagged` (active construction within the
// watch radius), add an orange ring + 🚧 badge so the bridge stands out as
// "clearance may be outdated".
const createBridgeIcon = (clearanceFeet, flagged = false) => {
  const getClearanceColor = (feet) => {
    if (feet < 13.67) return '#dc2626'; // Critical (under 13'8")
    if (feet < 14.0) return '#f59e0b';   // Warning (under 14'0")
    if (feet < 14.5) return '#FF8F35';   // Caution (under 14'6")
    return '#10b981';                     // Safe
  };

  const color = getClearanceColor(clearanceFeet);
  const feet = Math.floor(clearanceFeet);
  const inches = Math.round((clearanceFeet - feet) * 12);

  const flagRing = flagged
    ? `<circle cx="16" cy="16" r="15" fill="none" stroke="#ea580c" stroke-width="2" stroke-dasharray="3 2"/>`
    : '';
  const flagBadge = flagged
    ? `<circle cx="26" cy="6" r="6" fill="#ea580c" stroke="white" stroke-width="1.5"/>
       <text x="26" y="9" text-anchor="middle" font-size="8" font-weight="bold" fill="white">!</text>`
    : '';

  const svg = `
    <svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
      ${flagRing}
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="12" text-anchor="middle" font-size="8" font-weight="bold" fill="white">${feet}'</text>
      <text x="16" y="20" text-anchor="middle" font-size="7" font-weight="bold" fill="white">${inches}"</text>
      <path d="M 8 24 L 12 20 L 20 20 L 24 24" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      ${flagBadge}
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: 'bridge-clearance-icon',
    iconSize: [34, 34],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

export default function BridgeClearanceLayer({ onBridgeClick, events = [] }) {
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(false);

  // Correlate bridges with live construction events on the client (recomputes
  // only when bridges or events change) — keeps the bridges API response static
  // and cacheable, and adds no server egress.
  const annotatedBridges = useMemo(
    () => annotateWithConstruction(bridges, events),
    [bridges, events]
  );

  useEffect(() => {
    loadBridges();
  }, []);

  const loadBridges = async () => {
    try {
      setLoading(true);
      // Default to the Railway API. If VITE_BRIDGES_URL is set at build time
      // (e.g. a Cloudflare Pages/R2 URL), fetch the static file from there
      // instead — zero Railway egress. axios ignores baseURL for absolute URLs.
      const url = import.meta.env.VITE_BRIDGES_URL || '/api/bridges/all';
      const response = await api.get(url);

      const data = response.data;
      const list = Array.isArray(data) ? data : (data.bridges || []);
      setBridges(list);
      console.log('🌉 Loaded', list.length, 'bridge clearances from', import.meta.env.VITE_BRIDGES_URL ? 'static host' : 'API');
    } catch (error) {
      console.error('Error loading bridge clearances:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatClearance = (clearanceFeet) => {
    const feet = Math.floor(clearanceFeet);
    const inches = Math.round((clearanceFeet - feet) * 12);
    return `${feet}' ${inches}"`;
  };

  const getClearanceStatus = (clearanceFeet) => {
    if (clearanceFeet < 13.67) return { label: 'CRITICAL', color: '#dc2626' };
    if (clearanceFeet < 14.0) return { label: 'WARNING', color: '#6b7280' };
    if (clearanceFeet < 14.5) return { label: 'CAUTION', color: '#FF8F35' };
    return { label: 'SAFE', color: '#10b981' };
  };

  if (loading) {
    return null;
  }

  return (
    <>
      {annotatedBridges.map((bridge) => {
        if (!bridge.latitude || !bridge.longitude) return null;

        const position = [bridge.latitude, bridge.longitude];
        const status = getClearanceStatus(bridge.clearance_feet);

        return (
          <Marker
            key={bridge.id}
            position={position}
            icon={createBridgeIcon(bridge.clearance_feet, bridge.construction_nearby)}
            eventHandlers={{
              click: () => {
                if (onBridgeClick) {
                  onBridgeClick(bridge);
                }
              }
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
              <div style={{ fontSize: '11px', fontWeight: '600' }}>
                {formatClearance(bridge.clearance_feet)} clearance
              </div>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: '250px', padding: '8px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <span style={{ fontSize: '24px' }}>🌉</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: '700',
                      fontSize: '14px',
                      color: '#111827',
                      marginBottom: '2px'
                    }}>
                      {bridge.bridge_name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      {bridge.route}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      marginBottom: '2px',
                      fontWeight: '500'
                    }}>
                      Clearance Height
                    </div>
                    <div style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: status.color
                    }}>
                      {formatClearance(bridge.clearance_feet)}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: '#9ca3af'
                    }}>
                      ({bridge.clearance_meters.toFixed(2)} m)
                    </div>
                  </div>

                  <div style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    backgroundColor: `${status.color}15`,
                    border: `1.5px solid ${status.color}`,
                    fontSize: '11px',
                    fontWeight: '700',
                    color: status.color
                  }}>
                    {status.label}
                  </div>
                </div>

                {bridge.direction && bridge.direction !== 'Both' && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      marginBottom: '4px',
                      fontWeight: '500'
                    }}>
                      Direction
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: '#374151',
                      fontWeight: '600'
                    }}>
                      {bridge.direction}
                    </div>
                  </div>
                )}

                {bridge.warning_message && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px',
                    backgroundColor: '#6b7280',
                    borderLeft: '3px solid #f59e0b',
                    borderRadius: '4px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    color: '#92400e'
                  }}>
                    {bridge.warning_message}
                  </div>
                )}

                {bridge.construction_nearby && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px',
                    backgroundColor: '#fff7ed',
                    border: '1.5px solid #ea580c',
                    borderRadius: '6px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    color: '#9a3412'
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                      🚧 Construction nearby — clearance may be outdated
                    </div>
                    <div style={{ fontSize: '11px', color: '#7c2d12' }}>
                      {bridge.nearby_construction_count} active work zone{bridge.nearby_construction_count === 1 ? '' : 's'} within {bridge.watch_radius_km} km. Verify clearance before routing oversize/tall loads.
                    </div>
                    {bridge.nearby_construction?.[0] && (
                      <div style={{ fontSize: '11px', marginTop: '6px', color: '#7c2d12' }}>
                        Nearest: {bridge.nearby_construction[0].description}
                        {' '}({bridge.nearby_construction[0].distance_km} km
                        {bridge.nearby_construction[0].state ? `, ${bridge.nearby_construction[0].state}` : ''})
                      </div>
                    )}
                  </div>
                )}

                <div style={{
                  marginTop: '12px',
                  paddingTop: '8px',
                  borderTop: '1px solid #e5e7eb',
                  fontSize: '10px',
                  color: '#9ca3af',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>Watch Radius: {bridge.watch_radius_km} km</span>
                  {bridge.last_verified && (
                    <span style={{ color: bridge.construction_nearby ? '#ea580c' : '#9ca3af', fontWeight: bridge.construction_nearby ? 600 : 400 }}>
                      Clearance date: {new Date(bridge.last_verified).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
