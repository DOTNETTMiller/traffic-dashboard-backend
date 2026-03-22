import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, CircleMarker, Polyline, Polygon } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { isNearBorder } from '../utils/borderProximity';
import { analyzePolyline, validateAndFixGeometry } from '../utils/polylineDiagnostics';
import ParkingLayer from './ParkingLayer';
import { config } from '../config';
import InterchangeLayer from './InterchangeLayer';
import BridgeClearanceLayer from './BridgeClearanceLayer';
import OSWRegulationsLayer from './OSWRegulationsLayer';
import StateOSWRegulationsLayer from './StateOSWRegulationsLayer';
import ITSEquipmentLayer from './ITSEquipmentLayer';
import NetworkTopologyLayer from './NetworkTopologyLayer';
import TETCCorridorsLayer from './TETCCorridorsLayer';
import CADDElementsLayer from './CADDElementsLayer';
import V2XDeploymentsLayer from './V2XDeploymentsLayer';
import EventFormatPopup from './EventFormatPopup';
import BoundingBoxSelector from './BoundingBoxSelector';
import HeatMapControl from './HeatMapControl';
import HeatMapLayer from './HeatMapLayer';
import NASCOAIAnalysis from './NASCOAIAnalysis';
import NearbyITSEquipment from './NearbyITSEquipment';

