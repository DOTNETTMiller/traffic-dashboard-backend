// Traffic Dashboard Backend Proxy Server
// This server fetches data from state DOT APIs and serves it to your dashboard

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs').promises;
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for your frontend
app.use(cors());
app.use(express.json());

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  if (!db.verifyAdminToken(token)) {
    return res.status(403).json({ error: 'Invalid or expired admin token' });
  }

  next();
};

// Message storage file
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// Initialize messages file if it doesn't exist
async function initializeMessagesFile() {
  try {
    await fs.access(MESSAGES_FILE);
  } catch {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify([], null, 2));
    console.log('📝 Created messages.json file');
  }
}

// Load messages from file
async function loadMessages() {
  try {
    const data = await fs.readFile(MESSAGES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading messages:', error);
    return [];
  }
}

// Save messages to file
async function saveMessages(messages) {
  try {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving messages:', error);
    return false;
  }
}

// Initialize on startup
initializeMessagesFile();

// API Configuration
// IMPORTANT: Credentials are loaded from environment variables for security
const API_CONFIG = {
  nevada: {
    name: 'Nevada',
    eventsUrl: 'https://www.nvroads.com/api/v1/get/road-conditions',
    parkingUrl: 'https://www.nvroads.com/api/v1/get/truck-parking',
    apiKey: process.env.NEVADA_API_KEY || '',
    format: 'json',
    corridor: 'I-80'
  },
  ohio: {
    name: 'Ohio',
    eventsUrl: 'https://publicapi.ohgo.com/api/v1/constructions',
    incidentsUrl: 'https://publicapi.ohgo.com/api/v1/incidents',
    apiKey: process.env.OHIO_API_KEY || '',
    format: 'json',
    corridor: 'I-80'
  },
  newjersey: {
    name: 'New Jersey',
    eventsUrl: 'https://511nj.org/client/rest/rss/RSSAllNJActiveEvents',
    format: 'xml',
    corridor: 'I-80'
  },
  iowa: {
    name: 'Iowa',
    eventsUrl: 'https://ia.carsprogram.org/hub/data/feu-g.xml',
    username: process.env.CARS_USERNAME || '',
    password: process.env.CARS_PASSWORD || '',
    format: 'xml',
    corridor: 'both'
  },
  kansas: {
    name: 'Kansas',
    eventsUrl: 'https://kscars.kandrive.gov/hub/data/feu-g.xml',
    username: process.env.CARS_USERNAME || '',
    password: process.env.CARS_PASSWORD || '',
    format: 'xml',
    corridor: 'I-35'
  },
  nebraska: {
    name: 'Nebraska',
    eventsUrl: 'https://ne.carsprogram.org/hub/data/feu-g.xml',
    username: process.env.CARS_USERNAME || '',
    password: process.env.CARS_PASSWORD || '',
    format: 'xml',
    corridor: 'I-80'
  },
  indiana: {
    name: 'Indiana',
    eventsUrl: 'https://inhub.carsprogram.org/data/feu-g.xml',
    username: process.env.CARS_USERNAME || '',
    password: process.env.CARS_PASSWORD || '',
    format: 'xml',
    corridor: 'I-80'
  },
  minnesota: {
    name: 'Minnesota',
    eventsUrl: 'https://mn.carsprogram.org/hub/data/feu-g.xml',
    username: process.env.CARS_USERNAME || '',
    password: process.env.CARS_PASSWORD || '',
    format: 'xml',
    corridor: 'I-35'
  },
  utah: {
    name: 'Utah',
    wzdxUrl: 'https://udottraffic.utah.gov/wzdx/udot/v40/data',
    format: 'json',
    corridor: 'I-80'
  }
};

// Function to load states from database and merge with API_CONFIG
function loadStatesFromDatabase() {
  console.log('📦 Loading states from database...');

  const dbStates = db.getAllStates(true); // Get all with credentials

  dbStates.forEach(state => {
    if (state.enabled) {
      // Convert database format to API_CONFIG format
      API_CONFIG[state.stateKey] = {
        name: state.stateName,
        eventsUrl: state.apiUrl,
        format: state.format,
        apiType: state.apiType,
        ...(state.credentials || {})
      };

      console.log(`  ✅ Loaded ${state.stateName} from database`);
    }
  });

  console.log(`📊 Total states configured: ${Object.keys(API_CONFIG).length}`);
}

// Run migration on first startup (only runs once)
const existingStates = db.getAllStates();
if (existingStates.length === 0) {
  console.log('🔄 First startup detected - migrating existing states to database...');
  db.migrateFromConfig(API_CONFIG);
}

// Load any additional states from database
loadStatesFromDatabase();

// Generate admin token if none exist
const tokenCheck = db.db.prepare('SELECT COUNT(*) as count FROM admin_tokens').get();
if (tokenCheck.count === 0) {
  const initialToken = db.createAdminToken('Initial admin token');
  console.log('\n🔑 ═══════════════════════════════════════════════════════════');
  console.log('🔑 ADMIN TOKEN GENERATED (SAVE THIS SECURELY):');
  console.log(`🔑 ${initialToken}`);
  console.log('🔑 ═══════════════════════════════════════════════════════════\n');
}

// Helper function to parse XML
const parseXML = async (xmlString) => {
  const parser = new xml2js.Parser({ explicitArray: false });
  return await parser.parseStringPromise(xmlString);
};

// Helper to extract text strings from potentially nested objects
const extractTextValue = (obj) => {
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object' || obj === null) return '';

  // Try to find the first string value in the object
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') return value;
    // Don't recurse into nested objects to avoid getting too deep
  }
  return '';
};

// Helper to extract actual interstate corridor from location text
const extractCorridor = (locationText) => {
  if (!locationText) return 'Unknown';

  const text = locationText.toUpperCase();

  // Match patterns like "I-80", "I 80", "Interstate 80"
  const interstateMatch = text.match(/\b(?:I-?|INTERSTATE\s+)(\d{1,3})\b/);

  if (interstateMatch) {
    return `I-${interstateMatch[1]}`;
  }

  return 'Unknown';
};

