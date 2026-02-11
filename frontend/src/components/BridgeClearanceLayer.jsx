import { useEffect, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

// Create custom bridge icon
const createBridgeIcon = (clearanceFeet) => {
  const getClearanceColor = (feet) => {
    if (feet < 13.67) return '#dc2626'; // Critical (under 13'8")
    if (feet < 14.0) return '#f59e0b';   // Warning (under 14'0")
    if (feet < 14.5) return '#3b82f6';   // Caution (under 14'6")
    return '#10b981';                     // Safe
  };

  const color = getClearanceColor(clearanceFeet);
  const feet = Math.floor(clearanceFeet);
  const inches = Math.round((clearanceFeet - feet) * 12);

  const svg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="16" y="12" text-anchor="middle" font-size="8" font-weight="bold" fill="white">${feet}'</text>
      <text x="16" y="20" text-anchor="middle" font-size="7" font-weight="bold" fill="white">${inches}"</text>
      <path d="M 8 24 L 12 20 L 20 20 L 24 24" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: 'bridge-clearance-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

export default function BridgeClearanceLayer({ onBridgeClick }) {
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBridges();
  }, []);

  const loadBridges = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/bridges/all');

      if (response.data.success) {
        setBridges(response.data.bridges || []);
        console.log('🌉 Loaded', response.data.bridges?.length || 0, 'bridge clearances');
      }
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
    if (clearanceFeet < 14.5) return { label: 'CAUTION', color: '#3b82f6' };
    return { label: 'SAFE', color: '#10b981' };
  };

  if (loading) {
    return null;
  }

  return (
    <>
      {bridges.map((bridge) => {
        if (!bridge.latitude || !bridge.longitude) return null;

        const position = [bridge.latitude, bridge.longitude];
        const status = getClearanceStatus(bridge.clearance_feet);

        return (
          <Marker
            key={bridge.id}
            position={position}
            icon={createBridgeIcon(bridge.clearance_feet)}
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
                    backgroundcolor: '#6b7280',
                    borderLeft: '3px solid #f59e0b',
                    borderRadius: '4px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    color: '#92400e'
                  }}>
                    {bridge.warning_message}
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
                    <span>Verified: {new Date(bridge.last_verified).toLocaleDateString()}</span>
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