// Component to center map on selected event (only once when event changes)
function MapCenterController({ selectedEvent }) {
  const map = useMap();
  const lastCenteredEventId = useRef(null);

  useEffect(() => {
    // Disabled auto-centering to allow free map navigation
    // Users can navigate the map while event popups are open
    // Previously this would call map.setView() and snap the map back to the event

    // Only center if this is a different event than the last one we centered on
    // if (selectedEvent && selectedEvent.id !== lastCenteredEventId.current) {
    //   if (selectedEvent.latitude && selectedEvent.longitude) {
    //     const lat = parseFloat(selectedEvent.latitude);
    //     const lng = parseFloat(selectedEvent.longitude);

    //     if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    //       map.setView([lat, lng], 12, {
    //         animate: true,
    //         duration: 1
    //       });
    //       // Remember that we centered on this event
    //       lastCenteredEventId.current = selectedEvent.id;
    //     }
    //   }
    // } else if (!selectedEvent) {
    //   // Reset when no event is selected
    //   lastCenteredEventId.current = null;
    // }
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

// Component to listen for IPAWS geofence updates and center map
function IPAWSGeofenceCenterController() {
  const map = useMap();

  useEffect(() => {
    const handleGeofenceUpdate = (event) => {
      const { geofence, shouldCenter } = event.detail;

      if (shouldCenter && geofence && geofence.coordinates && geofence.coordinates[0]) {
        try {
          // Get all coordinates from the polygon
          const coords = geofence.coordinates[0];

          // Convert to Leaflet LatLng format
          const latLngs = coords.map(coord => [coord[1], coord[0]]); // [lat, lng]

          // Calculate bounds
          const bounds = L.latLngBounds(latLngs);

          // Close any open popups so they don't block the geofence view
          map.closePopup();

          // Fit map to bounds with padding
          map.fitBounds(bounds, {
            padding: [50, 50],
            animate: true,
            duration: 0.5,
            maxZoom: 14
          });

          console.log('🗺️ Map centered on IPAWS geofence');
        } catch (error) {
          console.error('Error centering map on geofence:', error);
        }
      }
    };

    window.addEventListener('ipaws-geofence-update', handleGeofenceUpdate);

    return () => {
      window.removeEventListener('ipaws-geofence-update', handleGeofenceUpdate);
    };
  }, [map]);

  return null;
}

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for BIM Bridge models
const bridgeIcon = L.divIcon({
  html: '<div style="font-size: 24px;">🌉</div>',
  className: 'bim-bridge-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15]
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

// Helper to calculate distance between two lat/lng points in miles (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
  const { eventType, description = '', lanesAffected = '', severity, severityLevel, geometry } = event;
  const normalizedSeverity = normalizeSeverity(severityLevel || severity);

  // Check if event is near a state border
  const borderInfo = isNearBorder(event);
  const isNearStateBorder = borderInfo && borderInfo.nearBorder;

  // Determine geometry enhancement status
  const geometrySource = geometry?.geometrySource;
  const isEnhanced = geometrySource === 'osrm' || geometrySource === 'state_dot_wfs' || geometrySource === 'interstate_polyline' || geometrySource === 'interstate' || geometrySource === 'feed_polyline';
  const isFallback = geometrySource === 'straight_line' || geometrySource === 'straight';

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
        ${isEnhanced || isFallback ? `
          <!-- Geometry enhancement badge -->
          <div style="
            position: absolute;
            bottom: -8px;
            right: -8px;
            z-index: 1500;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          ">
            <svg width="20" height="20" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="9" fill="${isEnhanced ? '#10b981' : '#dc2626'}" stroke="white" stroke-width="2"/>
              ${isEnhanced ? `
                <!-- Checkmark -->
                <path d="M 6 10 L 9 13 L 14 7" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              ` : `
                <!-- X mark -->
                <line x1="7" y1="7" x2="13" y2="13" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                <line x1="13" y1="7" x2="7" y2="13" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
              `}
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
  ipawsGeofence = null,
  onGeofenceUpdate,
  showITSEquipment = false,
  itsEquipmentRoute = null,
  itsEquipmentType = null,
  showCADDElements = false,
  showV2XDeployments = false,
  interstateOnly = true,
  heatMapActive = false,
  heatMapMode = 'density',
  onHeatMapToggle,
  onHeatMapModeChange,
  isDarkMode = false,
  stateKey = null
}) {
  // Debug: Verify geometry filter props are being received

  const mapRef = useRef(null);
  const [bimBridges, setBimBridges] = useState([]);
  const [savedGeofences, setSavedGeofences] = useState([]);

  // Load BIM bridges from database with V2X/AV tagging
  useEffect(() => {
    fetch(`${config.apiUrl}/api/bim/bridges`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.bridges) {
          setBimBridges(data.bridges);
          console.log(`🌉 Loaded ${data.bridges.length} BIM bridges with V2X/AV tagging`);
        }
      })
      .catch(err => console.error('Error loading BIM bridges:', err));
  }, []);

  // Load saved IPAWS geofences from database
  useEffect(() => {
    fetch(`${config.apiUrl}/api/geofences`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.geofences) {
          setSavedGeofences(data.geofences);
          console.log(`🚨 Loaded ${data.geofences.length} saved IPAWS geofences`);
        }
      })
      .catch(err => console.error('Error loading geofences:', err));
  }, []);

  // Filter out events without valid coordinates and validate/fix geometries
  const validEvents = events
    .filter(e => {
      const lat = parseFloat(e.latitude);
      const lng = parseFloat(e.longitude);

      // Basic coordinate validation
      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0 ||
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return false;
      }

      // Filter out events with no description AND no location (likely bad data)
      if ((!e.description || e.description.trim() === '') &&
          (!e.location || e.location.trim() === '')) {
        console.log(`🚫 Filtering event with no description/location: ${e.id}`);
        return false;
      }

      // Filter out straight-line fallback geometries (unreliable)
      if (e.geometry?.geometrySource === 'straight_line' ||
          e.geometry?.geometrySource === 'straight') {
        console.log(`🚫 Filtering straight-line fallback geometry: ${e.id} (${e.corridor || 'no corridor'})`);
        return false;
      }

      // Filter out unrealistically long 2-point lines (> 20 miles)
      if (e.geometry?.type === 'LineString' &&
          e.geometry?.coordinates?.length === 2) {
        const [start, end] = e.geometry.coordinates;
        const distance = calculateDistance(start[1], start[0], end[1], end[0]);
        if (distance > 20) {
          console.log(`🚫 Filtering unrealistically long 2-point line: ${e.id} (${distance.toFixed(2)} miles)`);
          return false;
        }
      }

      return true;
    })
    .map(e => validateAndFixGeometry(e))
    .filter(e => e !== null);

  // Optionally filter to interstate events only
  let displayEvents = interstateOnly ? validEvents.filter(isInterstateEvent) : validEvents;

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

        {/* Auto-center map when IPAWS geofence is updated */}
        <IPAWSGeofenceCenterController />

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

          // Check if event has linear geometry (LineString or MultiLineString)
          const hasGeometry = event.geometry &&
                             (event.geometry.type === 'LineString' || event.geometry.type === 'MultiLineString') &&
                             event.geometry.coordinates &&
                             Array.isArray(event.geometry.coordinates) &&
                             event.geometry.coordinates.length > 0;

          // Convert GeoJSON coordinates to Leaflet format [lat, lng]
          // For LineString: [[lng, lat], ...] -> [[lat, lng], ...]
          // For MultiLineString: [[[lng, lat], ...], ...] -> [[[lat, lng], ...], ...]
          let polylinePositions = [];
          if (hasGeometry) {
            if (event.geometry.type === 'LineString') {
              polylinePositions = event.geometry.coordinates.map(coord => {
                // Ensure coordinates are numbers, not strings
                const lat = parseFloat(coord[1]);
                const lng = parseFloat(coord[0]);
                return [lat, lng];
              });
            } else if (event.geometry.type === 'MultiLineString') {
              // MultiLineString: array of LineStrings
              polylinePositions = event.geometry.coordinates.map(line =>
                line.map(coord => {
                  const lat = parseFloat(coord[1]);
                  const lng = parseFloat(coord[0]);
                  return [lat, lng];
                })
              );
            }

            // Debug log for troubleshooting
            if (polylinePositions.length > 0 && event.id.includes('21785')) {
              console.log('🗺️ Rendering polyline for event:', event.id, {
                type: event.geometry.type,
                points: polylinePositions.length,
                firstPoint: polylinePositions[0],
                eventType: event.eventType,
                hasGeometry
              });
            }
          }

          // Analyze geometry for diagnostics (use first line for MultiLineString)
          let geometryDiagnostics = null;
          if (hasGeometry) {
            if (event.geometry.type === 'LineString') {
              geometryDiagnostics = analyzePolyline(event.geometry);
            } else if (event.geometry.type === 'MultiLineString') {
              // Analyze first line of MultiLineString
              const firstLine = {
                type: 'LineString',
                coordinates: event.geometry.coordinates[0],
                geometrySource: event.geometry.geometrySource
              };
              geometryDiagnostics = analyzePolyline(firstLine);
            }
          }

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
              onGeofenceUpdate={onGeofenceUpdate}
            />
          );

          // Check if we should draw a line
          let shouldDrawLine = polylinePositions &&
            ((Array.isArray(polylinePositions[0]) && polylinePositions.length >= 2) || // LineString
             (Array.isArray(polylinePositions) && polylinePositions.length > 0)); // MultiLineString

          // Transform 2-point geometries: use midpoint for better representation
          let transformedMarkerPos = null;
          if (shouldDrawLine &&
              event.geometry?.type === 'LineString' &&
              Array.isArray(polylinePositions) &&
              polylinePositions.length === 2) {
            const [lat1, lng1] = polylinePositions[0];
            const [lat2, lng2] = polylinePositions[1];
            const distance = calculateDistance(lat1, lng1, lat2, lng2);

            // If 2-point line is > 0.5 miles, transform to midpoint and show as single point
            if (distance > 0.5) {
              // Calculate midpoint for better geometric representation
              const midLat = (lat1 + lat2) / 2;
              const midLng = (lng1 + lng2) / 2;
              transformedMarkerPos = [midLat, midLng];
              console.log(`🔄 Transformed long 2-point line to midpoint for ${event.eventType}: ${distance.toFixed(2)} miles (${event.id})`);
              shouldDrawLine = false;
            }
          }

          // Debug logging
          if (event.id.includes('21785') || event.id.includes('19668')) {
            console.log('🔍 Line rendering check:', {
              eventId: event.id,
              eventType: event.eventType,
              hasGeometry,
              shouldDrawLine,
              polylinePositionsLength: polylinePositions.length,
              firstPosition: polylinePositions[0]
            });
          }

          // Dim events when IPAWS geofence is active
          const eventOpacity = ipawsGeofence ? 0.3 : 1.0;

          return (
            <div key={`event-${event.id}`}>
              {/* Render polyline if we have 2+ coordinate points */}
              {shouldDrawLine && (
                <>
                  {event.geometry.type === 'LineString' ? (
                    // Single polyline for LineString
                    <Polyline
                      key={`polyline-${event.id}`}
                      positions={polylinePositions}
                      pathOptions={{
                        color: getPolylineColor(event.eventType, normalizeSeverity(event.severityLevel || event.severity)) || '#FF0000', // Fallback to bright red
                        weight: 8, // Extra thick for visibility
                        opacity: eventOpacity, // Dim when IPAWS geofence is active
                        lineJoin: 'round',
                        lineCap: 'round'
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                        {tooltipContent}
                      </Tooltip>
                      <Popup
                        maxWidth={300}
                        minWidth={280}
                        autoPan={false}
                        keepInView={false}
                        closeButton={true}
                        className="compact-popup"
                      >
                        {popupContent}
                      </Popup>
                    </Polyline>
                  ) : (
                    // Multiple polylines for MultiLineString (bidirectional rendering)
                    polylinePositions.map((linePositions, index) => (
                      <Polyline
                        key={`polyline-${event.id}-${index}`}
                        positions={linePositions}
                        pathOptions={{
                          color: getPolylineColor(event.eventType, normalizeSeverity(event.severityLevel || event.severity)) || '#FF0000', // Fallback to bright red
                          weight: 8, // Extra thick for visibility
                          opacity: eventOpacity, // Dim when IPAWS geofence is active
                          lineJoin: 'round',
                          lineCap: 'round'
                        }}
                      >
                        {/* Only attach tooltip/popup to first line to avoid duplicates; hide when IPAWS active */}
                        {index === 0 && !ipawsGeofence && (
                          <>
                            <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                              {tooltipContent}
                            </Tooltip>
                            <Popup
                              maxWidth={300}
                              minWidth={280}
                              autoPan={false}
                              keepInView={false}
                              closeButton={true}
                              className="compact-popup"
                            >
                              {popupContent}
                            </Popup>
                          </>
                        )}
                      </Polyline>
                    ))
                  )}
                </>
              )}

              {/* Always render marker for the event location (use transformed midpoint if available) */}
              <Marker
                key={event.id}
                position={transformedMarkerPos || [parseFloat(event.latitude), parseFloat(event.longitude)]}
                icon={getMarkerIcon(event, hasMessages, messageCount)}
                zIndexOffset={hasMessages ? 1000 : 0}
                eventId={event.id}
                opacity={eventOpacity}
              >
                {!ipawsGeofence && (
                  <>
                    <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                      {tooltipContent}
                    </Tooltip>
                    <Popup
                      maxWidth={300}
                      minWidth={280}
                      autoPan={false}
                      keepInView={false}
                      closeButton={true}
                      className="compact-popup"
                    >
                      {popupContent}
                    </Popup>
                  </>
                )}
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
            <Popup
              autoPan={false}
              keepInView={false}
              closeButton={true}
              className="compact-popup"
            >
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

        {/* IPAWS Geofence Polygon */}
        {ipawsGeofence && ipawsGeofence.coordinates && Array.isArray(ipawsGeofence.coordinates[0]) && (
          <>
            {/* Render buffered area as polygon */}
            <Polygon
              positions={
                ipawsGeofence.coordinates[0].map(coord => [coord[1], coord[0]])
              }
              pathOptions={{
                color: '#f59e0b',
                weight: 2,
                opacity: 0.6,
                fillColor: '#fef3c7',
                fillOpacity: 0.2
              }}
            >
              <Tooltip permanent direction="center" opacity={0.9}>
                <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                  📡 IPAWS Geofence
                  {ipawsGeofence.isAsymmetric && (
                    <>
                      <br />
                      🚨 {ipawsGeofence.corridorAheadMiles}mi ahead / {ipawsGeofence.corridorBehindMiles}mi behind
                    </>
                  )}
                </div>
              </Tooltip>
            </Polygon>

            {/* Render centerline polyline to show corridor path */}
            {ipawsGeofence.centerline && ipawsGeofence.centerline.coordinates && (
              <Polyline
                positions={
                  ipawsGeofence.centerline.coordinates.map(coord => [coord[1], coord[0]])
                }
                pathOptions={{
                  color: '#f59e0b',
                  weight: 5,
                  opacity: 1.0,
                  lineJoin: 'round',
                  lineCap: 'round',
                  dashArray: '10, 5'
                }}
              />
            )}

            {/* Event Point Marker - shows where the incident is */}
            {ipawsGeofence.visualZones?.eventPoint && (
              <CircleMarker
                center={[
                  ipawsGeofence.visualZones.eventPoint.coordinates[1],
                  ipawsGeofence.visualZones.eventPoint.coordinates[0]
                ]}
                radius={8}
                pathOptions={{
                  color: '#111827',
                  weight: 3,
                  fillColor: '#fbbf24',
                  fillOpacity: 1
                }}
              >
                <Tooltip permanent direction="top" opacity={0.95}>
                  <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                    📍 Event Location
                  </div>
                </Tooltip>
              </CircleMarker>
            )}
          </>
        )}

        {/* Saved IPAWS Geofences from Database */}
        {savedGeofences.map((saved, idx) => {
          if (!saved.geofence || !saved.geofence.coordinates || !Array.isArray(saved.geofence.coordinates[0])) return null;

          const handleDeleteGeofence = async () => {
            if (!window.confirm(`Delete IPAWS geofence for event ${saved.eventId}?\n\nThis will remove the saved alert area from the map.`)) {
              return;
            }

            try {
              const response = await fetch(`${config.apiUrl}/api/events/${saved.eventId}/geofence`, {
                method: 'DELETE'
              });

              const data = await response.json();

              if (data.success) {
                // Refresh geofences list
                const refreshResponse = await fetch(`${config.apiUrl}/api/geofences`);
                const refreshData = await refreshResponse.json();
                if (refreshData.success) {
                  setSavedGeofences(refreshData.geofences);
                }
                alert('✅ Geofence deleted successfully!');
              } else {
                alert(`❌ Failed to delete geofence: ${data.error}`);
              }
            } catch (error) {
              console.error('Error deleting geofence:', error);
              alert(`❌ Error: ${error.message}`);
            }
          };

          return (
            <Polygon
              key={`saved-geofence-${saved.eventId}-${idx}`}
              positions={
                // Convert GeoJSON Polygon coordinates [[lng, lat], ...] to Leaflet format [[lat, lng], ...]
                saved.geofence.coordinates[0].map(coord => [coord[1], coord[0]])
              }
              pathOptions={{
                color: '#ef4444',
                weight: 2,
                opacity: 0.7,
                fillColor: '#fee2e2',
                fillOpacity: 0.15
              }}
            >
              <Popup
                maxWidth={300}
                minWidth={250}
                autoPan={true}
                keepInView={true}
                closeButton={true}
                className="compact-popup"
              >
                <div style={{ maxWidth: '260px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>🚨 Saved IPAWS Geofence</h4>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}>
                    <strong>Event ID:</strong> {saved.eventId}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}>
                    <strong>Population:</strong> {saved.population?.toLocaleString() || 'N/A'}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '13px' }}>
                    <strong>Buffer:</strong> {saved.bufferMiles} miles
                  </p>
                  {saved.overridePopulation && (
                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#f59e0b' }}>
                      ⚠️ Population threshold overridden
                    </p>
                  )}
                  <button
                    onClick={handleDeleteGeofence}
                    style={{
                      width: '100%',
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
                  >
                    🗑️ Delete Geofence
                  </button>
                </div>
              </Popup>
              <Tooltip permanent direction="center" opacity={0.8}>
                <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                  🚨 IPAWS Alert
                </div>
              </Tooltip>
            </Polygon>
          );
        })}

        {/* BIM Bridge Models with V2X/AV Highlighting */}
        {bimBridges.map((bridge, idx) => {
          return (
            <Marker
              key={`bim-bridge-${bridge.id || idx}`}
              position={[bridge.latitude, bridge.longitude]}
              icon={bridgeIcon}
            >
              <Popup maxWidth={450} autoPan={false} keepInView={false}>
                <div style={{ padding: '8px' }}>
                  <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#1f2937',
                    borderBottom: '2px solid #3b82f6',
                    paddingBottom: '8px'
                  }}>
                    🌉 {bridge.name || 'BIM Bridge Model'}
                  </h3>

                  <div style={{ fontSize: '13px', lineHeight: '1.6' }}>
                    {/* V2X/AV Tags - HIGHLIGHTED */}
                    {(bridge.v2x_applicable || bridge.av_applicable) && (
                      <div style={{
                        marginBottom: '12px',
                        padding: '8px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '6px',
                        color: 'white'
                      }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                          ⚡ Connected Infrastructure
                        </div>
                        {bridge.v2x_applicable && (
                          <div style={{ fontSize: '12px', marginLeft: '16px' }}>
                            🚦 <strong>V2X Features:</strong> {bridge.v2x_features?.join(', ') || 'Clearance monitoring'}
                          </div>
                        )}
                        {bridge.av_applicable && (
                          <div style={{ fontSize: '12px', marginLeft: '16px' }}>
                            🤖 <strong>AV Ready:</strong> {bridge.av_features?.join(', ') || 'HD map data'}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Location */}
                    <div style={{ marginBottom: '8px' }}>
                      <strong>📍 Location:</strong>
                      <div style={{ marginLeft: '16px', color: '#4b5563' }}>
                        {bridge.route && <div>Route: {bridge.route}</div>}
                        {bridge.city && <div>{bridge.city}, {bridge.county} County</div>}
                        {bridge.state && <div>{bridge.state}{bridge.district && ` - District ${bridge.district}`}</div>}
                      </div>
                    </div>

                    {/* Bridge Details */}
                    <div style={{ marginBottom: '8px' }}>
                      <strong>🏗️ Bridge Details:</strong>
                      <div style={{ marginLeft: '16px', color: '#4b5563' }}>
                        {bridge.spans && <div>Spans: {bridge.spans}</div>}
                        {bridge.supports && <div>Supports: {bridge.supports}</div>}
                        {bridge.clearance && (
                          <div style={{
                            background: '#fef3c7',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: '1px solid #f59e0b',
                            display: 'inline-block',
                            marginTop: '4px'
                          }}>
                            ⚠️ Min Clearance: <strong>{bridge.clearance} ft</strong> (V2X-broadcasted)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Traffic & Speed */}
                    <div style={{ marginBottom: '8px' }}>
                      <strong>🚗 Traffic & Speed:</strong>
                      <div style={{ marginLeft: '16px', color: '#4b5563' }}>
                        {bridge.adt && <div>Avg Daily Traffic: {bridge.adt.toLocaleString()} vehicles/day</div>}
                        {bridge.design_speed && <div>Design Speed: {bridge.design_speed} mph</div>}
                        {bridge.posted_speed && <div>Posted Speed: {bridge.posted_speed} mph</div>}
                      </div>
                    </div>

                    {/* Technical Data */}
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid #e5e7eb',
                      fontSize: '11px',
                      color: '#6b7280'
                    }}>
                      <div>CRS: {bridge.crs}</div>
                      {bridge.stateplane_easting && bridge.stateplane_northing && (
                        <div>State Plane: E {bridge.stateplane_easting.toFixed(2)}, N {bridge.stateplane_northing.toFixed(2)}</div>
                      )}
                      {bridge.file_name && <div>Source: {bridge.file_name}</div>}
                    </div>
                  </div>
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -10]}>
                <div style={{ textAlign: 'center', fontSize: '12px' }}>
                  <strong>{bridge.name}</strong>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {bridge.route} - {bridge.city}
                  </div>
                  {(bridge.v2x_applicable || bridge.av_applicable) && (
                    <div style={{
                      fontSize: '10px',
                      color: '#8b5cf6',
                      fontWeight: 'bold',
                      marginTop: '2px'
                    }}>
                      {bridge.v2x_applicable && '🚦 V2X'} {bridge.av_applicable && '🤖 AV'}
                    </div>
                  )}
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* TETC Vendor Coverage Corridors - shows data quality scores overlaid with events */}
        {/* <TETCCorridorsLayer events={events} /> */}

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

        {/* CADD Elements Layer */}
        {showCADDElements && (
          <CADDElementsLayer visible={showCADDElements} stateKey={stateKey} />
        )}

        {/* USDOT V2X Deployments Layer */}
        {showV2XDeployments && (
          <V2XDeploymentsLayer visible={showV2XDeployments} stateKey={stateKey} />
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

      {/* AI Harmonization Analysis - shown when corridor regulations are active */}
      {showCorridorRegulations && (
        <NASCOAIAnalysis />
      )}
    </div>
  );
}
