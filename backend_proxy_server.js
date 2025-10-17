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
    eventsUrl: 'https://ia.carsprogram.org/hub/mapupdate/data',
    wzdxUrl: 'https://cloud.iowadot.gov/Highway/OTO/wzdx.xml',
    username: process.env.CARS_USERNAME || '',
    password: process.env.CARS_PASSWORD || '',
    format: 'xml',
    corridor: 'both'
  },
  kansas: {
    name: 'Kansas',
    eventsUrl: 'https://ks.carsprogram.org/hub/mapupdate/data',
    username: process.env.CARS_USERNAME || '',
    password: process.env.CARS_PASSWORD || '',
    format: 'xml',
    corridor: 'I-35'
  },
  nebraska: {
    name: 'Nebraska',
    eventsUrl: 'https://ne.carsprogram.org/hub/mapupdate/data',
    username: process.env.CARS_USERNAME || '',
    password: process.env.CARS_PASSWORD || '',
    format: 'xml',
    corridor: 'I-80'
  },
  indiana: {
    name: 'Indiana',
    eventsUrl: 'https://inhub.carsprogram.org/mapupdate/data',
    username: process.env.CARS_USERNAME || '',
    password: process.env.CARS_PASSWORD || '',
    format: 'xml',
    corridor: 'I-80'
  },
  minnesota: {
    name: 'Minnesota',
    eventsUrl: 'https://mn.carsprogram.org/hub/mapupdate/data',
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
          const coords = feature.geometry?.coordinates || [0, 0];
          
          normalized.push({
            id: `UT-${props.road_event_id || Math.random().toString(36).substr(2, 9)}`,
            state: 'Utah',
            corridor: 'I-80',
            eventType: props.event_type || 'Construction',
            description: props.description || 'Work zone',
            location: props.road_names ? props.road_names.join(', ') : 'I-80',
            county: props.county || 'Unknown',
            latitude: coords[1],
            longitude: coords[0],
            startTime: props.start_date || new Date().toISOString(),
            endTime: props.end_date || null,
            lanesAffected: props.lanes?.[0]?.status || 'Check conditions',
            severity: props.event_status === 'active' ? 'medium' : 'low',
            direction: props.direction || 'Both',
            requiresCollaboration: false
          });
        });
      }
    } 
    else if (format === 'xml') {
      // Handle CARS Program XML feeds
      if (rawData.rss?.channel?.item) {
        const items = Array.isArray(rawData.rss.channel.item) 
          ? rawData.rss.channel.item 
          : [rawData.rss.channel.item];
        
        items.forEach(item => {
          const description = item.description || '';
          const title = item.title || '';
          
          // Try to extract location info
          const latMatch = description.match(/Lat:\s*([-\d.]+)/i);
          const lonMatch = description.match(/Lon:\s*([-\d.]+)/i);
          
          normalized.push({
            id: `${stateName.substring(0, 2).toUpperCase()}-${Math.random().toString(36).substr(2, 9)}`,
            state: stateName,
            corridor: API_CONFIG[stateName.toLowerCase()]?.corridor || 'Unknown',
            eventType: determineEventType(title),
            description: title || description,
            location: extractLocation(description, title),
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
        });
      }
    }
  } catch (error) {
    console.error(`Error normalizing ${stateName} data:`, error.message);
  }
  
  return normalized;
};

// Helper functions
const determineEventType = (text) => {
  const lowerText = (text || '').toLowerCase();
  if (lowerText.includes('construction') || lowerText.includes('work zone')) return 'Construction';
  if (lowerText.includes('accident') || lowerText.includes('crash') || lowerText.includes('incident')) return 'Incident';
  if (lowerText.includes('closure') || lowerText.includes('closed')) return 'Closure';
  if (lowerText.includes('weather') || lowerText.includes('snow') || lowerText.includes('ice')) return 'Weather';
  return 'Unknown';
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

// Fetch data from a single state
const fetchStateData = async (stateKey) => {
  const config = API_CONFIG[stateKey];
  const results = { state: config.name, events: [], errors: [] };
  
  try {
    if (config.format === 'json') {
      // Fetch JSON data
      const headers = {};
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
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