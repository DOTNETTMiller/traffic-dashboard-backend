import { useEffect, useState } from 'react';
import { Polyline, Popup, CircleMarker } from 'react-leaflet';
import api from '../services/api';

// Connection type styles
const connectionStyles = {
  fiber: {
    color: '#3b82f6',      // blue
    label: 'Fiber Optic',
    icon: '🔵'
  },
  radio: {
    color: '#8b5cf6',      // purple
    label: 'Radio Link',
    icon: '📡'
  },
  microwave: {
    color: '#ec4899',      // pink
    label: 'Microwave',
    icon: '📶'
  },
  cellular: {
    color: '#10b981',      // green
    label: 'Cellular/5G',
    icon: '📱'
  },
  ethernet: {
    color: '#6b7280',      // orange
    label: 'Ethernet',
    icon: '🔌'
  }
};

// Parse WKT LineString or MultiLineString to Leaflet coordinates
function parseWKTLineString(wkt) {
  if (!wkt) return [];

  try {
    // Handle both LINESTRING and MULTILINESTRING formats
    let coordString;

    // Try MULTILINESTRING first (format: MULTILINESTRING((lon lat, lon lat)))
    const multiMatch = wkt.match(/MULTILINESTRING\(\((.*?)\)\)/);
    if (multiMatch) {
      coordString = multiMatch[1];
    } else {
      // Try LINESTRING (format: LINESTRING(lon lat, lon lat))
      const lineMatch = wkt.match(/LINESTRING\((.*)\)/);
      if (lineMatch) {
        coordString = lineMatch[1];
      } else {
        return [];
      }
    }

    return coordString.split(',').map(point => {
      const [lon, lat] = point.trim().split(' ').map(Number);
      return [lat, lon]; // Leaflet uses [lat, lon]
    });
  } catch (error) {
    console.error('Error parsing WKT:', error);
    return [];
  }
}

