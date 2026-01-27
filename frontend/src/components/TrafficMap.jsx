import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, CircleMarker, Polyline } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { isNearBorder } from '../utils/borderProximity';
import { analyzePolyline } from '../utils/polylineDiagnostics';
import ParkingLayer from './ParkingLayer';
import InterchangeLayer from './InterchangeLayer';
import BridgeClearanceLayer from './BridgeClearanceLayer';
import OSWRegulationsLayer from './OSWRegulationsLayer';
import StateOSWRegulationsLayer from './StateOSWRegulationsLayer';
import ITSEquipmentLayer from './ITSEquipmentLayer';
import NetworkTopologyLayer from './NetworkTopologyLayer';
// import TETCCorridorsLayer from './TETCCorridorsLayer'; // Temporarily disabled - needs proper OSM relation-based routing
import EventFormatPopup from './EventFormatPopup';
import BoundingBoxSelector from './BoundingBoxSelector';
import HeatMapControl from './HeatMapControl';
import HeatMapLayer from './HeatMapLayer';
import MiniMapControl from './MiniMapControl';
import NASCOAIAnalysis from './NASCOAIAnalysis';
import NearbyITSEquipment from './NearbyITSEquipment';

// Component to center map on selected event
function MapCenterController({ selectedEvent }) {
  const map = useMap();

  useEffect(() => {
    if (selectedEvent && selectedEvent.latitude && selectedEvent.longitude) {
      const lat = parseFloat(selectedEvent.latitude);
      const lng = parseFloat(selectedEvent.longitude);

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        map.setView([lat, lng], 12, {
          animate: true,
          duration: 1
        });
      }
    }
  }, [selectedEvent, map]);

  return null;
}

// Component to capture map reference
function MapRefCapturer({ mapRef }) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  return null;
}

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper to determine lane closure direction
const getLaneClosureType = (description, lanesAffected) => {
  const text = (description + ' ' + lanesAffected).toLowerCase();

  // Check for full closure
  if (text.includes('all lanes') || text.includes('road closed') ||
      text.includes('completely closed') || text.includes('full closure')) {
    return 'full';
  }

  // Check for right lane
  if (text.includes('right lane') || text.includes('right shoulder')) {
    return 'right';
  }

  // Check for left lane
  if (text.includes('left lane') || text.includes('left shoulder')) {
    return 'left';
  }

  // Check for center/middle or multiple lanes
  if (text.includes('center') || text.includes('middle') ||
      text.includes('two lane') || text.includes('2 lane')) {
    return 'both';
  }

  return 'both'; // Default
};

// Helper to determine weather type
const getWeatherType = (description) => {
  const text = description.toLowerCase();

  if (text.includes('snow') || text.includes('ice') || text.includes('winter')) {
    return 'snow';
  }
  if (text.includes('rain') || text.includes('wet')) {
    return 'rain';
  }
  if (text.includes('wind') || text.includes('fog')) {
    return 'wind';
  }

  return 'general';
};

// Helper to get polyline color based on event type and severity
const getPolylineColor = (eventType, severity) => {
  // Closure - red (most severe)
  if (eventType === 'Closure') {
    return '#dc2626'; // red-600
  }

  // Incident - red/orange based on severity
  if (eventType === 'Incident') {
    return severity === 'high' ? '#dc2626' : '#f97316'; // red-600 or orange-500
  }

  // Construction - orange/yellow based on severity
  if (eventType === 'Construction') {
    return severity === 'high' ? '#f97316' : '#fbbf24'; // orange-500 or amber-400
  }

  // Weather - blue/red based on severity
  if (eventType === 'Weather') {
    return severity === 'high' ? '#dc2626' : '#3b82f6'; // red-600 or blue-500
  }

  // Default - based on severity
  const colors = {
    high: '#dc2626',    // red-600
    medium: '#f97316',  // orange-500
    low: '#10b981'      // green-500
  };
  return colors[severity] || colors.medium;
};

const normalizeSeverity = (severity) => {
  if (!severity) return 'medium';
  const value = severity.toString().toLowerCase();
  if (value === 'major' || value === 'high') return 'high';
  if (value === 'moderate' || value === 'medium') return 'medium';
  if (value === 'minor' || value === 'low') return 'low';
  return value;
};

