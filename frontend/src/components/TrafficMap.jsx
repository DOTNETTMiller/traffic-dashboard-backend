import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons based on severity and event type
const getMarkerIcon = (severity, eventType, hasMessages) => {
  const colors = {
    high: '#ef4444',    // red
    medium: '#f59e0b',  // orange
    low: '#10b981'      // green
  };

  const color = colors[severity] || colors.medium;

  // Different shapes for different event types
  const shapes = {
    'Construction': 'polygon(50% 0%, 100% 100%, 0% 100%)', // Triangle (warning sign)
    'Incident': 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)', // Octagon (stop sign)
    'Closure': 'polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)', // Rounded square
    'Weather': 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', // Star
    'Unknown': '50%' // Circle (default)
  };

  const shape = shapes[eventType] || shapes['Unknown'];

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        clip-path: ${shape};
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        position: relative;
      ">
        ${hasMessages ? `
          <div style="
            position: absolute;
            top: -8px;
            right: -8px;
            background-color: #1e40af;
            color: white;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
            clip-path: none;
          ">!</div>
        ` : ''}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

export default function TrafficMap({ events, messages = {}, onEventSelect }) {
  // Filter out events without valid coordinates
  const validEvents = events.filter(e => {
    const lat = parseFloat(e.latitude);
    const lng = parseFloat(e.longitude);
    return (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat !== 0 &&
      lng !== 0 &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  });

  console.log(`📍 Map: ${validEvents.length} valid events out of ${events.length} total`);

  // Center on mainland United States
  const defaultCenter = [39.8283, -98.5795];
  const defaultZoom = 5;

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        minZoom={4}
        maxBounds={[
          [24.396308, -125.0],  // Southwest corner (southern CA/TX)
          [49.384358, -66.93457] // Northeast corner (northern ME/WA)
        ]}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {validEvents.map((event) => {
          const hasMessages = messages[event.id] && messages[event.id].length > 0;
          const messageCount = hasMessages ? messages[event.id].length : 0;

          return (
            <Marker
              key={event.id}
              position={[parseFloat(event.latitude), parseFloat(event.longitude)]}
              icon={getMarkerIcon(event.severity, event.eventType, hasMessages)}
              eventHandlers={{
                click: () => onEventSelect && onEventSelect(event)
              }}
            >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
              <div style={{ minWidth: '200px' }}>
                <strong>{event.eventType}</strong><br/>
                {event.location}<br/>
                <em>{event.description.substring(0, 100)}{event.description.length > 100 ? '...' : ''}</em>
                {hasMessages && <div style={{ marginTop: '4px', color: '#1e40af', fontWeight: 'bold' }}>
                  💬 {messageCount} message{messageCount !== 1 ? 's' : ''}
                </div>}
              </div>
            </Tooltip>
            <Popup maxWidth={300}>
              <div style={{ padding: '8px' }}>
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}>
                  {event.eventType}
                </h3>
                <p style={{ margin: '4px 0' }}>
                  <strong>Location:</strong> {event.location}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>State:</strong> {event.state}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>Description:</strong> {event.description}
                </p>
                {hasMessages && (
                  <p style={{ margin: '8px 0', padding: '6px', backgroundColor: '#dbeafe', borderRadius: '4px' }}>
                    <strong>💬 {messageCount} Message{messageCount !== 1 ? 's' : ''}</strong>
                  </p>
                )}
                <p style={{ margin: '4px 0' }}>
                  <strong>Lanes:</strong> {event.lanesAffected}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <strong>Direction:</strong> {event.direction}
                </p>
                <button
                  onClick={() => onEventSelect && onEventSelect(event)}
                  style={{
                    marginTop: '8px',
                    padding: '6px 12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {hasMessages ? 'View Messages' : 'Add Message'}
                </button>
              </div>
            </Popup>
          </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