export default function NetworkTopologyLayer({ visible = true, stateKey = null, connectionType = null }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      fetchConnections();
    }
  }, [visible, stateKey, connectionType]);

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const params = {};
      if (stateKey) params.stateKey = stateKey;

      const response = await api.get('/api/network/topology', { params });

      if (response.data.success && Array.isArray(response.data.connections)) {
        let filtered = response.data.connections;

        // Filter by connection type if specified
        if (connectionType) {
          filtered = filtered.filter(c => c.connection_type === connectionType);
        }

        setConnections(filtered);
        console.log(`🌐 Loaded ${filtered.length} network connections${connectionType ? ` (${connectionType})` : ''}`);
      }
    } catch (error) {
      console.error('Error fetching network topology:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!visible || loading) return null;

  return (
    <>
      {connections.map(conn => {
        // Parse geometry
        const coords = parseWKTLineString(conn.geometry);
        if (coords.length < 2) return null;

        // Get style for connection type
        const style = connectionStyles[conn.connection_type] || connectionStyles.fiber;

        // Determine opacity and dash pattern based on status
        let opacity = 0.7;
        let dashArray = null;
        let weight = conn.is_physical ? 3 : 2;

        if (conn.operational_status === 'down') {
          opacity = 0.3;
          dashArray = '10, 10'; // Dashed for down
        } else if (conn.operational_status === 'degraded') {
          dashArray = '5, 5'; // Short dashes for degraded
        } else if (conn.operational_status === 'maintenance') {
          opacity = 0.5;
          dashArray = '15, 5'; // Long dashes for maintenance
        }

        // Health status color override
        let lineColor = style.color;
        if (conn.health_status === 'critical') {
          lineColor = '#ef4444'; // red
        } else if (conn.health_status === 'warning') {
          lineColor = '#f59e0b'; // orange
        }

        return (
          <Polyline
            key={conn.id}
            positions={coords}
            pathOptions={{
              color: lineColor,
              weight: weight,
              opacity: opacity,
              dashArray: dashArray
            }}
          >
            <Popup maxWidth={350}>
              <div style={{ padding: '8px' }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <span style={{ fontSize: '20px' }}>{style.icon}</span>
                  <div>
                    <div style={{
                      fontWeight: 'bold',
                      fontSize: '13px',
                      color: style.color
                    }}>
                      {style.label}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>
                      {conn.connection_id}
                    </div>
                  </div>
                </div>

                {/* Connection Details */}
                <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '8px' }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>From:</span>
                      <div style={{ fontWeight: '500', fontSize: '10px' }}>
                        {conn.from_device_type} @ {conn.from_location || 'Unknown'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#6b7280' }}>To:</span>
                      <div style={{ fontWeight: '500', fontSize: '10px' }}>
                        {conn.to_device_type} @ {conn.to_location || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '8px' }}>
                    <div>
                      <span style={{ color: '#6b7280' }}>Distance:</span>
                      <span style={{ fontWeight: '500', marginLeft: '4px' }}>
                        {conn.distance_meters ? `${Math.round(conn.distance_meters)}m` : 'N/A'}
                      </span>
                    </div>
                    {conn.bandwidth_mbps && (
                      <div>
                        <span style={{ color: '#6b7280' }}>Bandwidth:</span>
                        <span style={{ fontWeight: '500', marginLeft: '4px' }}>
                          {conn.bandwidth_mbps} Mbps
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: '#6b7280' }}>Status:</span>
                        <span style={{
                          marginLeft: '6px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '600',
                          backgroundColor: conn.operational_status === 'active' ? '#d1fae5' :
                                         conn.operational_status === 'down' ? '#fee2e2' :
                                         conn.operational_status === 'degraded' ? '#fed7aa' : '#e5e7eb',
                          color: conn.operational_status === 'active' ? '#065f46' :
                                conn.operational_status === 'down' ? '#991b1b' :
                                conn.operational_status === 'degraded' ? '#9a3412' : '#374151'
                        }}>
                          {conn.operational_status}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Health:</span>
                        <span style={{
                          marginLeft: '6px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '600',
                          backgroundColor: conn.health_status === 'healthy' ? '#d1fae5' :
                                         conn.health_status === 'critical' ? '#fee2e2' :
                                         conn.health_status === 'warning' ? '#fed7aa' : '#e5e7eb',
                          color: conn.health_status === 'healthy' ? '#065f46' :
                                conn.health_status === 'critical' ? '#991b1b' :
                                conn.health_status === 'warning' ? '#9a3412' : '#374151'
                        }}>
                          {conn.health_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fiber-specific details */}
                  {conn.connection_type === 'fiber' && (
                    <div style={{ marginTop: '6px', fontSize: '10px', color: '#6b7280' }}>
                      {conn.fiber_type && `Type: ${conn.fiber_type}`}
                      {conn.fiber_strand_count && ` • ${conn.fiber_strand_count} strands`}
                    </div>
                  )}

                  {/* Radio-specific details */}
                  {(conn.connection_type === 'radio' || conn.connection_type === 'microwave') && conn.frequency_mhz && (
                    <div style={{ marginTop: '6px', fontSize: '10px', color: '#6b7280' }}>
                      Frequency: {conn.frequency_mhz} MHz
                    </div>
                  )}

                  {/* Owner/Provider */}
                  {(conn.owner || conn.provider) && (
                    <div style={{ marginTop: '6px', fontSize: '10px', color: '#6b7280' }}>
                      {conn.owner && `Owner: ${conn.owner}`}
                      {conn.provider && ` • Provider: ${conn.provider}`}
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}

      {/* Draw endpoint markers for connections without geometry */}
      {connections.map(conn => {
        // Only draw markers if no geometry available
        if (conn.geometry) return null;
        if (!conn.from_lat || !conn.from_lon || !conn.to_lat || !conn.to_lon) return null;

        const style = connectionStyles[conn.connection_type] || connectionStyles.fiber;

        return (
          <Polyline
            key={`direct-${conn.id}`}
            positions={[
              [conn.from_lat, conn.from_lon],
              [conn.to_lat, conn.to_lon]
            ]}
            pathOptions={{
              color: style.color,
              weight: 2,
              opacity: 0.5,
              dashArray: '5, 10'
            }}
          >
            <Popup maxWidth={300}>
              <div style={{ padding: '8px', fontSize: '11px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{style.label}</div>
                <div style={{ color: '#6b7280', fontSize: '10px' }}>
                  {conn.connection_id}<br/>
                  From: {conn.from_device_type}<br/>
                  To: {conn.to_device_type}<br/>
                  Status: {conn.operational_status}
                </div>
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
}
