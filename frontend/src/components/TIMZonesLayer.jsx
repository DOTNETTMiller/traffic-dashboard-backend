import { useEffect, useState } from 'react';
import { Polyline, Polygon, Popup, Tooltip } from 'react-leaflet';
import api from '../services/api';

// Message format styles
const formatStyles = {
  tim: {
    color: '#3b82f6',      // blue
    weight: 4,
    opacity: 0.7,
    dashArray: null,
    label: 'SAE J2735 TIM',
    icon: '📡',
    description: 'Traveler Information Message for general public'
  },
  cvtim: {
    color: '#8b5cf6',      // purple
    weight: 4,
    opacity: 0.7,
    dashArray: '10, 5',    // dashed
    label: 'SAE J2540 CV-TIM',
    icon: '🚛',
    description: 'Commercial Vehicle TIM for trucks/fleet'
  },
  cifs: {
    color: '#10b981',      // green
    weight: 5,
    opacity: 0.6,
    dashArray: '15, 10, 5, 10',  // dash-dot pattern
    label: 'CIFS',
    icon: '🚨',
    description: 'Common Incident Feed Specification'
  }
};

// Severity-based color overrides
const severityColors = {
  high: '#ef4444',    // red
  major: '#ef4444',
  medium: '#f59e0b',  // orange
  moderate: '#f59e0b',
  low: '#10b981',     // green
  minor: '#10b981'
};