// Normalize data from different state formats
const normalizeEventData = (rawData, stateName, format, sourceType = 'events') => {
  const normalized = [];
  
  try {
    if (format === 'json') {
      // Handle Nevada
      if (stateName === 'Nevada' && Array.isArray(rawData)) {
        rawData.forEach(item => {
          const locationText = item.location_description || `I-80 ${item.direction || ''}`;
          if (item.routes && item.routes.some(r => /I-?\d+/.test(r))) {
            normalized.push({
              id: `NV-${item.id || Math.random().toString(36).substr(2, 9)}`,
              state: 'Nevada',
              corridor: extractCorridor(locationText),
              eventType: determineEventType(item.event_category || item.description),
              description: item.description || item.headline || 'Road condition update',
              location: locationText,
              county: item.county || 'Unknown',
              latitude: parseFloat(item.start_latitude) || 0,
              longitude: parseFloat(item.start_longitude) || 0,
              startTime: item.start_time || new Date().toISOString(),
              endTime: item.end_time || null,
              lanesAffected: item.lanes_affected || 'Check conditions',
              severity: determineSeverity(item),
              direction: item.direction || 'Both',
              requiresCollaboration: false
            });
          }
        });
      }

      // Handle Ohio
      if (stateName === 'Ohio' && Array.isArray(rawData)) {
        rawData.forEach(item => {
          const locationText = `${item.route} ${item.direction || ''} MM ${item.milepost || ''}`;
          if (item.route && /I-?\d+/.test(item.route)) {
            normalized.push({
              id: `OH-${item.id || Math.random().toString(36).substr(2, 9)}`,
              state: 'Ohio',
              corridor: extractCorridor(locationText),
              eventType: sourceType === 'incidents' ? 'Incident' : 'Construction',
              description: item.description || item.comments || 'Road work',
              location: locationText,
              county: item.county || 'Unknown',
              latitude: parseFloat(item.latitude) || 0,
              longitude: parseFloat(item.longitude) || 0,
              startTime: item.startDate || item.created || new Date().toISOString(),
              endTime: item.estimatedEndDate || item.endDate || null,
              lanesAffected: item.lanesBlocked || item.lanesAffected || 'Unknown',
              severity: item.severity || 'medium',
              direction: item.direction || 'Both',
              requiresCollaboration: false
            });
          }
        });
      }
      
      // Handle Utah WZDX
      if (stateName === 'Utah' && rawData.features) {
        rawData.features.forEach(feature => {
          const props = feature.properties;
          let lat = 0;
          let lng = 0;

          // Extract coordinates based on geometry type
          if (feature.geometry?.coordinates) {
            const coords = feature.geometry.coordinates;

            // Check if it's a LineString (array of points) or Point
            if (Array.isArray(coords) && coords.length > 0) {
              if (Array.isArray(coords[0])) {
                // LineString - take first point
                lng = parseFloat(coords[0][0]) || 0;
                lat = parseFloat(coords[0][1]) || 0;
              } else {
                // Point - direct coordinates
                lng = parseFloat(coords[0]) || 0;
                lat = parseFloat(coords[1]) || 0;
              }
            }
          }

          const locationText = props.road_names ? props.road_names.join(', ') : 'I-80';

          // Only include events on interstate highways
          if (isInterstateRoute(locationText)) {
            normalized.push({
              id: `UT-${props.road_event_id || Math.random().toString(36).substr(2, 9)}`,
              state: 'Utah',
              corridor: extractCorridor(locationText),
              eventType: props.event_type || 'Construction',
              description: props.description || 'Work zone',
              location: locationText,
              county: props.county || 'Unknown',
              latitude: lat,
              longitude: lng,
              startTime: props.start_date || new Date().toISOString(),
              endTime: props.end_date || null,
              lanesAffected: props.lanes?.[0]?.status || 'Check conditions',
              severity: props.event_status === 'active' ? 'medium' : 'low',
              direction: props.direction || 'Both',
              requiresCollaboration: false
            });
          }
        });
      }

      // Generic WZDx handling for all other states
      const apiType = API_CONFIG[Object.keys(API_CONFIG).find(k => API_CONFIG[k].name === stateName)]?.apiType;
      console.log(`${stateName}: apiType=${apiType}, hasFeatures=${!!rawData.features}, featuresLength=${rawData.features?.length}`);

      if (stateName !== 'Utah' && apiType === 'WZDx' && rawData.features) {
        console.log(`${stateName}: Processing ${rawData.features.length} WZDx features`);

        rawData.features.forEach(feature => {
          const props = feature.properties;

          // WZDx v4+ uses core_details, older versions have fields directly on properties
          const coreDetails = props.core_details || props;

          let lat = 0;
          let lng = 0;

          // Extract coordinates based on geometry type
          if (feature.geometry?.coordinates) {
            const coords = feature.geometry.coordinates;

            // Check if it's a LineString (array of points) or Point
            if (Array.isArray(coords) && coords.length > 0) {
              if (Array.isArray(coords[0])) {
                // LineString - take first point
                lng = parseFloat(coords[0][0]) || 0;
                lat = parseFloat(coords[0][1]) || 0;
              } else {
                // Point - direct coordinates
                lng = parseFloat(coords[0]) || 0;
                lat = parseFloat(coords[1]) || 0;
              }
            }
          }

          // Extract road names from core_details or properties
          const roadNames = coreDetails.road_names || props.road_names || [];
          const locationText = Array.isArray(roadNames) && roadNames.length > 0
            ? roadNames.join(', ')
            : (coreDetails.name || props.name || 'Unknown location');

          // Get state abbreviation from stateName
          const stateAbbr = stateName.toUpperCase().substring(0, 2);

          // Only include events on interstate highways
          if (isInterstateRoute(locationText)) {
            // Extract event ID from core_details or feature id
            const eventId = coreDetails.road_event_id || props.road_event_id || feature.id || Math.random().toString(36).substr(2, 9);

            normalized.push({
              id: `${stateAbbr}-${eventId}`,
              state: stateName,
              corridor: extractCorridor(locationText),
              eventType: coreDetails.event_type || props.event_type || 'work-zone',
              description: coreDetails.description || props.description || 'Work zone',
              location: locationText,
              county: props.county || 'Unknown',
              latitude: lat,
              longitude: lng,
              startTime: props.start_date || coreDetails.start_date || new Date().toISOString(),
              endTime: props.end_date || coreDetails.end_date || null,
              lanesAffected: props.vehicle_impact || 'Check conditions',
              severity: (props.vehicle_impact === 'all-lanes-open') ? 'low' : 'medium',
              direction: coreDetails.direction || props.direction || 'Both',
              requiresCollaboration: false
            });
          }
        });

        console.log(`${stateName}: Normalized ${normalized.length} WZDx events`);
      }
    } 
    else if (format === 'xml') {
      // Debug: Log XML structure
      console.log(`${stateName}: XML root keys:`, Object.keys(rawData));
      if (rawData.FEUMessages) {
        console.log(`${stateName}: FEUMessages keys:`, Object.keys(rawData.FEUMessages));
      }

      // Handle FEU-G XML feeds (CARS Program) - uses FEUMessages root with namespace
      if (rawData.FEUMessages?.['feu:full-event-update']) {
        const feuUpdate = rawData.FEUMessages['feu:full-event-update'];

        // Events are in feu:full-event-update array
        if (feuUpdate && Array.isArray(feuUpdate)) {
          console.log(`${stateName}: Found ${feuUpdate.length} FEU updates`);

          // Log first update structure to see field names
          if (feuUpdate.length > 0) {
            console.log(`${stateName}: First update keys:`, Object.keys(feuUpdate[0]));
            console.log(`${stateName}: First update sample:`, JSON.stringify(feuUpdate[0], null, 2).substring(0, 3000));
          }

          feuUpdate.forEach((update, index) => {
            // Extract event ID
            const eventId = update['event-reference']?.['event-id'] || 'unknown';

            // Extract headline
            const headlineObj = update.headline?.headline || {};
            const headlineText = extractTextValue(headlineObj) || 'Unknown';

            // Extract details
            const detail = update.details?.detail;

            // Log first detail structure
            if (index === 0 && detail) {
              console.log(`${stateName}: Detail keys:`, Object.keys(detail));
              if (detail.location) {
                console.log(`${stateName}: Location structure:`, JSON.stringify(detail.location, null, 2));
              }
            }

            // Extract coordinates from primary location
            let lat = 0;
            let lng = 0;

            const locationOnLink = detail?.locations?.location?.['location-on-link'];
            if (locationOnLink) {
              const primaryLoc = locationOnLink['primary-location']?.['geo-location'];
              if (primaryLoc) {
                // Coordinates are in microdegrees - divide by 1,000,000
                lat = parseFloat(primaryLoc.latitude) / 1000000 || 0;
                lng = parseFloat(primaryLoc.longitude) / 1000000 || 0;
              }
            }

            // Extract description
            const descriptions = detail?.descriptions?.description || [];
            const descArray = Array.isArray(descriptions) ? descriptions : [descriptions];
            const descParts = descArray
              .map(d => {
                const phrase = d.phrase || d;
                return extractTextValue(phrase);
              })
              .filter(text => text && text.trim().length > 0); // Remove empty strings
            const descText = descParts.length > 0
              ? descParts.join('; ')
              : 'Event description not available';

            // Extract location/roadway name
            let locationText = 'Location not specified';

            // Try route-designator from location-on-link
            const routeDesignator = locationOnLink?.['route-designator'];
            if (routeDesignator) {
              locationText = routeDesignator;
            }

            // Also try roadway-names if available
            const roadwayNames = detail?.['roadway-names']?.['roadway-name'] || [];
            if (roadwayNames && roadwayNames.length > 0) {
              const roadwayArray = Array.isArray(roadwayNames) ? roadwayNames : [roadwayNames];
              const roadwayText = roadwayArray.map(r => r._ || r).join(', ');
              if (roadwayText) locationText = roadwayText;
            }

            // Only include events on interstate highways
            if (isInterstateRoute(locationText)) {
              const corridor = extractCorridor(locationText);
              normalized.push({
                id: `${stateName.substring(0, 2).toUpperCase()}-${eventId}`,
                state: stateName,
                corridor: corridor,
                eventType: determineEventType(headlineText, descText),
                description: descText,
                location: locationText,
                county: 'Unknown',
                latitude: lat,
                longitude: lng,
                startTime: detail?.['event-times']?.['start-time'] || new Date().toISOString(),
                endTime: detail?.['event-times']?.['end-time'] || null,
                lanesAffected: extractLaneInfo(descText, headlineText),
                severity: determineSeverityFromText(descText, headlineText),
                direction: extractDirection(descText, headlineText, corridor, lat, lng),
                requiresCollaboration: false
              });
            }
          });
        }
      }
      // Handle RSS feeds (New Jersey)
      else if (rawData.rss?.channel?.item) {
        const items = Array.isArray(rawData.rss.channel.item)
          ? rawData.rss.channel.item
          : [rawData.rss.channel.item];

        items.forEach(item => {
          const description = item.description || '';
          const title = item.title || '';

          // Try to extract location info
          const latMatch = description.match(/Lat:\s*([-\d.]+)/i);
          const lonMatch = description.match(/Lon:\s*([-\d.]+)/i);
          const locationText = extractLocation(description, title);

          // Only include events on interstate highways
          if (isInterstateRoute(locationText)) {
            const corridor = extractCorridor(locationText);
            const lat = latMatch ? parseFloat(latMatch[1]) : 0;
            const lon = lonMatch ? parseFloat(lonMatch[1]) : 0;

            normalized.push({
              id: `${stateName.substring(0, 2).toUpperCase()}-${Math.random().toString(36).substr(2, 9)}`,
              state: stateName,
              corridor: corridor,
              eventType: determineEventType(title),
              description: title || description,
              location: locationText,
              county: 'Unknown',
              latitude: lat,
              longitude: lon,
              startTime: item.pubDate || new Date().toISOString(),
              endTime: null,
              lanesAffected: extractLaneInfo(description, title),
              severity: determineSeverityFromText(description, title),
              direction: extractDirection(description, title, corridor, lat, lon),
              requiresCollaboration: false
            });
          }
        });
      }
    }
  } catch (error) {
    console.error(`Error normalizing ${stateName} data:`, error.message);
  }

  // Apply cross-jurisdictional detection to all events
  normalized.forEach(event => {
    event.requiresCollaboration = requiresCrossJurisdictionalResponse(event);
  });

  return normalized;
};

// Helper functions
const determineEventType = (text, description = '') => {
  const lowerText = ((text || '') + ' ' + (description || '')).toLowerCase();

  // Construction patterns
  if (lowerText.includes('construction') ||
      lowerText.includes('work zone') ||
      lowerText.includes('road work') ||
      lowerText.includes('bridge work') ||
      lowerText.includes('maintenance')) {
    return 'Construction';
  }

  // Incident patterns
  if (lowerText.includes('accident') ||
      lowerText.includes('crash') ||
      lowerText.includes('incident') ||
      lowerText.includes('collision') ||
      lowerText.includes('vehicle') ||
      lowerText.includes('stalled')) {
    return 'Incident';
  }

  // Closure patterns
  if (lowerText.includes('closure') ||
      lowerText.includes('closed') ||
      lowerText.includes('blocked') ||
      lowerText.includes('lane closed') ||
      lowerText.includes('ramp closed')) {
    return 'Closure';
  }

  // Weather patterns
  if (lowerText.includes('weather') ||
      lowerText.includes('snow') ||
      lowerText.includes('ice') ||
      lowerText.includes('seasonal') ||
      lowerText.includes('winter') ||
      lowerText.includes('conditions') ||
      lowerText.includes('fog') ||
      lowerText.includes('rain') ||
      lowerText.includes('wind')) {
    return 'Weather';
  }

  return 'Construction'; // Default to construction instead of Unknown
};

const determineSeverity = (item) => {
  if (item.severity) return item.severity.toLowerCase();
  if (item.closed || item.event_category === 'CLOSURE') return 'high';
  if (item.event_category === 'INCIDENT' || item.event_category === 'ACCIDENT') return 'high';
  if (item.event_category === 'CONSTRUCTION') return 'medium';
  return 'low';
};

