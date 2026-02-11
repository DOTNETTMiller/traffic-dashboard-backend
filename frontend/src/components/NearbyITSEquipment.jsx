import { useEffect, useState } from 'react';
import api from '../services/api';

// Component to show nearby ITS equipment for an event with actionable recommendations
export default function NearbyITSEquipment({ event }) {
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (event && event.latitude && event.longitude) {
      fetchNearbyEquipment();
    }
  }, [event]);

  const fetchNearbyEquipment = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/its-equipment/nearby', {
        params: {
          latitude: event.latitude,
          longitude: event.longitude,
          radius: 5, // 5 mile radius
          stateKey: event.stateKey || event.state
        }
      });

      if (response.data.success) {
        setEquipment(response.data);
      }
    } catch (error) {
      console.error('Error fetching nearby ITS equipment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        margin: '8px 0',
        padding: '8px',
        backgroundcolor: '#6b7280',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        🔄 Finding nearby ITS equipment...
      </div>
    );
  }

  if (!equipment || equipment.total === 0) {
    return null;
  }

  const { byType, grouped, total } = equipment;

  return (
    <div style={{
      margin: '12px 0',
      padding: '10px',
      backgroundcolor: '#6b7280',
      borderRadius: '6px',
      border: '1px solid #86efac'
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: expanded ? '10px' : '0'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🎯</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#166534' }}>
              {total} ITS Asset{total !== 1 ? 's' : ''} Nearby
            </div>
            <div style={{ fontSize: '10px', color: '#16a34a' }}>
              Within 5 miles • Click for recommendations
            </div>
          </div>
        </div>
        <span style={{ fontSize: '16px', color: '#16a34a' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: '8px' }}>
          {/* Quick summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '6px',
            marginBottom: '12px'
          }}>
            {byType.cameras > 0 && (
              <div style={{
                padding: '6px',
                backgroundColor: '#dbeafe',
                borderRadius: '4px',
                fontSize: '11px',
                textAlign: 'center'
              }}>
                📹 {byType.cameras} Camera{byType.cameras !== 1 ? 's' : ''}
              </div>
            )}
            {byType.dms > 0 && (
              <div style={{
                padding: '6px',
                backgroundcolor: '#6b7280',
                borderRadius: '4px',
                fontSize: '11px',
                textAlign: 'center'
              }}>
                🚏 {byType.dms} DMS Sign{byType.dms !== 1 ? 's' : ''}
              </div>
            )}
            {byType.sensors > 0 && (
              <div style={{
                padding: '6px',
                backgroundColor: '#d1fae5',
                borderRadius: '4px',
                fontSize: '11px',
                textAlign: 'center'
              }}>
                🌡️ {byType.sensors} Sensor{byType.sensors !== 1 ? 's' : ''}
              </div>
            )}
            {byType.rsu > 0 && (
              <div style={{
                padding: '6px',
                backgroundColor: '#e9d5ff',
                borderRadius: '4px',
                fontSize: '11px',
                textAlign: 'center'
              }}>
                📡 {byType.rsu} RSU{byType.rsu !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div style={{
            padding: '10px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #d1fae5'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#166534',
              marginBottom: '8px'
            }}>
              💡 Recommended Actions
            </div>

            {/* Camera recommendations */}
            {grouped.cameras.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#3b82f6', marginBottom: '4px' }}>
                  📹 View Cameras ({grouped.cameras.length})
                </div>
                {grouped.cameras.slice(0, 3).map((cam, idx) => (
                  <div key={cam.id} style={{
                    fontSize: '10px',
                    padding: '4px 6px',
                    backgroundcolor: '#6b7280',
                    borderRadius: '3px',
                    marginBottom: '3px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>{cam.route || 'Camera'}</span>
                      {cam.milepost && <span style={{ color: '#6b7280' }}> MP {cam.milepost}</span>}
                      <span style={{ color: '#9ca3af', marginLeft: '4px' }}>
                        ({cam.distance_miles?.toFixed(1)} mi)
                      </span>
                    </div>
                    {cam.stream_url && (
                      <a
                        href={cam.stream_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '9px',
                          padding: '2px 6px',
                          backgroundColor: '#3b82f6',
                          color: '#111827',
                          borderRadius: '3px',
                          textDecoration: 'none'
                        }}
                      >
                        View
                      </a>
                    )}
                  </div>
                ))}
                {grouped.cameras.length > 3 && (
                  <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
                    +{grouped.cameras.length - 3} more cameras nearby
                  </div>
                )}
              </div>
            )}

            {/* DMS recommendations */}
            {grouped.dms.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>
                  🚏 Activate Message Boards ({grouped.dms.length})
                </div>
                {grouped.dms.slice(0, 3).map((dms, idx) => (
                  <div key={dms.id} style={{
                    fontSize: '10px',
                    padding: '4px 6px',
                    backgroundcolor: '#6b7280',
                    borderRadius: '3px',
                    marginBottom: '3px'
                  }}>
                    <span style={{ fontWeight: '600' }}>{dms.route || 'DMS'}</span>
                    {dms.milepost && <span style={{ color: '#6b7280' }}> MP {dms.milepost}</span>}
                    <span style={{ color: '#9ca3af', marginLeft: '4px' }}>
                      ({dms.distance_miles?.toFixed(1)} mi)
                    </span>
                    {dms.location_description && (
                      <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
                        {dms.location_description}
                      </div>
                    )}
                  </div>
                ))}
                {grouped.dms.length > 3 && (
                  <div style={{ fontSize: '9px', color: '#6b7280', marginTop: '2px' }}>
                    +{grouped.dms.length - 3} more signs nearby
                  </div>
                )}
              </div>
            )}

            {/* Sensor data */}
            {grouped.sensors.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#10b981', marginBottom: '4px' }}>
                  🌡️ Check Sensors ({grouped.sensors.length})
                </div>
                <div style={{
                  fontSize: '9px',
                  padding: '4px 6px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '3px',
                  color: '#6b7280'
                }}>
                  {grouped.sensors.filter(s => s.sensor_type === 'rwis').length} weather sensors,
                  {' '}{grouped.sensors.filter(s => s.sensor_type === 'traffic').length} traffic sensors available
                </div>
              </div>
            )}

            {/* RSU/V2X */}
            {grouped.rsu.length > 0 && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#8b5cf6', marginBottom: '4px' }}>
                  📡 V2X Communication ({grouped.rsu.length} RSU{grouped.rsu.length !== 1 ? 's' : ''})
                </div>
                <div style={{
                  fontSize: '9px',
                  padding: '4px 6px',
                  backgroundcolor: '#6b7280',
                  borderRadius: '3px',
                  color: '#6b7280'
                }}>
                  Connected vehicle messaging available in this area
                </div>
              </div>
            )}
          </div>

          {/* Show ITS layer button */}
          <button
            onClick={() => {
              // This will need to be passed as a prop from parent
              if (window.showITSLayer) {
                window.showITSLayer(true);
              }
            }}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '6px',
              backgroundColor: '#166534',
              color: '#111827',
              border: 'none',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            📍 Show All ITS Equipment on Map
          </button>
        </div>
      )}
    </div>
  );
}
