// Traffic Dashboard Backend Proxy Server
// This server fetches data from state DOT APIs and serves it to your dashboard

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for your frontend
app.use(cors());
app.use(express.json());

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

// Normalize data from different state formats
const normalizeEventData = (rawData, stateName, format, sourceType = 'events') => {
  const normalized = [];
  
  try {
    if (format === 'json') {
      // Handle Nevada
      if (stateName === 'Nevada' && Array.isArray(rawData)) {
        rawData.forEach(item => {
          if (item.routes && item.routes.some(r => r.includes('I-80'))) {
            normalized.push({
              id: `NV-${item.id || Math.random().toString(36).substr(2, 9)}`,
              state: 'Nevada',
              corridor: 'I-80',
              eventType: determineEventType(item.event_category || item.description),
              description: item.description || item.headline || 'Road condition update',
              location: item.location_description || `I-80 ${item.direction || ''}`,
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
          if (item.route && item.route.includes('I-80')) {
            normalized.push({
              id: `OH-${item.id || Math.random().toString(36).substr(2, 9)}`,
              state: 'Ohio',
              corridor: 'I-80',
              eventType: sourceType === 'incidents' ? 'Incident' : 'Construction',
              description: item.description || item.comments || 'Road work',
              location: `${item.route} ${item.direction || ''} MM ${item.milepost || ''}`,
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
              corridor: 'I-80',
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
              normalized.push({
                id: `${stateName.substring(0, 2).toUpperCase()}-${eventId}`,
                state: stateName,
                corridor: API_CONFIG[stateName.toLowerCase()]?.corridor || 'Unknown',
                eventType: determineEventType(headlineText, descText),
                description: descText,
                location: locationText,
                county: 'Unknown',
                latitude: lat,
                longitude: lng,
                startTime: detail?.['event-times']?.['start-time'] || new Date().toISOString(),
                endTime: detail?.['event-times']?.['end-time'] || null,
                lanesAffected: 'Check conditions',
                severity: determineSeverityFromText(descText, headlineText),
                direction: extractDirection(descText, locationText),
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
            normalized.push({
              id: `${stateName.substring(0, 2).toUpperCase()}-${Math.random().toString(36).substr(2, 9)}`,
              state: stateName,
              corridor: API_CONFIG[stateName.toLowerCase()]?.corridor || 'Unknown',
              eventType: determineEventType(title),
              description: title || description,
              location: locationText,
              county: 'Unknown',
              latitude: latMatch ? parseFloat(latMatch[1]) : 0,
              longitude: lonMatch ? parseFloat(lonMatch[1]) : 0,
              startTime: item.pubDate || new Date().toISOString(),
              endTime: null,
              lanesAffected: extractLaneInfo(description),
              severity: determineSeverityFromText(description, title),
              direction: extractDirection(description, title),
              requiresCollaboration: false
            });
          }
        });
      }
    }
  } catch (error) {
    console.error(`Error normalizing ${stateName} data:`, error.message);
  }
  
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

const extractLaneInfo = (description) => {
  const laneMatch = (description || '').match(/(\d+)\s*lane[s]?\s*(closed|blocked|affected)/i);
  if (laneMatch) return `${laneMatch[1]} lane(s) ${laneMatch[2]}`;
  return 'Check conditions';
};

const extractDirection = (description, title) => {
  const text = ((description || '') + ' ' + (title || '')).toLowerCase();
  if (text.includes('eastbound') || text.includes('eb')) return 'Eastbound';
  if (text.includes('westbound') || text.includes('wb')) return 'Westbound';
  if (text.includes('northbound') || text.includes('nb')) return 'Northbound';
  if (text.includes('southbound') || text.includes('sb')) return 'Southbound';
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

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Traffic Dashboard Backend Server`);
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 API Endpoints:`);
  console.log(`   GET http://localhost:${PORT}/api/events - Get all events`);
  console.log(`   GET http://localhost:${PORT}/api/events/:state - Get events by state`);
  console.log(`   GET http://localhost:${PORT}/api/health - Health check`);
  console.log(`\n🌐 Connected to ${Object.keys(API_CONFIG).length} state DOT APIs`);
  console.log(`\nPress Ctrl+C to stop the server\n`);
});