const determineSeverityFromText = (description, title) => {
  const text = ((description || '') + ' ' + (title || '')).toLowerCase();
  if (text.includes('closed') || text.includes('blocked')) return 'high';
  if (text.includes('accident') || text.includes('crash')) return 'high';
  return 'medium';
};

const extractLocation = (description, title) => {
  const text = (description || '') + ' ' + (title || '');
  const i80Match = text.match(/I-?80[^\w]*([A-Z]+)?[^\w]*(MM\s*\d+)?/i);
  const i35Match = text.match(/I-?35[^\w]*([A-Z]+)?[^\w]*(MM\s*\d+)?/i);
  
  if (i80Match) return i80Match[0];
  if (i35Match) return i35Match[0];
  
  return 'Location TBD';
};

const extractLaneInfo = (description, title = '') => {
  const text = ((description || '') + ' ' + (title || '')).toLowerCase();

  // Specific lane mentions
  if (text.includes('left lane') && (text.includes('closed') || text.includes('blocked'))) {
    return 'Left lane closed';
  }
  if (text.includes('right lane') && (text.includes('closed') || text.includes('blocked'))) {
    return 'Right lane closed';
  }
  if (text.includes('center lane') && (text.includes('closed') || text.includes('blocked'))) {
    return 'Center lane closed';
  }
  if (text.includes('middle lane') && (text.includes('closed') || text.includes('blocked'))) {
    return 'Center lane closed';
  }

  // Shoulder closures
  if (text.includes('both shoulders closed') || text.includes('shoulders closed')) {
    return 'Both shoulders closed';
  }
  if (text.includes('left shoulder') && (text.includes('closed') || text.includes('blocked'))) {
    return 'Left shoulder closed';
  }
  if (text.includes('right shoulder') && (text.includes('closed') || text.includes('blocked'))) {
    return 'Right shoulder closed';
  }
  if (text.includes('shoulder') && (text.includes('closed') || text.includes('blocked'))) {
    return 'Shoulder closed';
  }

  // Ramp closures
  if (text.includes('entrance ramp') && text.includes('closed')) {
    return 'Entrance ramp closed';
  }
  if (text.includes('exit ramp') && text.includes('closed')) {
    return 'Exit ramp closed';
  }
  if (text.includes('ramp') && text.includes('closed')) {
    return 'Ramp closed';
  }

  // Multiple lanes
  const laneMatch = text.match(/(\d+)\s*lane[s]?\s*(closed|blocked|affected)/i);
  if (laneMatch) return `${laneMatch[1]} lane(s) ${laneMatch[2]}`;

  // All lanes
  if (text.includes('all lanes') && (text.includes('closed') || text.includes('blocked'))) {
    return 'All lanes closed';
  }

  // Single lane without specification
  if ((text.includes('lane closed') || text.includes('lane blocked')) && !text.includes('no lane')) {
    return '1 lane closed';
  }

  return 'Check conditions';
};

const extractDirection = (description, title, corridor = '', latitude = 0, longitude = 0) => {
  const text = ((description || '') + ' ' + (title || '')).toLowerCase();

  // First try to extract from text
  if (text.includes('eastbound') || text.includes('eb')) return 'Eastbound';
  if (text.includes('westbound') || text.includes('wb')) return 'Westbound';
  if (text.includes('northbound') || text.includes('nb')) return 'Northbound';
  if (text.includes('southbound') || text.includes('sb')) return 'Southbound';

  // If we have valid coordinates and corridor info, try to determine from GPS
  if (latitude !== 0 && longitude !== 0 && corridor) {
    // I-80 runs East-West
    if (corridor.includes('I-80') || corridor.includes('I-70')) {
      // Approximate centerlines for I-80 across different states
      const centerlines = {
        'Nevada': 40.8,      // I-80 through Nevada ~40.8°N
        'Utah': 40.8,        // I-80 through Utah ~40.8°N
        'Wyoming': 41.2,     // I-80 through Wyoming ~41.2°N
        'Nebraska': 41.0,    // I-80 through Nebraska ~41.0°N
        'Iowa': 41.6,        // I-80 through Iowa ~41.6°N
        'Indiana': 41.6,     // I-80 through Indiana ~41.6°N
        'Ohio': 41.1,        // I-80 through Ohio ~41.1°N
        'New Jersey': 40.9   // I-80 through New Jersey ~40.9°N
      };

      // Determine state from description or use default
      let centerLat = 41.0; // Default centerline
      for (const [state, lat] of Object.entries(centerlines)) {
        if (text.includes(state.toLowerCase()) || description.includes(state) || title.includes(state)) {
          centerLat = lat;
          break;
        }
      }

      // North of centerline = Westbound, South of centerline = Eastbound
      // Add small buffer zone (0.01° ~= 0.7 miles) to avoid false assignments
      if (latitude > centerLat + 0.005) return 'Westbound';
      if (latitude < centerLat - 0.005) return 'Eastbound';
    }

    // I-35 runs North-South
    else if (corridor.includes('I-35')) {
      // Approximate centerlines for I-35 across different states
      const centerlines = {
        'Minnesota': -93.2,  // I-35 through Minnesota ~93.2°W
        'Iowa': -93.6,       // I-35 through Iowa ~93.6°W
        'Kansas': -95.7      // I-35 through Kansas ~95.7°W
      };

      // Determine state from description or use default
      let centerLon = -93.6; // Default centerline
      for (const [state, lon] of Object.entries(centerlines)) {
        if (text.includes(state.toLowerCase()) || description.includes(state) || title.includes(state)) {
          centerLon = lon;
          break;
        }
      }

      // West of centerline = Southbound, East of centerline = Northbound
      // Add small buffer zone (0.01° ~= 0.7 miles) to avoid false assignments
      if (longitude < centerLon - 0.005) return 'Southbound';
      if (longitude > centerLon + 0.005) return 'Northbound';
    }
  }

  return 'Both';
};

// Check if a route is an interstate highway (I-XX format)
const isInterstateRoute = (locationText) => {
  if (!locationText) return false;

  // Match patterns like "I-80", "I 80", "Interstate 80", etc.
  // Avoid state routes like "KS 156", "US 30", "MN 55"
  const interstatePattern = /\b(I-?\d{1,3}|Interstate\s+\d{1,3})\b/i;
  const stateRoutePattern = /\b(US|SR|KS|NE|IA|IN|MN|UT|NV|OH|NJ)\s*[-\s]?\d+\b/i;

  // Must match interstate pattern and NOT match state route pattern
  return interstatePattern.test(locationText) && !stateRoutePattern.test(locationText);
};

// Detect if an event requires cross-jurisdictional collaboration
const requiresCrossJurisdictionalResponse = (event) => {
  const text = `${event.location || ''} ${event.description || ''}`.toLowerCase();

  // 1. Check for explicit state line/border mentions
  if (text.includes('state line') ||
      text.includes('state border') ||
      text.includes('border') ||
      text.includes('multi-state') ||
      text.includes('cross-state')) {
    return true;
  }

  // 2. Check for mentions of multiple states in description
  const stateNames = ['iowa', 'kansas', 'nebraska', 'indiana', 'minnesota',
                      'utah', 'nevada', 'ohio', 'new jersey', 'illinois',
                      'wyoming', 'missouri', 'wisconsin', 'michigan', 'pennsylvania'];
  const mentionedStates = stateNames.filter(state => text.includes(state));
  if (mentionedStates.length > 1) {
    return true;
  }

  // 3. Check for major closures (high severity + closure type)
  // These could significantly impact traffic in neighboring states
  if ((event.eventType === 'Closure' || text.includes('closed')) &&
      event.severity === 'high') {

    // Extract milepost if available
    const mmMatch = text.match(/\bmm\s*(\d+)/i);
    if (mmMatch) {
      const milepost = parseInt(mmMatch[1]);

      // Check if near likely state borders (very low or very high mileposts)
      // Most interstate state crossings are at extreme mileposts
      if (milepost <= 10 || milepost >= 400) {
        return true;
      }
    }
  }

  // 4. Check for specific border locations
  // I-80: NE/IA border, NE/WY border, IA/IL border, IN/OH border, OH/PA border, UT/NV border
  // I-35: MN/IA border, IA/MO border, KS/OK border
  const borderKeywords = ['welcome center', 'rest area near', 'entering', 'leaving'];
  if (borderKeywords.some(keyword => text.includes(keyword)) &&
      (event.eventType === 'Closure' || event.severity === 'high')) {
    return true;
  }

  return false;
};

// Fetch data from a single state
const fetchStateData = async (stateKey) => {
  const config = API_CONFIG[stateKey];
  const results = { state: config.name, events: [], errors: [] };
  
  try {
    if (config.format === 'json') {
      // Fetch JSON data
      const headers = {};
      if (config.apiKey) {
        // Ohio uses "APIKEY {key}" format, Nevada uses "Bearer {key}"
        const authFormat = config.name === 'Ohio' ? 'APIKEY' : 'Bearer';
        headers['Authorization'] = `${authFormat} ${config.apiKey}`;
      }
      
      // Fetch events
      if (config.eventsUrl) {
        try {
          const response = await axios.get(config.eventsUrl, { 
            headers,
            timeout: 10000 
          });
          const normalized = normalizeEventData(response.data, config.name, 'json', 'events');
          results.events.push(...normalized);
        } catch (error) {
          results.errors.push(`Events: ${error.message}`);
        }
      }
      
      // Fetch incidents if available (Ohio)
      if (config.incidentsUrl) {
        try {
          const response = await axios.get(config.incidentsUrl, { 
            headers,
            timeout: 10000 
          });
          const normalized = normalizeEventData(response.data, config.name, 'json', 'incidents');
          results.events.push(...normalized);
        } catch (error) {
          results.errors.push(`Incidents: ${error.message}`);
        }
      }
      
      // Fetch WZDX if available
      if (config.wzdxUrl) {
        try {
          const response = await axios.get(config.wzdxUrl, { timeout: 10000 });
          const normalized = normalizeEventData(response.data, config.name, 'json', 'wzdx');
          results.events.push(...normalized);
        } catch (error) {
          results.errors.push(`WZDX: ${error.message}`);
        }
      }
    } 
    else if (config.format === 'xml') {
      // Fetch XML data with authentication if needed
      const axiosConfig = { timeout: 10000 };
      
      if (config.username && config.password) {
        axiosConfig.auth = {
          username: config.username,
          password: config.password
        };
      }
      
      if (config.eventsUrl) {
        try {
          const response = await axios.get(config.eventsUrl, axiosConfig);
          const parsed = await parseXML(response.data);
          const normalized = normalizeEventData(parsed, config.name, 'xml');
          results.events.push(...normalized);
        } catch (error) {
          results.errors.push(`Events: ${error.message}`);
        }
      }
      
      if (config.wzdxUrl) {
        try {
          const response = await axios.get(config.wzdxUrl, axiosConfig);
          const parsed = await parseXML(response.data);
          const normalized = normalizeEventData(parsed, config.name, 'xml');
          results.events.push(...normalized);
        } catch (error) {
          results.errors.push(`WZDX: ${error.message}`);
        }
      }
    }
  } catch (error) {
    results.errors.push(`General error: ${error.message}`);
  }
  
  return results;
};

