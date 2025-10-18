import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

// Custom marker icons based on severity
const getMarkerIcon = (severity, eventType, hasMessages) => {
  const colors = {
    high: '#ef4444',    // red
    medium: '#f59e0b',  // orange
    low: '#10b981'      // green
  };

  const color = colors[severity] || colors.medium;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        position: relative;
      ">
        ${hasMessages ? `
          <div style="
            position: absolute;
            top: -4px;
            right: -4px;
            background-color: #1e40af;
            color: white;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          ">!</div>
        ` : ''}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Component to auto-fit bounds when events change
function AutoFitBounds({ events }) {
  const map = useMap();

  useEffect(() => {
    if (events.length > 0) {
      const bounds = events.map(e => [parseFloat(e.latitude), parseFloat(e.longitude)]);
      if (bounds.length > 0) {
        try {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
        } catch (error) {
          console.warn('Error fitting bounds:', error);
        }
      }
    }
  }, [events, map]);

  return null;
}

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

  // Default center (middle of USA)
  const defaultCenter = [39.8283, -98.5795];

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={defaultCenter}
        zoom={5}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AutoFitBounds events={validEvents} />

        {validEvents.map((event) => {
          const hasMessages = messages[event.id] && messages[event.id].length > 0;

          return (
            <Marker
              key={event.id}
              position={[parseFloat(event.latitude), parseFloat(event.longitude)]}
              icon={getMarkerIcon(event.severity, event.eventType, hasMessages)}
              eventHandlers={{
                click: () => onEventSelect && onEventSelect(event)
              }}
            >
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
                  View Messages
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