const isInterstateEvent = (event) => {
  const corridor = event.corridor || '';
  const location = event.location || '';
  const description = event.description || '';

  const text = `${corridor} ${location} ${description}`;
  if (!text) return false;

  // Match I-5, I 80, Interstate 90, I-080, etc.
  const interstatePattern = /\b(?:I[-\s]?|Interstate\s+)(0*\d{1,3})\b/i;

  // Exclude state routes like US-30, PA-070, SR-55
  const stateRoutePattern = /\b(?:US|SR|PA|CA|KS|NV|UT|OH|NJ|MN|IN|IA|NE)[-\s]?\d{1,3}\b/i;

  return interstatePattern.test(text) && !stateRoutePattern.test(corridor);
};

// Custom marker icons based on event type with traffic sign symbols
const getMarkerIcon = (event, hasMessages, messageCount = 0) => {
  const { eventType, description = '', lanesAffected = '', severity, severityLevel } = event;
  const normalizedSeverity = normalizeSeverity(severityLevel || severity);

  // Check if event is near a state border
  const borderInfo = isNearBorder(event);
  const isNearStateBorder = borderInfo && borderInfo.nearBorder;

  let iconSvg = '';

  if (eventType === 'Closure') {
    const closureType = getLaneClosureType(description, lanesAffected);

    if (closureType === 'full') {
      // Red circle with white bar (Do Not Enter)
      iconSvg = `
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="#dc2626" stroke="white" stroke-width="2"/>
          <rect x="6" y="14" width="20" height="4" fill="white" rx="1"/>
        </svg>
      `;
    } else if (closureType === 'right') {
      // Orange diamond with left-pointing arrow (right lane closed, merge left)
      iconSvg = `
        <svg width="32" height="32" viewBox="0 0 32 32">
          <rect x="16" y="0" width="18" height="18" fill="#f97316" stroke="white"
                stroke-width="2" transform="rotate(45 16 16)"/>
          <path d="M 20 16 L 12 16 L 15 12 M 12 16 L 15 20"
                stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    } else if (closureType === 'left') {
      // Orange diamond with right-pointing arrow (left lane closed, merge right)
      iconSvg = `
        <svg width="32" height="32" viewBox="0 0 32 32">
          <rect x="16" y="0" width="18" height="18" fill="#f97316" stroke="white"
                stroke-width="2" transform="rotate(45 16 16)"/>
          <path d="M 12 16 L 20 16 L 17 12 M 20 16 L 17 20"
                stroke="black" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    } else {
      // Orange diamond only (multiple lanes or unspecified)
      iconSvg = `
        <svg width="32" height="32" viewBox="0 0 32 32">
          <rect x="16" y="0" width="18" height="18" fill="#f97316" stroke="white"
                stroke-width="2" transform="rotate(45 16 16)"/>
        </svg>
      `;
  }
  } else if (eventType === 'Weather') {
    const weatherType = getWeatherType(description);
    const color = normalizedSeverity === 'high' ? '#dc2626' : '#3b82f6';

    if (weatherType === 'snow') {
      // Snowflake
      iconSvg = `
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
          <g stroke="white" stroke-width="2" stroke-linecap="round">
            <line x1="16" y1="8" x2="16" y2="24"/>
            <line x1="8" y1="16" x2="24" y2="16"/>
            <line x1="11" y1="11" x2="21" y2="21"/>
            <line x1="21" y1="11" x2="11" y2="21"/>
            <line x1="16" y1="8" x2="13" y2="11"/>
            <line x1="16" y1="8" x2="19" y2="11"/>
          </g>
        </svg>
      `;
    } else if (weatherType === 'rain') {
      // Raindrops
      iconSvg = `
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
          <path d="M 12 12 Q 12 10 14 10 Q 16 10 16 12 L 16 18 Q 16 20 14 20 Q 12 20 12 18 Z"
                fill="white"/>
          <path d="M 18 14 Q 18 12 20 12 Q 22 12 22 14 L 22 20 Q 22 22 20 22 Q 18 22 18 20 Z"
                fill="white" opacity="0.8"/>
        </svg>
      `;
    } else if (weatherType === 'wind') {
      // Wavy lines (wind/fog)
      iconSvg = `
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
          <path d="M 8 12 Q 12 10 16 12 Q 20 14 24 12" stroke="white" stroke-width="2"
                fill="none" stroke-linecap="round"/>
          <path d="M 8 16 Q 12 14 16 16 Q 20 18 24 16" stroke="white" stroke-width="2"
                fill="none" stroke-linecap="round"/>
          <path d="M 8 20 Q 12 18 16 20 Q 20 22 24 20" stroke="white" stroke-width="2"
                fill="none" stroke-linecap="round"/>
        </svg>
      `;
    } else {
      // General weather (cloud)
      iconSvg = `
        <svg width="32" height="32" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
          <path d="M 10 18 Q 10 14 13 14 Q 13 12 15 12 Q 17 12 17 14 Q 20 14 20 17 Q 20 20 17 20 L 13 20 Q 10 20 10 18 Z"
                fill="white"/>
        </svg>
      `;
    }
  } else if (eventType === 'Incident') {
    // Red octagon (stop sign shape) with exclamation
    iconSvg = `
      <svg width="32" height="32" viewBox="0 0 32 32">
        <path d="M 10 4 L 22 4 L 28 10 L 28 22 L 22 28 L 10 28 L 4 22 L 4 10 Z"
              fill="#dc2626" stroke="white" stroke-width="2"/>
        <text x="16" y="23" font-size="20" font-weight="bold" fill="white"
              text-anchor="middle">!</text>
      </svg>
    `;
  } else if (eventType === 'Construction') {
    // Orange triangle (warning sign)
    const color = normalizedSeverity === 'high' ? '#dc2626' : '#f97316';
    iconSvg = `
      <svg width="32" height="32" viewBox="0 0 32 32">
        <path d="M 16 4 L 28 26 L 4 26 Z" fill="${color}" stroke="white" stroke-width="2"/>
        <text x="16" y="22" font-size="14" font-weight="bold" fill="black"
              text-anchor="middle">!</text>
      </svg>
    `;
  } else {
    // Default: Circle
    const colors = {
      high: '#dc2626',
      medium: '#f97316',
      low: '#10b981'
    };
    const color = colors[normalizedSeverity] || colors.medium;
    iconSvg = `
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r="14" fill="${color}" stroke="white" stroke-width="2"/>
      </svg>
    `;
  }

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <style>
        @keyframes pulse-border {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.4);
            opacity: 0.3;
          }
        }
      </style>
      <div style="position: relative; width: 32px; height: 32px; ${hasMessages ? 'z-index: 1000;' : 'z-index: 1;'}">
        ${isNearStateBorder ? `
          <!-- Pulsing border indicator for events near state borders -->
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            width: 48px;
            height: 48px;
            margin-left: -24px;
            margin-top: -24px;
            border: 3px solid #6366f1;
            border-radius: 50%;
            animation: pulse-border 2s ease-in-out infinite;
            pointer-events: none;
          "></div>
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            width: 40px;
            height: 40px;
            margin-left: -20px;
            margin-top: -20px;
            border: 2px solid #6366f1;
            border-radius: 50%;
            animation: pulse-border 2s ease-in-out infinite 0.3s;
            pointer-events: none;
          "></div>
        ` : ''}
        ${iconSvg}
        ${hasMessages ? `
          <div style="
            position: absolute;
            top: -20px;
            right: -20px;
            z-index: 2000;
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));
          ">
            <svg width="48" height="48" viewBox="0 0 48 48">
              <!-- Message bubble -->
              <path d="M 8 10 Q 8 6 12 6 L 36 6 Q 40 6 40 10 L 40 26 Q 40 30 36 30 L 20 30 L 14 38 L 14 30 L 12 30 Q 8 30 8 26 Z"
                    fill="#10b981" stroke="white" stroke-width="3"/>
              <!-- Exclamation mark -->
              <line x1="24" y1="12" x2="24" y2="22" stroke="white" stroke-width="4" stroke-linecap="round"/>
              <circle cx="24" cy="26" r="2.5" fill="white"/>
              <!-- Count badge -->
              <circle cx="38" cy="12" r="10" fill="#dc2626" stroke="white" stroke-width="3"/>
              <text x="38" y="17" font-size="14" font-weight="bold" fill="white" text-anchor="middle">${messageCount > 9 ? '9+' : messageCount}</text>
            </svg>
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

export default function TrafficMap({
  events,
  messages = {},
  detourAlerts = [],
  onEventSelect,
  selectedEvent = null,
  showParking = false,
  parkingPredictionHours = 0,
  showInterchanges = false,
  showBridgeClearances = false,
  showCorridorRegulations = false,
  showITSEquipment = false,
  itsEquipmentRoute = null,
  itsEquipmentType = null,
  interstateOnly = true,
  heatMapActive = false,
  heatMapMode = 'density',
  onHeatMapToggle,
  onHeatMapModeChange,
  isDarkMode = false
}) {
  const mapRef = useRef(null);
  const [showMiniMap, setShowMiniMap] = useState(() => {
    const saved = localStorage.getItem('showMiniMap');
    return saved ? JSON.parse(saved) : false;
  });

  // Save mini-map visibility to localStorage
  useEffect(() => {
    localStorage.setItem('showMiniMap', JSON.stringify(showMiniMap));
  }, [showMiniMap]);

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

  // Optionally filter to interstate events only
  const displayEvents = interstateOnly ? validEvents.filter(isInterstateEvent) : validEvents;

  console.log(`📍 Map: ${displayEvents.length} mapped events out of ${validEvents.length} valid events (${events.length} total)${interstateOnly ? ' [Interstate Only]' : ' [All Routes]'}`);

  // Sort events so those with messages appear on top (render last)
  const sortedEvents = [...displayEvents].sort((a, b) => {
    const aHasMessages = messages[a.id] && messages[a.id].length > 0;
    const bHasMessages = messages[b.id] && messages[b.id].length > 0;
    if (aHasMessages && !bHasMessages) return 1; // a renders after b (on top)
    if (!aHasMessages && bHasMessages) return -1; // b renders after a (on top)
    return 0;
  });

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
        minZoom={3}
      >
        {/* Map center controller */}
        <MapCenterController selectedEvent={selectedEvent} />

        {/* Capture map reference */}
        <MapRefCapturer mapRef={mapRef} />

        {/* ESRI World Street Map - excellent highway visibility */}
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
          url={isDarkMode
            ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
            : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
          }
          subdomains="abcd"
          maxZoom={20}
        />

        {/* Only show traffic events when truck parking is NOT active */}
        {!showParking && (
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
            iconCreateFunction={(cluster) => {
              const count = cluster.getChildCount();
              const markers = cluster.getAllChildMarkers();
              const hasAnyMessages = markers.some(m => {
                const eventId = m.options.eventId;
                return messages[eventId] && messages[eventId].length > 0;
              });

              return L.divIcon({
                html: `<div style="
                  background-color: ${hasAnyMessages ? '#10b981' : '#3b82f6'};
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
                className: 'custom-cluster-icon',
                iconSize: L.point(40, 40, true),
              });
            }}
          >
          {sortedEvents.map((event) => {
          const hasMessages = messages[event.id] && messages[event.id].length > 0;
          const messageCount = hasMessages ? messages[event.id].length : 0;
          const borderInfo = isNearBorder(event);

          // Check if event has linear geometry (LineString)
          const hasGeometry = event.geometry &&
                             event.geometry.type === 'LineString' &&
                             event.geometry.coordinates &&
                             Array.isArray(event.geometry.coordinates) &&
                             event.geometry.coordinates.length > 1;

          // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
          const polylinePositions = hasGeometry
            ? event.geometry.coordinates.map(coord => [coord[1], coord[0]])
            : [];

          // Analyze geometry for diagnostics
          const geometryDiagnostics = hasGeometry ? analyzePolyline(event.geometry) : null;

          // Tooltip content (shared between marker and polyline)
          const tooltipContent = (
            <div style={{ minWidth: '200px' }}>
              <strong>{event.eventType}</strong><br/>
              {event.location}<br/>
              <em>{event.description.substring(0, 100)}{event.description.length > 100 ? '...' : ''}</em>
              {borderInfo && borderInfo.nearBorder && <div style={{ marginTop: '4px', color: '#6366f1', fontWeight: 'bold' }}>
                🔵 {borderInfo.distance} mi from {borderInfo.borderStates.join('-')} border
              </div>}
              {hasMessages && <div style={{ marginTop: '4px', color: '#1e40af', fontWeight: 'bold' }}>
                💬 {messageCount} message{messageCount !== 1 ? 's' : ''}
              </div>}
            </div>
          );

          // Popup content with format tabs (shared between marker and polyline)
          const popupContent = (
            <EventFormatPopup
              event={event}
              onEventSelect={onEventSelect}
              hasMessages={hasMessages}
              messageCount={messageCount}
              borderInfo={borderInfo}
              geometryDiagnostics={geometryDiagnostics}
            />
          );

          return (
            <div key={`event-${event.id}`}>
              {/* Render polyline for linear features (work zones, closures along road segments) */}
              {/* Skip polylines for Weather events - only show markers */}
              {hasGeometry && event.eventType !== 'Weather' && (
                <Polyline
                  key={`polyline-${event.id}`}
                  positions={polylinePositions}
                  pathOptions={{
                    // TEMP: Show westbound in green for testing
                    color: (event.direction && event.direction.toLowerCase().includes('west'))
                      ? '#00ff00'
                      : getPolylineColor(event.eventType, normalizeSeverity(event.severityLevel || event.severity)),
                    weight: 5,
                    opacity: 0.7,
                    lineJoin: 'round',
                    lineCap: 'round'
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                    {tooltipContent}
                  </Tooltip>
                  <Popup maxWidth={300}>
                    {popupContent}
                  </Popup>
                </Polyline>
              )}

              {/* Always render marker for the event location */}
              <Marker
                key={event.id}
                position={[parseFloat(event.latitude), parseFloat(event.longitude)]}
                icon={getMarkerIcon(event, hasMessages, messageCount)}
                zIndexOffset={hasMessages ? 1000 : 0}
                eventId={event.id}
              >
                <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                  {tooltipContent}
                </Tooltip>
                <Popup maxWidth={300}>
                  {popupContent}
                </Popup>
              </Marker>
            </div>
          );
          })}
          </MarkerClusterGroup>
        )}

        {/* Detour alerts only shown when truck parking is NOT active */}
        {!showParking && detourAlerts.map(alert => (
          <CircleMarker
            key={`detour-${alert.id}`}
            center={[alert.latitude, alert.longitude]}
            radius={14}
            pathOptions={{ color: '#dc2626', weight: 3, fillOpacity: 0.25 }}
          >
            <Popup>
              <div style={{ maxWidth: '240px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Detour Advisory</h3>
                <p style={{ margin: '4px 0' }}><strong>{alert.interchangeName}</strong></p>
                {alert.eventCorridor && <p style={{ margin: '4px 0' }}>Corridor: {alert.eventCorridor}</p>}
                {alert.eventDescription && <p style={{ margin: '4px 0' }}>{alert.eventDescription}</p>}
                <p style={{ margin: '8px 0' }}>{alert.message}</p>
              </div>
            </Popup>
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent>
              🚧 Detour
            </Tooltip>
          </CircleMarker>
        ))}

        <ParkingLayer showParking={showParking} predictionHoursAhead={parkingPredictionHours} />
        <InterchangeLayer showInterchanges={showInterchanges} />

        {/* TETC Vendor Coverage Corridors - shows data quality scores overlaid with events */}
        {/* <TETCCorridorsLayer events={events} /> */}
        {/* Temporarily disabled - needs proper OSM relation-based routing to avoid fragmented lines */}

        {/* Bridge Clearance Layer */}
        {showBridgeClearances && (
          <BridgeClearanceLayer
            onBridgeClick={(bridge) => {
              // You can add custom bridge click handler if needed
              console.log('Bridge clicked:', bridge);
            }}
          />
        )}

        {/* State OS/OW Regulations Layer */}
        {showCorridorRegulations && (
          <StateOSWRegulationsLayer />
        )}

        {/* ITS Equipment Layer */}
        {showITSEquipment && (
          <ITSEquipmentLayer route={itsEquipmentRoute} equipmentType={itsEquipmentType} />
        )}

        {/* Network Topology Layer */}
        {showITSEquipment && (
          <NetworkTopologyLayer visible={showITSEquipment} />
        )}

        {/* Heat Map Visualization */}
        <HeatMapLayer
          events={validEvents}
          mode={heatMapMode}
          isVisible={heatMapActive}
        />

        {/* Bounding Box Selector for exporting filtered TIM/CV-TIM data */}
        <BoundingBoxSelector isDarkMode={isDarkMode} />
      </MapContainer>

      {/* Heat Map Control Panel */}
      <HeatMapControl
        isActive={heatMapActive}
        mode={heatMapMode}
        onToggle={onHeatMapToggle}
        onModeChange={onHeatMapModeChange}
      />

      {/* Mini Map Navigation Control */}
      <MiniMapControl
        parentMapRef={mapRef}
        isVisible={showMiniMap}
        onToggle={() => setShowMiniMap(!showMiniMap)}
      />

      {/* AI Harmonization Analysis - shown when corridor regulations are active */}
      {showCorridorRegulations && (
        <NASCOAIAnalysis />
      )}
    </div>
  );
}