// Main endpoint to fetch all events
app.get('/api/events', async (req, res) => {
  console.log('Fetching events from all states...');
  
  const allResults = await Promise.all(
    Object.keys(API_CONFIG).map(stateKey => fetchStateData(stateKey))
  );
  
  const allEvents = [];
  const allErrors = [];
  
  allResults.forEach(result => {
    allEvents.push(...result.events);
    if (result.errors.length > 0) {
      allErrors.push({ state: result.state, errors: result.errors });
    }
  });
  
  console.log(`Fetched ${allEvents.length} total events`);
  console.log(`Errors from ${allErrors.length} state(s)`);
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    totalEvents: allEvents.length,
    events: allEvents,
    errors: allErrors
  });
});

// Endpoint to fetch from a specific state
app.get('/api/events/:state', async (req, res) => {
  const stateKey = req.params.state.toLowerCase();
  
  if (!API_CONFIG[stateKey]) {
    return res.status(404).json({ error: 'State not found' });
  }
  
  console.log(`Fetching events from ${API_CONFIG[stateKey].name}...`);
  const result = await fetchStateData(stateKey);
  
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    state: result.state,
    totalEvents: result.events.length,
    events: result.events,
    errors: result.errors
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    states: Object.keys(API_CONFIG).length
  });
});

// Debug endpoint to check coordinate extraction
app.get('/api/debug/coordinates', async (req, res) => {
  const allResults = await Promise.all(
    Object.keys(API_CONFIG).map(stateKey => fetchStateData(stateKey))
  );

  const stats = {};
  allResults.forEach(result => {
    const validCoords = result.events.filter(e =>
      e.latitude && e.longitude && e.latitude !== 0 && e.longitude !== 0
    );
    stats[result.state] = {
      total: result.events.length,
      withCoordinates: validCoords.length,
      withoutCoordinates: result.events.length - validCoords.length,
      sampleEvent: result.events[0],
      sampleValidEvent: validCoords[0] || null
    };
  });

  res.json(stats);
});

// Generate normalization report for all states
app.get('/api/analysis/normalization', async (req, res) => {
  console.log('Generating normalization analysis...');

  const allResults = await Promise.all(
    Object.keys(API_CONFIG).map(stateKey => fetchStateData(stateKey))
  );

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalStates: allResults.length,
      totalEvents: 0,
      statesWithGoodData: 0,
      statesNeedingImprovement: 0
    },
    states: {},
    recommendations: []
  };

  allResults.forEach(result => {
    const stateName = result.state;
    const events = result.events;

    report.summary.totalEvents += events.length;

    // Analyze data quality
    const analysis = {
      eventCount: events.length,
      dataQuality: {
        hasCoordinates: 0,
        hasStartTime: 0,
        hasEndTime: 0,
        hasEventType: 0,
        hasSeverity: 0,
        hasDirection: 0,
        hasLaneInfo: 0,
        hasDescription: 0,
        hasCorridor: 0
      },
      missingFields: [],
      dataCompleteness: 0,
      grade: '',
      issues: [],
      strengths: [],
      recommendations: []
    };

    // Analyze each event
    events.forEach(event => {
      if (event.latitude && event.longitude && event.latitude !== 0 && event.longitude !== 0) {
        analysis.dataQuality.hasCoordinates++;
      }
      if (event.startTime) analysis.dataQuality.hasStartTime++;
      if (event.endTime) analysis.dataQuality.hasEndTime++;
      if (event.eventType && event.eventType !== 'Unknown') analysis.dataQuality.hasEventType++;
      if (event.severity) analysis.dataQuality.hasSeverity++;
      if (event.direction && event.direction !== 'Both') analysis.dataQuality.hasDirection++;
      if (event.lanesAffected && event.lanesAffected !== 'Check conditions' && event.lanesAffected !== 'Unknown') {
        analysis.dataQuality.hasLaneInfo++;
      }
      if (event.description && event.description !== 'Event description not available') {
        analysis.dataQuality.hasDescription++;
      }
      if (event.corridor && event.corridor !== 'Unknown') {
        analysis.dataQuality.hasCorridor++;
      }
    });

    // Calculate percentages
    const total = events.length || 1;
    const scores = {
      coordinates: (analysis.dataQuality.hasCoordinates / total) * 100,
      startTime: (analysis.dataQuality.hasStartTime / total) * 100,
      endTime: (analysis.dataQuality.hasEndTime / total) * 100,
      eventType: (analysis.dataQuality.hasEventType / total) * 100,
      severity: (analysis.dataQuality.hasSeverity / total) * 100,
      direction: (analysis.dataQuality.hasDirection / total) * 100,
      laneInfo: (analysis.dataQuality.hasLaneInfo / total) * 100,
      description: (analysis.dataQuality.hasDescription / total) * 100,
      corridor: (analysis.dataQuality.hasCorridor / total) * 100
    };

    // Overall completeness (weighted average - coordinates and description are most important)
    analysis.dataCompleteness = (
      scores.coordinates * 0.25 +
      scores.description * 0.20 +
      scores.eventType * 0.15 +
      scores.corridor * 0.15 +
      scores.severity * 0.10 +
      scores.startTime * 0.10 +
      scores.direction * 0.05
    );

    // Assign grade
    if (analysis.dataCompleteness >= 90) {
      analysis.grade = 'A';
      report.summary.statesWithGoodData++;
    } else if (analysis.dataCompleteness >= 80) {
      analysis.grade = 'B';
      report.summary.statesWithGoodData++;
    } else if (analysis.dataCompleteness >= 70) {
      analysis.grade = 'C';
      report.summary.statesNeedingImprovement++;
    } else if (analysis.dataCompleteness >= 60) {
      analysis.grade = 'D';
      report.summary.statesNeedingImprovement++;
    } else {
      analysis.grade = 'F';
      report.summary.statesNeedingImprovement++;
    }

    // Identify issues and recommendations
    if (scores.coordinates < 80) {
      analysis.issues.push('Missing or invalid coordinates on many events');
      analysis.recommendations.push('Ensure all events include valid latitude/longitude in decimal degrees format');
    } else {
      analysis.strengths.push('Good coordinate coverage');
    }

    if (scores.description < 70) {
      analysis.issues.push('Insufficient event descriptions');
      analysis.recommendations.push('Include detailed descriptions explaining event impact and conditions');
    } else {
      analysis.strengths.push('Detailed event descriptions');
    }

    if (scores.eventType < 80) {
      analysis.issues.push('Event type classification needs improvement');
      analysis.recommendations.push('Categorize events using standard types: Construction, Incident, Closure, Weather');
    } else {
      analysis.strengths.push('Good event type classification');
    }

    if (scores.corridor < 70) {
      analysis.issues.push('Corridor/route information inconsistent');
      analysis.recommendations.push('Include interstate number in standard format (e.g., I-80, I-35)');
    } else {
      analysis.strengths.push('Clear corridor identification');
    }

    if (scores.laneInfo < 50) {
      analysis.issues.push('Lane closure information often missing');
      analysis.recommendations.push('Specify which lanes are affected and closure type (e.g., "2 lanes closed", "Right shoulder")');
    }

    if (scores.endTime < 40) {
      analysis.issues.push('Estimated end times rarely provided');
      analysis.recommendations.push('Include estimated duration or end time for events when available');
    }

    if (scores.direction < 60) {
      analysis.issues.push('Direction information incomplete');
      analysis.recommendations.push('Specify direction (Northbound, Southbound, Eastbound, Westbound) for each event');
    }

    // Add source format info
    const config = API_CONFIG[Object.keys(API_CONFIG).find(k => API_CONFIG[k].name === stateName)];
    analysis.sourceFormat = config?.format || 'unknown';
    analysis.apiType = config?.wzdxUrl ? 'WZDx' : config?.eventsUrl?.includes('feu-g') ? 'FEU-G' : config?.eventsUrl?.includes('rss') ? 'RSS' : 'Custom JSON';

    // Format-specific recommendations
    if (analysis.apiType === 'FEU-G') {
      analysis.strengths.push('Using CARS Program FEU-G standard format');
    } else if (analysis.apiType === 'WZDx') {
      analysis.strengths.push('Using WZDx (Work Zone Data Exchange) standard format');
    } else {
      analysis.recommendations.push('Consider migrating to WZDx standard format for better interoperability');
    }

    report.states[stateName] = {
      ...analysis,
      percentages: scores
    };
  });

  // Overall recommendations
  report.recommendations = [
    {
      priority: 'High',
      category: 'Data Standardization',
      recommendation: 'Adopt WZDx (Work Zone Data Exchange) format across all states for maximum interoperability',
      benefit: 'Enables seamless data sharing between states and with third-party applications'
    },
    {
      priority: 'High',
      category: 'Coordinate Quality',
      recommendation: 'Ensure all events include valid GPS coordinates in WGS84 decimal degree format',
      benefit: 'Enables accurate mapping and geofencing for cross-state coordination'
    },
    {
      priority: 'Medium',
      category: 'Event Classification',
      recommendation: 'Standardize event types using SAE J2735 categories or WZDx event types',
      benefit: 'Consistent categorization improves filtering and automated alerting'
    },
    {
      priority: 'Medium',
      category: 'Temporal Data',
      recommendation: 'Always include event start time and estimated end time in ISO 8601 format',
      benefit: 'Enables better planning and real-time traveler information systems'
    },
    {
      priority: 'Low',
      category: 'Lane Information',
      recommendation: 'Specify lane closures using standard format (lane number, type, status)',
      benefit: 'Helps drivers make informed routing decisions'
    },
    {
      priority: 'Low',
      category: 'Cross-State Collaboration',
      recommendation: 'Flag events within 20 miles of state borders for automatic cross-state notification',
      benefit: 'Improves coordination on interstate corridors'
    }
  ];

  res.json(report);
});

