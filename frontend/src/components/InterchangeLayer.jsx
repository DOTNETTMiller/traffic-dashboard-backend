import { useState, useEffect } from 'react';
import { Marker, Popup, Tooltip, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';
import { theme } from '../styles/theme';

// Custom interchange icon - looks like a control tower / coordination point
const createInterchangeIcon = () => {
  const iconSvg = `
    <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <!-- Diamond shape for interchange -->
      <g transform="translate(14,14) rotate(45)">
        <rect x="-10" y="-10" width="20" height="20" fill="#3b82f6" stroke="white" stroke-width="2.5" rx="2"/>
      </g>
      <!-- Crosshair in center -->
      <circle cx="14" cy="14" r="3" fill="white"/>
      <line x1="14" y1="7" x2="14" y2="21" stroke="white" stroke-width="1.5"/>
      <line x1="7" y1="14" x2="21" y2="14" stroke="white" stroke-width="1.5"/>
    </svg>
  `;

  return L.divIcon({
    html: iconSvg,
    className: 'interchange-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14]
  });
};

export default function InterchangeLayer({ showInterchanges = false }) {
  const [interchanges, setInterchanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!showInterchanges) {
      return;
    }

    const fetchInterchanges = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get('/api/interchanges');

        if (response.data && response.data.success) {
          setInterchanges(response.data.interchanges);
        } else {
          setError('Failed to load interchanges');
        }
      } catch (err) {
        console.error('Error fetching interchanges:', err);
        setError(err.message);
        setInterchanges([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInterchanges();
  }, [showInterchanges]);

  if (!showInterchanges) {
    return null;
  }

  if (loading && interchanges.length === 0) {
    return null;
  }

  return (
    <>
      {interchanges.map((interchange) => {
        const lat = parseFloat(interchange.latitude);
        const lon = parseFloat(interchange.longitude);

        // Skip invalid coordinates
        if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
          return null;
        }

        const icon = createInterchangeIcon();

        // Parse notify states (notifyStates field from API)
        const affectedStates = interchange.notifyStates
          ? interchange.notifyStates.split(',').map(s => s.trim().toUpperCase())
          : [];

        return (
          <Marker
            key={interchange.id}
            position={[lat, lon]}
            icon={icon}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={0.95} permanent={true}>
              <div style={{ fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                {interchange.name}
              </div>
            </Tooltip>
            <Popup maxWidth={350}>
              <div style={{ padding: '8px' }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingBottom: '8px',
                  borderBottom: `2px solid ${theme.colors.accentBlue}`
                }}>
                  🎯 {interchange.name}
                </h3>

                <div style={{
                  marginBottom: '12px',
                  padding: '10px',
                  background: `${theme.colors.accentBlue}10`,
                  borderRadius: '8px',
                  borderLeft: `3px solid ${theme.colors.accentBlue}`
                }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', marginBottom: '4px' }}>
                    INTERSTATE COORDINATION POINT
                  </div>
                  <div style={{ fontSize: '13px', color: '#374151' }}>
                    This is a critical junction for cross-state coordination and detour planning.
                  </div>
                </div>

                {affectedStates.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                      📍 Affected States:
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {affectedStates.map((state) => (
                        <span
                          key={state}
                          style={{
                            padding: '4px 10px',
                            background: `${theme.colors.accentPurple}15`,
                            color: theme.colors.accentPurple,
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            border: `1px solid ${theme.colors.accentPurple}60`
                          }}
                        >
                          {state}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
                    📏 Watch Radius:
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    {interchange.watchRadiusKm || 15} km
                  </div>
                </div>

                {interchange.detourMessage && (
                  <div style={{
                    marginBottom: '12px',
                    padding: '10px',
                    background: '#fef3c7',
                    borderRadius: '8px',
                    borderLeft: '3px solid #f59e0b'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#92400e', marginBottom: '4px' }}>
                      ⚠️ COORDINATION MESSAGE:
                    </div>
                    <div style={{ fontSize: '12px', color: '#78350f', lineHeight: '1.5' }}>
                      {interchange.detourMessage}
                    </div>
                  </div>
                )}

                <div style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '6px' }}>
                    <strong>Primary Corridor:</strong> {interchange.corridor || 'N/A'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    <strong>Managed by:</strong> {interchange.stateKey?.toUpperCase() || 'N/A'} DOT
                  </div>
                </div>

                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  background: '#f3f4f6',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#6b7280',
                  lineHeight: '1.6'
                }}>
                  💡 <strong>Tip:</strong> Use this coordination point for cross-state messaging and detour planning when events occur within the watch radius.
                </div>
              </div>
            </Popup>

            {/* Watch radius circle */}
            <CircleMarker
              center={[lat, lon]}
              radius={0}
              pathOptions={{
                fillColor: '#3b82f6',
                fillOpacity: 0,
                color: '#3b82f6',
                weight: 0,
                opacity: 0
              }}
            />
          </Marker>
        );
      })}
    </>
  );
}
