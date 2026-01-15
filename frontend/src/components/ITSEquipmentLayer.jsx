import { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import api from '../services/api';

// Equipment type icons and colors
const equipmentStyles = {
  camera: {
    icon: '📹',
    color: '#3b82f6', // blue
    label: 'Camera'
  },
  dms: {
    icon: '🚏',
    color: '#f59e0b', // orange
    label: 'DMS Sign'
  },
  rsu: {
    icon: '📡',
    color: '#8b5cf6', // purple
    label: 'RSU'
  },
  sensor: {
    icon: '🌡️',
    color: '#10b981', // green
    label: 'Sensor'
  }
};

// Health status colors
const healthColors = {
  excellent: '#10b981',  // green
  good: '#3b82f6',       // blue
  fair: '#f59e0b',       // orange
  poor: '#ef4444',       // red
  critical: '#dc2626',   // dark red
  offline: '#6b7280'     // gray
};

// Create custom marker icon with health indicator
const createEquipmentIcon = (type, healthCategory, isOnline) => {
  const style = equipmentStyles[type] || equipmentStyles.sensor;

  // Determine health indicator color
  const healthColor = isOnline === false ? healthColors.offline :
                     (healthColors[healthCategory] || '#9ca3af');

  return L.divIcon({
    html: `
      <div style="
        background: ${style.color};
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      ">
        <span style="
          transform: rotate(45deg);
          font-size: 16px;
        ">${style.icon}</span>
        ${healthCategory || isOnline !== undefined ? `
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${healthColor};
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          "></div>
        ` : ''}
      </div>
    `,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

export default function ITSEquipmentLayer({ visible = true, stateKey = null, equipmentType = null, route = null }) {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      fetchEquipment();
    }
  }, [visible, stateKey, equipmentType, route]);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const params = {};
      if (stateKey) params.stateKey = stateKey;

      // Try to fetch equipment with health data first, fall back to basic equipment
      let response;
      try {
        response = await api.get('/api/equipment/health', { params });
      } catch (healthError) {
        console.warn('Health data unavailable, falling back to basic equipment:', healthError);
        response = await api.get('/api/its-equipment', { params });
      }

      if (response.data.success && Array.isArray(response.data.equipment)) {
        let filtered = response.data.equipment;

        // Filter by equipment type if specified
        if (equipmentType) {
          filtered = filtered.filter(e => e.equipment_type === equipmentType);
        }

        // Filter by route if specified
        if (route) {
          filtered = filtered.filter(e => e.route === route);
        }

        setEquipment(filtered);
        console.log(`📡 Loaded ${filtered.length} ITS equipment items${route ? ` for route ${route}` : ''}`);
      }
    } catch (error) {
      console.error('Error fetching ITS equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!visible || loading) return null;

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={50}
      spiderfyOnMaxZoom={true}
      showCoverageOnHover={false}
      zoomToBoundsOnClick={true}
      iconCreateFunction={(cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            background-color: #8b5cf6;
            color: white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">${count}</div>`,
          className: 'its-equipment-cluster-icon',
          iconSize: L.point(40, 40, true),
        });
      }}
    >
      {Array.isArray(equipment) && equipment.map((item) => {
        if (!item.latitude || !item.longitude) return null;

        const style = equipmentStyles[item.equipment_type] || equipmentStyles.sensor;

        return (
          <Marker
            key={item.id}
            position={[item.latitude, item.longitude]}
            icon={createEquipmentIcon(item.equipment_type, item.health_category, item.is_online)}
          >
            <Popup maxWidth={400}>
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
                  <span style={{ fontSize: '24px' }}>{style.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 'bold',
                      fontSize: '14px',
                      color: style.color
                    }}>
                      {style.label}
                    </div>
                    {item.arc_its_id && (
                      <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>
                        {item.arc_its_id}
                      </div>
                    )}
                  </div>
                  {/* Health indicator badge */}
                  {(item.health_category || item.is_online !== undefined) && (
                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '600',
                      backgroundColor: item.is_online === false ? '#fee2e2' :
                                     item.health_category === 'excellent' ? '#d1fae5' :
                                     item.health_category === 'good' ? '#dbeafe' :
                                     item.health_category === 'fair' ? '#fed7aa' :
                                     item.health_category === 'poor' ? '#fecaca' :
                                     item.health_category === 'critical' ? '#fee2e2' : '#f3f4f6',
                      color: item.is_online === false ? '#991b1b' :
                            item.health_category === 'excellent' ? '#065f46' :
                            item.health_category === 'good' ? '#1e40af' :
                            item.health_category === 'fair' ? '#9a3412' :
                            item.health_category === 'poor' ? '#991b1b' :
                            item.health_category === 'critical' ? '#991b1b' : '#6b7280'
                    }}>
                      {item.is_online === false ? 'Offline' :
                       item.health_category ? item.health_category.charAt(0).toUpperCase() + item.health_category.slice(1) :
                       'Unknown'}
                    </div>
                  )}
                </div>

                {/* Health metrics (if available) */}
                {(item.health_score !== undefined || item.operational_status) && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '6px' }}>
                      Health Status
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                      {item.health_score !== undefined && (
                        <div>
                          <span style={{ color: '#6b7280' }}>Score:</span>
                          <span style={{ fontWeight: '600', marginLeft: '4px' }}>
                            {Math.round(item.health_score)}%
                          </span>
                        </div>
                      )}
                      {item.operational_status && (
                        <div>
                          <span style={{ color: '#6b7280' }}>Status:</span>
                          <span style={{ fontWeight: '600', marginLeft: '4px', textTransform: 'capitalize' }}>
                            {item.operational_status}
                          </span>
                        </div>
                      )}
                      {item.uptime_percent_24h !== undefined && (
                        <div>
                          <span style={{ color: '#6b7280' }}>Uptime (24h):</span>
                          <span style={{ fontWeight: '600', marginLeft: '4px' }}>
                            {Math.round(item.uptime_percent_24h)}%
                          </span>
                        </div>
                      )}
                      {item.data_quality_score !== undefined && (
                        <div>
                          <span style={{ color: '#6b7280' }}>Data Quality:</span>
                          <span style={{ fontWeight: '600', marginLeft: '4px' }}>
                            {Math.round(item.data_quality_score)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Location */}
                {item.location_description && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '2px' }}>
                      Location
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      {item.location_description}
                    </div>
                  </div>
                )}

                {item.route && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '2px' }}>
                      Route
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      {item.route} {item.milepost ? `MP ${item.milepost}` : ''}
                    </div>
                  </div>
                )}

                {/* Equipment Details */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px'
                }}>
                  {item.manufacturer && (
                    <div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>Manufacturer</div>
                      <div style={{ fontSize: '11px', fontWeight: '600' }}>{item.manufacturer}</div>
                    </div>
                  )}

                  {item.model && (
                    <div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>Model</div>
                      <div style={{ fontSize: '11px', fontWeight: '600' }}>{item.model}</div>
                    </div>
                  )}

                  {item.installation_date && (
                    <div>
                      <div style={{ fontSize: '10px', color: '#6b7280' }}>Installed</div>
                      <div style={{ fontSize: '11px', fontWeight: '600' }}>
                        {new Date(item.installation_date).toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>Status</div>
                    <div style={{ fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {item.status}
                    </div>
                  </div>
                </div>

                {/* RSU Specific */}
                {item.equipment_type === 'rsu' && (
                  <div style={{
                    marginTop: '12px',
                    padding: '8px',
                    backgroundColor: '#faf5ff',
                    borderRadius: '6px',
                    border: '1px solid #e9d5ff'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#7c3aed', marginBottom: '6px' }}>
                      V2X Capabilities
                    </div>

                    {item.communication_range && (
                      <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                        📶 Range: {item.communication_range}m
                      </div>
                    )}

                    {item.supported_protocols && (
                      <div style={{ fontSize: '11px' }}>
                        📡 Protocols: {JSON.parse(item.supported_protocols || '[]').join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Camera Specific */}
                {item.equipment_type === 'camera' && item.stream_url && (
                  <div style={{ marginTop: '12px' }}>
                    <a
                      href={item.stream_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        padding: '6px 12px',
                        backgroundColor: style.color,
                        color: 'white',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textDecoration: 'none'
                      }}
                    >
                      📹 View Stream
                    </a>
                  </div>
                )}

                {/* ARC-ITS Compliance */}
                {item.arc_its_category && (
                  <div style={{
                    marginTop: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>
                      ARC-ITS Classification
                    </div>
                    <div style={{ fontSize: '10px', color: '#374151' }}>
                      {item.arc_its_category}
                    </div>
                    {item.arc_its_interface && (
                      <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                        Interface: {item.arc_its_interface}
                      </div>
                    )}
                  </div>
                )}

                {/* Coordinates */}
                <div style={{
                  marginTop: '8px',
                  fontSize: '9px',
                  color: '#9ca3af',
                  fontFamily: 'monospace'
                }}>
                  {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}

// Legend component for ITS Equipment
export function ITSEquipmentLegend({ onToggle, visible }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      padding: '12px',
      zIndex: 1000,
      minWidth: '180px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: expanded ? '8px' : '0'
      }}>
        <div style={{
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onToggle(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>ITS Equipment</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0',
            color: '#6b7280'
          }}
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
          {Object.entries(equipmentStyles).map(([type, style]) => (
            <div
              key={type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '6px',
                fontSize: '11px'
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: style.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px'
              }}>
                {style.icon}
              </div>
              <span>{style.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