// Convert events to SAE J2735-style Traveler Information Messages
app.get('/api/convert/tim', async (req, res) => {
  console.log('Converting events to TIM format...');

  const allResults = await Promise.all(
    Object.keys(API_CONFIG).map(stateKey => fetchStateData(stateKey))
  );

  const allEvents = [];
  allResults.forEach(result => allEvents.push(...result.events));

  // Convert to TIM-style messages
  const timMessages = allEvents.map(event => {
    // Generate VMS-style message (Variable Message Sign text)
    const vmsMessage = generateVMSMessage(event);

    // Generate full TIM structure (simplified version of SAE J2735)
    return {
      msgCnt: Math.floor(Math.random() * 127), // Message count
      timeStamp: new Date(event.startTime).toISOString(),
      packetID: event.id,
      urlB: null,
      dataFrames: [
        {
          startTime: event.startTime,
          durationTime: event.endTime ? Math.floor((new Date(event.endTime) - new Date(event.startTime)) / 60000) : null, // minutes
          priority: event.severity === 'high' ? 0 : event.severity === 'medium' ? 1 : 2,
          regions: [
            {
              name: event.state,
              anchorPosition: {
                lat: event.latitude,
                long: event.longitude,
                elevation: null
              },
              laneWidth: null,
              directionality: event.direction,
              closedPath: false,
              direction: event.direction,
              description: event.corridor
            }
          ],
          content: {
            advisory: {
              item: {
                itis: getITISCode(event.eventType), // ITIS code (ISO 14823)
                text: vmsMessage
              }
            },
            workZone: event.eventType === 'Construction' ? {
              workersPresent: true,
              speedLimit: null
            } : null,
            incident: ['Incident', 'Closure'].includes(event.eventType) ? {
              eventType: event.eventType,
              description: event.description
            } : null
          }
        }
      ],
      // VMS display message
      vmsMessage: vmsMessage,
      // WZDx compatibility
      wzdx_event_type: mapToWZDxEventType(event.eventType),
      original_event: event
    };
  });

  res.json({
    format: 'SAE J2735 TIM (Traveler Information Message)',
    timestamp: new Date().toISOString(),
    messageCount: timMessages.length,
    messages: timMessages
  });
});

// Helper: Generate VMS-style message text (for highway signs)
const generateVMSMessage = (event) => {
  const messages = [];

  // Line 1: Event type and severity
  if (event.severity === 'high') {
    messages.push(`*** ${event.eventType.toUpperCase()} ***`);
  } else {
    messages.push(event.eventType.toUpperCase());
  }

  // Line 2: Location
  const locationShort = event.location.substring(0, 40);
  messages.push(locationShort);

  // Line 3: Impact
  if (event.lanesAffected && event.lanesAffected !== 'Check conditions' && event.lanesAffected !== 'Unknown') {
    messages.push(event.lanesAffected.toUpperCase());
  } else if (event.eventType === 'Closure') {
    messages.push('ROAD CLOSED');
  } else {
    messages.push('USE CAUTION');
  }

  // Line 4: Direction or advice
  if (event.direction && event.direction !== 'Both') {
    messages.push(`${event.direction.toUpperCase()} ONLY`);
  }

  return messages.join(' / ');
};

// Helper: Get ITIS code (Incident Traffic Information Standard)
const getITISCode = (eventType) => {
  const itisCodes = {
    'Construction': 8963, // Road work
    'Incident': 769,      // Incident
    'Closure': 773,       // Road closure
    'Weather': 8704       // Winter weather conditions
  };
  return itisCodes[eventType] || 0;
};

// Helper: Map to WZDx event types
const mapToWZDxEventType = (eventType) => {
  const mapping = {
    'Construction': 'work-zone',
    'Incident': 'incident',
    'Closure': 'restriction',
    'Weather': 'weather-condition'
  };
  return mapping[eventType] || 'work-zone';
};

// ==================== SAE COMPLIANCE GUIDE ENDPOINTS ====================