export default function TIMZonesLayer({
  visible = false,
  formatType = 'all', // 'all', 'tim', 'cvtim', 'cifs'
  stateFilter = null,
  showLabels = true
}) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchZones();
    }
  }, [visible, stateFilter]);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const params = {};
      if (stateFilter) params.state = stateFilter;

      // Fetch events with geometry
      const response = await api.get('/api/events', { params });

      if (response.data.success && Array.isArray(response.data.events)) {
        // Filter events that have LineString or Polygon geometry
        const geometricEvents = response.data.events.filter(event =>
          event.geometry &&
          (event.geometry.type === 'LineString' ||
           event.geometry.type === 'MultiLineString' ||
           event.geometry.type === 'Polygon')
        );

        // Assign format types based on event characteristics
        const annotatedZones = geometricEvents.map(event => ({
          ...event,
          messageFormat: determineMessageFormat(event)
        }));

        setZones(annotatedZones);
        console.log(`📡 Loaded ${annotatedZones.length} TIM/CV-TIM/CIFS zones`);
      }
    } catch (error) {
      console.error('Error fetching TIM zones:', error);
    } finally {
      setLoading(false);
    }
  };

  // Determine which message format this event would use
  const determineMessageFormat = (event) => {
    const desc = (event.description || '').toLowerCase();
    const type = (event.eventType || '').toLowerCase();

    // CV-TIM: Commercial vehicle specific (weight limits, truck restrictions)
    if (desc.includes('truck') || desc.includes('commercial vehicle') ||
        desc.includes('weight') || desc.includes('hazmat') ||
        desc.includes('oversize') || desc.includes('permit')) {
      return 'cvtim';
    }

    // CIFS: Active incidents and emergencies
    if (type.includes('incident') || type.includes('accident') ||
        type.includes('emergency') || type.includes('crash') ||
        desc.includes('lane blocked') || desc.includes('disabled vehicle')) {
      return 'cifs';
    }

    // TIM: General work zones, closures, advisories (default)
    return 'tim';
  };

  // Convert GeoJSON geometry to Leaflet coordinates
  const geometryToLeafletCoords = (geometry) => {
    if (!geometry || !geometry.coordinates) return null;

    if (geometry.type === 'LineString') {
      return geometry.coordinates.map(coord => [coord[1], coord[0]]);
    } else if (geometry.type === 'MultiLineString') {
      // For MultiLineString, use the first line
      return geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
    } else if (geometry.type === 'Polygon') {
      // For Polygon, use the outer ring
      return geometry.coordinates[0].map(coord => [coord[1], coord[0]]);
    }

    return null;
  };

  if (!visible || loading) return null;

  // Filter by format type if specified
  const filteredZones = formatType === 'all'
    ? zones
    : zones.filter(z => z.messageFormat === formatType);

  return (
    <>
      {filteredZones.map(zone => {
        const coords = geometryToLeafletCoords(zone.geometry);
        if (!coords || coords.length < 2) return null;

        const format = formatStyles[zone.messageFormat] || formatStyles.tim;
        const severityKey = (zone.severity || 'medium').toLowerCase();

        // Override color based on severity for high-priority events
        let lineColor = format.color;
        if (severityColors[severityKey] && (severityKey === 'high' || severityKey === 'major')) {
          lineColor = severityColors[severityKey];
        }

        const Component = zone.geometry.type === 'Polygon' ? Polygon : Polyline;

        return (
          <Component
            key={`${zone.messageFormat}-${zone.id}`}
            positions={coords}
            pathOptions={{
              color: lineColor,
              weight: format.weight,
              opacity: format.opacity,
              dashArray: format.dashArray,
              fillOpacity: zone.geometry.type === 'Polygon' ? 0.1 : undefined
            }}
          >
            {showLabels && (
              <Tooltip direction="center" permanent={false} sticky>
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                  {format.icon} {format.label}
                </span>
              </Tooltip>
            )}

            <Popup maxWidth={450}>
              <div style={{ padding: '8px' }}>
                {/* Format Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <span style={{ fontSize: '24px' }}>{format.icon}</span>
                  <div>
                    <div style={{
                      fontWeight: 'bold',
                      fontSize: '14px',
                      color: format.color
                    }}>
                      {format.label}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>
                      {format.description}
                    </div>
                  </div>
                </div>

                {/* Event Details */}
                <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                  <div style={{
                    fontWeight: 'bold',
                    marginBottom: '6px',
                    color: severityColors[severityKey] || '#374151'
                  }}>
                    {zone.eventType || 'Event'} - {zone.corridor}
                  </div>

                  <div style={{ marginBottom: '8px', color: '#374151' }}>
                    {zone.description}
                  </div>

                  <div style={{
                    fontSize: '10px',
                    color: '#6b7280',
                    marginBottom: '6px'
                  }}>
                    📍 {zone.location}
                  </div>

                  {/* Formatted Message Preview */}
                  <div style={{
                    marginTop: '12px',
                    padding: '8px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '4px',
                    borderLeft: `3px solid ${format.color}`
                  }}>
                    <div style={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      color: '#6b7280',
                      marginBottom: '4px'
                    }}>
                      Formatted Message:
                    </div>
                    <div style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#374151'
                    }}>
                      {generateMessagePreview(zone, zone.messageFormat)}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '10px',
                    color: '#6b7280'
                  }}>
                    <div>State: {zone.state}</div>
                    <div>Severity: <span style={{
                      padding: '1px 4px',
                      borderRadius: '2px',
                      backgroundColor: severityColors[severityKey] || '#9ca3af',
                      color: 'white',
                      fontWeight: 'bold'
                    }}>{zone.severity}</span></div>
                    {zone.startTime && <div>Start: {new Date(zone.startTime).toLocaleString()}</div>}
                  </div>
                </div>
              </div>
            </Popup>
          </Component>
        );
      })}
    </>
  );
}

// Generate a preview of how this event would look in the formatted message
function generateMessagePreview(event, format) {
  const corridor = event.corridor || 'Route';
  const direction = event.direction || 'Both directions';
  const desc = event.description || 'Work zone';

  if (format === 'tim') {
    // SAE J2735 TIM format preview
    return `TIM ${event.id}: ${corridor} ${direction} - ${desc}`;
  } else if (format === 'cvtim') {
    // CV-TIM format preview
    return `CV-TIM: ${corridor} ${direction} - ${desc} [Commercial Vehicle Advisory]`;
  } else if (format === 'cifs') {
    // CIFS format preview
    return `CIFS INCIDENT: ${corridor} ${direction} - ${desc}`;
  }

  return desc;
}
