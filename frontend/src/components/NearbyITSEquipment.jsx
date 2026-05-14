import { useEffect, useState } from 'react';
import api from '../services/api';

// Inline camera preview. Most state DOT cameras serve either JPEG snapshots or
// MJPEG streams that render in an <img>; some serve HLS (.m3u8) or auth-walled
// pages, which a plain <img> can't show. We try the <img> first, refresh it on
// a timer so JPEG snapshots stay live, and fall back to a "Open stream" link
// when the load fails (CORS, HLS, 403, mixed-content, etc.).
function CameraPreview({ streamUrl, label }) {
  const [failed, setFailed] = useState(false);
  const [bust, setBust] = useState(() => Date.now());

  useEffect(() => {
    if (failed) return;
    // Refresh every 10s — fine for JPEG snapshots, harmless for MJPEG (the
    // server keeps streaming; we just reconnect once).
    const id = setInterval(() => setBust(Date.now()), 10000);
    return () => clearInterval(id);
  }, [failed]);

  if (failed) {
    return (
      <a
        href={streamUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          width: '100%',
          padding: '14px 8px',
          marginTop: '4px',
          backgroundColor: '#111827',
          color: '#fbbf24',
          fontSize: '10px',
          textAlign: 'center',
          borderRadius: '4px',
          textDecoration: 'none',
          border: '1px dashed #374151'
        }}
        title={`Camera at ${label} couldn't embed — open in new tab`}
      >
        🔗 Open stream (can't embed inline)
      </a>
    );
  }

  // ?_t cache-busts the snapshot URL so the browser refetches instead of
  // reusing the cached frame. Some feeds ignore the param, which is fine —
  // they keep streaming.
  const sep = streamUrl.includes('?') ? '&' : '?';
  return (
    <a
      href={streamUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'block', marginTop: '4px' }}
      title={`Click to open ${label} full-size`}
    >
      <img
        src={`${streamUrl}${sep}_t=${bust}`}
        alt={`Live camera at ${label}`}
        onError={() => setFailed(true)}
        loading="lazy"
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          objectFit: 'cover',
          backgroundColor: '#111827',
          borderRadius: '4px',
          border: '1px solid #1f2937',
          display: 'block'
        }}
      />
    </a>
  );
}

// Component to show nearby ITS equipment for an event with actionable recommendations
export default function NearbyITSEquipment({ event }) {
  const [equipment, setEquipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Track which lookup we used so the header can say "along corridor" vs
  // "within 5 miles" honestly. Defaults to point-radius for events without
  // a usable geometry.
  const [mode, setMode] = useState('radius');

  useEffect(() => {
    if (event && (event.id || (event.latitude && event.longitude))) {
      fetchNearbyEquipment();
    }
  }, [event]);

  const fetchNearbyEquipment = async () => {
    try {
      setLoading(true);
      // Prefer the corridor-aware lookup whenever the event has any kind of
      // geometry — backend will resolve LineStrings from cache via event.id,
      // or accept a Point shape directly. Falls back to the flat radius
      // endpoint when neither is available.
      const hasGeometry = event.geometry && (event.geometry.coordinates || event.geometry.encodedPolyline || event.geometry.encodedPolylines);
      if (event.id || hasGeometry) {
        try {
          const body = {
            event_id: event.id,
            radius: 2,
            stateKey: event.stateKey || event.state,
            corridor: event.corridor
          };
          // Only send explicit geometry when it's already plain coords —
          // backend can decode the cached version when given event_id.
          if (event.geometry?.coordinates) body.geometry = event.geometry;
          else if (!event.id && event.latitude && event.longitude) {
            body.geometry = { type: 'Point', coordinates: [event.longitude, event.latitude] };
          }
          const response = await api.post('/api/its-equipment/along-corridor', body);
          if (response.data.success) {
            setEquipment(response.data);
            setMode('corridor');
            return;
          }
        } catch (corridorErr) {
          // Fall through to the radius endpoint — the corridor endpoint may
          // not be deployed on older backends, and we'd rather show something.
          console.warn('corridor lookup unavailable, falling back to radius:', corridorErr?.message);
        }
      }

      const response = await api.get('/api/its-equipment/nearby', {
        params: {
          latitude: event.latitude,
          longitude: event.longitude,
          radius: 5,
          stateKey: event.stateKey || event.state
        }
      });
      if (response.data.success) {
        setEquipment(response.data);
        setMode('radius');
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
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#374151'
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
      backgroundColor: '#6b7280',
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
              {mode === 'corridor'
                ? `Along corridor • within ${equipment.radius || 2} mi`
                : `Within ${equipment.radius || 5} miles`} • Click for recommendations
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
                backgroundColor: '#fef3c7',
                borderRadius: '4px',
                fontSize: '11px',
                textAlign: 'center',
                color: '#92400e'
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
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#FF8F35', marginBottom: '4px' }}>
                  📹 View Cameras ({grouped.cameras.length})
                </div>
                {grouped.cameras.slice(0, 3).map((cam, idx) => {
                  const label = `${cam.route || 'Camera'}${cam.milepost ? ` MP ${cam.milepost}` : ''}`;
                  return (
                    <div key={cam.id} style={{
                      fontSize: '10px',
                      padding: '6px',
                      backgroundColor: '#eff6ff',
                      borderRadius: '4px',
                      marginBottom: '6px',
                      color: '#C66A1F'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: '600' }}>{cam.route || 'Camera'}</span>
                          {cam.milepost && <span style={{ color: '#FF8F35' }}> MP {cam.milepost}</span>}
                          <span style={{ color: '#6b7280', marginLeft: '4px' }}>
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
                              backgroundColor: '#FF8F35',
                              color: 'white',
                              borderRadius: '3px',
                              textDecoration: 'none'
                            }}
                          >
                            Open
                          </a>
                        )}
                      </div>
                      {cam.stream_url && (
                        <CameraPreview streamUrl={cam.stream_url} label={label} />
                      )}
                    </div>
                  );
                })}
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
                    backgroundColor: '#fef3c7',
                    borderRadius: '3px',
                    marginBottom: '3px',
                    color: '#92400e'
                  }}>
                    <span style={{ fontWeight: '600' }}>{dms.route || 'DMS'}</span>
                    {dms.milepost && <span style={{ color: '#d97706' }}> MP {dms.milepost}</span>}
                    <span style={{ color: '#78716c', marginLeft: '4px' }}>
                      ({dms.distance_miles?.toFixed(1)} mi)
                    </span>
                    {dms.location_description && (
                      <div style={{ fontSize: '9px', color: '#a16207', marginTop: '2px' }}>
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
                  backgroundColor: '#d1fae5',
                  borderRadius: '3px',
                  color: '#065f46'
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
                  backgroundColor: '#e9d5ff',
                  borderRadius: '3px',
                  color: '#6b21a8'
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