// Generate state-specific SAE J2735 compliance guide
app.get('/api/compliance/guide/:state', async (req, res) => {
  const stateKey = req.params.state.toLowerCase();

  // Get state from database
  const stateConfig = db.getState(stateKey);
  if (!stateConfig) {
    return res.status(404).json({ error: 'State not found' });
  }

  console.log(`Generating SAE J2735 compliance guide for ${stateConfig.stateName}...`);
  const result = await fetchStateData(stateKey);

  // Build config object compatible with the rest of the code
  const config = {
    name: stateConfig.stateName,
    format: stateConfig.format,
    wzdxUrl: stateConfig.apiType === 'WZDx' ? stateConfig.apiUrl : null,
    eventsUrl: stateConfig.apiType !== 'WZDx' ? stateConfig.apiUrl : null,
    apiType: stateConfig.apiType
  };

  // Get a sample event to demonstrate transformation
  const sampleEvent = result.events[0];

  // Analyze the state's data quality
  const analysis = {
    hasCoordinates: 0,
    hasStartTime: 0,
    hasEndTime: 0,
    hasEventType: 0,
    hasSeverity: 0,
    hasDirection: 0,
    hasLaneInfo: 0,
    hasDescription: 0
  };

  result.events.forEach(event => {
    if (event.latitude && event.longitude && event.latitude !== 0 && event.longitude !== 0) {
      analysis.hasCoordinates++;
    }
    if (event.startTime) analysis.hasStartTime++;
    if (event.endTime) analysis.hasEndTime++;
    if (event.eventType && event.eventType !== 'Unknown') analysis.hasEventType++;
    if (event.severity) analysis.hasSeverity++;
    if (event.direction && event.direction !== 'Both') analysis.hasDirection++;
    if (event.lanesAffected && event.lanesAffected !== 'Check conditions') analysis.hasLaneInfo++;
    if (event.description) analysis.hasDescription++;
  });

  const total = result.events.length || 1;
  const completeness = {
    coordinates: Math.round((analysis.hasCoordinates / total) * 100),
    startTime: Math.round((analysis.hasStartTime / total) * 100),
    endTime: Math.round((analysis.hasEndTime / total) * 100),
    eventType: Math.round((analysis.hasEventType / total) * 100),
    severity: Math.round((analysis.hasSeverity / total) * 100),
    direction: Math.round((analysis.hasDirection / total) * 100),
    laneInfo: Math.round((analysis.hasLaneInfo / total) * 100),
    description: Math.round((analysis.hasDescription / total) * 100)
  };

  // Generate SAE J2735 TIM from sample event
  const timExample = sampleEvent ? {
    msgCnt: 1,
    timeStamp: new Date(sampleEvent.startTime).toISOString(),
    packetID: sampleEvent.id,
    dataFrames: [{
      startTime: sampleEvent.startTime,
      durationTime: sampleEvent.endTime ? Math.floor((new Date(sampleEvent.endTime) - new Date(sampleEvent.startTime)) / 60000) : null,
      priority: sampleEvent.severity === 'high' ? 0 : sampleEvent.severity === 'medium' ? 1 : 2,
      regions: [{
        name: sampleEvent.state,
        anchorPosition: {
          lat: sampleEvent.latitude,
          long: sampleEvent.longitude,
          elevation: null
        },
        directionality: sampleEvent.direction,
        description: sampleEvent.corridor
      }],
      content: {
        advisory: {
          item: {
            itis: getITISCode(sampleEvent.eventType),
            text: generateVMSMessage(sampleEvent)
          }
        },
        workZone: sampleEvent.eventType === 'Construction' ? {
          workersPresent: true,
          speedLimit: null
        } : null
      }
    }]
  } : null;

  // Build compliance guide
  const guide = {
    state: config.name,
    generatedAt: new Date().toISOString(),
    currentFormat: {
      type: config.format,
      apiType: config.wzdxUrl ? 'WZDx' : config.eventsUrl?.includes('feu-g') ? 'FEU-G' : config.eventsUrl?.includes('rss') ? 'RSS' : 'Custom JSON',
      endpointUrl: config.wzdxUrl || config.eventsUrl
    },
    dataQualityScore: completeness,
    gaps: [],
    recommendations: [],
    transformationSteps: [],
    saeJ2735Example: timExample,
    wzdxMigrationGuide: {
      currentStandard: config.wzdxUrl ? 'Already using WZDx' : (config.eventsUrl?.includes('feu-g') ? 'FEU-G' : 'Custom format'),
      recommendedAction: '',
      benefits: [],
      implementationSteps: []
    }
  };

  // Identify gaps and recommendations
  if (completeness.coordinates < 90) {
    guide.gaps.push({
      field: 'GPS Coordinates',
      currentCoverage: `${completeness.coordinates}%`,
      required: '100%',
      severity: 'HIGH',
      impact: 'Cannot display events on map or determine cross-state boundaries'
    });
    guide.recommendations.push({
      priority: 'HIGH',
      field: 'coordinates',
      recommendation: 'Include latitude and longitude in WGS84 decimal degrees format for all events',
      example: { latitude: 40.7608, longitude: -111.8910 },
      saeJ2735Mapping: 'dataFrames[].regions[].anchorPosition.lat/long'
    });
  }

  if (completeness.eventType < 90) {
    guide.gaps.push({
      field: 'Event Type Classification',
      currentCoverage: `${completeness.eventType}%`,
      required: '100%',
      severity: 'MEDIUM',
      impact: 'Reduces ability to categorize and filter events'
    });
    guide.recommendations.push({
      priority: 'MEDIUM',
      field: 'eventType',
      recommendation: 'Classify all events using standard types',
      allowedValues: ['Construction', 'Incident', 'Closure', 'Weather'],
      saeJ2735Mapping: 'ITIS codes - Construction: 8963, Incident: 769, Closure: 773, Weather: 8704',
      wzdxMapping: 'work-zone, incident, restriction, weather-condition'
    });
  }

  if (completeness.direction < 70) {
    guide.gaps.push({
      field: 'Direction Information',
      currentCoverage: `${completeness.direction}%`,
      required: '95%',
      severity: 'MEDIUM',
      impact: 'Cannot determine which direction of travel is affected'
    });
    guide.recommendations.push({
      priority: 'MEDIUM',
      field: 'direction',
      recommendation: 'Specify direction for each event',
      allowedValues: ['Northbound', 'Southbound', 'Eastbound', 'Westbound', 'Both'],
      saeJ2735Mapping: 'dataFrames[].regions[].directionality'
    });
  }

  if (completeness.laneInfo < 60) {
    guide.gaps.push({
      field: 'Lane Closure Details',
      currentCoverage: `${completeness.laneInfo}%`,
      required: '80%',
      severity: 'LOW',
      impact: 'Drivers cannot assess severity or plan lane changes'
    });
    guide.recommendations.push({
      priority: 'LOW',
      field: 'lanesAffected',
      recommendation: 'Specify which lanes are closed or affected',
      examples: ['Left lane closed', 'Right shoulder closed', '2 lanes closed', 'All lanes closed'],
      saeJ2735Mapping: 'Encoded in advisory text content'
    });
  }

  if (completeness.endTime < 50) {
    guide.gaps.push({
      field: 'End Time / Duration',
      currentCoverage: `${completeness.endTime}%`,
      required: '70%',
      severity: 'LOW',
      impact: 'Cannot estimate when conditions will improve'
    });
    guide.recommendations.push({
      priority: 'LOW',
      field: 'endTime',
      recommendation: 'Include estimated end time in ISO 8601 format',
      example: '2025-10-18T18:00:00Z',
      saeJ2735Mapping: 'dataFrames[].durationTime (in minutes)'
    });
  }

  // WZDx migration guide
  if (!config.wzdxUrl) {
    guide.wzdxMigrationGuide.recommendedAction = 'Migrate to WZDx v4.x for full SAE J2735 compatibility';
    guide.wzdxMigrationGuide.benefits = [
      'Standardized format adopted by USDOT and multiple states',
      'Native support for work zones, incidents, and restrictions',
      'Better interoperability with third-party navigation apps',
      'Easier integration into connected vehicle systems',
      'Built-in support for lane-level detail and geometry'
    ];
    guide.wzdxMigrationGuide.implementationSteps = [
      {
        step: 1,
        title: 'Review WZDx specification',
        description: 'Study WZDx v4.x specification at https://github.com/usdot-jpo-ode/wzdx',
        estimatedTime: '1-2 weeks'
      },
      {
        step: 2,
        title: 'Map existing fields to WZDx schema',
        description: `Your current ${guide.currentFormat.apiType} format fields should be mapped to WZDx FeatureCollection structure`,
        estimatedTime: '1 week'
      },
      {
        step: 3,
        title: 'Implement WZDx feed generation',
        description: 'Create endpoint that outputs GeoJSON FeatureCollection with WZDx properties',
        estimatedTime: '2-4 weeks'
      },
      {
        step: 4,
        title: 'Validate against WZDx schema',
        description: 'Use WZDx JSON schema validator to ensure compliance',
        estimatedTime: '1 week'
      },
      {
        step: 5,
        title: 'Register feed with USDOT',
        description: 'Submit WZDx feed URL to USDOT Work Zone Data Exchange registry',
        estimatedTime: '1 week'
      }
    ];
  } else {
    guide.wzdxMigrationGuide.recommendedAction = 'Already using WZDx - ensure compliance with latest v4.x spec';
    guide.wzdxMigrationGuide.benefits = ['Maintaining industry-leading data standard'];
    guide.wzdxMigrationGuide.implementationSteps = [
      {
        step: 1,
        title: 'Validate current WZDx feed',
        description: 'Ensure feed validates against latest WZDx v4.x JSON schema',
        estimatedTime: '1 week'
      }
    ];
  }

  // Transformation steps based on current format
  if (guide.currentFormat.apiType === 'FEU-G') {
    guide.transformationSteps = [
      {
        step: 'Extract coordinates',
        from: 'details.locations.location.location-on-link.primary-location.geo-location (microdegrees)',
        to: 'Divide by 1,000,000 to get decimal degrees',
        example: { from: '40760800', to: '40.7608' }
      },
      {
        step: 'Extract event type',
        from: 'headline.headline text',
        to: 'Parse keywords (construction, incident, closure, weather) and map to standard types',
        example: { from: 'ROAD WORK', to: 'Construction' }
      },
      {
        step: 'Extract location',
        from: 'details.locations.location.location-on-link.route-designator',
        to: 'Parse interstate number (e.g., I-80, I-35)',
        example: { from: 'I 80', to: 'I-80' }
      }
    ];
  } else if (guide.currentFormat.apiType === 'RSS') {
    guide.transformationSteps = [
      {
        step: 'Extract coordinates',
        from: 'item.description text with "Lat: X, Lon: Y" pattern',
        to: 'Parse using regex and convert to decimal degrees',
        example: { from: 'Lat: 40.7608 Lon: -111.8910', to: { lat: 40.7608, lon: -111.8910 } }
      },
      {
        step: 'Extract event details',
        from: 'item.title and item.description',
        to: 'Parse for event type, location, and lane information',
        example: { from: 'I-80 EB accident at MM 123', to: { corridor: 'I-80', direction: 'Eastbound', type: 'Incident' } }
      }
    ];
  } else if (guide.currentFormat.apiType === 'WZDx') {
    guide.transformationSteps = [
      {
        step: 'Already WZDx compliant',
        from: 'GeoJSON FeatureCollection with WZDx properties',
        to: 'Directly compatible with SAE J2735 TIM via conversion layer',
        example: { note: 'No transformation needed - WZDx is SAE J2735 compatible' }
      }
    ];
  }

  // Add C2C/ngTMDD compliance check
  const c2cCompliance = {
    hasUniqueEventId: sampleEvent && sampleEvent.id ? 100 : 0,
    hasOrganizationId: 0, // Not currently in our data model
    hasLinearReference: 0, // Check if we have route + milepost
    hasUpdateTimestamp: completeness.startTime,
    hasEventStatus: completeness.severity >= 90 ? 100 : 0,
    hasGeographicCoords: completeness.coordinates,
    hasDirectionalImpact: completeness.direction,
    hasLaneImpact: completeness.laneInfo
  };

  // Check for linear reference (route + milepost in description)
  if (sampleEvent) {
    const text = (sampleEvent.location + ' ' + sampleEvent.description).toLowerCase();
    const hasRoute = /\b(i-\d+|interstate \d+)\b/.test(text);
    const hasMilepost = /\b(mm|mile|milepost|mp)\s*\d+/i.test(text);
    if (hasRoute && hasMilepost) {
      c2cCompliance.hasLinearReference = 100;
    } else if (hasRoute || hasMilepost) {
      c2cCompliance.hasLinearReference = 50;
    }
  }

  // Calculate C2C compliance percentage
  const c2cScore = Math.round(
    Object.values(c2cCompliance).reduce((sum, val) => sum + val, 0) /
    Object.keys(c2cCompliance).length
  );

  guide.c2cCompliance = {
    score: c2cScore,
    grade: c2cScore >= 80 ? 'PASS' : 'FAIL',
    details: c2cCompliance,
    validationTool: 'C2C-MVT (Center-to-Center Message Validation Tool)',
    standard: 'ngTMDD (Next Generation Traffic Management Data Dictionary)',
    message: c2cScore >= 80
      ? 'Data is ready for center-to-center sharing between DOT TMCs'
      : 'Data needs improvement for reliable C2C communication',
    recommendations: []
  };

  // Add C2C-specific recommendations
  if (c2cCompliance.hasUniqueEventId < 100) {
    guide.c2cCompliance.recommendations.push({
      field: 'Event ID',
      issue: 'Missing unique event identifier',
      solution: 'Assign a unique ID to each event for tracking across TMCs',
      importance: 'HIGH'
    });
  }
  if (c2cCompliance.hasOrganizationId < 100) {
    guide.c2cCompliance.recommendations.push({
      field: 'Organization ID',
      issue: 'Missing TMC/DOT organization identifier',
      solution: 'Include organization code (e.g., "UT-DOT", "IA-DOT") to identify event owner',
      importance: 'MEDIUM'
    });
  }
  if (c2cCompliance.hasLinearReference < 80) {
    guide.c2cCompliance.recommendations.push({
      field: 'Linear Reference',
      issue: 'Missing or incomplete route + milepost information',
      solution: 'Include both interstate route (I-80) and milepost (MM 123) for precise location',
      importance: 'HIGH'
    });
  }

  // Add categorized scoring system
  guide.categoryScores = {
    essential: {
      name: 'Essential Fields (Required for Cross-State Coordination)',
      weight: 50,
      fields: [
        {
          field: 'GPS Coordinates',
          score: completeness.coordinates,
          maxPoints: 25,
          currentPoints: Math.round((completeness.coordinates / 100) * 25),
          impact: completeness.coordinates < 90 ? 'CRITICAL - Cannot map events or detect state borders' : 'Good',
          status: completeness.coordinates >= 90 ? 'PASS' : 'FAIL'
        },
        {
          field: 'Interstate Route',
          score: completeness.corridor || 0,
          maxPoints: 15,
          currentPoints: Math.round(((completeness.corridor || 0) / 100) * 15),
          impact: (completeness.corridor || 0) < 80 ? 'HIGH - Cannot filter by corridor' : 'Good',
          status: (completeness.corridor || 0) >= 80 ? 'PASS' : 'FAIL'
        },
        {
          field: 'Event Description',
          score: completeness.description,
          maxPoints: 10,
          currentPoints: Math.round((completeness.description / 100) * 10),
          impact: completeness.description < 70 ? 'HIGH - Users cannot understand event details' : 'Good',
          status: completeness.description >= 70 ? 'PASS' : 'FAIL'
        }
      ],
      totalScore: 0,
      maxScore: 50,
      percentage: 0
    },
    important: {
      name: 'Important Fields (Improves Situational Awareness)',
      weight: 30,
      fields: [
        {
          field: 'Event Type',
          score: completeness.eventType,
          maxPoints: 10,
          currentPoints: Math.round((completeness.eventType / 100) * 10),
          impact: completeness.eventType < 80 ? 'MEDIUM - Reduces filtering and alerting capability' : 'Good',
          status: completeness.eventType >= 80 ? 'PASS' : 'FAIL'
        },
        {
          field: 'Severity Level',
          score: completeness.severity,
          maxPoints: 10,
          currentPoints: Math.round((completeness.severity / 100) * 10),
          impact: completeness.severity < 80 ? 'MEDIUM - Cannot prioritize high-impact events' : 'Good',
          status: completeness.severity >= 80 ? 'PASS' : 'FAIL'
        },
        {
          field: 'Start Time',
          score: completeness.startTime,
          maxPoints: 10,
          currentPoints: Math.round((completeness.startTime / 100) * 10),
          impact: completeness.startTime < 90 ? 'MEDIUM - Cannot track event timeline' : 'Good',
          status: completeness.startTime >= 90 ? 'PASS' : 'FAIL'
        }
      ],
      totalScore: 0,
      maxScore: 30,
      percentage: 0
    },
    enhanced: {
      name: 'Enhanced Fields (Optimal for Traveler Information)',
      weight: 20,
      fields: [
        {
          field: 'Direction',
          score: completeness.direction,
          maxPoints: 7,
          currentPoints: Math.round((completeness.direction / 100) * 7),
          impact: completeness.direction < 60 ? 'LOW - Travelers cannot determine affected direction' : 'Good',
          status: completeness.direction >= 60 ? 'PASS' : 'FAIL'
        },
        {
          field: 'Lane Information',
          score: completeness.laneInfo,
          maxPoints: 7,
          currentPoints: Math.round((completeness.laneInfo / 100) * 7),
          impact: completeness.laneInfo < 50 ? 'LOW - Cannot assess traffic impact severity' : 'Good',
          status: completeness.laneInfo >= 50 ? 'PASS' : 'FAIL'
        },
        {
          field: 'End Time',
          score: completeness.endTime,
          maxPoints: 6,
          currentPoints: Math.round((completeness.endTime / 100) * 6),
          impact: completeness.endTime < 40 ? 'LOW - Cannot estimate event duration' : 'Good',
          status: completeness.endTime >= 40 ? 'PASS' : 'FAIL'
        }
      ],
      totalScore: 0,
      maxScore: 20,
      percentage: 0
    }
  };

  // Calculate category totals
  Object.values(guide.categoryScores).forEach(category => {
    category.totalScore = category.fields.reduce((sum, field) => sum + field.currentPoints, 0);
    category.percentage = Math.round((category.totalScore / category.maxScore) * 100);
  });

  // Calculate overall weighted score
  guide.overallScore = {
    weightedTotal: 0,
    maxPossible: 100,
    percentage: 0,
    grade: '',
    rank: ''
  };

  Object.values(guide.categoryScores).forEach(category => {
    guide.overallScore.weightedTotal += category.totalScore;
  });

  guide.overallScore.percentage = Math.round(guide.overallScore.weightedTotal);

  // Assign grade
  if (guide.overallScore.percentage >= 90) {
    guide.overallScore.grade = 'A';
    guide.overallScore.rank = 'Excellent - SAE J2735 Ready';
  } else if (guide.overallScore.percentage >= 80) {
    guide.overallScore.grade = 'B';
    guide.overallScore.rank = 'Good - Minor improvements needed';
  } else if (guide.overallScore.percentage >= 70) {
    guide.overallScore.grade = 'C';
    guide.overallScore.rank = 'Fair - Moderate improvements needed';
  } else if (guide.overallScore.percentage >= 60) {
    guide.overallScore.grade = 'D';
    guide.overallScore.rank = 'Poor - Significant improvements needed';
  } else {
    guide.overallScore.grade = 'F';
    guide.overallScore.rank = 'Critical - Major data quality issues';
  }

  // Priority action plan
  guide.actionPlan = {
    immediate: [],
    shortTerm: [],
    longTerm: []
  };

  // Categorize actions by priority
  Object.entries(guide.categoryScores).forEach(([categoryKey, category]) => {
    category.fields.forEach(field => {
      if (field.status === 'FAIL') {
        const action = {
          field: field.field,
          currentScore: field.score,
          pointsGained: field.maxPoints - field.currentPoints,
          impact: field.impact,
          category: category.name
        };

        if (categoryKey === 'essential' && field.score < 80) {
          guide.actionPlan.immediate.push(action);
        } else if (categoryKey === 'important' && field.score < 70) {
          guide.actionPlan.shortTerm.push(action);
        } else {
          guide.actionPlan.longTerm.push(action);
        }
      }
    });
  });

  // Sort by points gained (highest impact first)
  guide.actionPlan.immediate.sort((a, b) => b.pointsGained - a.pointsGained);
  guide.actionPlan.shortTerm.sort((a, b) => b.pointsGained - a.pointsGained);
  guide.actionPlan.longTerm.sort((a, b) => b.pointsGained - a.pointsGained);

  // Add improvement potential
  guide.improvementPotential = {
    immediateActions: guide.actionPlan.immediate.length,
    potentialScoreIncrease: guide.actionPlan.immediate.reduce((sum, action) => sum + action.pointsGained, 0),
    newGradeIfFixed: '',
    message: ''
  };

  const potentialScore = guide.overallScore.percentage + guide.improvementPotential.potentialScoreIncrease;
  if (potentialScore >= 90) {
    guide.improvementPotential.newGradeIfFixed = 'A';
    guide.improvementPotential.message = `Fixing ${guide.actionPlan.immediate.length} critical issues would raise your score to ${potentialScore}% (Grade A)`;
  } else if (potentialScore >= 80) {
    guide.improvementPotential.newGradeIfFixed = 'B';
    guide.improvementPotential.message = `Fixing ${guide.actionPlan.immediate.length} critical issues would raise your score to ${potentialScore}% (Grade B)`;
  } else {
    guide.improvementPotential.newGradeIfFixed = 'C+';
    guide.improvementPotential.message = `Fixing ${guide.actionPlan.immediate.length} critical issues would raise your score to ${potentialScore}%`;
  }

  res.json(guide);
});

// Get list of all states with their compliance status
app.get('/api/compliance/summary', async (req, res) => {
  console.log('Generating compliance summary for all states...');

  // Get all states from database
  const allStates = db.getAllStates();
  const stateKeys = allStates.map(s => s.stateKey);

  const allResults = await Promise.all(
    stateKeys.map(stateKey => fetchStateData(stateKey))
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    totalStates: allResults.length,
    states: []
  };

  allResults.forEach(result => {
    // Find the state config from database
    const stateConfig = allStates.find(s => s.stateName === result.state);
    if (!stateConfig) return;

    const total = result.events.length || 1;

    // Calculate data completeness
    let completenessScore = 0;
    result.events.forEach(event => {
      let score = 0;
      if (event.latitude && event.longitude && event.latitude !== 0 && event.longitude !== 0) score += 25;
      if (event.description && event.description !== 'Event description not available') score += 20;
      if (event.eventType && event.eventType !== 'Unknown') score += 15;
      if (event.corridor && event.corridor !== 'Unknown') score += 15;
      if (event.severity) score += 10;
      if (event.startTime) score += 10;
      if (event.direction && event.direction !== 'Both') score += 5;
      completenessScore += score;
    });
    completenessScore = Math.round(completenessScore / total);

    const isWzdx = stateConfig.apiType === 'WZDx';
    const isFEUG = stateConfig.apiUrl?.includes('feu-g');

    summary.states.push({
      name: result.state,
      eventCount: result.events.length,
      currentFormat: isWzdx ? 'WZDx' : (isFEUG ? 'FEU-G' : (stateConfig.format === 'xml' ? 'RSS' : stateConfig.apiType || 'Custom JSON')),
      dataCompletenessScore: completenessScore,
      saeJ2735Ready: completenessScore >= 80,
      wzdxCompliant: isWzdx,
      complianceGuideUrl: `/api/compliance/guide/${stateConfig.stateKey}`,
      recommendedAction: isWzdx ? 'Maintain current standard' : (completenessScore < 70 ? 'Improve data quality and migrate to WZDx' : 'Migrate to WZDx')
    });
  });

  res.json(summary);
});

// ==================== MESSAGE ENDPOINTS ====================

// Get all messages
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await loadMessages();
    res.json({
      success: true,
      count: messages.length,
      messages: messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get messages for a specific event
app.get('/api/messages/event/:eventId', async (req, res) => {
  try {
    const messages = await loadMessages();
    const eventMessages = messages.filter(m => m.eventId === req.params.eventId);
    res.json({
      success: true,
      eventId: req.params.eventId,
      count: eventMessages.length,
      messages: eventMessages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a new message
app.post('/api/messages', async (req, res) => {
  try {
    const { eventId, sender, message, timestamp } = req.body;

    // Validation
    if (!eventId || !sender || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: eventId, sender, message'
      });
    }

    const messages = await loadMessages();

    const newMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventId,
      sender,
      message,
      timestamp: timestamp || new Date().toISOString()
    };

    messages.push(newMessage);
    await saveMessages(messages);

    console.log(`💬 New message from ${sender} for event ${eventId}`);

    res.status(201).json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a message
app.delete('/api/messages/:id', async (req, res) => {
  try {
    const messages = await loadMessages();
    const filteredMessages = messages.filter(m => m.id !== req.params.id);

    if (messages.length === filteredMessages.length) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    await saveMessages(filteredMessages);

    res.json({
      success: true,
      message: 'Message deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete all messages for an event
app.delete('/api/messages/event/:eventId', async (req, res) => {
  try {
    const messages = await loadMessages();
    const filteredMessages = messages.filter(m => m.eventId !== req.params.eventId);

    const deletedCount = messages.length - filteredMessages.length;
    await saveMessages(filteredMessages);

    res.json({
      success: true,
      deletedCount: deletedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== STATE-TO-STATE MESSAGING ENDPOINTS ====================

// State authentication middleware
const requireStateAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('State ')) {
    return res.status(401).json({ error: 'Missing or invalid state authorization header' });
  }

  const [stateKey, password] = authHeader.substring(6).split(':');
  if (!db.verifyStatePassword(stateKey, password)) {
    return res.status(403).json({ error: 'Invalid state credentials' });
  }

  req.stateKey = stateKey;
  req.stateName = db.getState(stateKey)?.stateName;
  next();
};

// Set/update state password (admin only)
app.post('/api/states/password', requireAdmin, (req, res) => {
  const { stateKey, password } = req.body;

  if (!stateKey || !password) {
    return res.status(400).json({ error: 'Missing stateKey or password' });
  }

  // Verify state exists
  const state = db.getState(stateKey);
  if (!state) {
    return res.status(404).json({ error: 'State not found' });
  }

  const result = db.setStatePassword(stateKey, password);

  if (result.success) {
    res.json({
      success: true,
      message: `Password set for ${state.stateName}`
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// State login (verify credentials)
app.post('/api/states/login', (req, res) => {
  const { stateKey, password } = req.body;

  if (!stateKey || !password) {
    return res.status(400).json({ error: 'Missing stateKey or password' });
  }

  const state = db.getState(stateKey);
  if (!state) {
    return res.status(404).json({ error: 'State not found' });
  }

  if (db.verifyStatePassword(stateKey, password)) {
    res.json({
      success: true,
      stateKey: state.stateKey,
      stateName: state.stateName,
      message: 'Login successful'
    });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Send direct message (state to state)
app.post('/api/states/messages', requireStateAuth, (req, res) => {
  const { toState, subject, message, eventId, priority } = req.body;

  if (!toState || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields: toState, subject, message' });
  }

  // Verify recipient state exists (unless it's "ALL")
  if (toState !== 'ALL') {
    const recipient = db.getState(toState);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient state not found' });
    }
  }

  const result = db.sendMessage({
    fromState: req.stateKey,
    toState,
    subject,
    message,
    eventId,
    priority: priority || 'normal'
  });

  if (result.success) {
    res.status(201).json({
      success: true,
      messageId: result.id,
      message: 'Message sent'
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Get inbox (messages to this state)
app.get('/api/states/inbox', requireStateAuth, (req, res) => {
  const messages = db.getInbox(req.stateKey);
  const unreadCount = db.getUnreadCount(req.stateKey);

  res.json({
    success: true,
    stateKey: req.stateKey,
    stateName: req.stateName,
    unreadCount,
    messages
  });
});

// Get sent messages (from this state)
app.get('/api/states/sent', requireStateAuth, (req, res) => {
  const messages = db.getSentMessages(req.stateKey);

  res.json({
    success: true,
    stateKey: req.stateKey,
    stateName: req.stateName,
    messages
  });
});

// Mark message as read
app.post('/api/states/messages/:id/read', requireStateAuth, (req, res) => {
  const result = db.markMessageRead(req.params.id, req.stateKey);

  if (result.success) {
    res.json({ success: true, message: 'Message marked as read' });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Add comment to event (any authenticated state can comment)
app.post('/api/events/:eventId/comments', requireStateAuth, (req, res) => {
  const { comment } = req.body;

  if (!comment) {
    return res.status(400).json({ error: 'Missing comment' });
  }

  const result = db.addEventComment({
    eventId: req.params.eventId,
    stateKey: req.stateKey,
    stateName: req.stateName,
    comment
  });

  if (result.success) {
    res.status(201).json({
      success: true,
      commentId: result.id,
      message: 'Comment added'
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Get comments for an event (public - no auth required)
app.get('/api/events/:eventId/comments', (req, res) => {
  const comments = db.getEventComments(req.params.eventId);

  res.json({
    success: true,
    eventId: req.params.eventId,
    count: comments.length,
    comments
  });
});

// Get all event comments (for viewing all discussions)
app.get('/api/events/comments/all', (req, res) => {
  const comments = db.getAllEventComments();

  res.json({
    success: true,
    count: comments.length,
    comments
  });
});

// Get list of states available for messaging
app.get('/api/states/list', (req, res) => {
  const states = db.getAllStates(false); // No credentials

  res.json({
    success: true,
    states: states.map(s => ({
      stateKey: s.stateKey,
      stateName: s.stateName
    }))
  });
});

// ==================== ADMIN STATE MANAGEMENT ENDPOINTS ====================

// Generate admin token (one-time setup or regenerate)
app.post('/api/admin/generate-token', (req, res) => {
  const { description } = req.body;
  const token = db.createAdminToken(description || 'Admin access token');

  if (token) {
    res.json({
      success: true,
      token: token,
      message: 'Save this token securely! It will not be shown again.',
      usage: `Authorization: Bearer ${token}`
    });
  } else {
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// Add new state (admin only)
app.post('/api/admin/states', requireAdmin, (req, res) => {
  const { stateKey, stateName, apiUrl, apiType, format, credentials } = req.body;

  // Validation
  if (!stateKey || !stateName || !apiUrl || !format) {
    return res.status(400).json({
      error: 'Missing required fields: stateKey, stateName, apiUrl, format'
    });
  }

  const result = db.addState({
    stateKey,
    stateName,
    apiUrl,
    apiType: apiType || 'Custom',
    format,
    credentials
  });

  if (result.success) {
    // Reload API_CONFIG to include new state
    loadStatesFromDatabase();
    res.status(201).json({
      success: true,
      message: `State ${stateName} added successfully`,
      stateKey: result.stateKey
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Update existing state (admin only)
app.put('/api/admin/states/:stateKey', requireAdmin, (req, res) => {
  const { stateKey } = req.params;
  const updates = req.body;

  const result = db.updateState(stateKey, updates);

  if (result.success) {
    // Reload API_CONFIG
    loadStatesFromDatabase();
    res.json({
      success: true,
      message: `State ${stateKey} updated successfully`
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Delete state (admin only)
app.delete('/api/admin/states/:stateKey', requireAdmin, (req, res) => {
  const { stateKey } = req.params;

  const result = db.deleteState(stateKey);

  if (result.success) {
    // Reload API_CONFIG
    loadStatesFromDatabase();
    res.json({
      success: true,
      message: `State ${stateKey} deleted successfully`
    });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// List all states (public gets basic info, admin gets credentials)
app.get('/api/admin/states', (req, res) => {
  const authHeader = req.headers.authorization;
  const isAdmin = authHeader && authHeader.startsWith('Bearer ') &&
                  db.verifyAdminToken(authHeader.substring(7));

  const states = db.getAllStates(isAdmin);

  res.json({
    success: true,
    count: states.length,
    states: states
  });
});

// Test state API connection (admin only)
app.get('/api/admin/test-state/:stateKey', requireAdmin, async (req, res) => {
  const { stateKey } = req.params;
  const state = db.getState(stateKey, true); // Include credentials

  if (!state) {
    return res.status(404).json({ error: 'State not found' });
  }

  try {
    // Attempt to fetch data using state's configuration
    const result = await fetchStateData(stateKey);

    res.json({
      success: true,
      state: state.stateName,
      eventsFound: result.events.length,
      errors: result.errors,
      message: result.events.length > 0
        ? 'Connection successful!'
        : 'Connected but no events found (this may be normal)'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to connect to state API'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Traffic Dashboard Backend Server`);
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 API Endpoints:`);
  console.log(`   GET http://localhost:${PORT}/api/events - Get all events`);
  console.log(`   GET http://localhost:${PORT}/api/events/:state - Get events by state`);
  console.log(`   GET http://localhost:${PORT}/api/health - Health check`);
  console.log(`   GET http://localhost:${PORT}/api/analysis/normalization - Data quality report`);
  console.log(`   GET http://localhost:${PORT}/api/convert/tim - Convert to SAE J2735 TIM format`);
  console.log(`\n📋 SAE J2735 Compliance Endpoints (NEW):`);
  console.log(`   GET http://localhost:${PORT}/api/compliance/summary - All states compliance status`);
  console.log(`   GET http://localhost:${PORT}/api/compliance/guide/:state - State-specific SAE compliance guide`);
  console.log(`\n💬 Message Endpoints:`);
  console.log(`   GET http://localhost:${PORT}/api/messages - Get all messages`);
  console.log(`   GET http://localhost:${PORT}/api/messages/event/:eventId - Get event messages`);
  console.log(`   POST http://localhost:${PORT}/api/messages - Create message`);
  console.log(`   DELETE http://localhost:${PORT}/api/messages/:id - Delete message`);
  console.log(`\n🔐 Admin State Management Endpoints (NEW):`);
  console.log(`   POST http://localhost:${PORT}/api/admin/generate-token - Generate admin token`);
  console.log(`   GET http://localhost:${PORT}/api/admin/states - List all states`);
  console.log(`   POST http://localhost:${PORT}/api/admin/states - Add new state (requires admin token)`);
  console.log(`   PUT http://localhost:${PORT}/api/admin/states/:stateKey - Update state (requires admin token)`);
  console.log(`   DELETE http://localhost:${PORT}/api/admin/states/:stateKey - Delete state (requires admin token)`);
  console.log(`   GET http://localhost:${PORT}/api/admin/test-state/:stateKey - Test state API (requires admin token)`);
  console.log(`\n🌐 Connected to ${Object.keys(API_CONFIG).length} state DOT APIs`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
});