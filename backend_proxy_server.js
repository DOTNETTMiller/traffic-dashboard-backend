// Traffic Dashboard Backend Proxy Server
// This server fetches data from state DOT APIs and serves it to your dashboard

const express = require('express');
const compression = require('compression');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./database');
const emailService = require('./email-service');
const { fetchOhioEvents } = require('./scripts/fetch_ohio_events');
const { fetchCaltransLCS } = require('./scripts/fetch_caltrans_lcs');
const { fetchPennDOTRCRS } = require('./scripts/fetch_penndot_rcrs');
const ComplianceAnalyzer = require('./compliance-analyzer');
const { OpenAI } = require('openai');

// Initialize volume data from bundled sources on startup
function initVolumeData() {
  try {
    const bundledFile = path.join(__dirname, 'bundled_data/truck_parking_patterns.json');
    const volumeDir = path.join(__dirname, 'data');
    const volumeFile = path.join(volumeDir, 'truck_parking_patterns.json');

    // Create data directory if needed
    if (!fs.existsSync(volumeDir)) {
      console.log(`📁 Creating data directory: ${volumeDir}`);
      fs.mkdirSync(volumeDir, { recursive: true });
    }

    // Check if file exists on volume
    if (fs.existsSync(volumeFile)) {
      const stats = fs.statSync(volumeFile);
      console.log(`✅ Data file already exists on volume (${(stats.size/1024).toFixed(2)} KB)`);
      return;
    }

    // Copy bundled file to volume
    if (!fs.existsSync(bundledFile)) {
      console.log(`⚠️  Bundled file not found: ${bundledFile}`);
      return;
    }

    console.log(`📦 Copying bundled data to volume...`);
    fs.copyFileSync(bundledFile, volumeFile);

    const stats = fs.statSync(volumeFile);
    console.log(`✅ Data file copied successfully (${(stats.size/1024).toFixed(2)} KB)`);
  } catch (error) {
    console.error('❌ Failed to initialize volume data:', error);
  }
}

// Auto-import parking facilities on startup if database is empty
async function initParkingFacilities() {
  try {
    console.log('\n🚗 Checking parking facilities...\n');

    // Count existing facilities
    const countResult = await db.getAsync('SELECT COUNT(*) as count FROM parking_facilities');
    const currentCount = countResult.count;

    console.log(`📊 Current facilities in database: ${currentCount}`);

    // Check how many Iowa facilities we have (should be 44)
    const iowaResult = await db.getAsync('SELECT COUNT(*) as count FROM parking_facilities WHERE state = \'IA\'');
    const iowaCount = iowaResult.count;

    console.log(`🌽 Iowa facilities in database: ${iowaCount}`);

    // If we have all 44 Iowa facilities, assume database is properly populated
    if (iowaCount >= 44) {
      console.log('✅ Parking facilities already populated (Iowa check passed)\n');
      return;
    }

    console.log(`⚠️  Missing Iowa facilities! Expected 44, found ${iowaCount}. Running import...\n`);

    // Import facilities from JSON
    console.log('📥 Importing parking facilities from JSON...');
    const facilitiesPath = path.join(__dirname, 'scripts', 'facilities_data.json');

    if (!fs.existsSync(facilitiesPath)) {
      console.log('⚠️  facilities_data.json not found, skipping import\n');
      return;
    }

    const facilitiesData = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));
    console.log(`📦 Loaded ${facilitiesData.length} facilities from JSON`);

    // Clear existing facilities
    await db.runAsync('DELETE FROM parking_facilities');
    console.log('🗑️  Cleared existing facilities');

    // Import facilities
    let imported = 0;
    for (const f of facilitiesData) {
      try {
        await db.runAsync(
          `INSERT INTO parking_facilities
           (facility_id, site_id, state, capacity, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [f.facility_id, f.site_id, f.state, f.capacity || 0, f.latitude || 0, f.longitude || 0]
        );
        imported++;
      } catch (err) {
        console.error(`⚠️  Error importing ${f.facility_id}:`, err.message);
      }
    }

    console.log(`✅ Imported ${imported} facilities`);

    // Apply coordinate offsets to separate co-located facilities
    console.log('📍 Applying coordinate offsets...');
    const duplicatesQuery = `
      SELECT latitude, longitude,
             STRING_AGG(facility_id, '|') as facilities,
             COUNT(*) as count
      FROM parking_facilities
      WHERE latitude <> 0 AND longitude <> 0
      GROUP BY latitude, longitude
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    const duplicates = await db.allAsync(duplicatesQuery);
    console.log(`  Found ${duplicates.length} locations with multiple facilities`);

    let offsetCount = 0;
    for (const dup of duplicates) {
      const facilityIds = dup.facilities.split('|');
      const baseLatitude = parseFloat(dup.latitude);
      const baseLongitude = parseFloat(dup.longitude);

      const offsetDistance = 0.0005; // ~50 meters
      const angleStep = (2 * Math.PI) / facilityIds.length;

      for (let index = 1; index < facilityIds.length; index++) {
        const facilityId = facilityIds[index];
        const angle = angleStep * index;
        const latOffset = Math.sin(angle) * offsetDistance;
        const lonOffset = Math.cos(angle) * offsetDistance;

        const newLat = baseLatitude + latOffset;
        const newLon = baseLongitude + lonOffset;

        await db.runAsync(
          `UPDATE parking_facilities
           SET latitude = $1, longitude = $2
           WHERE facility_id = $3`,
          [newLat, newLon, facilityId]
        );

        offsetCount++;
      }
    }

    console.log(`✅ Applied offsets to ${offsetCount} facilities`);
    console.log('🎉 Parking facilities initialization complete!\n');

  } catch (error) {
    console.error('❌ Error initializing parking facilities:', error);
    console.error(error.stack);
  }
}

// Run initialization before starting the server
console.log('\n🔄 Initializing volume data...\n');
initVolumeData();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable GZIP compression for all responses (reduces bandwidth by 70-80%)
app.use(compression());

// Prevent Railway Edge CDN from caching API routes
app.use('/api', (req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

// JWT Secret (should be in environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'ccai2026-traffic-dashboard-secret-key';

// OpenAI initialization for chat assistance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Auto-migrate users to email-based usernames on startup (if needed)
let migrationAttempted = false;
async function migrateUsersToEmailUsernames() {
  if (migrationAttempted) return; // Prevent infinite loops
  migrationAttempted = true;

  try {
    const users = await db.getAllUsers();
    const needsMigration = users.filter(u => u.username !== u.email);

    if (needsMigration.length > 0) {
      console.log(`🔄 Migrating ${needsMigration.length} users to email-based usernames...`);

      needsMigration.forEach(user => {
        const result = db.updateUser(user.id, { username: user.email });
        if (result.success) {
          console.log(`  ✅ ${user.username} → ${user.email}`);
        } else {
          console.log(`  ❌ Failed to migrate ${user.username}`);
        }
      });

      console.log('✅ User migration complete!');
    } else {
      console.log('✅ All users already using email-based usernames');
    }
  } catch (error) {
    console.error('⚠️  User migration skipped:', error.message);
    // Don't retry - just skip it
  }
}

// Run migration on startup (only once)
setTimeout(() => migrateUsersToEmailUsernames(), 1000);

// Enable CORS for your frontend
app.use(cors());
app.use(express.json());

// Ensure Express trusts upstream proxies (Railway, etc.) for HTTPS detection
app.set('trust proxy', 1);

// Enforce HTTPS in production to avoid browser security warnings
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
  }
  return next();
});

// Basic security headers for browsers that require them
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Admin authentication middleware - accepts legacy tokens or user JWT with admin role
const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  // Legacy admin tokens
  if (db.verifyAdminToken(token)) {
    req.adminAuthType = 'token';
    return next();
  }

  // User JWT with admin role
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role === 'admin') {
      req.user = decoded;
      req.adminAuthType = 'user';
      return next();
    }
    return res.status(403).json({ error: 'Admin privileges required' });
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired admin credentials' });
  }
};

// User authentication middleware
const requireUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, email, stateKey, role }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Combined authentication middleware - accepts both User JWT and State password
const requireUserOrStateAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  // Try Bearer token first (new user system)
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      // Allow admins without state affiliation
      if (decoded.role === 'admin') {
        req.stateKey = 'ADMIN';
        req.stateName = decoded.organization || decoded.fullName || 'Admin';
        req.user = decoded;
        return next();
      }

      // User must have a state affiliation
      if (!decoded.stateKey) {
        return res.status(403).json({ error: 'User has no state affiliation. Only state-affiliated users can comment.' });
      }

      const state = db.getState(decoded.stateKey);
      if (!state) {
        return res.status(403).json({ error: 'Invalid state affiliation' });
      }

      req.stateKey = decoded.stateKey;
      req.stateName = state.stateName;
      req.user = decoded;
      return next();
    } catch (error) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  // Fall back to State password auth (old system)
  if (authHeader.startsWith('State ')) {
    const [stateKey, password] = authHeader.substring(6).split(':');
    if (!db.verifyStatePassword(stateKey, password)) {
      return res.status(403).json({ error: 'Invalid state credentials' });
    }

    req.stateKey = stateKey;
    req.stateName = db.getState(stateKey)?.stateName;
    return next();
  }

  return res.status(401).json({ error: 'Invalid authorization format' });
};

const FRONTEND_DIST_PATH = path.join(__dirname, 'frontend', 'dist');
const TRUCK_PARKING_PREDICTIONS_PATH = path.join(__dirname, 'data', 'truck_parking_predictions.json');

// Create static file middleware once
const staticFileMiddleware = express.static(FRONTEND_DIST_PATH);

let truckParkingPredictions = null;

const loadTruckParkingPredictions = () => {
  if (!fs.existsSync(TRUCK_PARKING_PREDICTIONS_PATH)) {
    console.warn('⚠️  Truck parking predictions file not found');
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(TRUCK_PARKING_PREDICTIONS_PATH, 'utf-8'));

    Object.entries(raw.sites || {}).forEach(([siteId, siteData]) => {
      const hourMap = {};
      (siteData.hourly || []).forEach(entry => {
        hourMap[entry.hour_of_week] = entry;
      });
      siteData.hourMap = hourMap;
    });

    raw.statewideHourMap = {};
    (raw.statewide_hourly || []).forEach(entry => {
      raw.statewideHourMap[entry.hour_of_week] = entry;
    });

    console.log('✅ Loaded truck parking predictions');
    return raw;
  } catch (error) {
    console.error('⚠️  Failed to parse truck parking predictions:', error.message);
    return null;
  }
};

truckParkingPredictions = loadTruckParkingPredictions();

const getHourOfWeekUTC = (date) => {
  const hour = date.getUTCHours();
  const day = date.getUTCDay();
  return ((day * 24) + hour) % 168;
};

const haversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Serve documentation files (before static frontend)
app.get('/docs/:filename', (req, res) => {
  const { filename } = req.params;
  const docsPath = path.join(__dirname, 'docs', filename);

  // Security: Only allow .md files
  if (!filename.endsWith('.md')) {
    return res.status(400).json({ error: 'Only markdown files are allowed' });
  }

  // Check if file exists
  if (!fs.existsSync(docsPath)) {
    return res.status(404).json({ error: 'Documentation file not found' });
  }

  // Read and send the file
  fs.readFile(docsPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading documentation file:', err);
      return res.status(500).json({ error: 'Error reading documentation file' });
    }
    res.type('text/plain').send(data);
  });
});

// API Configuration
// IMPORTANT: Credentials are loaded from environment variables for security
const API_CONFIG = {
  nevada: {
    name: 'Nevada',
    eventsUrl: 'https://www.nvroads.com/api/v2/get/roadconditions',
    parkingUrl: 'https://www.nvroads.com/api/v2/get/truckparking',
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
  },
  illinois: {
    name: 'Illinois',
    eventsUrl: 'https://travelmidwest.com/lmiga/incidents.json?path=GATEWAY.IL',
    format: 'json',
    corridor: 'both'
  },
  // pennsylvania: Pennsylvania Turnpike Commission - DISABLED: Requires API key (not username/password)
  // The API expects ?api_key=... but we don't have a Turnpike API key
  // Pennsylvania statewide data is provided by PennDOT RCRS via fetchPennDOTRCRS()
};

const getAllStateKeys = () => {
  const keys = Object.keys(API_CONFIG).map(key => key.toLowerCase());
  if (!keys.includes('pa')) {
    keys.push('pa');
  }
  return Array.from(new Set(keys));
};

// Function to load states from database and merge with API_CONFIG
async function loadStatesFromDatabase() {
  try {
    console.log('📦 Loading states from database...');

    const dbStates = await db.getAllStates(true); // Get all with credentials

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
  } catch (error) {
    console.error('⚠️  Error loading states from database:', error.message);
    console.log('📊 Using default state configurations');
    // Continue with existing API_CONFIG
  }
}

// SAE J2735 ITIS Code Mapping
// Official ITIS codes from SAE J2735 specification
const ITIS_CODES = {
  'work-zone': 8963,          // Road work
  'construction': 8963,       // Construction
  'incident': 769,            // Accident
  'accident': 769,            // Accident
  'weather-condition': 1537,  // Adverse weather
  'weather': 1537,            // Adverse weather
  'restriction': 1281,        // Road closure
  'detour': 1284,             // Detour
  'special-event': 1289,      // Special event
  'road-hazard': 1792         // Roadway hazard
};

// Check if event type is mappable to ITIS code
function hasITISMapping(eventType) {
  if (!eventType) return false;
  const normalizedType = eventType.toLowerCase().trim();
  return ITIS_CODES.hasOwnProperty(normalizedType);
}

// Get ITIS code for event type
function getITISCode(eventType) {
  if (!eventType) return null;
  const normalizedType = eventType.toLowerCase().trim();
  return ITIS_CODES[normalizedType] || null;
}

// Filter events by bounding box (geographic coordinates)
// Bounding box format: { minLat, maxLat, minLon, maxLon }
function filterEventsByBoundingBox(events, boundingBox) {
  if (!boundingBox || !boundingBox.minLat || !boundingBox.maxLat || !boundingBox.minLon || !boundingBox.maxLon) {
    return events; // No bounding box specified, return all events
  }

  const { minLat, maxLat, minLon, maxLon } = boundingBox;

  // Validate bounding box parameters
  const minLatNum = parseFloat(minLat);
  const maxLatNum = parseFloat(maxLat);
  const minLonNum = parseFloat(minLon);
  const maxLonNum = parseFloat(maxLon);

  if (isNaN(minLatNum) || isNaN(maxLatNum) || isNaN(minLonNum) || isNaN(maxLonNum)) {
    console.error('⚠️  Invalid bounding box parameters - must be valid numbers');
    return events;
  }

  if (minLatNum > maxLatNum || minLonNum > maxLonNum) {
    console.error('⚠️  Invalid bounding box - min values must be less than max values');
    return events;
  }

  const filtered = events.filter(event => {
    // Handle both coordinate formats: latitude/longitude fields or coordinates array
    const latitude = event.latitude || (event.coordinates && event.coordinates[1]);
    const longitude = event.longitude || (event.coordinates && event.coordinates[0]);

    // Skip events without coordinates
    if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
      return false;
    }

    // Check if coordinates are within bounding box
    return latitude >= minLatNum &&
           latitude <= maxLatNum &&
           longitude >= minLonNum &&
           longitude <= maxLonNum;
  });

  console.log(`📍 Bounding box filter: ${filtered.length} of ${events.length} events within bounds (${minLatNum},${minLonNum}) to (${maxLatNum},${maxLonNum})`);
  return filtered;
}

// Calculate distance between two points using Haversine formula (returns km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Check if event is near any low-clearance bridge and create warnings
async function checkBridgeClearanceProximity(event, stateKey) {
  try {
    // Get event coordinates
    const eventLat = event.latitude || (event.coordinates && event.coordinates[1]);
    const eventLon = event.longitude || (event.coordinates && event.coordinates[0]);

    if (!eventLat || !eventLon) {
      return; // No coordinates available
    }

    // Get all active low-clearance bridges
    const bridges = await db.getActiveBridges();

    for (const bridge of bridges) {
      const distance = calculateDistance(
        eventLat, eventLon,
        bridge.latitude, bridge.longitude
      );

      // Check if event is within watch radius
      if (distance <= bridge.watch_radius_km) {
        // Check if warning already exists for this event/bridge combination
        const existingWarning = await db.getBridgeWarningByEventAndBridge(
          event.id || event.guid,
          bridge.id
        );

        if (!existingWarning) {
          // Create bridge clearance warning
          const warningData = {
            bridge_id: bridge.id,
            event_id: event.id || event.guid,
            event_state: stateKey,
            event_description: event.description || event.headline,
            distance_km: distance,
            message: `${bridge.warning_message}\n\nEvent nearby: ${event.description || event.headline} (${distance.toFixed(1)} km away)`
          };

          await db.createBridgeWarning(warningData);

          console.log(`🌉 Bridge clearance warning created for ${bridge.bridge_name} (${bridge.clearance_feet}') - Event ${event.id} (${distance.toFixed(1)} km away)`);
        }
      }
    }
  } catch (error) {
    console.error('Error checking bridge clearance proximity:', error);
  }
}

// Check if event is near any interstate interchange and create detour alerts
async function checkInterchangeProximity(event, stateKey) {
  try {
    // Get event coordinates
    const eventLat = event.latitude || (event.coordinates && event.coordinates[1]);
    const eventLon = event.longitude || (event.coordinates && event.coordinates[0]);

    if (!eventLat || !eventLon) {
      return; // No coordinates available
    }

    // Get all active interchanges
    const interchanges = await db.getActiveInterchanges();

    for (const interchange of interchanges) {
      const distance = calculateDistance(
        eventLat, eventLon,
        interchange.latitude, interchange.longitude
      );

      // Check if event is within watch radius
      if (distance <= interchange.watch_radius_km) {
        // Check if alert already exists for this event/interchange combination
        const existingAlert = await db.getDetourAlertByEventAndInterchange(
          event.id || event.guid,
          interchange.id
        );

        if (!existingAlert) {
          // Create detour alert
          const alertData = {
            interchange_id: interchange.id,
            event_id: event.id || event.guid,
            event_state: stateKey,
            event_corridor: event.road || event.route || interchange.corridor,
            event_location: event.location || event.description,
            event_description: event.description || event.headline,
            severity: event.severity || event.priority || 'medium',
            lanes_affected: event.lanesAffected || event.lanes_blocked,
            notified_states: interchange.notify_states,
            message: `${interchange.detour_message}\n\nEvent: ${event.description || event.headline}\nDistance: ${distance.toFixed(1)} km from interchange`
          };

          const alertId = await db.createDetourAlert(alertData);

          console.log(`🚨 Detour alert created for ${interchange.name} - Event ${event.id} (${distance.toFixed(1)} km away)`);

          // Send notifications to affected states
          const stateList = interchange.notify_states.split(',').map(s => s.trim());
          for (const targetState of stateList) {
            if (targetState !== stateKey) { // Don't notify the originating state
              try {
                await db.createStateMessage({
                  fromState: stateKey,
                  toState: targetState,
                  subject: `⚠️ Detour Advisory: ${interchange.name}`,
                  message: alertData.message,
                  eventId: event.id || event.guid,
                  priority: 'high',
                  messageType: 'detour_advisory'
                });
                console.log(`   📧 Notified ${targetState} about detour alert`);
              } catch (err) {
                console.error(`   ❌ Failed to notify ${targetState}:`, err.message);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking interchange proximity:', error);
  }
}

// Note: generateVMSMessage function already exists later in the file at line ~1424

// Initialize database and run migration (async startup)
async function initializeDatabase() {
  try {
    // Initialize database (required for PostgreSQL)
    await db.init();

    // Run migration on first startup (only runs once)
    const existingStates = await db.getAllStates();
    if (existingStates.length === 0) {
      console.log('🔄 First startup detected - migrating existing states to database...');
      db.migrateFromConfig(API_CONFIG);
    }

    // Load any additional states from database
    await loadStatesFromDatabase();

    // Generate admin token if none exist
    const tokenCheck = db.db.prepare('SELECT COUNT(*) as count FROM admin_tokens').get();
    if (tokenCheck.count === 0) {
      const initialToken = db.createAdminToken('Initial admin token');
      console.log('\n🔑 ═══════════════════════════════════════════════════════════');
      console.log('🔑 ADMIN TOKEN GENERATED (SAVE THIS SECURELY):');
      console.log(`🔑 ${initialToken}`);
      console.log('🔑 ═══════════════════════════════════════════════════════════\n');
    }
  } catch (error) {
    console.error('⚠️  Database initialization error:', error.message);
    console.log('⚠️  Server will continue with limited functionality');
    // Server will start but database features may be limited
  }
}

// Initialize database then start server
initializeDatabase()
  .then(() => {
    // Start server after database is ready
    startServer();
  })
  .catch(err => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });

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

const attachRawFields = (event, rawData = {}, extractedData = {}) => {
  // rawData = what actually exists in the feed structure
  // extractedData = what we can infer from text parsing
  // event = final normalized value (with fallbacks)

  event.rawFields = {
    // Capture all three levels for transparency
    eventType: {
      raw: rawData.eventType ?? null,
      extracted: extractedData.eventType ?? null,
      normalized: event.eventType ?? null
    },
    startTime: {
      raw: rawData.startTime ?? null,
      extracted: extractedData.startTime ?? null,
      normalized: event.startTime ?? null
    },
    endTime: {
      raw: rawData.endTime ?? null,
      extracted: extractedData.endTime ?? null,
      normalized: event.endTime ?? null
    },
    description: {
      raw: rawData.description ?? null,
      extracted: extractedData.description ?? null,
      normalized: event.description ?? null
    },
    lanesAffected: {
      raw: rawData.lanesAffected ?? null,
      extracted: extractedData.lanesAffected ?? null,
      normalized: event.lanesAffected ?? null
    },
    severity: {
      raw: rawData.severity ?? null,
      extracted: extractedData.severity ?? null,
      normalized: event.severity ?? null
    },
    direction: {
      raw: rawData.direction ?? null,
      extracted: extractedData.direction ?? null,
      normalized: event.direction ?? null
    },
    corridor: {
      raw: rawData.corridor ?? null,
      extracted: extractedData.corridor ?? null,
      normalized: event.corridor ?? null
    },
    coordinates: {
      raw: rawData.coordinates ?? null,
      extracted: extractedData.coordinates ?? null,
      normalized: (event.longitude !== undefined && event.latitude !== undefined)
        ? [event.longitude, event.latitude] : null
    }
  };

  return event;
};

// Normalize data from different state formats
const normalizeEventData = (rawData, stateName, format, sourceType = 'events') => {
  const normalized = [];
  
  try {
    if (format === 'json' || format === 'geojson') {
      // Handle Nevada
      if (stateName === 'Nevada' && Array.isArray(rawData)) {
        rawData.forEach(item => {
          const locationText = item.location_description || `I-80 ${item.direction || ''}`;
          if (item.routes && item.routes.some(r => /I-?\d+/.test(r))) {
            const startRaw = item.start_time ? item.start_time : null;
            const eventTypeRaw = item.event_category || item.description || null;
            const directionRaw = item.direction || null;
            const lanesRaw = item.lanes_affected || null;
            const normalizedEvent = {
              id: `NV-${item.id || Math.random().toString(36).substr(2, 9)}`,
              state: 'Nevada',
              corridor: extractCorridor(locationText),
              eventType: determineEventType(item.event_category || item.description),
              description: item.description || item.headline || 'Road condition update',
              location: locationText,
              county: item.county || 'Unknown',
              latitude: parseFloat(item.start_latitude) || 0,
              longitude: parseFloat(item.start_longitude) || 0,
              startTime: startRaw,
              endTime: item.end_time || null,
              lanesAffected: lanesRaw || 'Check conditions',
              severity: determineSeverity(item),
              direction: directionRaw || 'Both',
              requiresCollaboration: false
            };

            normalized.push(attachRawFields(normalizedEvent, {
              startTime: startRaw,
              endTime: item.end_time || null,
              eventType: item.event_category || null,
              description: item.description || null,
              lanesAffected: lanesRaw,
              severity: determineSeverity(item),
              direction: directionRaw,
              corridor: extractCorridor(locationText),
              coordinates: (normalizedEvent.longitude && normalizedEvent.latitude)
                ? [normalizedEvent.longitude, normalizedEvent.latitude]
                : null
            }));
          }
        });
      }

      // Handle Ohio
      if (stateName === 'Ohio' && Array.isArray(rawData)) {
        rawData.forEach(item => {
          const locationText = `${item.route} ${item.direction || ''} MM ${item.milepost || ''}`;
          if (item.route && /I-?\d+/.test(item.route)) {
            const startRaw = item.startDate || item.created || null;
            const endRaw = item.estimatedEndDate || item.endDate || null;
            const severityRaw = item.severity || null;
            const directionRaw = item.direction || null;
            const lanesRaw = item.lanesBlocked || item.lanesAffected || null;
            const normalizedEvent = {
              id: `OH-${item.id || Math.random().toString(36).substr(2, 9)}`,
              state: 'Ohio',
              corridor: extractCorridor(locationText),
              eventType: sourceType === 'incidents' ? 'Incident' : 'Construction',
              description: item.description || item.comments || 'Road work',
              location: locationText,
              county: item.county || 'Unknown',
              latitude: parseFloat(item.latitude) || 0,
              longitude: parseFloat(item.longitude) || 0,
              startTime: startRaw,
              endTime: endRaw,
              lanesAffected: lanesRaw || 'Unknown',
              severity: severityRaw || 'medium',
              direction: directionRaw || 'Both',
              requiresCollaboration: false
            };

            normalized.push(attachRawFields(normalizedEvent, {
              startTime: startRaw,
              endTime: endRaw,
              lanesAffected: lanesRaw,
              severity: severityRaw,
              direction: directionRaw,
              description: item.description || item.comments || null,
              eventType: item.category || null,
              corridor: extractCorridor(locationText),
              coordinates: (normalizedEvent.longitude && normalizedEvent.latitude)
                ? [normalizedEvent.longitude, normalizedEvent.latitude]
                : null
            }));
          }
        });
      }

      // Handle Illinois (TravelMidwest LMIGA format)
      if (stateName === 'Illinois' && Array.isArray(rawData)) {
        rawData.forEach(table => {
          // Each table represents a highway corridor (e.g., "I-55 NB")
          const tableName = table.tableName || '';
          const reportRows = table.reportRows || [];

          reportRows.forEach(item => {
            // Extract route from tableName or fullLocation
            const route = tableName.match(/I-\d+/)?.[0] ||
                         item.fullLocation?.match(/I-\d+/)?.[0] ||
                         'Unknown';

            // Extract direction from tableName (NB, SB, EB, WB)
            const directionMatch = tableName.match(/\b(NB|SB|EB|WB)\b/);
            let direction = 'Both';
            if (directionMatch) {
              const dir = directionMatch[1];
              direction = dir === 'NB' ? 'Northbound' :
                         dir === 'SB' ? 'Southbound' :
                         dir === 'EB' ? 'Eastbound' :
                         dir === 'WB' ? 'Westbound' : 'Both';
            }

            const locationText = item.fullLocation || item.location || `${route} ${direction}`;

            // Only include events on interstate highways
            if (/I-?\d+/.test(route)) {
              const startRaw = item.startTime || null;
              const endRaw = item.estimatedEndTime || null;
              const descriptionRaw = item.description || 'Traffic incident';
              const lanesRaw = item.closureDetails || null;
              const mileMarker = item.mileMarker || null;

              // Determine event type from description
              let eventType = 'Incident';
              const descLower = descriptionRaw.toLowerCase();
              if (descLower.includes('construction') || descLower.includes('work zone')) {
                eventType = 'Construction';
              } else if (descLower.includes('crash') || descLower.includes('accident')) {
                eventType = 'Crash';
              } else if (descLower.includes('weather') || descLower.includes('ice') || descLower.includes('snow')) {
                eventType = 'Weather';
              }

              const normalizedEvent = {
                id: `IL-${item.id || Math.random().toString(36).substr(2, 9)}`,
                state: 'Illinois',
                corridor: extractCorridor(route),
                eventType: eventType,
                description: descriptionRaw,
                location: locationText + (mileMarker ? ` MM ${mileMarker}` : ''),
                county: item.fullLocation?.split(',')[1]?.trim() || 'Unknown',
                latitude: parseFloat(item.latitude) || 0,
                longitude: parseFloat(item.longitude) || 0,
                startTime: startRaw,
                endTime: endRaw,
                lanesAffected: lanesRaw || 'Check conditions',
                severity: descLower.includes('blocked') || descLower.includes('closed') ? 'high' : 'medium',
                direction: direction,
                requiresCollaboration: false
              };

              normalized.push(attachRawFields(normalizedEvent, {
                startTime: startRaw,
                endTime: endRaw,
                lanesAffected: lanesRaw,
                severity: normalizedEvent.severity,
                direction: direction,
                description: descriptionRaw,
                eventType: eventType,
                corridor: extractCorridor(route),
                coordinates: (normalizedEvent.longitude && normalizedEvent.latitude)
                  ? [normalizedEvent.longitude, normalizedEvent.latitude]
                  : null
              }));
            }
          });
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
            const corridor = extractCorridor(locationText);
            const startRaw = props.start_date || null;
            const endRaw = props.end_date || null;
            const descriptionRaw = props.description || null;
            const lanesRaw = props.lanes?.[0]?.status || null;
            const directionRaw = props.direction || null;
            const severityRaw = props.event_status || null;

            const normalizedEvent = {
              id: `UT-${props.road_event_id || Math.random().toString(36).substr(2, 9)}`,
              state: 'Utah',
              corridor,
              eventType: props.event_type || 'Construction',
              description: descriptionRaw || 'Work zone',
              location: locationText,
              county: props.county || 'Unknown',
              latitude: lat,
              longitude: lng,
              startTime: startRaw,
              endTime: endRaw,
              lanesAffected: lanesRaw || 'Check conditions',
              severity: severityRaw === 'active' ? 'medium' : 'low',
              direction: directionRaw || 'Both',
              requiresCollaboration: false
            };

            normalized.push(attachRawFields(normalizedEvent, {
              startTime: startRaw,
              endTime: endRaw,
              description: descriptionRaw,
              lanesAffected: lanesRaw,
              direction: directionRaw,
              severity: severityRaw,
              corridor,
              coordinates: (lat && lng) ? [lng, lat] : null
            }));
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
            const eventId = coreDetails.road_event_id || props.road_event_id || feature.id || Math.random().toString(36).substr(2, 9);
            const corridor = extractCorridor(locationText);
            const startRaw = props.start_date || coreDetails.start_date || null;
            const endRaw = props.end_date || coreDetails.end_date || null;
            const descriptionRaw = coreDetails.description || props.description || null;
            const lanesRaw = props.vehicle_impact || null;
            const directionRaw = coreDetails.direction || props.direction || null;
            const severityRaw = props.vehicle_impact || null;

            const normalizedEvent = {
              id: `${stateAbbr}-${eventId}`,
              state: stateName,
              corridor,
              eventType: coreDetails.event_type || props.event_type || 'work-zone',
              description: descriptionRaw || 'Work zone',
              location: locationText,
              county: props.county || 'Unknown',
              latitude: lat,
              longitude: lng,
              startTime: startRaw,
              endTime: endRaw,
              lanesAffected: lanesRaw || 'Check conditions',
              severity: (lanesRaw === 'all-lanes-open') ? 'low' : 'medium',
              direction: directionRaw || 'Both',
              requiresCollaboration: false
            };

            normalized.push(attachRawFields(normalizedEvent, {
              startTime: startRaw,
              endTime: endRaw,
              description: descriptionRaw,
              lanesAffected: lanesRaw,
              direction: directionRaw,
              severity: severityRaw,
              corridor,
              coordinates: (lat && lng) ? [lng, lat] : null
            }));
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
            const startRaw = detail?.['event-times']?.['start-time'] || null;
            const endRaw = detail?.['event-times']?.['end-time'] || null;
            const lanesRaw = extractLaneInfo(descText, headlineText);
            const directionRaw = extractDirection(descText, headlineText, corridor, lat, lng);
            const severityRaw = determineSeverityFromText(descText, headlineText);

            const normalizedEvent = {
              id: `${stateName.substring(0, 2).toUpperCase()}-${eventId}`,
              state: stateName,
              corridor: corridor,
              eventType: determineEventType(headlineText, descText),
              description: descText,
              location: locationText,
              county: 'Unknown',
              latitude: lat,
              longitude: lng,
              startTime: startRaw,
              endTime: endRaw,
              lanesAffected: lanesRaw,
              severity: severityRaw,
              direction: directionRaw,
              requiresCollaboration: false
            };

            normalized.push(attachRawFields(normalizedEvent, {
              startTime: startRaw,
              endTime: endRaw,
              lanesAffected: lanesRaw,
              severity: severityRaw,
              direction: directionRaw,
              description: descText,
              corridor,
              coordinates: (lat && lng) ? [lng, lat] : null
            }));
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

            // RAW: What actually exists in the RSS feed structure
            const rawData = {
              eventType: item.eventType ?? item.category ?? null,  // RSS doesn't have this
              startTime: item.pubDate ?? null,  // RSS has pubDate
              endTime: item.endDate ?? null,  // RSS doesn't have this
              description: title || description || null,  // RSS has title/description
              lanesAffected: item.lanes ?? item.lanesAffected ?? null,  // RSS doesn't have this
              severity: item.severity ?? item.priority ?? null,  // RSS doesn't have this
              direction: item.direction ?? null,  // RSS doesn't have this
              corridor: item.route ?? item.corridor ?? null,  // RSS doesn't have this
              coordinates: (latMatch && lonMatch) ? [parseFloat(lonMatch[1]), parseFloat(latMatch[1])] : null  // RSS has lat/lon in text
            };

            // EXTRACTED: What we can infer from text parsing
            const extractedData = {
              eventType: determineEventType(title),
              startTime: item.pubDate ?? null,  // No extraction needed
              endTime: null,  // Can't extract
              description: title || description || null,  // No extraction needed
              lanesAffected: extractLaneInfo(description, title),
              severity: determineSeverityFromText(description, title),
              direction: extractDirection(description, title, corridor, lat, lon),
              corridor: corridor,
              coordinates: (lat && lon) ? [lon, lat] : null
            };

            // NORMALIZED: Final values with fallbacks
            const normalizedEvent = {
              id: `${stateName.substring(0, 2).toUpperCase()}-${Math.random().toString(36).substr(2, 9)}`,
              state: stateName,
              corridor: extractedData.corridor || 'Unknown',
              eventType: extractedData.eventType || 'Unknown',
              description: extractedData.description || 'No description',
              location: locationText,
              county: 'Unknown',
              latitude: lat,
              longitude: lon,
              startTime: extractedData.startTime,
              endTime: null,
              lanesAffected: extractedData.lanesAffected || 'Check conditions',
              severity: extractedData.severity || 'medium',
              direction: extractedData.direction || 'Both',
              requiresCollaboration: false
            };

            normalized.push(attachRawFields(normalizedEvent, rawData, extractedData));
          }
        });
      }
      // Handle CHP (California Highway Patrol) XML feeds
      else if (rawData.State) {
        console.log(`${stateName}: Processing CHP XML feed`);

        // Navigate through the CHP XML structure
        const dispatchCenters = rawData.State.DispatchCenter || [];
        const centerArray = Array.isArray(dispatchCenters) ? dispatchCenters : [dispatchCenters];

        let totalLogs = 0;
        centerArray.forEach(center => {
          const divisions = center.DispatchCenterDivision || [];
          const divArray = Array.isArray(divisions) ? divisions : [divisions];

          divArray.forEach(division => {
            const logs = division.Log || [];
            const logArray = Array.isArray(logs) ? logs : [logs];

            logArray.forEach(log => {
              totalLogs++;

              // Extract fields from CHP log
              const logId = log.$ && log.$.ID ? log.$.ID : 'unknown';
              const logType = log.LogType || 'Unknown';
              const locationRaw = log.Location || 'Unknown location';
              const area = log.Area || 'Unknown';
              const logTime = log.LogTime || new Date().toISOString();

              // Parse LATLON (format: "37940064:121298258" - microdegrees)
              const latlon = log.LATLON || '';
              let lat = 0;
              let lng = 0;
              if (latlon && latlon.includes(':')) {
                const [latStr, lngStr] = latlon.split(':');
                lat = parseFloat(latStr) / 1000000 || 0;
                lng = parseFloat(lngStr) / 1000000 || 0;
              }

              // Extract incident details
              let description = logType;
              if (log.LogDetails && log.LogDetails.details) {
                const details = Array.isArray(log.LogDetails.details)
                  ? log.LogDetails.details
                  : [log.LogDetails.details];
                const detailTexts = details
                  .map(d => d.IncidentDetail)
                  .filter(text => text)
                  .join('; ');
                if (detailTexts) {
                  description = `${logType} - ${detailTexts}`;
                }
              }

              // Only include events on interstate highways
              if (isInterstateRoute(locationRaw)) {
                const corridor = extractCorridor(locationRaw);

                const normalizedEvent = {
                  id: `CHP-${logId}`,
                  state: stateName,
                  corridor: corridor,
                  eventType: logType,
                  description: description,
                  location: locationRaw,
                  county: area,
                  latitude: lat,
                  longitude: lng,
                  startTime: logTime,
                  endTime: null,
                  lanesAffected: 'Check conditions',
                  severity: determineSeverityFromText(description, logType),
                  direction: extractDirection(description, logType, corridor, lat, lng),
                  requiresCollaboration: false
                };

                normalized.push(attachRawFields(normalizedEvent, {
                  startTime: logTime,
                  endTime: null,
                  lanesAffected: 'Check conditions',
                  severity: determineSeverityFromText(description, logType),
                  direction: extractDirection(description, logType, corridor, lat, lng),
                  description: description,
                  corridor,
                  coordinates: (lat && lng) ? [lng, lat] : null
                }));
              }
            });
          });
        });

        console.log(`${stateName}: Processed ${totalLogs} CHP logs, ${normalized.length} on interstate routes`);
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

// Get TMDD standards and format deviation info for a state
// Based on STATE_DATA_STANDARDS_ANALYSIS.md
const getTMDDStandardsInfo = (stateKey, apiUrl, apiType) => {
  // Detect version from URL patterns
  let version = null;
  let compliance = 'Not TMDD';
  let hasCustomHandler = false;
  let deviations = [];

  // FEU-G states (Direct TMDD v3.x compliance)
  if (apiUrl && apiUrl.includes('feu-g.xml')) {
    version = 'TMDD v3.x (FEU-G)';
    compliance = 'Direct TMDD';
    hasCustomHandler = true;
    deviations = [
      'Coordinates in microdegrees (÷1,000,000 conversion required)',
      'Deep namespace nesting with feu: prefix',
      'Multiple description elements joined with semicolons'
    ];
  }
  // WZDx v4.2
  else if ((apiUrl && apiUrl.includes('/wzdx/v4.2')) ||
           (apiUrl && apiUrl.includes('wzdx_v4.1')) ||
           stateKey === 'il' || stateKey === 'ohio') {
    version = 'WZDx v4.2';
    compliance = 'WZDx (TMDD-adjacent)';
    if (stateKey === 'ohio') {
      hasCustomHandler = true;
      deviations = ['Array of objects not GeoJSON', 'Separate endpoints for incidents vs construction'];
    }
  }
  // WZDx v4.1
  else if (stateKey === 'md' || stateKey === 'ma') {
    version = 'WZDx v4.1';
    compliance = 'WZDx (TMDD-adjacent)';
  }
  // WZDx v4.0
  else if ((stateKey === 'utah' || stateKey === 'ut') && apiUrl && apiUrl.includes('/v40/')) {
    version = 'WZDx v4.0';
    compliance = 'WZDx (TMDD-adjacent)';
    hasCustomHandler = true;
    deviations = ['Plain JSON not GeoJSON', 'Custom coordinate extraction for LineString vs Point'];
  }
  // WZDx v4.x (unspecified)
  else if (apiType === 'WZDx') {
    version = 'WZDx v4.x';
    compliance = 'WZDx (TMDD-adjacent)';
  }
  // Nevada Custom JSON
  else if (stateKey === 'nevada') {
    version = 'Custom';
    compliance = 'None (Proprietary)';
    hasCustomHandler = true;
    deviations = ['Root-level array not GeoJSON', 'String coordinates require parseFloat', 'Routes as array'];
  }
  // New Jersey RSS
  else if (stateKey === 'newjersey') {
    version = 'RSS 2.0';
    compliance = 'None (RSS)';
    hasCustomHandler = true;
    deviations = ['Coordinates in unstructured text', 'Regex parsing required for all structured data'];
  }

  return {
    version,
    compliance,
    hasCustomHandler,
    deviations,
    documentationUrl: compliance === 'Direct TMDD'
      ? 'https://www.ite.org/technical-resources/standards/tmdd/'
      : compliance.includes('WZDx')
      ? 'https://github.com/usdot-jpo-ode/wzdx'
      : null
  };
};

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
  const stateName = config?.name || (stateKey === 'pa' ? 'Pennsylvania' : stateKey.toUpperCase());
  const normalizedStateKey = stateKey.toLowerCase();
  const results = { state: stateName, stateKey: normalizedStateKey, events: [], errors: [] };

  if (stateKey === 'pa') {
    try {
      const penndotEvents = await fetchPennDOTRCRS();
      if (penndotEvents && penndotEvents.length > 0) {
        results.events.push(...penndotEvents);
      }
    } catch (error) {
      results.errors.push(`PennDOT RCRS: ${error.message}`);
    }
    return results;
  }

  if (!config) {
    results.errors.push('State configuration not found');
    return results;
  }

  try {
    if (config.format === 'json' || config.format === 'geojson') {
      // Fetch JSON/GeoJSON data
      const headers = {};
      const params = {};

      // Pennsylvania uses Basic Authentication with username/password
      if (config.username && config.password) {
        const credentials = Buffer.from(`${config.username}:${config.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }
      // Other states use API key authentication
      else if (config.apiKey) {
        // Nevada uses ?key= query parameter
        if (config.name === 'Nevada') {
          params.key = config.apiKey;
        }
        // Ohio uses "APIKEY {key}" format in Authorization header
        else if (config.name === 'Ohio') {
          headers['Authorization'] = `APIKEY ${config.apiKey}`;
        }
        // Other states use "Bearer {key}" format in Authorization header
        else {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        }
      }

      // Fetch events
      if (config.eventsUrl) {
        try {
          const response = await axios.get(config.eventsUrl, {
            headers: {
              ...headers,
              'Accept-Encoding': 'gzip, deflate'
            },
            params,
            timeout: 10000,
            decompress: true // Explicitly enable gzip decompression
          });
          const normalized = normalizeEventData(response.data, config.name, config.format, 'events');
          results.events.push(...normalized);
        } catch (error) {
          results.errors.push(`Events: ${error.message}`);
        }
      }

      // Fetch incidents if available (Ohio)
      if (config.incidentsUrl) {
        try {
          const response = await axios.get(config.incidentsUrl, {
            headers: {
              ...headers,
              'Accept-Encoding': 'gzip, deflate'
            },
            timeout: 10000,
            decompress: true // Explicitly enable gzip decompression
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
          const response = await axios.get(config.wzdxUrl, {
            headers: {
              'Accept-Encoding': 'gzip, deflate'
            },
            timeout: 10000,
            decompress: true // Explicitly enable gzip decompression
          });
          const normalized = normalizeEventData(response.data, config.name, 'json', 'wzdx');
          results.events.push(...normalized);
        } catch (error) {
          results.errors.push(`WZDX: ${error.message}`);
        }
      }
    } 
    else if (config.format === 'xml') {
      // Fetch XML data with authentication if needed
      const axiosConfig = {
        timeout: 10000,
        decompress: true, // Explicitly enable gzip decompression
        headers: {
          'Accept-Encoding': 'gzip, deflate'
        }
      };

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

  // Check all events for proximity to interstate interchanges and low-clearance bridges
  if (results.events.length > 0) {
    try {
      await Promise.all(
        results.events.map(async (event) => {
          await checkInterchangeProximity(event, normalizedStateKey);
          await checkBridgeClearanceProximity(event, normalizedStateKey);
        })
      );
    } catch (error) {
      console.error(`Error checking proximity for ${stateName}:`, error);
    }
  }

  // Track data quality metrics for this feed
  try {
    // Calculate quality scores for all events
    const qualityScores = results.events.map(event =>
      dataQualityTracker.assessEventQuality(event)
    );

    // Compute average quality score
    const avgQuality = qualityScores.length > 0
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : 0;

    // Determine success (1 if we got events and no critical errors, 0 otherwise)
    const successCount = results.events.length > 0 && results.errors.length === 0 ? 1 : 0;

    // Update feed metrics
    dataQualityTracker.updateFeedMetrics(
      normalizedStateKey,
      results.events.length,
      successCount,
      avgQuality,
      new Date()
    );
  } catch (error) {
    console.error(`Error tracking quality metrics for ${stateName}:`, error);
  }

  return results;
};

// Main endpoint to fetch all events
app.get('/api/events', async (req, res) => {
  console.log('Fetching events from all states...');

  const allResults = await Promise.all(
    getAllStateKeys().map(stateKey => fetchStateData(stateKey))
  );

  const allEvents = [];
  const allErrors = [];

  allResults.forEach(result => {
    allEvents.push(...result.events);
    if (result.errors.length > 0) {
      allErrors.push({ state: result.state, errors: result.errors });
    }
  });

  // Add Ohio API events (construction + incidents)
  try {
    console.log('Fetching enhanced Ohio events from OHGO API...');
    const ohioEvents = await fetchOhioEvents();
    if (ohioEvents && ohioEvents.length > 0) {
      allEvents.push(...ohioEvents);
      console.log(`Added ${ohioEvents.length} Ohio API events`);
    }
  } catch (error) {
    console.error('Error fetching Ohio API events:', error.message);
    allErrors.push({ state: 'OH (API)', errors: [error.message] });
  }

  // Add California Caltrans LCS events (lane closures from all 12 districts)
  try {
    console.log('Fetching Caltrans LCS events from all districts...');
    const caltransEvents = await fetchCaltransLCS();
    if (caltransEvents && caltransEvents.length > 0) {
      allEvents.push(...caltransEvents);
      console.log(`Added ${caltransEvents.length} Caltrans LCS events`);
    }
  } catch (error) {
    console.error('Error fetching Caltrans LCS events:', error.message);
    allErrors.push({ state: 'CA (LCS)', errors: [error.message] });
  }

  // Deduplicate events by ID (keep first occurrence)
  const seenIds = new Set();
  const uniqueEvents = [];
  let duplicateCount = 0;

  allEvents.forEach(event => {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      uniqueEvents.push(event);
    } else {
      duplicateCount++;
    }
  });

  if (duplicateCount > 0) {
    console.log(`⚠️  Removed ${duplicateCount} duplicate event(s)`);
  }

  console.log(`Fetched ${uniqueEvents.length} unique events (${allEvents.length} total, ${duplicateCount} duplicates removed)`);
  console.log(`Errors from ${allErrors.length} state(s)`);

  // Filter by state query parameter if provided
  let filteredEvents = uniqueEvents;
  const stateFilter = req.query.state;

  if (stateFilter) {
    const stateFilterLower = stateFilter.toLowerCase();
    const stateFilterNormalized = stateFilter.substring(0, 2).toUpperCase(); // e.g., "pa" -> "PA", "ohio" -> "OH"

    filteredEvents = uniqueEvents.filter(event => {
      const eventState = event.state || '';
      const eventStateLower = eventState.toLowerCase();

      // Match by full name (e.g., "Pennsylvania") or abbreviation (e.g., "PA")
      return eventStateLower === stateFilterLower ||
             eventStateLower.startsWith(stateFilterLower) ||
             eventState === stateFilterNormalized;
    });

    console.log(`Filtered to ${filteredEvents.length} events for state: ${stateFilter}`);
  }

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    totalEvents: filteredEvents.length,
    events: filteredEvents,
    errors: allErrors
  });
});

// Endpoint to fetch from a specific state
app.get('/api/events/:state', async (req, res) => {
  const stateKey = req.params.state.toLowerCase();

  if (!API_CONFIG[stateKey] && stateKey !== 'pa') {
    return res.status(404).json({ error: 'State not found' });
  }

  const stateName = API_CONFIG[stateKey]?.name || 'Pennsylvania';
  console.log(`Fetching events from ${stateName}...`);

  const result = await fetchStateData(stateKey);
  result.state = result.state || stateName;

  // Add Ohio API events if requesting Ohio
  if (stateKey === 'ohio') {
    try {
      console.log('Fetching enhanced Ohio events from OHGO API...');
      const ohioEvents = await fetchOhioEvents();
      if (ohioEvents && ohioEvents.length > 0) {
        result.events.push(...ohioEvents);
        console.log(`Added ${ohioEvents.length} Ohio API events`);
      }
    } catch (error) {
      console.error('Error fetching Ohio API events:', error.message);
      result.errors.push(error.message);
    }
  }

  // Add California Caltrans LCS events if requesting California
  if (stateKey === 'ca') {
    try {
      console.log('Fetching Caltrans LCS events from all districts...');
      const caltransEvents = await fetchCaltransLCS();
      if (caltransEvents && caltransEvents.length > 0) {
        result.events.push(...caltransEvents);
        console.log(`Added ${caltransEvents.length} Caltrans LCS events`);
      }
    } catch (error) {
      console.error('Error fetching Caltrans LCS events:', error.message);
      result.errors.push(error.message);
    }
  }

  // Add Pennsylvania PennDOT RCRS events if requesting Pennsylvania
  if (stateKey === 'pa') {
    console.log(`Using ${result.events.length} PennDOT RCRS events for Pennsylvania`);
  }

  // Deduplicate events by ID (keep first occurrence)
  const seenIds = new Set();
  const uniqueEvents = [];
  let duplicateCount = 0;

  result.events.forEach(event => {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      uniqueEvents.push(event);
    } else {
      duplicateCount++;
    }
  });

  if (duplicateCount > 0) {
    console.log(`⚠️  Removed ${duplicateCount} duplicate event(s) for ${result.state}`);
  }

  // Filter out events without valid coordinates (fixes map display issues)
  const validEvents = uniqueEvents.filter(event => {
    // Check for coordinates array [longitude, latitude]
    if (event.coordinates && Array.isArray(event.coordinates) && event.coordinates.length === 2) {
      const [lon, lat] = event.coordinates;
      // Valid coordinates must be non-zero
      if (lon !== 0 && lat !== 0 && !isNaN(lon) && !isNaN(lat)) {
        return true;
      }
    }

    // Check for legacy latitude/longitude fields
    if (event.latitude && event.longitude) {
      const lat = parseFloat(event.latitude);
      const lon = parseFloat(event.longitude);
      if (lat !== 0 && lon !== 0 && !isNaN(lat) && !isNaN(lon)) {
        return true;
      }
    }

    // Check for geometry field (used by some states like Ohio)
    if (event.geometry && event.geometry.coordinates) {
      return true;
    }

    return false;
  });

  const invalidCount = uniqueEvents.length - validEvents.length;
  if (invalidCount > 0) {
    console.log(`🗺️  Filtered out ${invalidCount} event(s) without valid coordinates for ${result.state}`);
  }

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    state: result.state,
    totalEvents: validEvents.length,
    events: validEvents,
    errors: result.errors
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('✅ /api/health endpoint hit!');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    states: getAllStateKeys().length,
    version: '1.1.1' // Updated with database diagnostics
  });
});

// ========================================
// Traffic Impact Warning Endpoints
// ========================================

const TrafficImpactAnalyzer = require('./traffic_impact_analyzer.js');
const impactAnalyzer = new TrafficImpactAnalyzer();

// Get traffic warnings for all corridors
app.get('/api/warnings', async (req, res) => {
  try {
    // Fetch all current events
    const allResults = await Promise.all(
      getAllStateKeys().map(stateKey => fetchStateData(stateKey))
    );

    const allEvents = [];
    allResults.forEach(result => {
      allEvents.push(...result.events);
    });

    // Analyze events and generate warnings
    const warnings = impactAnalyzer.analyzeAllEvents(allEvents);
    const stats = impactAnalyzer.getWarningStatistics(warnings);

    res.json({
      success: true,
      warnings,
      statistics: stats,
      totalEvents: allEvents.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating traffic warnings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate warnings'
    });
  }
});

// Get traffic warnings for a specific corridor
app.get('/api/warnings/corridor/:corridorName', async (req, res) => {
  try {
    const corridorName = req.params.corridorName;

    // Fetch all current events
    const allResults = await Promise.all(
      getAllStateKeys().map(stateKey => fetchStateData(stateKey))
    );

    const allEvents = [];
    allResults.forEach(result => {
      allEvents.push(...result.events);
    });

    // Get warnings for the specific corridor
    const warnings = impactAnalyzer.getCorridorWarnings(allEvents, corridorName);
    const stats = impactAnalyzer.getWarningStatistics(warnings);

    res.json({
      success: true,
      corridor: corridorName,
      warnings,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating corridor warnings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate corridor warnings'
    });
  }
});

// Database diagnostic endpoint
app.get('/api/db-status', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'states.db');
  const dbDir = path.dirname(dbPath);

  const status = {
    databasePath: dbPath,
    databaseDir: dbDir,
    dirExists: fs.existsSync(dbDir),
    fileExists: fs.existsSync(dbPath),
    env: {
      DATABASE_PATH: process.env.DATABASE_PATH || 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set'
    }
  };

  // Try to check dir permissions
  try {
    if (fs.existsSync(dbDir)) {
      const stats = fs.statSync(dbDir);
      status.dirStats = {
        isDirectory: stats.isDirectory(),
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
      };
    }
  } catch (error) {
    status.dirError = error.message;
  }

  // Try to check file permissions if exists
  try {
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      status.fileStats = {
        size: stats.size,
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
      };
    }
  } catch (error) {
    status.fileError = error.message;
  }

  res.json(status);
});

// ==================== USER AUTHENTICATION ENDPOINTS ====================

// User registration
app.post('/api/users/register', (req, res) => {
  const { username, email, password, fullName, organization, stateKey } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Check if user already exists
  const existingUser = db.getUserByUsername(username);
  if (existingUser) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  // Validate state key if provided
  if (stateKey) {
    const state = db.getState(stateKey);
    if (!state) {
      return res.status(400).json({ error: 'Invalid state key' });
    }
  }

  // Create user
  const result = db.createUser({
    username,
    email,
    password,
    fullName,
    organization,
    stateKey
  });

  if (result.success) {
    // Generate JWT token
    const token = jwt.sign(
      {
        id: result.userId,
        username,
        email,
        stateKey,
        role: 'user'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: result.userId,
        username,
        email,
        fullName,
        organization,
        stateKey
      }
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// User login
app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = await db.verifyUserPassword(username, password);

  if (user) {
    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        stateKey: user.stateKey,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        organization: user.organization,
        stateKey: user.stateKey,
        role: user.role
      }
    });
  }

  // User not authenticated - check for fallback credentials
  const fallbackLogin = async (targetUsername, defaultEmail) => {
      let fallbackUser = db.getUserByUsername ? await db.getUserByUsername(targetUsername) : null;
      if (!fallbackUser) {
        const createResult = await db.createUser({
          username: targetUsername,
          email: defaultEmail,
          password,
          fullName: 'DOT Administrator',
          organization: 'DOT Corridor Communicator',
          stateKey: null,
          role: 'admin'
        });
        if (!createResult.success) {
          console.error('Fallback user creation failed:', createResult.error);
          return null;
        }
        fallbackUser = await db.getUserByUsername(targetUsername);
      } else {
        await db.updateUser(fallbackUser.id, {
          password,
          role: 'admin',
          active: true
        });
        fallbackUser = await db.getUserByUsername(targetUsername);
      }

      if (!fallbackUser) return null;

      const token = jwt.sign(
        {
          id: fallbackUser.id,
          username: fallbackUser.username,
          email: fallbackUser.email,
          stateKey: fallbackUser.stateKey,
          role: fallbackUser.role
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return {
        token,
        user: {
          id: fallbackUser.id,
          username: fallbackUser.username,
          email: fallbackUser.email,
          fullName: fallbackUser.fullName,
          organization: fallbackUser.organization,
          stateKey: fallbackUser.stateKey,
          role: fallbackUser.role
        }
    };
    };

    if ((username === 'MM' || username === 'matthew.miller@iowadot.us') && password === 'admin2026') {
      const fallback = await fallbackLogin('matthew.miller@iowadot.us', 'matthew.miller@iowadot.us');
      if (fallback) {
        return res.json({ success: true, message: 'Login successful', ...fallback });
      }
    }

  if ((username === 'admin' || username === 'admin@example.com') && password === 'admin2026') {
    const fallback = await fallbackLogin('admin@example.com', 'admin@example.com');
    if (fallback) {
      return res.json({ success: true, message: 'Login successful', ...fallback });
    }
  }

  res.status(401).json({ error: 'Invalid username or password' });
});

// Verify token and get current user
app.get('/api/users/me', requireUser, (req, res) => {
  const user = db.getUserByUsername(req.user.username);

  if (user) {
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        organization: user.organization,
        stateKey: user.stateKey,
        role: user.role
      }
    });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Update user profile
app.put('/api/users/profile', requireUser, async (req, res) => {
  const { fullName, organization, stateKey, notifyOnMessages, notifyOnHighSeverity } = req.body;

  const user = db.getUserByUsername(req.user.username);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update user information
  const result = await db.updateUser(user.id, {
    fullName,
    organization,
    stateKey: stateKey || null,
    notifyOnMessages: notifyOnMessages !== undefined ? notifyOnMessages : user.notifyOnMessages,
    notifyOnHighSeverity: notifyOnHighSeverity !== undefined ? notifyOnHighSeverity : user.notifyOnHighSeverity
  });

  if (result.success) {
    const updatedUser = db.getUserByUsername(req.user.username);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        organization: updatedUser.organization,
        stateKey: updatedUser.stateKey,
        role: updatedUser.role,
        notifyOnMessages: updatedUser.notifyOnMessages,
        notifyOnHighSeverity: updatedUser.notifyOnHighSeverity
      }
    });
  } else {
    res.status(400).json({ error: result.error || 'Failed to update profile' });
  }
});

// Change password for current user
app.put('/api/users/password', requireUser, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  // Verify current password
  const user = await db.verifyUserPassword(req.user.username, currentPassword);
  if (!user) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Update password
  const result = await db.updateUser(user.id, { password: newPassword });

  if (result.success) {
    res.json({ success: true, message: 'Password changed successfully' });
  } else {
    res.status(400).json({ error: result.error || 'Failed to change password' });
  }
});

// Legacy endpoint - redirect to new endpoint
app.post('/api/users/change-password', requireUser, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  // Verify current password
  const user = await db.verifyUserPassword(req.user.username, currentPassword);
  if (!user) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Update password
  const result = await db.updateUser(user.id, { password: newPassword });

  if (result.success) {
    res.json({ success: true, message: 'Password changed successfully' });
  } else {
    res.status(400).json({ error: result.error || 'Failed to change password' });
  }
});

// Request password reset (sends email with reset token)
app.post('/api/users/request-password-reset', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = db.getUserByUsername(email);
  if (!user) {
    // Don't reveal whether the email exists for security
    return res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  }

  // Generate a temporary password reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

  // Store reset token in database (you'll need to add this functionality to database.js)
  // For now, we'll just send an email with a temporary password
  const tempPassword = crypto.randomBytes(8).toString('hex');
  const result = db.updateUser(user.id, { password: tempPassword });

  if (result.success) {
    // Send email with temporary password
    emailService.sendEmail(
      user.email,
      'Password Reset - DOT Corridor Communicator',
      `Your temporary password is: ${tempPassword}\n\nPlease log in and change your password immediately.`
    );

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } else {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// TEMPORARY: Migrate users table schema (no auth required - REMOVE AFTER USE)
app.post('/api/temp-migrate-schema', async (req, res) => {
  try {
    if (!db.isPostgres) {
      return res.json({ success: true, message: 'SQLite does not need migration' });
    }

    console.log('Running PostgreSQL schema migration...');

    await db.db.pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT');
    console.log('✅ Added full_name column');

    await db.db.pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS organization TEXT');
    console.log('✅ Added organization column');

    await db.db.pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_messages BOOLEAN DEFAULT TRUE');
    console.log('✅ Added notify_on_messages column');

    await db.db.pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_high_severity BOOLEAN DEFAULT TRUE');
    console.log('✅ Added notify_on_high_severity column');

    console.log('✅ Migration complete!');

    res.json({
      success: true,
      message: 'Schema migration completed successfully'
    });
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// TEMPORARY: Direct password reset endpoint (no auth required - REMOVE AFTER USE)
app.post('/api/temp-reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and newPassword required' });
    }

    const user = db.getUserByUsername(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Directly update the password using SQL
    const hashedPassword = db.hashPassword(newPassword);

    if (db.isPostgres) {
      // PostgreSQL
      await db.db.pool.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hashedPassword, user.id]
      );
    } else {
      // SQLite
      db.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, user.id);
    }

    console.log(`✅ Password reset for ${email} - new password: ${newPassword}`);

    res.json({
      success: true,
      message: 'Password reset successful',
      email,
      newPassword
    });
  } catch (error) {
    console.error('Error in temp password reset:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user notification preferences
app.put('/api/users/notifications', requireUser, (req, res) => {
  const { notifyOnMessages, notifyOnHighSeverity } = req.body;

  const result = db.updateUserNotificationPreferences(req.user.id, {
    notifyOnMessages,
    notifyOnHighSeverity
  });

  if (result.success) {
    res.json({
      success: true,
      message: 'Notification preferences updated',
      preferences: {
        notifyOnMessages,
        notifyOnHighSeverity
      }
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// ==================== STATE SUBSCRIPTION ENDPOINTS ====================

// Get user's state subscriptions
app.get('/api/users/subscriptions', requireUser, async (req, res) => {
  try {
    const subscriptions = await db.getUserStateSubscriptions(req.user.id);
    res.json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('Error getting user subscriptions:', error);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

// Set user's state subscriptions (replaces existing)
app.put('/api/users/subscriptions', requireUser, async (req, res) => {
  const { stateKeys } = req.body;

  if (!Array.isArray(stateKeys)) {
    return res.status(400).json({ error: 'stateKeys must be an array' });
  }

  const result = await db.setUserStateSubscriptions(req.user.id, stateKeys);

  if (result.success) {
    res.json({
      success: true,
      message: 'State subscriptions updated',
      subscriptions: stateKeys
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Subscribe to a state
app.post('/api/users/subscriptions/:stateKey', requireUser, async (req, res) => {
  const { stateKey } = req.params;

  const result = await db.subscribeUserToState(req.user.id, stateKey);

  if (result.success) {
    res.json({
      success: true,
      message: `Subscribed to ${stateKey}`,
      stateKey
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Unsubscribe from a state
app.delete('/api/users/subscriptions/:stateKey', requireUser, async (req, res) => {
  const { stateKey } = req.params;

  const result = await db.unsubscribeUserFromState(req.user.id, stateKey);

  if (result.success) {
    res.json({
      success: true,
      message: `Unsubscribed from ${stateKey}`,
      stateKey
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Debug endpoint to check coordinate extraction
app.get('/api/debug/coordinates', async (req, res) => {
  const allResults = await Promise.all(
    getAllStateKeys().map(stateKey => fetchStateData(stateKey))
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

// WORKAROUND: Uncached path to bypass Railway Edge CDN caching
app.post('/xapi/admin/import-facilities', async (req, res) => {
  try {
    console.log('📥 Starting facility import...');

    const fs = require('fs');
    const path = require('path');

    // Read facilities from JSON file
    const facilitiesPath = path.join(__dirname, 'scripts', 'facilities_data.json');
    const facilitiesData = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

    console.log(`Found ${facilitiesData.length} facilities to import`);

    // Delete existing facilities
    await db.runAsync('DELETE FROM parking_facilities');
    console.log('Cleared existing facilities');

    // Import facilities
    let imported = 0;
    for (const f of facilitiesData) {
      try {
        await db.runAsync(
          `INSERT INTO parking_facilities
           (facility_id, site_id, state, capacity, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [f.facility_id, f.site_id, f.state, f.capacity || 0, f.latitude || 0, f.longitude || 0]
        );
        imported++;
        if (imported % 50 === 0) {
          console.log(`Imported ${imported}/${facilitiesData.length}`);
        }
      } catch (err) {
        console.error(`Error importing ${f.facility_id}:`, err.message);
      }
    }

    // Get counts by state
    const stateCountsQuery = `
      SELECT state, COUNT(*) as count
      FROM parking_facilities
      GROUP BY state
      ORDER BY state
    `;
    const stateCounts = await db.allAsync(stateCountsQuery);

    res.json({
      success: true,
      message: `Imported ${imported} facilities`,
      imported,
      total: facilitiesData.length,
      byState: stateCounts
    });

  } catch (error) {
    console.error('Error importing facilities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/xapi/admin/apply-coordinate-offsets', async (req, res) => {
  try {
    console.log('📍 Starting coordinate offset application...');

    const duplicatesQuery = `
      SELECT latitude, longitude,
             STRING_AGG(facility_id, '|') as facilities,
             COUNT(*) as count
      FROM parking_facilities
      WHERE latitude <> 0 AND longitude <> 0
      GROUP BY latitude, longitude
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    const duplicates = await db.allAsync(duplicatesQuery);

    if (duplicates.length === 0) {
      return res.json({
        success: true,
        message: 'No duplicate coordinates found - offsets already applied!',
        offsetCount: 0
      });
    }

    let offsetCount = 0;

    for (const dup of duplicates) {
      const facilityIds = dup.facilities.split('|');
      const baseLatitude = parseFloat(dup.latitude);
      const baseLongitude = parseFloat(dup.longitude);

      const offsetDistance = 0.0005;
      const angleStep = (2 * Math.PI) / facilityIds.length;

      for (let index = 0; index < facilityIds.length; index++) {
        if (index === 0) continue;

        const facilityId = facilityIds[index];
        const angle = angleStep * index;
        const latOffset = Math.sin(angle) * offsetDistance;
        const lonOffset = Math.cos(angle) * offsetDistance;

        const newLat = baseLatitude + latOffset;
        const newLon = baseLongitude + lonOffset;

        await db.runAsync(
          `UPDATE parking_facilities
           SET latitude = $1, longitude = $2
           WHERE facility_id = $3`,
          [newLat, newLon, facilityId]
        );

        offsetCount++;
      }
    }

    res.json({
      success: true,
      message: `Applied offsets to ${offsetCount} facilities`,
      offsetCount,
      duplicateLocationsFound: duplicates.length
    });

  } catch (error) {
    console.error('Error applying coordinate offsets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoint to import facilities from JSON file
app.post('/api/admin/import-facilities', async (req, res) => {
  try {
    console.log('📥 Starting facility import...');

    const fs = require('fs');
    const path = require('path');

    // Read facilities from JSON file
    const facilitiesPath = path.join(__dirname, 'scripts', 'facilities_data.json');
    const facilitiesData = JSON.parse(fs.readFileSync(facilitiesPath, 'utf8'));

    console.log(`Found ${facilitiesData.length} facilities to import`);

    // Delete existing facilities
    await db.runAsync('DELETE FROM parking_facilities');
    console.log('Cleared existing facilities');

    // Import facilities
    let imported = 0;
    for (const f of facilitiesData) {
      try {
        await db.runAsync(
          `INSERT INTO parking_facilities
           (facility_id, site_id, state, capacity, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [f.facility_id, f.site_id, f.state, f.capacity || 0, f.latitude || 0, f.longitude || 0]
        );
        imported++;
        if (imported % 50 === 0) {
          console.log(`Imported ${imported}/${facilitiesData.length}`);
        }
      } catch (err) {
        console.error(`Error importing ${f.facility_id}:`, err.message);
      }
    }

    // Get counts by state
    const stateCountsQuery = `
      SELECT state, COUNT(*) as count
      FROM parking_facilities
      GROUP BY state
      ORDER BY state
    `;
    const stateCounts = await db.allAsync(stateCountsQuery);

    res.json({
      success: true,
      message: `Imported ${imported} facilities`,
      imported,
      total: facilitiesData.length,
      byState: stateCounts
    });

  } catch (error) {
    console.error('Error importing facilities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin endpoint to apply coordinate offsets
app.post('/api/admin/apply-coordinate-offsets', async (req, res) => {
  try {
    console.log('📍 Starting coordinate offset application...');

    // Find facilities with duplicate coordinates
    const duplicatesQuery = `
      SELECT latitude, longitude,
             STRING_AGG(facility_id, '|') as facilities,
             COUNT(*) as count
      FROM parking_facilities
      WHERE latitude <> 0 AND longitude <> 0
      GROUP BY latitude, longitude
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    const duplicates = await db.allAsync(duplicatesQuery);

    if (duplicates.length === 0) {
      return res.json({
        success: true,
        message: 'No duplicate coordinates found - offsets already applied!',
        offsetCount: 0
      });
    }

    let offsetCount = 0;

    for (const dup of duplicates) {
      const facilityIds = dup.facilities.split('|');
      const baseLatitude = parseFloat(dup.latitude);
      const baseLongitude = parseFloat(dup.longitude);

      // Apply small offsets in a circular pattern
      // Offset by ~50 meters (~0.0005 degrees)
      const offsetDistance = 0.0005;
      const angleStep = (2 * Math.PI) / facilityIds.length;

      for (let index = 0; index < facilityIds.length; index++) {
        if (index === 0) continue; // Keep first one at original location

        const facilityId = facilityIds[index];
        const angle = angleStep * index;
        const latOffset = Math.sin(angle) * offsetDistance;
        const lonOffset = Math.cos(angle) * offsetDistance;

        const newLat = baseLatitude + latOffset;
        const newLon = baseLongitude + lonOffset;

        await db.runAsync(
          `UPDATE parking_facilities
           SET latitude = $1, longitude = $2
           WHERE facility_id = $3`,
          [newLat, newLon, facilityId]
        );

        offsetCount++;
      }
    }

    // Verify results
    const remainingQuery = `
      SELECT COUNT(*) as count
      FROM (
        SELECT latitude, longitude
        FROM parking_facilities
        WHERE latitude <> 0 AND longitude <> 0
        GROUP BY latitude, longitude
        HAVING COUNT(*) > 1
      ) AS duplicates
    `;

    const remaining = await db.getAsync(remainingQuery);

    res.json({
      success: true,
      message: `Applied offsets to ${offsetCount} facilities`,
      offsetCount,
      duplicateLocationsFound: duplicates.length,
      remainingDuplicates: remaining.count
    });

  } catch (error) {
    console.error('Error applying coordinate offsets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate normalization report for all states
app.get('/api/analysis/normalization', async (req, res) => {
  console.log('Generating normalization analysis...');

  const allResults = await Promise.all(
    getAllStateKeys().map(stateKey => fetchStateData(stateKey))
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

// Cache for feed alignment analysis (refreshes every 5 minutes)
let feedAlignmentCache = null;
let feedAlignmentCacheTime = null;
const FEED_ALIGNMENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cross-State Feed Alignment Analysis
app.get('/api/analysis/feed-alignment', async (req, res) => {
  try {
    // Check if cache is valid
    if (feedAlignmentCache && feedAlignmentCacheTime &&
        (Date.now() - feedAlignmentCacheTime) < FEED_ALIGNMENT_CACHE_TTL) {
      console.log('✅ Serving feed alignment from cache');
      return res.json(feedAlignmentCache);
    }

    console.log('Analyzing cross-state feed alignment and generating mapping recommendations...');

    // Get all states from API_CONFIG (includes hardcoded states + database states)
    const stateKeys = getAllStateKeys();
    console.log(`📊 Analyzing feed alignment for ${stateKeys.length} states: ${stateKeys.join(', ')}`);

    // Fetch sample events from all states
    const allResults = await Promise.all(
      stateKeys.map(stateKey => fetchStateData(stateKey))
    );

  const alignment = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalStates: allResults.length,
      totalEvents: 0,
      uniqueFieldNames: new Set(),
      commonFields: {},
      formatVariations: {}
    },
    fieldMapping: {
      coordinates: { target: 'latitude/longitude', variations: [], states: {} },
      time: { target: 'startTime/endTime (ISO 8601)', variations: [], states: {} },
      eventType: { target: 'eventType (WZDx enum)', variations: [], states: {} },
      severity: { target: 'severity (high/medium/low)', variations: [], states: {} },
      direction: { target: 'direction (northbound/southbound/etc.)', variations: [], states: {} },
      lanes: { target: 'lanesAffected', variations: [], states: {} },
      location: { target: 'location (text description)', variations: [], states: {} },
      corridor: { target: 'corridor (I-80, US-50, etc.)', variations: [], states: {} },
      description: { target: 'description', variations: [], states: {} }
    },
    stateSpecificMappings: {},
    normalizationRecommendations: []
  };

  // Analyze each state's raw event structure
  allResults.forEach(result => {
    const stateName = result.state;
    const events = result.events || [];

    alignment.summary.totalEvents += events.length;

    if (events.length === 0) {
      alignment.stateSpecificMappings[stateName] = {
        status: 'NO_EVENTS',
        message: 'No events available for analysis'
      };
      return;
    }

    // Get first event as sample for structure analysis
    const sampleEvent = events[0];
    const rawFields = Object.keys(sampleEvent);

    // Track all unique field names
    rawFields.forEach(field => alignment.summary.uniqueFieldNames.add(field));

    // Analyze field mappings
    const stateMapping = {
      sourceFormat: result.format || 'unknown',
      apiType: result.apiType || 'Custom',
      rawFieldsSample: rawFields,
      mappings: {},
      issues: [],
      recommendations: []
    };

    // COORDINATES MAPPING
    if (sampleEvent.latitude || sampleEvent.lat || sampleEvent.Latitude) {
      const latField = sampleEvent.latitude ? 'latitude' : sampleEvent.lat ? 'lat' : 'Latitude';
      const lonField = sampleEvent.longitude ? 'longitude' : sampleEvent.lon ? 'lon' : sampleEvent.Longitude ? 'Longitude' : 'lng';
      stateMapping.mappings.coordinates = { from: `${latField}/${lonField}`, to: 'latitude/longitude', status: 'MAPPED' };
      if (!alignment.fieldMapping.coordinates.variations.includes(latField)) {
        alignment.fieldMapping.coordinates.variations.push(latField);
      }
    } else if (sampleEvent.geometry || sampleEvent.coordinates) {
      stateMapping.mappings.coordinates = { from: 'geometry/coordinates', to: 'latitude/longitude', status: 'NESTED', note: 'Coordinates in nested structure' };
      stateMapping.recommendations.push('Extract coordinates from nested geometry object to top-level latitude/longitude fields');
    } else {
      stateMapping.mappings.coordinates = { status: 'MISSING' };
      stateMapping.issues.push('No coordinate fields detected - unable to map events geographically');
    }

    // TIME MAPPING
    if (sampleEvent.startTime || sampleEvent.start_time || sampleEvent.start_date || sampleEvent.created_at) {
      const timeField = sampleEvent.startTime ? 'startTime' : sampleEvent.start_time ? 'start_time' : sampleEvent.start_date ? 'start_date' : 'created_at';
      stateMapping.mappings.time = { from: timeField, to: 'startTime (ISO 8601)', status: 'MAPPED' };

      // Check if time format is ISO 8601
      const timeValue = sampleEvent[timeField];
      if (timeValue && !timeValue.includes('T') && !timeValue.includes('Z')) {
        stateMapping.issues.push(`Time field "${timeField}" is not in ISO 8601 format (lacks T separator or Z timezone)`);
        stateMapping.recommendations.push(`Convert ${timeField} to ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ`);
      }

      if (!alignment.fieldMapping.time.variations.includes(timeField)) {
        alignment.fieldMapping.time.variations.push(timeField);
      }
    } else {
      stateMapping.mappings.time = { status: 'MISSING' };
      stateMapping.issues.push('No timestamp field detected - events cannot be temporally ordered');
    }

    // EVENT TYPE MAPPING
    if (sampleEvent.eventType || sampleEvent.event_type || sampleEvent.type || sampleEvent.category) {
      const typeField = sampleEvent.eventType ? 'eventType' : sampleEvent.event_type ? 'event_type' : sampleEvent.type ? 'type' : 'category';
      const typeValue = sampleEvent[typeField];
      stateMapping.mappings.eventType = { from: typeField, to: 'eventType (WZDx enum)', status: 'MAPPED', sample: typeValue };

      // Check if it matches WZDx enum
      const wzdxTypes = ['work-zone', 'detour', 'incident', 'weather-condition', 'restriction'];
      if (typeValue && !wzdxTypes.some(t => typeValue.toLowerCase().includes(t.toLowerCase()))) {
        stateMapping.recommendations.push(`Map "${typeValue}" to WZDx standard event types: ${wzdxTypes.join(', ')}`);
      }

      if (!alignment.fieldMapping.eventType.variations.includes(typeField)) {
        alignment.fieldMapping.eventType.variations.push(typeField);
      }
    } else {
      stateMapping.mappings.eventType = { status: 'MISSING' };
      stateMapping.issues.push('No event type/category field - cannot classify events');
    }

    // SEVERITY MAPPING
    if (sampleEvent.severity || sampleEvent.priority || sampleEvent.impact || sampleEvent.urgency) {
      const sevField = sampleEvent.severity ? 'severity' : sampleEvent.priority ? 'priority' : sampleEvent.impact ? 'impact' : 'urgency';
      const sevValue = sampleEvent[sevField];
      stateMapping.mappings.severity = { from: sevField, to: 'severity (high/medium/low)', status: 'MAPPED', sample: sevValue };

      // Check if it uses standard values
      const standardValues = ['high', 'medium', 'low', 'critical', 'minor'];
      if (sevValue && !standardValues.some(v => sevValue.toLowerCase().includes(v))) {
        stateMapping.recommendations.push(`Standardize severity values to: high, medium, low (current: "${sevValue}")`);
      }

      if (!alignment.fieldMapping.severity.variations.includes(sevField)) {
        alignment.fieldMapping.severity.variations.push(sevField);
      }
    } else {
      stateMapping.mappings.severity = { status: 'MISSING' };
    }

    // DIRECTION MAPPING
    if (sampleEvent.direction || sampleEvent.Direction || sampleEvent.lane_direction) {
      const dirField = sampleEvent.direction ? 'direction' : sampleEvent.Direction ? 'Direction' : 'lane_direction';
      const dirValue = sampleEvent[dirField];
      stateMapping.mappings.direction = { from: dirField, to: 'direction', status: 'MAPPED', sample: dirValue };

      if (!alignment.fieldMapping.direction.variations.includes(dirField)) {
        alignment.fieldMapping.direction.variations.push(dirField);
      }
    } else {
      stateMapping.mappings.direction = { status: 'MISSING' };
    }

    // LANES MAPPING
    if (sampleEvent.lanesAffected || sampleEvent.lanes_affected || sampleEvent.lanes || sampleEvent.lane_closure) {
      const laneField = sampleEvent.lanesAffected ? 'lanesAffected' : sampleEvent.lanes_affected ? 'lanes_affected' : sampleEvent.lanes ? 'lanes' : 'lane_closure';
      stateMapping.mappings.lanes = { from: laneField, to: 'lanesAffected', status: 'MAPPED' };

      if (!alignment.fieldMapping.lanes.variations.includes(laneField)) {
        alignment.fieldMapping.lanes.variations.push(laneField);
      }
    } else {
      stateMapping.mappings.lanes = { status: 'MISSING' };
    }

    // LOCATION MAPPING
    if (sampleEvent.location || sampleEvent.Location || sampleEvent.location_description) {
      const locField = sampleEvent.location ? 'location' : sampleEvent.Location ? 'Location' : 'location_description';
      stateMapping.mappings.location = { from: locField, to: 'location', status: 'MAPPED' };

      if (!alignment.fieldMapping.location.variations.includes(locField)) {
        alignment.fieldMapping.location.variations.push(locField);
      }
    } else {
      stateMapping.mappings.location = { status: 'MISSING' };
      stateMapping.issues.push('No location text field - difficult for human readers to understand event location');
    }

    // CORRIDOR MAPPING
    if (sampleEvent.corridor || sampleEvent.route || sampleEvent.roadway || sampleEvent.highway) {
      const corrField = sampleEvent.corridor ? 'corridor' : sampleEvent.route ? 'route' : sampleEvent.roadway ? 'roadway' : 'highway';
      stateMapping.mappings.corridor = { from: corrField, to: 'corridor', status: 'MAPPED' };

      if (!alignment.fieldMapping.corridor.variations.includes(corrField)) {
        alignment.fieldMapping.corridor.variations.push(corrField);
      }
    } else {
      stateMapping.mappings.corridor = { status: 'INFERRED', note: 'Extracted from location text' };
      stateMapping.recommendations.push('Add explicit corridor/route field for better filtering and cross-state coordination');
    }

    // DESCRIPTION MAPPING
    if (sampleEvent.description || sampleEvent.Description || sampleEvent.details || sampleEvent.message) {
      const descField = sampleEvent.description ? 'description' : sampleEvent.Description ? 'Description' : sampleEvent.details ? 'details' : 'message';
      stateMapping.mappings.description = { from: descField, to: 'description', status: 'MAPPED' };

      if (!alignment.fieldMapping.description.variations.includes(descField)) {
        alignment.fieldMapping.description.variations.push(descField);
      }
    } else {
      stateMapping.mappings.description = { status: 'MISSING' };
    }

    alignment.stateSpecificMappings[stateName] = stateMapping;
  });

  // Convert Set to Array for JSON serialization
  alignment.summary.uniqueFieldNames = Array.from(alignment.summary.uniqueFieldNames);

  // Generate normalization recommendations
  alignment.normalizationRecommendations = [
    {
      priority: 'CRITICAL',
      category: 'Field Standardization',
      issue: `${alignment.fieldMapping.coordinates.variations.length} different coordinate field naming patterns detected`,
      recommendation: 'Standardize all feeds to use "latitude" and "longitude" fields at top level',
      affectedStates: Object.entries(alignment.stateSpecificMappings)
        .filter(([_, m]) => m.mappings && m.mappings.coordinates && m.mappings.coordinates.from !== 'latitude/longitude')
        .map(([state]) => state),
      implementation: 'Add normalization logic to map all coordinate variations to standard latitude/longitude fields',
      codeExample: `
// Normalize coordinates from various field names
event.latitude = event.latitude || event.lat || event.Latitude || geometry?.coordinates?.[1];
event.longitude = event.longitude || event.lon || event.lng || geometry?.coordinates?.[0];
      `.trim()
    },
    {
      priority: 'HIGH',
      category: 'Time Format Standardization',
      issue: `${alignment.fieldMapping.time.variations.length} different time field naming patterns detected`,
      recommendation: 'Convert all timestamps to ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ) in "startTime" field',
      affectedStates: Object.entries(alignment.stateSpecificMappings)
        .filter(([_, m]) => m.issues && m.issues.some(i => i.includes('ISO 8601')))
        .map(([state]) => state),
      implementation: 'Parse existing time formats and convert to ISO 8601',
      codeExample: `
// Normalize time fields to ISO 8601
const rawTime = event.startTime || event.start_time || event.start_date || event.created_at;
event.startTime = new Date(rawTime).toISOString(); // Ensures YYYY-MM-DDTHH:MM:SS.sssZ format
      `.trim()
    },
    {
      priority: 'HIGH',
      category: 'Event Type Taxonomy',
      issue: 'Multiple event type categorization schemes in use',
      recommendation: 'Map all event types to WZDx v4.x standard event type enum',
      mapping: {
        'work-zone': ['Construction', 'Work Zone', 'Maintenance', 'Road Work'],
        'incident': ['Accident', 'Crash', 'Collision', 'Incident'],
        'weather-condition': ['Weather', 'Winter', 'Ice', 'Snow', 'Fog'],
        'restriction': ['Closure', 'Detour', 'Road Closed'],
        'detour': ['Detour', 'Alternate Route']
      },
      implementation: 'Create mapping function that translates state-specific types to WZDx types',
      codeExample: `
// Map state-specific event types to WZDx standard
const typeMapping = {
  'construction': 'work-zone',
  'accident': 'incident',
  'weather': 'weather-condition',
  'closure': 'restriction'
};
event.eventType = typeMapping[event.eventType.toLowerCase()] || event.eventType;
      `.trim()
    },
    {
      priority: 'MEDIUM',
      category: 'Severity Standardization',
      issue: 'Inconsistent severity/priority value schemes',
      recommendation: 'Normalize all severity values to three-level system: high, medium, low',
      mapping: {
        'high': ['critical', 'severe', 'major', 'high', '1', 'urgent'],
        'medium': ['moderate', 'medium', '2', 'normal'],
        'low': ['minor', 'low', '3', 'info']
      },
      implementation: 'Map all severity variations to standard three-level system'
    },
    {
      priority: 'MEDIUM',
      category: 'Field Naming Consistency',
      issue: 'Mix of camelCase, snake_case, and PascalCase field names across states',
      recommendation: 'Standardize all normalized output to camelCase (WZDx standard)',
      examples: {
        correct: 'lanesAffected, eventType, startTime',
        incorrect: 'lanes_affected, EventType, start_time'
      },
      implementation: 'Use consistent camelCase naming in normalization layer'
    }
  ];

  alignment.normalizationRecommendations.push({
    priority: 'HIGH',
    category: 'Corridor Standardization',
    issue: 'Multiple corridor naming conventions detected (e.g., "I80", "Interstate 80", "I-080")',
    recommendation: 'Normalize interstate corridors to canonical "I-XX" format before filtering or comparisons',
    implementation: 'Convert corridor values to uppercase, strip spaces, pad zeros, and output as `I-<number>`.'
  });

    // Cache the result
    feedAlignmentCache = alignment;
    feedAlignmentCacheTime = Date.now();
    console.log('✅ Feed alignment analysis complete, cached for 5 minutes');

    res.json(alignment);
  } catch (error) {
    console.error('❌ Error in feed alignment analysis:', error);
    res.status(500).json({
      error: 'Failed to analyze feed alignment',
      message: error.message
    });
  }
});

// Convert events to SAE J2735-style Traveler Information Messages
app.get('/api/convert/tim', async (req, res) => {
  console.log('Converting events to SAE J2735 TIM format (includes WZDx, Ohio OHGO, Caltrans LCS)...');

  // Extract bounding box parameters from query string
  const { minLat, maxLat, minLon, maxLon } = req.query;
  const boundingBox = (minLat && maxLat && minLon && maxLon) ? { minLat, maxLat, minLon, maxLon } : null;

  if (boundingBox) {
    console.log(`📍 Bounding box filter requested: (${minLat},${minLon}) to (${maxLat},${maxLon})`);
  }

  const allResults = await Promise.all(
    getAllStateKeys().map(stateKey => fetchStateData(stateKey))
  );

  const allEvents = [];
  allResults.forEach(result => allEvents.push(...result.events));

  // Add Ohio OHGO API events
  try {
    const ohioEvents = await fetchOhioEvents();
    if (ohioEvents && ohioEvents.length > 0) {
      allEvents.push(...ohioEvents);
      console.log(`Added ${ohioEvents.length} Ohio OHGO events to TIM conversion`);
    }
  } catch (error) {
    console.error('Error fetching Ohio events for TIM:', error.message);
  }

  // Add California Caltrans LCS events
  try {
    const caltransEvents = await fetchCaltransLCS();
    if (caltransEvents && caltransEvents.length > 0) {
      allEvents.push(...caltransEvents);
      console.log(`Added ${caltransEvents.length} Caltrans LCS events to TIM conversion`);
    }
  } catch (error) {
    console.error('Error fetching Caltrans events for TIM:', error.message);
  }

  // Deduplicate events by ID (keep first occurrence)
  const seenIds = new Set();
  const uniqueEvents = [];
  let duplicateCount = 0;

  allEvents.forEach(event => {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      uniqueEvents.push(event);
    } else {
      duplicateCount++;
    }
  });

  if (duplicateCount > 0) {
    console.log(`⚠️  Removed ${duplicateCount} duplicate event(s) in TIM conversion`);
  }

  console.log(`Total events for TIM conversion: ${uniqueEvents.length} (${allEvents.length} before dedup)`);

  // Apply bounding box filter if provided
  const filteredEvents = boundingBox ? filterEventsByBoundingBox(uniqueEvents, boundingBox) : uniqueEvents;

  // Convert to TIM-style messages
  const timMessages = filteredEvents.map(event => {
    // Generate VMS-style message (Variable Message Sign text)
    const vmsMessage = generateVMSMessage(event);

    // Generate full TIM structure (simplified version of SAE J2735)
    // Handle both WZDx (startTime/endTime) and Ohio/Caltrans (startDate/endDate) field names
    const startDateTime = event.startTime || event.startDate;
    const endDateTime = event.endTime || event.endDate;

    // Handle both coordinate formats: latitude/longitude fields or coordinates array
    const latitude = event.latitude || (event.coordinates && event.coordinates[1]);
    const longitude = event.longitude || (event.coordinates && event.coordinates[0]);

    return {
      msgCnt: Math.floor(Math.random() * 127), // Message count
      timeStamp: startDateTime ? new Date(startDateTime).toISOString() : new Date().toISOString(),
      packetID: event.id,
      urlB: null,
      dataFrames: [
        {
          startTime: startDateTime,
          durationTime: endDateTime && startDateTime ? Math.floor((new Date(endDateTime) - new Date(startDateTime)) / 60000) : null, // minutes
          priority: event.severity === 'high' ? 0 : event.severity === 'medium' ? 1 : 2,
          regions: [
            {
              name: event.state,
              anchorPosition: {
                lat: latitude,
                long: longitude,
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

// ==================== SAE J2540 COMMERCIAL VEHICLE TIM ENDPOINT ====================
// SAE J2540 extends J2735 with commercial vehicle-specific information
app.get('/api/convert/tim-cv', async (req, res) => {
  console.log('Converting events to SAE J2540 Commercial Vehicle TIM format...');

  // Extract bounding box parameters from query string
  const { minLat, maxLat, minLon, maxLon } = req.query;
  const boundingBox = (minLat && maxLat && minLon && maxLon) ? { minLat, maxLat, minLon, maxLon } : null;

  if (boundingBox) {
    console.log(`📍 Bounding box filter requested: (${minLat},${minLon}) to (${maxLat},${maxLon})`);
  }

  // Fetch all events (same as regular TIM)
  const allResults = await Promise.all(
    getAllStateKeys().map(stateKey => fetchStateData(stateKey))
  );

  const allEvents = [];
  allResults.forEach(result => allEvents.push(...result.events));

  // Add Ohio OHGO API events
  try {
    const ohioEvents = await fetchOhioEvents();
    if (ohioEvents && ohioEvents.length > 0) {
      allEvents.push(...ohioEvents);
      console.log(`Added ${ohioEvents.length} Ohio OHGO events to CV-TIM conversion`);
    }
  } catch (error) {
    console.error('Error fetching Ohio events for CV-TIM:', error.message);
  }

  // Add California Caltrans LCS events
  try {
    const caltransEvents = await fetchCaltransLCS();
    if (caltransEvents && caltransEvents.length > 0) {
      allEvents.push(...caltransEvents);
      console.log(`Added ${caltransEvents.length} Caltrans LCS events to CV-TIM conversion`);
    }
  } catch (error) {
    console.error('Error fetching Caltrans events for CV-TIM:', error.message);
  }

  // Deduplicate events by ID (keep first occurrence)
  const seenIds = new Set();
  const uniqueEvents = [];
  let duplicateCount = 0;

  allEvents.forEach(event => {
    if (!seenIds.has(event.id)) {
      seenIds.add(event.id);
      uniqueEvents.push(event);
    } else {
      duplicateCount++;
    }
  });

  if (duplicateCount > 0) {
    console.log(`⚠️  Removed ${duplicateCount} duplicate event(s) in CV-TIM conversion`);
  }

  console.log(`Total events for CV-TIM conversion: ${uniqueEvents.length} (${allEvents.length} before dedup)`);

  // Apply bounding box filter if provided
  const filteredEvents = boundingBox ? filterEventsByBoundingBox(uniqueEvents, boundingBox) : uniqueEvents;

  // Convert to Commercial Vehicle TIM messages (J2540)
  const cvTimMessages = filteredEvents.map(event => {
    const vmsMessage = generateVMSMessage(event);
    const startDateTime = event.startTime || event.startDate;
    const endDateTime = event.endTime || event.endDate;
    const latitude = event.latitude || (event.coordinates && event.coordinates[1]);
    const longitude = event.longitude || (event.coordinates && event.coordinates[0]);

    // Base J2735 structure
    const baseTIM = {
      msgCnt: Math.floor(Math.random() * 127),
      timeStamp: startDateTime ? new Date(startDateTime).toISOString() : new Date().toISOString(),
      packetID: event.id,
      urlB: null,
      dataFrames: [
        {
          startTime: startDateTime,
          durationTime: endDateTime && startDateTime ? Math.floor((new Date(endDateTime) - new Date(startDateTime)) / 60000) : null,
          priority: event.severity === 'high' ? 0 : event.severity === 'medium' ? 1 : 2,
          regions: [
            {
              name: event.state,
              anchorPosition: {
                lat: latitude,
                long: longitude,
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
                itis: getITISCode(event.eventType),
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
      vmsMessage: vmsMessage,
      wzdx_event_type: mapToWZDxEventType(event.eventType),
      original_event: event
    };

    // SAE J2540 Commercial Vehicle Extensions
    baseTIM.commercialVehicle = {
      // Truck-specific restrictions
      restrictions: {
        truckRestricted: event.roadStatus === 'Closed' || (event.lanesClosed && parseInt(event.lanesClosed) > 0),
        hazmatRestricted: event.category && event.category.toLowerCase().includes('hazmat'),
        oversizeRestricted: event.category && (event.category.toLowerCase().includes('bridge') || event.category.toLowerCase().includes('oversize')),
        // Weight/height restrictions would come from additional data sources
        weightLimit: null, // kg - would need bridge/route data
        heightLimit: null, // cm - would need clearance data
        lengthLimit: null  // cm - would need route data
      },

      // Lane impact for trucks
      laneImpact: {
        totalLanes: event.totalLanes || null,
        lanesAffected: event.lanesClosed || event.lanesAffected || null,
        rightLanesClosed: event.lanesClosed ? event.lanesClosed.includes('R') || event.lanesClosed.includes('right') : false,
        shoulderClosed: event.description && event.description.toLowerCase().includes('shoulder')
      },

      // Advisory messages for truck drivers
      advisories: generateTruckAdvisories(event),

      // Parking information (if available)
      parking: {
        hasNearbyParking: false, // Would check TPIMS data for nearby facilities
        parkingFacilities: [], // Would list nearby truck parking from TPIMS
        estimatedDelay: estimateTruckDelay(event)
      },

      // Route guidance
      routeGuidance: {
        suggestedDetour: null, // Could integrate with route planning
        alternateRoute: null,
        avoidArea: event.roadStatus === 'Closed'
      }
    };

    return baseTIM;
  });

  res.json({
    format: 'SAE J2540 Commercial Vehicle TIM (Extended with CV-specific data)',
    timestamp: new Date().toISOString(),
    messageCount: cvTimMessages.length,
    messages: cvTimMessages,
    cvExtensions: {
      description: 'SAE J2540 extensions include truck restrictions, lane impacts, parking info, and route guidance',
      features: [
        'Truck-specific restrictions (hazmat, oversize, weight, height)',
        'Detailed lane impact analysis for trucks',
        'Commercial vehicle advisories',
        'Truck parking availability (when available)',
        'Route guidance and detour suggestions'
      ]
    }
  });
});

// Helper: Generate truck-specific advisories
const generateTruckAdvisories = (event) => {
  const advisories = [];

  // Lane closure advisories
  if (event.lanesClosed || event.lanesAffected) {
    if (event.lanesClosed && event.lanesClosed.includes('R')) {
      advisories.push('Right lane closed - trucks use left lanes');
    }
    if (event.lanesAffected && event.lanesAffected.toLowerCase().includes('all')) {
      advisories.push('CRITICAL: All lanes affected - expect severe delays');
    }
  }

  // Road status advisories
  if (event.roadStatus === 'Closed') {
    advisories.push('ROAD CLOSED - Find alternate route');
  } else if (event.roadStatus === 'Restricted') {
    advisories.push('Lane restrictions in effect - reduce speed');
  }

  // Facility-specific advisories (Caltrans)
  if (event.facility) {
    if (event.facility === 'Ramp') {
      advisories.push('Ramp closure - plan alternate exit/entrance');
    } else if (event.facility === 'Connector') {
      advisories.push('Connector closed - check alternate routes');
    }
  }

  // Work zone advisories
  if (event.type === 'work-zone' || event.eventType === 'Construction') {
    advisories.push('Active work zone - workers present, reduce speed');
  }

  // Severity-based advisories
  if (event.severity === 'Major' || event.severity === 'high') {
    advisories.push('HIGH PRIORITY: Major traffic impact expected');
  }

  // Category-specific advisories
  if (event.category) {
    const category = event.category.toLowerCase();
    if (category.includes('bridge')) {
      advisories.push('Bridge work - oversized loads check clearances');
    }
    if (category.includes('paving') || category.includes('grinding')) {
      advisories.push('Paving operations - expect rough surface and delays');
    }
  }

  return advisories.length > 0 ? advisories : ['Monitor conditions and plan accordingly'];
};

// Helper: Estimate delay for trucks (more conservative than cars)
const estimateTruckDelay = (event) => {
  let delayMinutes = 0;

  // Base delay from severity
  if (event.severity === 'Major' || event.severity === 'high') {
    delayMinutes = 30;
  } else if (event.severity === 'Moderate' || event.severity === 'medium') {
    delayMinutes = 15;
  } else {
    delayMinutes = 5;
  }

  // Additional delay for closures
  if (event.roadStatus === 'Closed') {
    delayMinutes += 45; // Detour time
  } else if (event.roadStatus === 'Restricted') {
    delayMinutes += 10;
  }

  // Additional delay for lane closures (trucks slower to merge)
  if (event.lanesClosed && event.totalLanes) {
    const percentClosed = parseInt(event.lanesClosed.split(',').length) / parseInt(event.totalLanes);
    delayMinutes += Math.floor(percentClosed * 20);
  }

  return delayMinutes > 0 ? `${delayMinutes} minutes` : 'Minimal';
};

// Helper: Generate VMS-style message text (for highway signs)
// Enhanced to support WZDx, Ohio OHGO, and Caltrans LCS events
const generateVMSMessage = (event) => {
  const messages = [];

  // Line 1: Event type/category and severity
  const eventLabel = event.category || event.eventType || event.type;
  if (event.severity === 'Major' || event.severity === 'high') {
    messages.push(`*** ${eventLabel.toUpperCase()} ***`);
  } else {
    messages.push(eventLabel.toUpperCase());
  }

  // Line 2: Location (corridor + direction)
  let locationLine = '';
  if (event.corridor) {
    locationLine = event.corridor;
    if (event.direction && event.direction !== 'Both') {
      locationLine += ` ${event.direction.toUpperCase()}`;
    }
  } else if (event.location) {
    locationLine = event.location.substring(0, 40);
  }
  if (locationLine) messages.push(locationLine);

  // Line 3: Impact - prioritize specific lane/road status info
  let impactLine = '';

  // Caltrans LCS specific: detailed lane closure info
  if (event.lanesClosed && event.totalLanes) {
    const lanesArray = event.lanesClosed.split(',').map(l => l.trim());
    if (event.facility === 'Ramp' && event.roadStatus === 'Closed') {
      impactLine = 'RAMP CLOSED';
    } else if (lanesArray.length >= parseInt(event.totalLanes)) {
      impactLine = 'ALL LANES CLOSED';
    } else {
      impactLine = `LANES ${event.lanesClosed} OF ${event.totalLanes} CLOSED`;
    }
  }
  // Ohio OHGO specific: road status
  else if (event.roadStatus) {
    if (event.roadStatus === 'Closed') {
      impactLine = 'ROAD CLOSED';
    } else if (event.roadStatus === 'Restricted') {
      impactLine = 'LANE RESTRICTIONS';
    } else {
      impactLine = 'USE CAUTION';
    }
  }
  // WZDx legacy: lanesAffected
  else if (event.lanesAffected && event.lanesAffected !== 'Check conditions' && event.lanesAffected !== 'Unknown') {
    impactLine = event.lanesAffected.toUpperCase();
  }
  // Fallback based on event type
  else if (event.type === 'restriction' || event.eventType === 'Closure') {
    impactLine = 'ROAD CLOSED';
  } else {
    impactLine = 'USE CAUTION';
  }

  if (impactLine) messages.push(impactLine);

  // Line 4: Facility type (for Caltrans) or direction
  if (event.facility && event.facility !== 'Mainline') {
    messages.push(event.facility.toUpperCase());
  } else if (event.direction && event.direction !== 'Both' && !locationLine.includes(event.direction.toUpperCase())) {
    messages.push(`${event.direction.toUpperCase()} ONLY`);
  }

  return messages.join(' / ');
};

// Note: getITISCode function is now defined at the top of the file with comprehensive ITIS mappings

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

// ==================== WZDx v4.x VALIDATION FUNCTIONS ====================

// WZDx v4.x specification validators
const WZDxValidators = {
  // Valid WZDx event_type enum values (WZDx v4.x spec)
  validEventTypes: [
    'work-zone',
    'detour',
    'restriction',
    'incident',
    'weather-event',
    'special-event',
    'road-hazard'
  ],

  // Valid WZDx direction enum values
  validDirections: [
    'northbound',
    'southbound',
    'eastbound',
    'westbound',
    'inner-loop',
    'outer-loop',
    'undefined'  // Allowed for bidirectional
  ],

  // Valid WZDx vehicle_impact enum values
  validVehicleImpacts: [
    'all-lanes-open',
    'some-lanes-closed',
    'all-lanes-closed',
    'alternating-one-way',
    'some-lanes-closed-merge-left',
    'some-lanes-closed-merge-right',
    'all-lanes-open-shift-left',
    'all-lanes-open-shift-right',
    'some-lanes-closed-split',
    'flagging',
    'temporary-traffic-signal',
    'unknown'
  ],

  // Check if timestamp is valid ISO 8601
  isValidISO8601: (timestamp) => {
    if (!timestamp) return false;
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?([+-]\d{2}:\d{2})?$/;
    if (!iso8601Regex.test(timestamp)) return false;
    // Verify it's a valid date
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  },

  // Check if event_type matches WZDx spec
  isValidEventType: (eventType) => {
    if (!eventType) return false;
    return WZDxValidators.validEventTypes.includes(eventType.toLowerCase());
  },

  // Check if direction matches WZDx spec
  isValidDirection: (direction) => {
    if (!direction) return false;
    return WZDxValidators.validDirections.includes(direction.toLowerCase());
  },

  // Check if vehicle_impact matches WZDx spec
  isValidVehicleImpact: (impact) => {
    if (!impact) return false;
    return WZDxValidators.validVehicleImpacts.includes(impact.toLowerCase().replace(/_/g, '-'));
  }
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

  // Analyze the state's data quality and collect violation examples
  // Track VALID values only - not just presence
  const analysis = {
    hasCoordinates: 0,
    hasValidCoordinates: 0,
    hasStartTime: 0,
    hasValidStartTime: 0,
    hasEndTime: 0,
    hasEventType: 0,
    hasValidEventType: 0,
    hasSeverity: 0,
    hasDirection: 0,
    hasValidDirection: 0,
    hasLaneInfo: 0,
    hasValidLaneInfo: 0,
    hasDescription: 0,
    hasCorridor: 0,
    // SAE J2735 specific validation
    hasPreciseGPS: 0,        // GPS with 5+ decimal places (~1m precision)
    hasMillisecondTime: 0,   // Timestamps with millisecond precision
    hasITISMappableType: 0,  // Event types mappable to ITIS codes
    hasPriorityField: 0,     // Severity field for TIM priority mapping

    // TMDD v3.1 specific validation
    hasStructuredLinearRef: 0,  // Route + milepost as structured fields
    hasMilepostData: 0,         // Milepost or mile marker in location
    hasOrganizationId: 0,       // TMC/DOT organization identifier
    hasEventStatusField: 0,     // Event status (active, planned, archived)
    hasStructuredLanes: 0,      // Lane numbers/identifiers (not just text)

    // SAE J2540-2 Weather Information Message specific validation
    weatherEvents: 0,               // Total weather-related events
    hasWeatherCondition: 0,         // Structured weather condition codes (not just "weather")
    hasSurfaceCondition: 0,         // Road surface status (dry/wet/icy/snow-covered)
    hasVisibility: 0,               // Visibility distance in meters
    hasTemperature: 0,              // Temperature data for ice/frost prediction
    hasPrecipitationType: 0,        // Precipitation type (rain/snow/sleet)
    hasPrecipitationIntensity: 0,   // Precipitation intensity (light/moderate/heavy)
    hasWeatherSensorTime: 0         // Weather data timestamp for freshness
  };

  // Collect violation examples (max 5 per category)
  const violations = {
    missingCoordinates: [],
    invalidTimestamps: [],
    invalidEventTypes: [],
    invalidDirections: [],
    missingRequired: [],
    invalidVehicleImpact: []
  };

  const isWzdx = stateConfig.apiType === 'WZDx';
  const MAX_EXAMPLES = 5;

  result.events.forEach(event => {
    // Check coordinates
    if (event.latitude && event.longitude) {
      analysis.hasCoordinates++;
      // Valid coordinates: non-zero, within valid lat/lon ranges
      if (event.latitude !== 0 && event.longitude !== 0 &&
          event.latitude >= -90 && event.latitude <= 90 &&
          event.longitude >= -180 && event.longitude <= 180) {
        analysis.hasValidCoordinates++;
      } else if (violations.missingCoordinates.length < MAX_EXAMPLES) {
        violations.missingCoordinates.push({
          eventId: event.id,
          location: event.location || 'Unknown',
          issue: event.latitude === 0 || event.longitude === 0 ? 'Coordinates are 0,0' : 'Coordinates out of valid range',
          actual: { lat: event.latitude, lon: event.longitude }
        });
      }
    } else if (violations.missingCoordinates.length < MAX_EXAMPLES) {
      violations.missingCoordinates.push({
        eventId: event.id,
        location: event.location || 'Unknown',
        issue: 'Missing coordinates',
        actual: { lat: event.latitude, lon: event.longitude }
      });
    }

    // Check start time
    if (event.startTime) {
      analysis.hasStartTime++;
      if (WZDxValidators.isValidISO8601(event.startTime)) {
        analysis.hasValidStartTime++;
      } else if (isWzdx && violations.invalidTimestamps.length < MAX_EXAMPLES) {
        violations.invalidTimestamps.push({
          eventId: event.id,
          location: event.location || 'Unknown',
          issue: 'Invalid ISO 8601 format',
          actual: event.startTime,
          expected: '2025-10-19T14:30:00Z'
        });
      }
    }

    // Check end time
    if (event.endTime) analysis.hasEndTime++;

    // Check event type
    if (event.eventType && event.eventType !== 'Unknown') {
      analysis.hasEventType++;
      if (WZDxValidators.isValidEventType(event.eventType)) {
        analysis.hasValidEventType++;
      } else if (isWzdx && violations.invalidEventTypes.length < MAX_EXAMPLES) {
        violations.invalidEventTypes.push({
          eventId: event.id,
          location: event.location || 'Unknown',
          issue: 'Event type not in WZDx v4.x enum',
          actual: event.eventType,
          expected: WZDxValidators.validEventTypes.join(', ')
        });
      }
    }

    // Check severity
    if (event.severity) analysis.hasSeverity++;

    // Check direction
    if (event.direction && event.direction !== 'Both') {
      analysis.hasDirection++;
      if (WZDxValidators.isValidDirection(event.direction)) {
        analysis.hasValidDirection++;
      } else if (isWzdx && violations.invalidDirections.length < MAX_EXAMPLES) {
        violations.invalidDirections.push({
          eventId: event.id,
          location: event.location || 'Unknown',
          issue: 'Direction not in WZDx v4.x enum',
          actual: event.direction,
          expected: WZDxValidators.validDirections.join(', ')
        });
      }
    }

    // Check lane info (vehicle_impact in WZDx)
    if (event.lanesAffected && event.lanesAffected !== 'Check conditions') {
      analysis.hasLaneInfo++;
      if (WZDxValidators.isValidVehicleImpact(event.lanesAffected)) {
        analysis.hasValidLaneInfo++;
      } else if (isWzdx && violations.invalidVehicleImpact.length < MAX_EXAMPLES) {
        violations.invalidVehicleImpact.push({
          eventId: event.id,
          location: event.location || 'Unknown',
          issue: 'Vehicle impact not in WZDx v4.x enum',
          actual: event.lanesAffected,
          expected: WZDxValidators.validVehicleImpacts.join(', ')
        });
      }
    }

    // Check description
    if (event.description) analysis.hasDescription++;

    // Check corridor
    if (event.corridor && event.corridor !== 'Unknown') analysis.hasCorridor++;

    // ========== SAE J2735 V2X VALIDATION ==========
    // These checks go beyond basic WZDx compliance to assess V2X readiness

    // 1. GPS Precision Check (SAE J2735 requires ±10m accuracy)
    // Check decimal places: 5+ decimals = ~1m precision, 4 decimals = ~10m, 3 decimals = ~100m
    if (event.latitude && event.longitude && event.latitude !== 0 && event.longitude !== 0) {
      const latString = event.latitude.toString();
      const lonString = event.longitude.toString();
      const latDecimals = (latString.split('.')[1] || '').length;
      const lonDecimals = (lonString.split('.')[1] || '').length;

      // Require at least 4 decimal places for ~10m precision (SAE J2735 minimum)
      if (latDecimals >= 4 && lonDecimals >= 4) {
        analysis.hasPreciseGPS++;
      }
    }

    // 2. Millisecond Timestamp Check (SAE J2735 TIM requires sub-second precision)
    if (event.startTime && WZDxValidators.isValidISO8601(event.startTime)) {
      // Check for milliseconds (e.g., "2025-10-19T14:30:00.123Z" or Unix timestamp with milliseconds)
      const hasMilliseconds = event.startTime.includes('.') ||
                             (event.startTime.match(/\d{13,}/) !== null); // Unix timestamp in milliseconds
      if (hasMilliseconds) {
        analysis.hasMillisecondTime++;
      }
    }

    // 3. ITIS Code Mapping Check (SAE J2735 advisory content requires ITIS codes)
    if (event.eventType) {
      if (hasITISMapping(event.eventType)) {
        analysis.hasITISMappableType++;
      }
    }

    // 4. Priority Field Check (SAE J2735 TIM requires priority 0-7, derived from severity)
    if (event.severity) {
      analysis.hasPriorityField++;
    }

    // ========== TMDD v3.1 C2C VALIDATION ==========
    // These checks assess readiness for center-to-center communication

    // 1. Structured Linear Reference (TMDD location-on-link requires route + milepost)
    const locationText = ((event.location || '') + ' ' + (event.description || '')).toLowerCase();
    const hasMilepost = /\b(mm|mile|milepost|mp)\s*\d+/i.test(locationText);

    if (hasMilepost) {
      analysis.hasMilepostData++;
    }

    if (event.corridor && hasMilepost) {
      // Has both route (corridor) and milepost - structured linear reference
      analysis.hasStructuredLinearRef++;
    }

    // 2. Organization ID (TMDD requires TMC/DOT identifier)
    if (event.state || event.organization_id) {
      analysis.hasOrganizationId++;
    }

    // 3. Event Status Field (TMDD event-status: active, planned, archived)
    if (event.status || event.eventStatus) {
      analysis.hasEventStatusField++;
    }

    // 4. Structured Lane Information (TMDD event-lanes requires lane numbers)
    // Check for actual lane numbers (Lane 1, L1, etc.) not just "some lanes closed"
    if (event.lanesAffected) {
      const laneText = event.lanesAffected.toLowerCase();
      const hasLaneNumbers = /\b(lane\s*\d+|l\d+|\d+\s*lane)/i.test(laneText);
      if (hasLaneNumbers || event.lane_numbers) {
        analysis.hasStructuredLanes++;
      }
    }

    // ========== SAE J2540-2 WEATHER INFORMATION MESSAGE VALIDATION ==========
    // Only apply to weather-related events
    const isWeatherEvent = event.eventType && (
      event.eventType.toLowerCase().includes('weather') ||
      event.eventType.toLowerCase().includes('winter') ||
      event.eventType.toLowerCase().includes('ice') ||
      event.eventType.toLowerCase().includes('snow') ||
      event.eventType.toLowerCase().includes('fog') ||
      event.eventType.toLowerCase().includes('rain')
    );

    if (isWeatherEvent) {
      analysis.weatherEvents++;

      // 1. Structured Weather Condition (not just "weather" - need specific codes)
      // SAE J2540-2 requires specific condition codes: ice, snow, fog, rain, etc.
      if (event.weather_condition || event.weatherCondition) {
        analysis.hasWeatherCondition++;
      } else if (event.description) {
        // Check description for structured weather codes
        const desc = event.description.toLowerCase();
        if (desc.includes('ice') || desc.includes('snow') || desc.includes('fog') ||
            desc.includes('rain') || desc.includes('sleet') || desc.includes('hail')) {
          analysis.hasWeatherCondition++;
        }
      }

      // 2. Surface Condition (dry/wet/icy/snow-covered/slush)
      if (event.surface_condition || event.surfaceCondition || event.roadCondition) {
        analysis.hasSurfaceCondition++;
      } else if (event.description) {
        const desc = event.description.toLowerCase();
        if (desc.includes('icy') || desc.includes('wet') || desc.includes('snow-covered') ||
            desc.includes('slippery') || desc.includes('slush')) {
          analysis.hasSurfaceCondition++;
        }
      }

      // 3. Visibility (distance in meters/feet)
      if (event.visibility || event.visibility_distance) {
        analysis.hasVisibility++;
      } else if (event.description) {
        const desc = event.description.toLowerCase();
        if (/visibility.*(reduced|low|poor|\d+\s*(feet|ft|meters|m|miles|mi))/i.test(desc)) {
          analysis.hasVisibility++;
        }
      }

      // 4. Temperature (for ice/frost prediction)
      if (event.temperature || event.air_temperature || event.temp) {
        analysis.hasTemperature++;
      }

      // 5. Precipitation Type (rain/snow/sleet/hail)
      if (event.precipitation_type || event.precipitationType) {
        analysis.hasPrecipitationType++;
      } else if (event.description) {
        const desc = event.description.toLowerCase();
        if (desc.includes('rain') || desc.includes('snow') || desc.includes('sleet') ||
            desc.includes('hail') || desc.includes('freezing')) {
          analysis.hasPrecipitationType++;
        }
      }

      // 6. Precipitation Intensity (light/moderate/heavy)
      if (event.precipitation_intensity || event.precipitationIntensity) {
        analysis.hasPrecipitationIntensity++;
      } else if (event.description) {
        const desc = event.description.toLowerCase();
        if (desc.includes('light') || desc.includes('moderate') || desc.includes('heavy') ||
            desc.includes('intense')) {
          analysis.hasPrecipitationIntensity++;
        }
      }

      // 7. Weather Sensor Timestamp (for data freshness - critical for safety)
      if (event.weather_timestamp || event.weatherTimestamp || event.sensor_timestamp) {
        analysis.hasWeatherSensorTime++;
      }
    }

    // Check for missing required fields
    if (!event.id || !event.location || !event.description) {
      if (violations.missingRequired.length < MAX_EXAMPLES) {
        violations.missingRequired.push({
          eventId: event.id || 'NO_ID',
          missingFields: [
            !event.id ? 'id' : null,
            !event.location ? 'location' : null,
            !event.description ? 'description' : null
          ].filter(Boolean),
          impact: 'Cannot uniquely identify or describe this event'
        });
      }
    }
  });

  const total = result.events.length || 1;

  // For WZDx feeds, use VALID values only (strict compliance)
  // For non-WZDx feeds, use presence (but still collect violations for guidance)
  const completeness = {
    coordinates: Math.round(((isWzdx ? analysis.hasValidCoordinates : analysis.hasCoordinates) / total) * 100),
    startTime: Math.round(((isWzdx ? analysis.hasValidStartTime : analysis.hasStartTime) / total) * 100),
    endTime: Math.round((analysis.hasEndTime / total) * 100),
    eventType: Math.round(((isWzdx ? analysis.hasValidEventType : analysis.hasEventType) / total) * 100),
    severity: Math.round((analysis.hasSeverity / total) * 100),
    direction: Math.round(((isWzdx ? analysis.hasValidDirection : analysis.hasDirection) / total) * 100),
    laneInfo: Math.round(((isWzdx ? analysis.hasValidLaneInfo : analysis.hasLaneInfo) / total) * 100),
    description: Math.round((analysis.hasDescription / total) * 100),
    corridor: Math.round((analysis.hasCorridor / total) * 100),
    // SAE J2735 V2X-specific metrics
    preciseGPS: Math.round((analysis.hasPreciseGPS / total) * 100),
    millisecondTimestamps: Math.round((analysis.hasMillisecondTime / total) * 100),
    itisMapping: Math.round((analysis.hasITISMappableType / total) * 100),
    priorityField: Math.round((analysis.hasPriorityField / total) * 100),
    // TMDD v3.1 C2C-specific metrics
    structuredLinearRef: Math.round((analysis.hasStructuredLinearRef / total) * 100),
    milepostData: Math.round((analysis.hasMilepostData / total) * 100),
    organizationId: Math.round((analysis.hasOrganizationId / total) * 100),
    eventStatusField: Math.round((analysis.hasEventStatusField / total) * 100),
    structuredLanes: Math.round((analysis.hasStructuredLanes / total) * 100),
    // SAE J2540-2 Weather Information Message metrics
    weatherEvents: analysis.weatherEvents,
    weatherCondition: analysis.weatherEvents > 0 ? Math.round((analysis.hasWeatherCondition / analysis.weatherEvents) * 100) : 0,
    surfaceCondition: analysis.weatherEvents > 0 ? Math.round((analysis.hasSurfaceCondition / analysis.weatherEvents) * 100) : 0,
    visibility: analysis.weatherEvents > 0 ? Math.round((analysis.hasVisibility / analysis.weatherEvents) * 100) : 0,
    temperature: analysis.weatherEvents > 0 ? Math.round((analysis.hasTemperature / analysis.weatherEvents) * 100) : 0,
    precipitationType: analysis.weatherEvents > 0 ? Math.round((analysis.hasPrecipitationType / analysis.weatherEvents) * 100) : 0,
    precipitationIntensity: analysis.weatherEvents > 0 ? Math.round((analysis.hasPrecipitationIntensity / analysis.weatherEvents) * 100) : 0,
    weatherSensorTime: analysis.weatherEvents > 0 ? Math.round((analysis.hasWeatherSensorTime / analysis.weatherEvents) * 100) : 0
  };

  // Calculate total violation count
  const totalViolations = Object.values(violations).reduce((sum, arr) => sum + arr.length, 0);

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
          impact: (completeness.corridor || 0) < 80 ? 'HIGH - Your events are missing interstate route identifiers (e.g., I-35, I-80). Add route/highway field to enable corridor filtering for cross-state coordination.' : 'Good - Interstate route identifiers present',
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

  // Add detailed field-level violations with actual data examples
  guide.fieldLevelAnalysis = {
    evaluationStandard: isWzdx ? 'WZDx v4.x Specification' : 'TMDD/ngTMDD (Traffic Management Data Dictionary)',
    feedType: stateConfig.apiType,
    summary: `Analyzed ${result.events.length} events ${isWzdx ? 'against WZDx v4.x specification' : 'for TMDD/ngTMDD compliance (evaluated via C2C-MVT)'} and found ${
      Object.values(violations).reduce((sum, v) => sum + v.length, 0)
    } specific violations across ${
      Object.values(violations).filter(v => v.length > 0).length
    } categories`,
    totalEventsAnalyzed: result.events.length,
    violationCategories: [],
    note: isWzdx ? null : 'TMDD compliance ensures your data can be shared via Center-to-Center (C2C) communication with other DOT TMCs'
  };

  // Add each violation category with examples
  if (violations.missingCoordinates.length > 0) {
    guide.fieldLevelAnalysis.violationCategories.push({
      category: 'Missing GPS Coordinates',
      severity: 'CRITICAL',
      count: violations.missingCoordinates.length,
      impact: 'Cannot display events on map or detect cross-state boundaries',
      specRequirement: 'WGS84 decimal degrees (latitude/longitude) required for all events',
      examples: violations.missingCoordinates,
      recommendation: 'Add GPS coordinates in decimal degrees format. Example: { "latitude": 40.7608, "longitude": -111.8910 }'
    });
  }

  // Only add WZDx-specific violations for WZDx feeds
  if (isWzdx) {
    if (violations.invalidTimestamps.length > 0) {
      guide.fieldLevelAnalysis.violationCategories.push({
        category: 'Invalid Timestamp Format (WZDx Requirement)',
        severity: 'HIGH',
        count: violations.invalidTimestamps.length,
        impact: 'Cannot parse event times or validate event timeline',
        specRequirement: 'WZDx v4.x requires ISO 8601 format with timezone (YYYY-MM-DDTHH:mm:ssZ)',
        examples: violations.invalidTimestamps,
        recommendation: 'Use ISO 8601 format with UTC timezone. Example: "2025-10-19T14:30:00Z"'
      });
    }

    if (violations.invalidEventTypes.length > 0) {
      guide.fieldLevelAnalysis.violationCategories.push({
        category: 'Invalid Event Type (WZDx Requirement)',
        severity: 'HIGH',
        count: violations.invalidEventTypes.length,
        impact: 'Does not match WZDx v4.x specification - cannot properly categorize events',
        specRequirement: `WZDx v4.x event_type enum values: ${WZDxValidators.validEventTypes.join(', ')}`,
        examples: violations.invalidEventTypes,
        recommendation: 'Use only WZDx v4.x event types. Map custom types to standard values: work-zone, incident, detour, restriction, weather-event, special-event, road-hazard.'
      });
    }

    if (violations.invalidDirections.length > 0) {
      guide.fieldLevelAnalysis.violationCategories.push({
        category: 'Invalid Direction (WZDx Requirement)',
        severity: 'MEDIUM',
        count: violations.invalidDirections.length,
        impact: 'Does not match WZDx v4.x specification - cannot determine which direction is affected',
        specRequirement: `WZDx v4.x direction enum values: ${WZDxValidators.validDirections.join(', ')}`,
        examples: violations.invalidDirections,
        recommendation: 'Use lowercase WZDx direction values. Example: "northbound" not "Northbound", "NB", or "unknown"'
      });
    }
  }

  if (violations.missingRequired.length > 0) {
    guide.fieldLevelAnalysis.violationCategories.push({
      category: 'Missing Required Fields',
      severity: 'HIGH',
      count: violations.missingRequired.length,
      impact: 'Cannot uniquely identify or describe events',
      specRequirement: 'Every event must have: id, location, description',
      examples: violations.missingRequired,
      recommendation: 'Ensure all events have unique ID, location string, and description text'
    });
  }

  // ==================== MULTI-STANDARD COMPLIANCE SCORECARD ====================
  // Calculate compliance scores for WZDx v4.x, SAE J2735, and TMDD v3.1

  // 1. WZDx v4.x Compliance Score (Open Data Standard)
  const wzdxScore = {
    standard: 'WZDx v4.x (Work Zone Data Exchange)',
    purpose: 'Modern open data standard for work zone and traffic event data',
    applicability: isWzdx ? 'Your feed claims WZDx compliance' : 'Not using WZDx format',

    // Required fields (50 points)
    requiredFields: {
      coordinates: { score: completeness.coordinates, weight: 25, points: Math.round((completeness.coordinates / 100) * 25) },
      route: { score: completeness.corridor || 0, weight: 15, points: Math.round(((completeness.corridor || 0) / 100) * 15) },
      description: { score: completeness.description, weight: 10, points: Math.round((completeness.description / 100) * 10) }
    },

    // Important fields (30 points)
    importantFields: {
      eventType: { score: completeness.eventType, weight: 10, points: Math.round((completeness.eventType / 100) * 10) },
      startTime: { score: completeness.startTime, weight: 10, points: Math.round((completeness.startTime / 100) * 10) },
      severity: { score: completeness.severity, weight: 10, points: Math.round((completeness.severity / 100) * 10) }
    },

    // Enhanced fields (20 points)
    enhancedFields: {
      direction: { score: completeness.direction, weight: 7, points: Math.round((completeness.direction / 100) * 7) },
      vehicleImpact: { score: completeness.laneInfo, weight: 7, points: Math.round((completeness.laneInfo / 100) * 7) },
      endTime: { score: completeness.endTime, weight: 6, points: Math.round((completeness.endTime / 100) * 6) }
    },

    totalScore: 0,
    percentage: 0,
    grade: '',
    status: '',
    violations: isWzdx ? Object.values(violations).reduce((sum, arr) => sum + arr.length, 0) : 'N/A - Not WZDx format',
    recommendations: []
  };

  // Calculate WZDx total
  wzdxScore.totalScore =
    Object.values(wzdxScore.requiredFields).reduce((sum, f) => sum + f.points, 0) +
    Object.values(wzdxScore.importantFields).reduce((sum, f) => sum + f.points, 0) +
    Object.values(wzdxScore.enhancedFields).reduce((sum, f) => sum + f.points, 0);

  wzdxScore.percentage = Math.round(wzdxScore.totalScore);

  // Assign WZDx grade
  if (wzdxScore.percentage >= 90) {
    wzdxScore.grade = 'A';
    wzdxScore.status = 'Excellent - Fully WZDx v4.x compliant';
  } else if (wzdxScore.percentage >= 80) {
    wzdxScore.grade = 'B';
    wzdxScore.status = 'Good - Minor WZDx compliance issues';
  } else if (wzdxScore.percentage >= 70) {
    wzdxScore.grade = 'C';
    wzdxScore.status = 'Fair - Moderate WZDx improvements needed';
  } else if (wzdxScore.percentage >= 60) {
    wzdxScore.grade = 'D';
    wzdxScore.status = 'Poor - Significant WZDx gaps';
  } else {
    wzdxScore.grade = 'F';
    wzdxScore.status = 'Critical - Not WZDx compliant';
  }

  // WZDx-specific recommendations with "current vs. should be" examples
  if (isWzdx && violations.invalidEventTypes.length > 0) {
    const exampleInvalid = violations.invalidEventTypes[0];
    wzdxScore.recommendations.push({
      priority: 'HIGH',
      field: 'event_type',
      issue: `${violations.invalidEventTypes.length} events have invalid event_type values`,
      currentValue: exampleInvalid?.eventType || 'Invalid value (e.g., "Construction", "Accident")',
      targetValue: `WZDx v4.x compliant: ${WZDxValidators.validEventTypes.slice(0, 4).join(', ')}, etc.`,
      solution: `Use only WZDx v4.x event types: ${WZDxValidators.validEventTypes.join(', ')}`,
      impact: `+${Math.round((violations.invalidEventTypes.length / result.events.length) * 10)} points`,
      exampleCorrection: exampleInvalid?.eventType === 'Construction' ? '"work-zone"' : exampleInvalid?.eventType === 'Accident' ? '"incident"' : '"work-zone" or "incident"'
    });
  }

  if (isWzdx && violations.invalidDirections.length > 0) {
    const exampleInvalid = violations.invalidDirections[0];
    wzdxScore.recommendations.push({
      priority: 'MEDIUM',
      field: 'direction',
      issue: `${violations.invalidDirections.length} events have invalid direction values`,
      currentValue: exampleInvalid?.direction || 'Invalid (e.g., "NB", "EB", "Unknown")',
      targetValue: `WZDx compliant: ${WZDxValidators.validDirections.slice(0, 4).join(', ')}`,
      solution: `Use WZDx direction enum: ${WZDxValidators.validDirections.join(', ')}`,
      impact: `+${Math.round((violations.invalidDirections.length / result.events.length) * 7)} points`,
      exampleCorrection: exampleInvalid?.direction === 'NB' ? '"northbound"' : exampleInvalid?.direction === 'EB' ? '"eastbound"' : 'lowercase directional'
    });
  }

  if (isWzdx && violations.invalidVehicleImpact && violations.invalidVehicleImpact.length > 0) {
    const exampleInvalid = violations.invalidVehicleImpact[0];
    wzdxScore.recommendations.push({
      priority: 'MEDIUM',
      field: 'vehicle_impact',
      issue: `${violations.invalidVehicleImpact.length} events have invalid vehicle_impact values`,
      currentValue: exampleInvalid?.vehicleImpact || 'Missing or invalid',
      targetValue: `WZDx compliant: ${WZDxValidators.validVehicleImpacts.slice(0, 3).join(', ')}`,
      solution: `Use WZDx vehicle_impact enum: ${WZDxValidators.validVehicleImpacts.join(', ')}`,
      impact: `+${Math.round((violations.invalidVehicleImpact.length / result.events.length) * 7)} points`,
      exampleCorrection: '"some-lanes-closed" or "all-lanes-open"'
    });
  }

  // Add recommendations for missing fields
  if (completeness.coordinates < 90) {
    wzdxScore.recommendations.push({
      priority: 'CRITICAL',
      field: 'coordinates',
      issue: `Only ${completeness.coordinates}% of events have valid GPS coordinates`,
      currentValue: `${100 - completeness.coordinates}% of events missing or have invalid coordinates (e.g., latitude: 0, longitude: 0)`,
      targetValue: 'All events must have valid WGS84 decimal degrees',
      solution: 'Add latitude and longitude in decimal degrees format to every event',
      impact: `+${Math.round((100 - completeness.coordinates) * 0.25)} points`,
      example: '{ "latitude": 40.7608, "longitude": -111.8910 }'
    });
  }

  if (completeness.corridor < 80) {
    wzdxScore.recommendations.push({
      priority: 'HIGH',
      field: 'road_name / route',
      issue: `Only ${completeness.corridor}% of events have route/corridor identifiers`,
      currentValue: `${100 - completeness.corridor}% missing route identifiers like "I-80" or "US-50"`,
      targetValue: 'All events should have interstate or highway route identifier',
      solution: 'Add road_name field with route identifier (I-80, US-50, etc.)',
      impact: `+${Math.round((100 - completeness.corridor) * 0.15)} points`,
      example: '{ "road_name": "Interstate 80", "road_number": "I-80" }'
    });
  }

  // 2. SAE J2735 Readiness Score (V2X Communication)
  const saeScore = {
    standard: 'SAE J2735 (V2X Traveler Information Message)',
    purpose: 'Vehicle-to-everything (V2X) communication for connected vehicles',
    applicability: 'Measures readiness for SAE J2735 TIM broadcasting',

    // Core TIM requirements - REAL SAE J2735 VALIDATION
    coreRequirements: {
      preciseCoordinates: {
        score: completeness.preciseGPS,  // Now using actual GPS precision check (4+ decimals)
        weight: 35,  // Increased from 30 - most critical for V2X positioning
        requirement: 'GPS coordinates with ≥4 decimal places (~10m precision for V2X anchorPosition)',
        status: completeness.preciseGPS >= 80 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.preciseGPS}% of events have precise GPS (4+ decimals). SAE J2735 requires ±10m accuracy.`
      },
      millisecondTimestamps: {
        score: completeness.millisecondTimestamps,  // Now checking actual sub-second precision
        weight: 20,  // Increased from 15 - V2X timing is critical
        requirement: 'Timestamps with millisecond precision (SAE J2735 TIM timeStamp field)',
        status: completeness.millisecondTimestamps >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.millisecondTimestamps}% have millisecond precision. V2X requires sub-second accuracy.`
      },
      itisCodeMapping: {
        score: completeness.itisMapping,  // Now checking actual ITIS code mappability
        weight: 20,  // Increased from 15 - standardized codes essential for V2X
        requirement: 'Event types mappable to official ITIS codes (SAE J2735 advisory content)',
        status: completeness.itisMapping >= 80 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.itisMapping}% of event types map to ITIS codes (769=accident, 8963=road work, etc.)`
      },
      priorityField: {
        score: completeness.priorityField,  // Now checking severity field for TIM priority 0-7
        weight: 10,
        requirement: 'Severity field present for TIM priority mapping (0=high, 7=low)',
        status: completeness.priorityField >= 80 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.priorityField}% have severity for SAE J2735 priority level (0-7 scale)`
      },
      direction: {
        score: completeness.direction,
        weight: 15,
        requirement: 'Valid direction for TIM region directionality (WZDx enum)',
        status: completeness.direction >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.direction}% have valid direction (northbound/southbound/etc.)`
      }
      // NOTE: 'description' field removed - not a real SAE J2735 TIM requirement
      // SAE J2735 focuses on structured data (ITIS codes, precise GPS, timestamps)
    },

    totalScore: 0,
    percentage: 0,
    grade: '',
    status: '',
    readinessLevel: '',
    recommendations: []
  };

  // Calculate SAE total
  Object.values(saeScore.coreRequirements).forEach(req => {
    saeScore.totalScore += Math.round((req.score / 100) * req.weight);
  });

  saeScore.percentage = Math.round(saeScore.totalScore);

  // Assign SAE grade and readiness
  if (saeScore.percentage >= 90) {
    saeScore.grade = 'A';
    saeScore.status = 'V2X Ready';
    saeScore.readinessLevel = 'Your data can be broadcast as SAE J2735 TIM messages with minimal transformation';
  } else if (saeScore.percentage >= 80) {
    saeScore.grade = 'B';
    saeScore.status = 'Near V2X Ready';
    saeScore.readinessLevel = 'Minor enhancements needed for reliable V2X broadcasting';
  } else if (saeScore.percentage >= 70) {
    saeScore.grade = 'C';
    saeScore.status = 'V2X Compatible';
    saeScore.readinessLevel = 'Moderate improvements needed for V2X readiness';
  } else if (saeScore.percentage >= 60) {
    saeScore.grade = 'D';
    saeScore.status = 'Limited V2X Compatibility';
    saeScore.readinessLevel = 'Significant gaps for V2X communication';
  } else {
    saeScore.grade = 'F';
    saeScore.status = 'Not V2X Ready';
    saeScore.readinessLevel = 'Critical data quality issues prevent V2X use';
  }

  // SAE-specific recommendations - REAL V2X REQUIREMENTS with current vs. should be
  if (saeScore.coreRequirements.preciseCoordinates.status === 'NEEDS IMPROVEMENT') {
    saeScore.recommendations.push({
      priority: 'CRITICAL',
      field: 'GPS Coordinates Precision',
      issue: `Only ${completeness.preciseGPS}% of events have GPS precision ≥4 decimals (~10m accuracy)`,
      currentValue: `Low precision coordinates (e.g., 40.76, -111.89) providing ~1km accuracy`,
      targetValue: 'High precision coordinates (e.g., 40.7608, -111.8910) providing ~10m accuracy',
      solution: 'Increase GPS coordinate precision to ≥4 decimal places. Example: 40.7608 (4 decimals = ~10m), not 40.76 (2 decimals = ~1km)',
      impact: 'SAE J2735 TIM anchorPosition requires ±10m accuracy for V2X safety messages',
      technicalDetail: 'Decimal places: 2=~1km, 3=~100m, 4=~10m, 5=~1m, 6=~10cm',
      example: '{ "latitude": 40.7608, "longitude": -111.8910 } ✓ (4 decimals)'
    });
  }

  if (saeScore.coreRequirements.millisecondTimestamps.status === 'NEEDS IMPROVEMENT') {
    saeScore.recommendations.push({
      priority: 'HIGH',
      field: 'Timestamp Precision',
      issue: `Only ${completeness.millisecondTimestamps}% of timestamps have millisecond precision`,
      currentValue: 'Second-level precision: "2025-10-19T14:30:00Z"',
      targetValue: 'Millisecond precision: "2025-10-19T14:30:00.123Z"',
      solution: 'Add millisecond precision to timestamps. Example: "2025-10-19T14:30:00.123Z" not "2025-10-19T14:30:00Z"',
      impact: 'SAE J2735 TIM timeStamp field requires sub-second precision for accurate event timing',
      technicalDetail: 'V2X systems need millisecond accuracy to coordinate with fast-moving vehicles',
      example: '"start_date": "2025-10-19T14:30:00.123Z" ✓'
    });
  }

  if (saeScore.coreRequirements.itisCodeMapping.status === 'NEEDS IMPROVEMENT') {
    saeScore.recommendations.push({
      priority: 'MEDIUM',
      field: 'ITIS Code Mapping',
      issue: `Only ${completeness.itisMapping}% of event types map to official ITIS codes`,
      currentValue: 'Non-standard types (e.g., "Construction", "Accident", "Weather")',
      targetValue: 'ITIS-mappable types: work-zone (8963), incident (769), weather-condition (1537)',
      solution: 'Use standard event types that map to ITIS codes: work-zone→8963, incident→769, weather-condition→1537, restriction→1281',
      impact: 'SAE J2735 TIM advisory content requires ITIS codes for standardized message interpretation',
      technicalDetail: 'ITIS (Incident Types for ITS Systems) provides standardized codes for V2X communication',
      example: '"event_type": "work-zone" → ITIS code 8963 ✓'
    });
  }

  if (saeScore.coreRequirements.priorityField.status === 'NEEDS IMPROVEMENT') {
    saeScore.recommendations.push({
      priority: 'MEDIUM',
      field: 'Priority/Severity Field',
      issue: `Only ${completeness.priorityField}% of events have severity field for TIM priority`,
      currentValue: `${100 - completeness.priorityField}% missing severity field`,
      targetValue: 'All events have severity: high (0-2), medium (3-5), or low (6-7)',
      solution: 'Add severity classification (high/medium/low) to map to SAE J2735 priority levels (0=highest, 7=lowest)',
      impact: 'TIM messages require priority field to determine message propagation and display urgency',
      technicalDetail: 'Priority mapping: high→0-2, medium→3-5, low→6-7',
      example: '"severity": "high" → TIM priority level 0-2 ✓'
    });
  }

  // 3. TMDD v3.1 Compatibility Score (Center-to-Center)
  const tmddScore = {
    standard: 'TMDD v3.1 (Traffic Management Data Dictionary)',
    purpose: 'NTCIP standard for center-to-center communication between TMCs',
    applicability: 'Measures compatibility with TMDD/ngTMDD for DOT-to-DOT data exchange',

    // TMDD event requirements - REAL TMDD v3.1 VALIDATION
    tmddElements: {
      eventId: {
        score: sampleEvent && sampleEvent.id ? 100 : 0,
        weight: 10,
        requirement: 'Unique event identifier (event-id)',
        status: sampleEvent && sampleEvent.id ? 'PASS' : 'FAIL',
        note: sampleEvent && sampleEvent.id ? 'All events have unique IDs' : 'Missing event IDs'
      },
      organizationId: {
        score: completeness.organizationId,  // Now using REAL validation across all events
        weight: 10,
        requirement: 'TMC/DOT organization identifier for event ownership',
        status: completeness.organizationId >= 90 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.organizationId}% of events have organization/state identifier. TMDD requires TMC org codes.`
      },
      structuredLinearReference: {
        score: completeness.structuredLinearRef,  // Now using REAL validation: route + milepost
        weight: 20,
        requirement: 'Route + milepost for TMDD location-on-link element',
        status: completeness.structuredLinearRef >= 80 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.structuredLinearRef}% have both route AND milepost. ${completeness.milepostData}% have milepost data.`
      },
      eventCategory: {
        score: completeness.eventType,
        weight: 15,
        requirement: 'Event classification (TMDD event-category)',
        status: completeness.eventType >= 90 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.eventType}% have event type. TMDD requires specific event-category codes.`
      },
      eventTimes: {
        score: Math.min(100, (completeness.startTime + completeness.endTime) / 2),
        weight: 15,
        requirement: 'Start and end timestamps (TMDD event-times element)',
        status: Math.min(100, (completeness.startTime + completeness.endTime) / 2) >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.startTime}% start time, ${completeness.endTime}% end time. TMDD requires temporal bounds.`
      },
      eventStatus: {
        score: completeness.eventStatusField,  // Now using REAL validation for TMDD event-status
        weight: 10,
        requirement: 'Event status field (active, planned, archived)',
        status: completeness.eventStatusField >= 80 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.eventStatusField}% have status field. TMDD event-status indicates lifecycle state.`
      },
      structuredLanes: {
        score: completeness.structuredLanes,  // Now using REAL validation for lane numbers
        weight: 10,
        requirement: 'Structured lane numbers (TMDD event-lanes element)',
        status: completeness.structuredLanes >= 60 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.structuredLanes}% have structured lane numbers (Lane 1, L2, etc.). TMDD requires lane identifiers.`
      },
      geographicCoords: {
        score: completeness.coordinates,
        weight: 10,
        requirement: 'Geographic coordinates for TMDD event-locations',
        status: completeness.coordinates >= 90 ? 'PASS' : 'NEEDS IMPROVEMENT',
        note: `${completeness.coordinates}% have valid GPS coordinates for TMDD geographic location.`
      }
    },

    totalScore: 0,
    percentage: 0,
    grade: '',
    status: '',
    c2cReadiness: '',
    recommendations: []
  };

  // Calculate TMDD total
  Object.values(tmddScore.tmddElements).forEach(element => {
    tmddScore.totalScore += Math.round((element.score / 100) * element.weight);
  });

  tmddScore.percentage = Math.round(tmddScore.totalScore);

  // Assign TMDD grade
  if (tmddScore.percentage >= 90) {
    tmddScore.grade = 'A';
    tmddScore.status = 'TMDD Compatible';
    tmddScore.c2cReadiness = 'Ready for center-to-center exchange via TMDD/ngTMDD';
  } else if (tmddScore.percentage >= 80) {
    tmddScore.grade = 'B';
    tmddScore.status = 'Near TMDD Compatible';
    tmddScore.c2cReadiness = 'Minor improvements needed for TMDD C2C exchange';
  } else if (tmddScore.percentage >= 70) {
    tmddScore.grade = 'C';
    tmddScore.status = 'Partially TMDD Compatible';
    tmddScore.c2cReadiness = 'Moderate enhancements needed for reliable C2C communication';
  } else if (tmddScore.percentage >= 60) {
    tmddScore.grade = 'D';
    tmddScore.status = 'Limited TMDD Compatibility';
    tmddScore.c2cReadiness = 'Significant gaps for TMDD-based center-to-center';
  } else {
    tmddScore.grade = 'F';
    tmddScore.status = 'Not TMDD Compatible';
    tmddScore.c2cReadiness = 'Major improvements required for C2C data exchange';
  }

  // TMDD-specific recommendations - UPDATED FOR REAL VALIDATION with current vs. should be
  if (tmddScore.tmddElements.structuredLinearReference.status === 'NEEDS IMPROVEMENT') {
    tmddScore.recommendations.push({
      priority: 'HIGH',
      field: 'Linear Reference (Route + Milepost)',
      issue: `Only ${completeness.structuredLinearRef}% have structured linear reference (route + milepost)`,
      currentValue: `Text-based location: "Work on I-80 near Salt Lake City" OR ${100 - completeness.milepostData}% missing milepost`,
      targetValue: 'Structured fields: route="I-80" + milepost="MM 123"',
      solution: 'Include both interstate/route (e.g., I-80) and milepost (MM 123) as structured fields, not just in text',
      impact: 'TMDD location-on-link element requires route AND milepost for precise C2C location sharing',
      currentState: `${completeness.milepostData}% have milepost data, but need both route and milepost together`,
      example: '{ "route": "I-80", "milepost": 123, "direction": "eastbound" } ✓'
    });
  }

  if (tmddScore.tmddElements.organizationId.status === 'NEEDS IMPROVEMENT') {
    tmddScore.recommendations.push({
      priority: 'MEDIUM',
      field: 'Organization/TMC Identifier',
      issue: `Only ${completeness.organizationId}% have organization/TMC identifier`,
      currentValue: 'Missing organization field OR implicit from state only',
      targetValue: 'Explicit TMC code: "IA-DOT", "UDOT", "WYDOT"',
      solution: 'Add TMC organization code (e.g., "IA-DOT", "UDOT") to identify event owner',
      impact: 'TMDD requires organization ID for multi-agency C2C coordination',
      example: '{ "organization_id": "UDOT", "owning_tmc": "Utah DOT TMC" } ✓'
    });
  }

  if (tmddScore.tmddElements.eventStatus.status === 'NEEDS IMPROVEMENT') {
    tmddScore.recommendations.push({
      priority: 'MEDIUM',
      field: 'Event Status/Lifecycle',
      issue: `Only ${completeness.eventStatusField}% have event status field`,
      currentValue: 'No status field (implicit "active" assumed)',
      targetValue: 'Explicit status: "active", "planned", or "archived"',
      solution: 'Add status field indicating lifecycle: "active", "planned", or "archived"',
      impact: 'TMDD event-status helps TMCs understand which events are currently affecting traffic',
      example: '{ "status": "active", "lifecycle_state": "ongoing" } ✓'
    });
  }

  if (tmddScore.tmddElements.structuredLanes.status === 'NEEDS IMPROVEMENT') {
    tmddScore.recommendations.push({
      priority: 'MEDIUM',
      field: 'Structured Lane Numbers',
      issue: `Only ${completeness.structuredLanes}% have structured lane numbers`,
      currentValue: 'Text description: "some lanes closed" or "left lane blocked"',
      targetValue: 'Structured identifiers: "Lane 1", "L2", or lane array [1, 2]',
      solution: 'Include lane identifiers (Lane 1, L2, etc.) instead of just "some lanes closed"',
      impact: 'TMDD event-lanes element requires specific lane numbers for detailed C2C communication',
      example: '{ "lanes_affected": [1, 2], "lane_description": "Lanes 1-2 closed" } ✓'
    });
  }

  if (tmddScore.tmddElements.eventTimes.status === 'NEEDS IMPROVEMENT') {
    tmddScore.recommendations.push({
      priority: 'MEDIUM',
      field: 'Event Start/End Times',
      issue: `Missing start (${100 - completeness.startTime}%) or end (${100 - completeness.endTime}%) timestamps`,
      currentValue: `Events missing temporal bounds`,
      targetValue: 'Both start_time and end_time in ISO 8601 format',
      solution: 'Include both event start time and estimated end time',
      impact: 'TMDD event-times element requires temporal bounds for C2C coordination',
      example: '{ "start_date": "2025-10-19T14:30:00Z", "end_date": "2025-10-19T18:00:00Z" } ✓'
    });
  }

  // 4. SAE J2540-2 Weather Information Message Score (CONDITIONAL - only for weather events)
  let j2540Score = null;

  if (completeness.weatherEvents > 0) {
    j2540Score = {
      standard: 'SAE J2540-2 (Road Weather Information Message)',
      purpose: 'Structured weather data for safety and mobility decisions',
      applicability: `Only applies to weather-related events (${completeness.weatherEvents} of ${result.events.length} events)`,

      weatherElements: {
        weatherCondition: {
          score: completeness.weatherCondition,
          weight: 20,
          requirement: 'Structured weather condition codes (ice, snow, fog, rain, etc.)',
          status: completeness.weatherCondition >= 80 ? 'PASS' : 'NEEDS IMPROVEMENT',
          note: `${completeness.weatherCondition}% of weather events have structured condition codes`
        },
        surfaceCondition: {
          score: completeness.surfaceCondition,
          weight: 20,
          requirement: 'Road surface status (dry/wet/icy/snow-covered/slush)',
          status: completeness.surfaceCondition >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT',
          note: `${completeness.surfaceCondition}% have surface condition data`
        },
        visibility: {
          score: completeness.visibility,
          weight: 15,
          requirement: 'Visibility distance measurement in meters',
          status: completeness.visibility >= 60 ? 'PASS' : 'NEEDS IMPROVEMENT',
          note: `${completeness.visibility}% include visibility information`
        },
        temperature: {
          score: completeness.temperature,
          weight: 15,
          requirement: 'Air/surface temperature for ice/frost prediction',
          status: completeness.temperature >= 60 ? 'PASS' : 'NEEDS IMPROVEMENT',
          note: `${completeness.temperature}% include temperature data`
        },
        precipitationType: {
          score: completeness.precipitationType,
          weight: 15,
          requirement: 'Precipitation type (rain/snow/sleet/hail)',
          status: completeness.precipitationType >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT',
          note: `${completeness.precipitationType}% specify precipitation type`
        },
        precipitationIntensity: {
          score: completeness.precipitationIntensity,
          weight: 10,
          requirement: 'Precipitation intensity (light/moderate/heavy)',
          status: completeness.precipitationIntensity >= 60 ? 'PASS' : 'NEEDS IMPROVEMENT',
          note: `${completeness.precipitationIntensity}% specify precipitation intensity`
        },
        weatherSensorTime: {
          score: completeness.weatherSensorTime,
          weight: 5,
          requirement: 'Weather sensor timestamp for data freshness',
          status: completeness.weatherSensorTime >= 50 ? 'PASS' : 'NEEDS IMPROVEMENT',
          note: `${completeness.weatherSensorTime}% have weather sensor timestamps`
        }
      },

      totalScore: 0,
      percentage: 0,
      grade: '',
      status: '',
      weatherReadiness: '',
      recommendations: []
    };

    // Calculate J2540-2 total
    Object.values(j2540Score.weatherElements).forEach(element => {
      j2540Score.totalScore += Math.round((element.score / 100) * element.weight);
    });

    j2540Score.percentage = Math.round(j2540Score.totalScore);

    // Assign J2540-2 grade and readiness
    if (j2540Score.percentage >= 90) {
      j2540Score.grade = 'A';
      j2540Score.status = 'Weather Data Ready';
      j2540Score.weatherReadiness = 'Comprehensive structured weather data suitable for J2540-2 broadcasting';
    } else if (j2540Score.percentage >= 80) {
      j2540Score.grade = 'B';
      j2540Score.status = 'Near Weather Data Ready';
      j2540Score.weatherReadiness = 'Minor enhancements needed for complete weather information';
    } else if (j2540Score.percentage >= 70) {
      j2540Score.grade = 'C';
      j2540Score.status = 'Partial Weather Data';
      j2540Score.weatherReadiness = 'Moderate improvements needed for J2540-2 compliance';
    } else if (j2540Score.percentage >= 60) {
      j2540Score.grade = 'D';
      j2540Score.status = 'Limited Weather Data';
      j2540Score.weatherReadiness = 'Significant gaps in structured weather information';
    } else {
      j2540Score.grade = 'F';
      j2540Score.status = 'Insufficient Weather Data';
      j2540Score.weatherReadiness = 'Critical weather data elements missing';
    }

    // J2540-2 specific recommendations
    if (j2540Score.weatherElements.weatherCondition.status === 'NEEDS IMPROVEMENT') {
      j2540Score.recommendations.push({
        priority: 'CRITICAL',
        field: 'Weather Condition Codes',
        issue: `Only ${completeness.weatherCondition}% of weather events have structured condition codes`,
        currentValue: 'Generic "weather" or text descriptions only',
        targetValue: 'Specific codes: ice, snow, fog, rain, sleet, hail',
        solution: 'Use structured weather condition fields with specific codes instead of generic "weather" type',
        impact: 'SAE J2540-2 requires specific weather codes for automated safety systems',
        example: '{ "weather_condition": "ice", "surface_condition": "icy" } ✓'
      });
    }

    if (j2540Score.weatherElements.surfaceCondition.status === 'NEEDS IMPROVEMENT') {
      j2540Score.recommendations.push({
        priority: 'HIGH',
        field: 'Road Surface Condition',
        issue: `Only ${completeness.surfaceCondition}% specify road surface status`,
        currentValue: 'Missing surface condition data',
        targetValue: 'Surface status: dry, wet, icy, snow-covered, slush, frost',
        solution: 'Add surface_condition field with standardized values',
        impact: 'Road surface condition is critical for vehicle traction and safety warnings',
        example: '{ "surface_condition": "icy", "surface_temperature": 28 } ✓'
      });
    }

    if (j2540Score.weatherElements.visibility.status === 'NEEDS IMPROVEMENT') {
      j2540Score.recommendations.push({
        priority: 'HIGH',
        field: 'Visibility Distance',
        issue: `Only ${completeness.visibility}% include visibility measurements`,
        currentValue: 'No visibility data or qualitative only ("poor visibility")',
        targetValue: 'Quantitative visibility in meters (e.g., 100m, 500m)',
        solution: 'Include visibility_distance field with numeric value in meters',
        impact: 'Visibility measurements essential for fog/weather-related safety warnings',
        example: '{ "visibility": 100, "visibility_units": "meters" } ✓'
      });
    }

    if (j2540Score.weatherElements.temperature.status === 'NEEDS IMPROVEMENT') {
      j2540Score.recommendations.push({
        priority: 'MEDIUM',
        field: 'Temperature Data',
        issue: `Only ${completeness.temperature}% include temperature information`,
        currentValue: 'Missing temperature data',
        targetValue: 'Air and/or surface temperature in Celsius or Fahrenheit',
        solution: 'Add temperature fields for ice/frost prediction',
        impact: 'Temperature critical for predicting ice formation and road treatment decisions',
        example: '{ "air_temperature": 30, "surface_temperature": 28, "temp_units": "F" } ✓'
      });
    }

    if (j2540Score.weatherElements.precipitationType.status === 'NEEDS IMPROVEMENT') {
      j2540Score.recommendations.push({
        priority: 'MEDIUM',
        field: 'Precipitation Type',
        issue: `Only ${completeness.precipitationType}% specify precipitation type`,
        currentValue: 'Generic "precipitation" or missing type',
        targetValue: 'Specific type: rain, snow, sleet, freezing rain, hail',
        solution: 'Add precipitation_type field with standardized values',
        impact: 'Precipitation type affects visibility, traction, and required vehicle equipment',
        example: '{ "precipitation_type": "freezing rain", "intensity": "moderate" } ✓'
      });
    }
  }

  // Add multi-standard scorecard to guide
  guide.multiStandardCompliance = {
    summary: {
      message: j2540Score
        ? `This scorecard evaluates your data against four major transportation standards (including weather-specific J2540-2 for ${completeness.weatherEvents} weather events)`
        : 'This scorecard evaluates your data against three major transportation standards',
      evaluationDate: new Date().toISOString(),
      eventsAnalyzed: result.events.length,
      weatherEventsAnalyzed: completeness.weatherEvents
    },

    wzdx: wzdxScore,
    sae: saeScore,
    tmdd: tmddScore,
    j2540: j2540Score,  // Will be null if no weather events

    // Overall recommendations prioritized across all standards
    crossStandardRecommendations: [
      {
        priority: 'CRITICAL',
        issue: 'GPS coordinates',
        currentCoverage: `${completeness.coordinates}%`,
        recommendation: 'Ensure 100% of events have valid GPS coordinates',
        benefitsStandards: ['WZDx', 'SAE J2735', 'TMDD'],
        pointsGained: {
          wzdx: Math.round((100 - completeness.coordinates) * 0.25),
          sae: Math.round((100 - completeness.coordinates) * 0.25),
          tmdd: Math.round((100 - completeness.coordinates) * 0.10)
        }
      },
      {
        priority: 'HIGH',
        issue: 'Event type standardization',
        currentCoverage: `${completeness.eventType}%`,
        recommendation: 'Use standard event type classifications compatible with WZDx/ITIS/TMDD',
        benefitsStandards: ['WZDx', 'SAE J2735', 'TMDD'],
        pointsGained: {
          wzdx: Math.round((100 - completeness.eventType) * 0.10),
          sae: Math.round((100 - completeness.eventType) * 0.15),
          tmdd: Math.round((100 - completeness.eventType) * 0.15)
        }
      },
      {
        priority: 'HIGH',
        issue: 'Route/corridor identifiers',
        currentCoverage: `${completeness.corridor || 0}%`,
        recommendation: 'Add interstate/highway route identifiers (e.g., I-80, US-50)',
        benefitsStandards: ['WZDx', 'TMDD'],
        pointsGained: {
          wzdx: Math.round((100 - (completeness.corridor || 0)) * 0.15),
          sae: 0,
          tmdd: Math.round((100 - (completeness.corridor || 0)) * 0.10)
        }
      }
    ],

    // Grade roadmap showing path to Grade A for each standard
    gradeRoadmap: {
      wzdx: {
        currentGrade: wzdxScore.grade,
        currentScore: wzdxScore.percentage,
        targetGrade: 'A',
        targetScore: 90,
        pointsNeeded: Math.max(0, 90 - wzdxScore.percentage),
        estimatedEffort: wzdxScore.percentage >= 80 ? 'Low (1-2 weeks)' : wzdxScore.percentage >= 70 ? 'Medium (3-4 weeks)' : 'High (6-8 weeks)',
        keyImprovements: wzdxScore.recommendations.slice(0, 3)
      },
      sae: {
        currentGrade: saeScore.grade,
        currentScore: saeScore.percentage,
        targetGrade: 'A',
        targetScore: 90,
        pointsNeeded: Math.max(0, 90 - saeScore.percentage),
        estimatedEffort: saeScore.percentage >= 80 ? 'Low (2-3 weeks)' : saeScore.percentage >= 70 ? 'Medium (4-6 weeks)' : 'High (8-12 weeks)',
        keyImprovements: saeScore.recommendations.slice(0, 3)
      },
      tmdd: {
        currentGrade: tmddScore.grade,
        currentScore: tmddScore.percentage,
        targetGrade: 'A',
        targetScore: 90,
        pointsNeeded: Math.max(0, 90 - tmddScore.percentage),
        estimatedEffort: tmddScore.percentage >= 80 ? 'Low (2-3 weeks)' : tmddScore.percentage >= 70 ? 'Medium (4-6 weeks)' : 'High (8-12 weeks)',
        keyImprovements: tmddScore.recommendations.slice(0, 3)
      }
    }
  };

  // ==================== COMPOSITE OVERALL SCORE ====================
  // Calculate true composite score across 3-4 standards (4 if weather events exist)
  const standardCount = j2540Score ? 4 : 3;
  const compositePercentage = j2540Score
    ? Math.round((wzdxScore.percentage + saeScore.percentage + tmddScore.percentage + j2540Score.percentage) / 4)
    : Math.round((wzdxScore.percentage + saeScore.percentage + tmddScore.percentage) / 3);

  // Determine composite letter grade
  let compositeGrade = '';
  let compositeStatus = '';
  if (compositePercentage >= 90) {
    compositeGrade = 'A';
    compositeStatus = 'Excellent - Multi-Standard Compliant';
  } else if (compositePercentage >= 80) {
    compositeGrade = 'B';
    compositeStatus = 'Good - Strong Standards Alignment';
  } else if (compositePercentage >= 70) {
    compositeGrade = 'C';
    compositeStatus = 'Fair - Moderate Standards Compliance';
  } else if (compositePercentage >= 60) {
    compositeGrade = 'D';
    compositeStatus = 'Poor - Needs Significant Improvement';
  } else {
    compositeGrade = 'F';
    compositeStatus = 'Critical - Major Standards Gaps';
  }

  // Replace the old overallScore with the new composite score
  const breakdown = {
    wzdx: { percentage: wzdxScore.percentage, grade: wzdxScore.grade },
    sae: { percentage: saeScore.percentage, grade: saeScore.grade },
    tmdd: { percentage: tmddScore.percentage, grade: tmddScore.grade }
  };

  if (j2540Score) {
    breakdown.j2540 = { percentage: j2540Score.percentage, grade: j2540Score.grade };
  }

  const messageStandards = j2540Score
    ? `WZDx (${wzdxScore.percentage}%), SAE J2735 (${saeScore.percentage}%), TMDD (${tmddScore.percentage}%), and SAE J2540-2 (${j2540Score.percentage}%)`
    : `WZDx (${wzdxScore.percentage}%), SAE J2735 (${saeScore.percentage}%), and TMDD (${tmddScore.percentage}%)`;

  guide.overallScore = {
    weightedTotal: compositePercentage,
    maxPossible: 100,
    percentage: compositePercentage,
    grade: compositeGrade,
    rank: compositeStatus,
    breakdown: breakdown,
    message: `Composite score averaging ${messageStandards}`,
    standardsEvaluated: standardCount,
    weatherEventsIncluded: j2540Score ? completeness.weatherEvents : 0
  };

  res.json(guide);
});

// ==================== MESSAGE ENDPOINTS ====================

// Legacy message endpoints now proxy to event comments for backward compatibility
app.get('/api/messages', async (req, res) => {
  try {
    const comments = await db.getAllEventComments();

    // Ensure comments is an array
    if (!Array.isArray(comments)) {
      console.error('getAllEventComments returned non-array:', typeof comments, comments);
      return res.json({
        success: true,
        count: 0,
        messages: []
      });
    }

    const messages = comments.map(comment => ({
      id: comment.id,
      eventId: comment.event_id,
      sender: comment.state_name,
      message: comment.comment,
      timestamp: comment.created_at,
      stateKey: comment.state_key
    }));

    res.json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error) {
    console.error('Error in /api/messages:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/messages/event/:eventId', async (req, res) => {
  try {
    // Get comments from event_comments table
    const comments = await db.getEventComments(req.params.eventId);
    const commentMessages = comments.map(comment => ({
      id: comment.id,
      eventId: comment.event_id,
      sender: comment.state_name,
      message: comment.comment,
      timestamp: comment.created_at,
      stateKey: comment.state_key
    }));

    // Also get messages from state_messages table linked to this event
    const stateMessages = await db.db.prepare(`
      SELECT id, from_state, to_state, subject, message, created_at, event_id
      FROM state_messages
      WHERE event_id = ?
      ORDER BY created_at ASC
    `).all(req.params.eventId);

    const stateMsgFormatted = stateMessages.map(msg => ({
      id: msg.id,
      eventId: msg.event_id,
      sender: msg.from_state === 'ADMIN' ? 'DOT Corridor Communicator' : msg.from_state,
      message: msg.subject ? `${msg.subject}\n\n${msg.message}` : msg.message,
      timestamp: msg.created_at,
      stateKey: msg.from_state.toLowerCase()
    }));

    // Merge and sort by timestamp
    const allMessages = [...commentMessages, ...stateMsgFormatted].sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    res.json({
      success: true,
      eventId: req.params.eventId,
      count: allMessages.length,
      messages: allMessages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/messages', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Legacy endpoint deprecated. Use POST /api/events/:eventId/comments with authorization.'
  });
});

app.delete('/api/messages/:id', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Legacy endpoint deprecated. Use DELETE /api/events/comments/:id with authorization.'
  });
});

app.delete('/api/messages/event/:eventId', (req, res) => {
  res.status(410).json({
    success: false,
    error: 'Legacy endpoint deprecated. Use the event comment APIs.'
  });
});

// ==================== STATE-TO-STATE MESSAGING ENDPOINTS ====================

// Support both legacy state passwords and new user JWTs
const requireStateAuth = requireUserOrStateAuth;

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
app.get('/api/states/inbox', requireStateAuth, async (req, res) => {
  const messages = await db.getInbox(req.stateKey);
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
app.get('/api/states/sent', requireStateAuth, async (req, res) => {
  const messages = await db.getSentMessages(req.stateKey);

  // Also get event comments from this state
  const comments = await db.getEventCommentsByState(req.stateKey);

  // Convert comments to message format
  const commentMessages = comments.map(comment => ({
    id: `comment-${comment.id}`,
    from_state: comment.state_key,
    to_state: 'Event Comment',
    subject: `Comment on Event`,
    message: comment.comment,
    created_at: comment.created_at,
    read: true,
    priority: 'normal',
    event_id: comment.event_id,
    isEventComment: true
  }));

  // Merge and sort by date
  const allMessages = [...messages, ...commentMessages].sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );

  res.json({
    success: true,
    stateKey: req.stateKey,
    stateName: req.stateName,
    messages: allMessages
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

// Delete a state message (only the sender can delete)
app.delete('/api/states/messages/:id', requireStateAuth, (req, res) => {
  const result = db.deleteStateMessage(req.params.id, req.stateKey);

  if (result.success) {
    res.json({ success: true, message: 'Message deleted' });
  } else {
    res.status(403).json({ error: result.error });
  }
});

// Bulk delete detour advisory messages
app.delete('/api/states/messages/bulk/detour-advisories', requireUserOrStateAuth, (req, res) => {
  try {
    const result = db.db.prepare(`
      DELETE FROM state_messages
      WHERE to_state = ?
      AND subject LIKE '%Detour Advisory%'
    `).run(req.stateKey);

    res.json({
      success: true,
      message: `Deleted ${result.changes} detour advisory messages`,
      deletedCount: result.changes
    });
  } catch (error) {
    console.error('Error deleting detour messages:', error);
    res.status(500).json({ error: 'Failed to delete messages' });
  }
});

// Delete an event comment (only the commenter can delete)
app.delete('/api/events/comments/:id', requireStateAuth, (req, res) => {
  // Extract the actual comment ID if it's prefixed with "comment-"
  let commentId = req.params.id;
  if (commentId.startsWith('comment-')) {
    commentId = commentId.substring(8);
  }

  const result = db.deleteEventComment(commentId, req.stateKey);

  if (result.success) {
    res.json({ success: true, message: 'Comment deleted' });
  } else {
    res.status(403).json({ error: result.error });
  }
});

// Add comment to event (any authenticated state or state-affiliated user can comment)
app.post('/api/events/:eventId/comments', requireUserOrStateAuth, async (req, res) => {
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
    // Send email notifications in the background (don't wait for completion)
    setImmediate(async () => {
      try {
        // Find the event details from all events cache
        const allStates = await db.getAllStates();
        const allEventsResults = await Promise.all(
          allStates.map(state => fetchStateData(state.stateKey))
        );

        let eventDetails = null;
        for (const stateResult of allEventsResults) {
          const event = stateResult.events.find(e => e.id === req.params.eventId);
          if (event) {
            eventDetails = event;
            break;
          }
        }

        if (eventDetails) {
          // Get users who should be notified about messages for this state
          const usersToNotify = db.getUsersForMessageNotification(eventDetails.state);

          console.log(`📧 Sending message notifications to ${usersToNotify.length} users for ${eventDetails.state}`);

          // Send email to each user
          for (const user of usersToNotify) {
            // Don't send notification to the person who posted the message
            if (user.stateKey !== req.stateKey || user.username !== req.user?.username) {
              await emailService.sendMessageNotification(
                user.email,
                user.fullName || user.username,
                eventDetails,
                {
                  sender: req.stateName,
                  message: comment,
                  timestamp: new Date().toISOString()
                }
              );
            }
          }
        } else {
          console.log(`⚠️ Could not find event ${req.params.eventId} for email notification`);
        }
      } catch (error) {
        console.error('Error sending message notifications:', error);
      }
    });

    res.status(201).json({
      success: true,
      commentId: result.id,
      comment: {
        id: result.id,
        event_id: req.params.eventId,
        state_key: req.stateKey,
        state_name: req.stateName,
        comment,
        created_at: new Date().toISOString()
      },
      message: 'Comment added'
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Get comments for an event (public - no auth required)
app.get('/api/events/:eventId/comments', async (req, res) => {
  try {
    const comments = await db.getEventComments(req.params.eventId);

    res.json({
      success: true,
      eventId: req.params.eventId,
      count: comments.length,
      comments
    });
  } catch (error) {
    console.error('Error fetching event comments:', error);
    res.json({
      success: false,
      eventId: req.params.eventId,
      count: 0,
      comments: []
    });
  }
});

// Get all event comments (for viewing all discussions)
app.get('/api/events/comments/all', async (req, res) => {
  const comments = await db.getAllEventComments();

  res.json({
    success: true,
    count: comments.length,
    comments
  });
});

// Get list of states available for messaging
app.get('/api/states/list', async (req, res) => {
  const states = await db.getAllStates(false); // No credentials

  res.json({
    success: true,
    states: states.map(s => ({
      stateKey: s.stateKey,
      stateName: s.stateName,
      format: s.format,
      apiType: s.apiType
    }))
  });
});

// ==================== AI CHAT ASSISTANT ====================

// System prompt with WZDx, TMDD, SAE J2735 expertise
const SYSTEM_PROMPT = `You are an expert AI assistant for the DOT Corridor Communicator system. You help state DOTs with traffic data compliance and truck parking availability.

Your expertise includes:
- WZDx v4.x (Work Zone Data Exchange) specification
- SAE J2735 (V2X messaging standard)
- TMDD (Traffic Management Data Dictionary) standard
- Feed alignment and normalization best practices
- Compliance scoring and data quality assessment
- Truck parking availability predictions and TPIMS data analysis

You can help users with:
1. **Compliance Scores**: Explain why they received a specific score and what fields they need to add
2. **Standards Questions**: Answer questions about WZDx, TMDD, SAE J2735 field definitions and requirements
3. **Feed Issues**: Diagnose parsing errors, validation issues, and field mapping problems
4. **Implementation Guidance**: Provide code examples and best practices for improving feed quality
5. **Truck Parking**: Answer questions about parking availability, predictions, alerts, and facility details

When a user asks about truck parking:
- Reference actual prediction data (provided in context)
- Explain availability patterns and confidence levels
- Help interpret alerts and recommend alternative facilities
- Provide context about peak times and occupancy trends

When a user asks about their compliance:
- Reference their actual data (provided in context)
- Be specific about missing fields
- Explain the difference between raw (in feed structure), extracted (parsed from text), and normalized (with fallbacks)
- Provide actionable recommendations

Be concise, technical, and helpful. Focus on practical solutions.`;

app.post('/api/chat', async (req, res) => {
  const { message, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: 'AI chat is not configured. Please contact administrator to add OPENAI_API_KEY.'
    });
  }

  try {
    // Try to get user info from auth header if provided (optional)
    let userId = null;
    let stateKey = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id;
        stateKey = decoded.stateKey;
      } catch (err) {
        // Token invalid/expired, but that's okay - continue without user context
      }
    }

    // Get conversation history
    const history = db.getChatHistory(userId, stateKey, 20);

    // Build context for the AI based on what the user is viewing
    let contextInfo = '';

    if (context) {
      if (context.type === 'compliance' && context.data) {
        // User is viewing compliance scores
        const { stateKey, complianceData } = context.data;
        contextInfo = `\n\nCURRENT CONTEXT: User is viewing compliance report for ${stateKey}\n`;
        if (complianceData) {
          contextInfo += `Compliance Scores:\n`;
          contextInfo += `- WZDx: ${complianceData.wzdx || 'N/A'}%\n`;
          contextInfo += `- SAE J2735: ${complianceData.sae || 'N/A'}%\n`;
          contextInfo += `- TMDD: ${complianceData.tmdd || 'N/A'}%\n`;
          if (complianceData.fieldCoverage) {
            contextInfo += `\nField Coverage:\n`;
            complianceData.fieldCoverage.slice(0, 5).forEach(field => {
              contextInfo += `- ${field.field}: Raw ${field.rawCoveragePercentage}%, Extracted ${field.extractedCoveragePercentage}%, Normalized ${field.normalizedCoveragePercentage}%\n`;
            });
          }
        }
      } else if (context.type === 'feed-alignment' && context.data) {
        contextInfo = `\n\nCURRENT CONTEXT: User is viewing feed alignment analysis\n`;
        const { issues, recommendations } = context.data;
        if (issues && issues.length > 0) {
          contextInfo += `Issues: ${issues.join(', ')}\n`;
        }
        if (recommendations && recommendations.length > 0) {
          contextInfo += `Recommendations: ${recommendations.slice(0, 3).join(', ')}\n`;
        }
      } else if (context.type === 'parking' && context.data) {
        contextInfo = `\n\nCURRENT CONTEXT: User is viewing truck parking predictions\n`;
        const { predictions, alerts, targetTime, hourOffset } = context.data;

        if (targetTime) {
          contextInfo += `Prediction Time: ${new Date(targetTime).toLocaleString()} ${hourOffset ? `(+${hourOffset}hr from now)` : '(current)'}\n`;
        }

        if (alerts && alerts.length > 0) {
          contextInfo += `\nACTIVE ALERTS (${alerts.length}):\n`;
          alerts.forEach(alert => {
            contextInfo += `- ${alert.severity.toUpperCase()}: ${alert.message}\n`;
          });
        }

        if (predictions && predictions.length > 0) {
          // Summarize predictions
          const total = predictions.length;
          const withCoords = predictions.filter(p => p.latitude && p.longitude).length;
          const limited = predictions.filter(p => p.predictedAvailable <= 5).length;
          const full = predictions.filter(p => p.predictedAvailable === 0).length;

          contextInfo += `\nPREDICTIONS SUMMARY:\n`;
          contextInfo += `- Total Facilities: ${total}\n`;
          contextInfo += `- With GPS Coordinates: ${withCoords}\n`;
          contextInfo += `- Limited Parking (≤5 spaces): ${limited}\n`;
          contextInfo += `- Full (0 spaces): ${full}\n`;

          // List facilities with limited parking
          if (limited > 0) {
            contextInfo += `\nFACILITIES WITH LIMITED PARKING:\n`;
            predictions
              .filter(p => p.predictedAvailable <= 5)
              .slice(0, 10)
              .forEach(p => {
                contextInfo += `- ${p.siteId} (${p.state}): ${p.predictedAvailable} spaces, ${Math.round(p.occupancyRate * 100)}% occupancy, ${p.confidence} confidence\n`;
              });
          }
        }
      }
    }

    // Build conversation messages for OpenAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + contextInfo },
      ...history.map(h => ({ role: h.role, content: h.message })),
      { role: 'user', content: message }
    ];

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',  // Most cost-effective
      messages,
      temperature: 0.7,
      max_tokens: 800
    });

    const assistantMessage = completion.choices[0].message.content;

    // Save both messages to database
    db.saveChatMessage(userId, stateKey, 'user', message, context?.type, context?.data);
    db.saveChatMessage(userId, stateKey, 'assistant', assistantMessage);

    res.json({
      success: true,
      message: assistantMessage,
      usage: {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens
      }
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

// Get chat history for current user
app.get('/api/chat/history', (req, res) => {
  // Try to get user info from auth header if provided (optional)
  let userId = null;
  let stateKey = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
      stateKey = decoded.stateKey;
    } catch (err) {
      // Token invalid/expired, but that's okay - continue without user context
    }
  }

  const limit = parseInt(req.query.limit) || 50;
  const history = db.getChatHistory(userId, stateKey, limit);

  res.json({
    success: true,
    count: history.length,
    messages: history
  });
});

// Clear chat history for current user
app.delete('/api/chat/history', (req, res) => {
  // Try to get user info from auth header if provided (optional)
  let userId = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      // Token invalid/expired, but that's okay - continue without user context
    }
  }

  const result = db.clearChatHistory(userId);
  res.json(result);
});

// ==================== TRUCK PARKING PREDICTIONS ====================

app.get('/api/truck-parking/predictions', (req, res) => {
  if (!truckParkingPredictions) {
    return res.status(503).json({ error: 'Truck parking predictions unavailable' });
  }

  const timestampParam = req.query.timestamp;
  const hourOffsetParam = req.query.hourOffset;
  const siteFilter = req.query.siteId;

  const requestDate = timestampParam ? new Date(timestampParam) : new Date();
  if (Number.isNaN(requestDate.getTime())) {
    return res.status(400).json({ error: 'Invalid timestamp parameter' });
  }

  let targetHour = getHourOfWeekUTC(requestDate);
  if (hourOffsetParam !== undefined) {
    const offset = parseInt(hourOffsetParam, 10);
    if (!Number.isNaN(offset)) {
      targetHour = ((targetHour + offset) % 168 + 168) % 168;
    }
  }

  const sitesRequested = siteFilter
    ? siteFilter.split(',').map(s => s.trim()).filter(Boolean)
    : Object.keys(truckParkingPredictions.sites || {});

  const siteResults = [];
  sitesRequested.forEach(siteId => {
    const siteData = truckParkingPredictions.sites?.[siteId];
    if (!siteData) return;
    const hourly = siteData.hourMap ? siteData.hourMap[targetHour] : null;
    siteResults.push({
      siteId,
      siteName: siteData.site_name || null,
      latitude: siteData.latitude || null,
      longitude: siteData.longitude || null,
      capacity: siteData.capacity || (hourly ? hourly.mean_capacity : null),
      roadway: siteData.roadway || null,
      state: siteData.state || null,
      prediction: hourly
    });
  });

  const statewide = truckParkingPredictions.statewideHourMap?.[targetHour] || null;

  res.json({
    success: true,
    generatedAt: truckParkingPredictions.generated_at,
    requestTimestamp: requestDate.toISOString(),
    hourOfWeek: targetHour,
    metadata: truckParkingPredictions.metadata,
    statewide,
    sites: siteResults
  });
});

// ==================== COMPLIANCE & DATA QUALITY ENDPOINTS ====================

// Get compliance summary for all states
app.get('/api/compliance/summary', async (req, res) => {
  try {
    console.log('Generating compliance summary for all states...');
    const analyzer = new ComplianceAnalyzer();
    const states = [];

    // Fetch events from all states
    const allResults = await Promise.all(
      getAllStateKeys().map(stateKey => fetchStateData(stateKey))
    );

    // Analyze each state's events
    for (const result of allResults) {
      if (result.events && result.events.length > 0) {
        const stateKey = result.stateKey || result.state.toLowerCase();
        const stateName = API_CONFIG[stateKey]?.name || result.state;
        const analysis = analyzer.analyzeState(stateKey.toUpperCase(), stateName, result.events);

        states.push({
          name: stateName,
          stateKey: stateKey,
          eventCount: result.events.length,
          currentFormat: analysis.currentFormat,
          overallScore: analysis.overallScore,
          dataCompletenessScore: analysis.dataCompletenessScore,
          saeJ2735Ready: analysis.saeJ2735Ready,
          wzdxCompliant: analysis.wzdxCompliant,
          complianceGuideUrl: `/api/compliance/state/${stateKey}`
        });
      }
    }

    // Add Ohio with enhanced OHGO API data
    try {
      console.log('Fetching enhanced Ohio events for compliance analysis...');
      const ohioEvents = await fetchOhioEvents();
      if (ohioEvents && ohioEvents.length > 0) {
        const analysis = analyzer.analyzeState('OH', 'Ohio', ohioEvents);

        // Remove standard Ohio if it exists (replace with enhanced version)
        const ohioIndex = states.findIndex(s => s.stateKey === 'ohio');
        if (ohioIndex !== -1) {
          states.splice(ohioIndex, 1);
        }

        states.push({
          name: 'Ohio',
          stateKey: 'ohio',
          eventCount: ohioEvents.length,
          currentFormat: analysis.currentFormat,
          overallScore: analysis.overallScore,
          dataCompletenessScore: analysis.dataCompletenessScore,
          saeJ2735Ready: analysis.saeJ2735Ready,
          wzdxCompliant: analysis.wzdxCompliant,
          complianceGuideUrl: `/api/compliance/state/ohio`
        });
        console.log(`✅ Added Ohio with ${ohioEvents.length} enhanced events`);
      }
    } catch (error) {
      console.error('Error adding Ohio to compliance summary:', error.message);
    }

    // Add California with Caltrans LCS data
    try {
      console.log('Fetching Caltrans LCS events for compliance analysis...');
      const caltransEvents = await fetchCaltransLCS();
      if (caltransEvents && caltransEvents.length > 0) {
        const analysis = analyzer.analyzeState('CA', 'California', caltransEvents);

        states.push({
          name: 'California',
          stateKey: 'ca',
          eventCount: caltransEvents.length,
          currentFormat: analysis.currentFormat,
          overallScore: analysis.overallScore,
          dataCompletenessScore: analysis.dataCompletenessScore,
          saeJ2735Ready: analysis.saeJ2735Ready,
          wzdxCompliant: analysis.wzdxCompliant,
          complianceGuideUrl: `/api/compliance/state/ca`
        });
        console.log(`✅ Added California with ${caltransEvents.length} Caltrans LCS events`);
      }
    } catch (error) {
      console.error('Error adding California to compliance summary:', error.message);
    }

    // Sort by overall score (descending)
    states.sort((a, b) => b.overallScore.percentage - a.overallScore.percentage);

    console.log(`Compliance summary generated for ${states.length} states`);
    res.json({
      generatedAt: new Date().toISOString(),
      states: states
    });
  } catch (error) {
    console.error('Error generating compliance summary:', error);
    res.status(500).json({ error: 'Failed to generate compliance summary' });
  }
});

// Get detailed compliance guide for specific state
app.get('/api/compliance/state/:stateKey', async (req, res) => {
  try {
    const stateKey = req.params.stateKey.toLowerCase();

    if (!API_CONFIG[stateKey] && stateKey !== 'pa') {
      return res.status(404).json({ error: 'State not found' });
    }

    const stateName = API_CONFIG[stateKey]?.name || 'Pennsylvania';
    console.log(`Generating compliance guide for ${stateName}...`);

    // Fetch state events
    const result = await fetchStateData(stateKey);

    if (!result.events || result.events.length === 0) {
      return res.status(404).json({
        error: 'State has no events',
        stateKey: stateKey.toUpperCase()
      });
    }

    const analyzer = new ComplianceAnalyzer();
    const analysis = analyzer.analyzeState(stateKey.toUpperCase(), stateName, result.events);

    res.json({
      generatedAt: new Date().toISOString(),
      state: {
        stateKey: stateKey.toUpperCase(),
        stateName: stateName,
        eventCount: result.events.length
      },
      ...analysis
    });
  } catch (error) {
    console.error('Error generating state compliance guide:', error);
    res.status(500).json({ error: 'Failed to generate compliance guide' });
  }
});

// Helper to generate secure temporary passwords for admin resets
const generateTemporaryPassword = (length = 12) => {
  const raw = crypto.randomBytes(Math.ceil(length * 0.75)).toString('base64');
  return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, length) || crypto.randomBytes(length).toString('hex').slice(0, length);
};

// ==================== ADMIN USER MANAGEMENT ENDPOINTS ====================

// List users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await db.getAllUsers();
  res.json({ success: true, users });
});

// Create user
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { email, password, fullName, organization, stateKey, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let userPassword = password;
    if (!userPassword) {
      userPassword = generateTemporaryPassword();
    }

    const result = await db.createUser({
      username: email,  // Use email as username
      email,
      password: userPassword,
      fullName,
      organization,
      stateKey,
      role: role || 'user'
    });

    if (result.success) {
      const createdUser = await db.getUserById(result.userId);
      res.status(201).json({
        success: true,
        user: createdUser,
        temporaryPassword: password ? null : userPassword
      });
    } else {
      res.status(400).json({ error: result.error || 'Failed to create user' });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
app.put('/api/admin/users/:userId', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const updates = {};
  const allowedFields = ['email', 'fullName', 'organization', 'role', 'stateKey', 'active', 'notifyOnMessages', 'notifyOnHighSeverity'];

  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  // If email is updated, also update username to keep them in sync
  if (updates.email) {
    updates.username = updates.email;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const result = db.updateUser(userId, updates);

  if (result.success) {
    const updated = db.getUserById(userId);
    res.json({ success: true, user: updated });
  } else {
    res.status(400).json({ error: result.error || 'Failed to update user' });
  }
});

// Reset password
app.post('/api/admin/users/:userId/reset-password', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const newPassword = req.body?.password || generateTemporaryPassword();
  const result = db.updateUser(userId, { password: newPassword });

  if (result.success) {
    res.json({ success: true, temporaryPassword: newPassword, message: 'Password reset successfully' });
  } else {
    res.status(400).json({ error: result.error || 'Failed to reset password' });
  }
});

// Delete user
app.delete('/api/admin/users/:userId', requireAdmin, (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  const result = db.deleteUser(userId);

  if (result.success) {
    res.json({ success: true, message: 'User deleted' });
  } else {
    res.status(400).json({ error: result.error || 'Failed to delete user' });
  }
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
app.get('/api/admin/states', async (req, res) => {
  const authHeader = req.headers.authorization;
  const isAdmin = authHeader && authHeader.startsWith('Bearer ') &&
                  db.verifyAdminToken(authHeader.substring(7));

  const states = await db.getAllStates(isAdmin);

  res.json({
    success: true,
    count: states.length,
    states: states
  });
});

// Interchange management (admin)
// Public endpoint to get all active interchanges for map display
app.get('/api/interchanges', (req, res) => {
  const interchanges = db.getInterchanges().filter(i => i.active);
  res.json({ success: true, interchanges });
});

app.get('/api/admin/interchanges', requireAdmin, (req, res) => {
  const interchanges = db.getInterchanges();
  res.json({ success: true, interchanges });
});

app.post('/api/admin/interchanges', requireAdmin, (req, res) => {
  const { name, stateKey, corridor, latitude, longitude, watchRadiusKm, notifyStates, detourMessage, active } = req.body;

  if (!name || !stateKey || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'name, stateKey, latitude, and longitude are required' });
  }

  const result = db.createInterchange({
    name,
    stateKey: stateKey.toLowerCase(),
    corridor,
    latitude,
    longitude,
    watchRadiusKm: watchRadiusKm || 15,
    notifyStates: notifyStates || [],
    detourMessage,
    active: active !== undefined ? !!active : true
  });

  if (result.success) {
    res.status(201).json({ success: true, id: result.id });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.put('/api/admin/interchanges/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid interchange id' });
  }

  const updates = { ...req.body };
  if (updates.stateKey) {
    updates.stateKey = updates.stateKey.toLowerCase();
  }

  if (updates.notifyStates) {
    updates.notifyStates = Array.isArray(updates.notifyStates) ? updates.notifyStates : [updates.notifyStates];
  }

  const result = db.updateInterchange(id, updates);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.delete('/api/admin/interchanges/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid interchange id' });
  }

  const result = db.deleteInterchange(id);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.post('/api/admin/detour-alerts/:id/resolve', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid alert id' });
  }

  const note = req.body?.note || null;
  const result = db.resolveDetourAlert(id, note);
  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(400).json({ error: result.error });
  }
});

app.get('/api/detour-alerts/active', requireUser, async (req, res) => {
  const alerts = await db.getActiveDetourAlerts();
  res.json({ success: true, alerts });
});

app.get('/api/bridge-warnings/active', async (req, res) => {
  const warnings = await db.getActiveBridgeWarnings();
  res.json({ success: true, warnings });
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

// Admin send message to state (no state login required)
app.post('/api/admin/messages', requireAdmin, (req, res) => {
  const { toState, messageType, messageContent } = req.body;

  if (!toState || !messageType || !messageContent) {
    return res.status(400).json({ error: 'Missing required fields: toState, messageType, messageContent' });
  }

  // Verify recipient state exists
  const recipient = db.getState(toState);
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient state not found' });
  }

  // Send message with fromState as 'ADMIN'
  const result = db.sendMessage({
    fromState: 'ADMIN',
    toState,
    subject: messageType.charAt(0).toUpperCase() + messageType.slice(1), // Capitalize message type
    message: messageContent,
    priority: messageType === 'alert' ? 'high' : 'normal'
  });

  if (result.success) {
    console.log(`📧 Admin sent ${messageType} message to ${recipient.stateName}`);
    res.status(201).json({
      success: true,
      messageId: result.id,
      message: `Message sent to ${recipient.stateName}`
    });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Feed submission endpoints
app.post('/api/feeds/submit', requireUser, (req, res) => {
  const { feedName, feedUrl, format, apiType, stateKey, apiKey, username, password, notes } = req.body;

  if (!feedName || !feedUrl || !format) {
    return res.status(400).json({ error: 'feedName, feedUrl, and format are required' });
  }

  const credentials = {};
  if (apiKey) credentials.apiKey = apiKey;
  if (username) credentials.username = username;
  if (password) credentials.password = password;

  const submission = db.submitFeed({
    submittedBy: req.user.id,
    submitterUsername: req.user.username,
    submitterEmail: req.user.email,
    feedName,
    feedUrl,
    format,
    apiType,
    stateKey,
    credentials,
    notes
  });

  if (submission.success) {
    res.status(201).json({ success: true, id: submission.id });
  } else {
    res.status(500).json({ error: submission.error });
  }
});

app.get('/api/admin/feeds/submissions', requireAdmin, (req, res) => {
  const status = req.query.status || 'pending';
  const submissions = db.getFeedSubmissions(status);
  res.json({ success: true, submissions });
});

app.post('/api/admin/feeds/submissions/:id/resolve', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid submission id' });
  }

  const { status, adminNote, enableState = true, overwriteExisting = false } = req.body || {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved or rejected' });
  }

  const submission = db.getFeedSubmission(id);
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  if (submission.status !== 'pending') {
    return res.status(400).json({ error: 'Submission already processed' });
  }

  if (status === 'approved') {
    if (!submission.stateKey) {
      return res.status(400).json({ error: 'Submission missing stateKey; cannot auto-configure state' });
    }

    const stateKey = submission.stateKey.toLowerCase();
    const existingState = db.getState(stateKey, true);
    const apiUrl = submission.feedUrl;
    const format = submission.format;
    const apiType = submission.apiType || 'Custom';
    const credentials = submission.credentials || {};

    if (existingState) {
      if (!overwriteExisting) {
        console.log(`ℹ️ Feed submission ${id} references existing state ${stateKey}; overwrite not requested`);
      } else {
        db.updateState(stateKey, {
          apiUrl,
          format,
          apiType,
          enabled: enableState
        });

        if (Object.keys(credentials).length) {
          db.setStateCredentials(stateKey, credentials);
        }

        console.log(`✅ Updated state configuration for ${stateKey} via feed submission ${id}`);
      }
    } else {
      const addResult = db.addState({
        stateKey,
        stateName: submission.feedName,
        apiUrl,
        apiType,
        format,
        credentials
      });

      if (!addResult.success) {
        return res.status(500).json({ error: addResult.error || 'Failed to add state' });
      }

      if (enableState === false) {
        db.updateState(stateKey, { enabled: false });
      }

      console.log(`✅ Added new state configuration ${stateKey} via feed submission ${id}`);
    }

    loadStatesFromDatabase();
  }

  const adminUser = req.user?.username || 'admin-token';
  db.updateFeedSubmissionStatus(id, status, adminUser, adminNote || null);
  res.json({ success: true });
});

// High-Severity Event Monitoring
// Track notified events to avoid duplicate notifications
const notifiedEvents = new Set();
let detourEvaluationRunning = false;

const severityWeight = (severity) => {
  if (!severity) return 0;
  const normalized = severity.toLowerCase();
  if (['critical', 'high', 'major', 'severe'].includes(normalized)) return 3;
  if (['medium', 'moderate'].includes(normalized)) return 2;
  if (['low', 'minor'].includes(normalized)) return 1;
  return 0;
};

const isImpactfulEvent = (event) => {
  const type = (event.eventType || '').toLowerCase();
  const severity = severityWeight(event.severity) >= 2;
  const lanes = (event.lanesAffected || '').toLowerCase();
  const description = (event.description || '').toLowerCase();

  const closureKeywords = ['closure', 'closed', 'blocked', 'standstill', 'stalled', 'crash', 'accident', 'jackknife'];
  const isClosure = closureKeywords.some(keyword => type.includes(keyword) || description.includes(keyword));
  const lanesClosed = lanes.includes('closed') || lanes.includes('blocked');

  return severity || isClosure || lanesClosed;
};

const buildDetourMessage = (interchange, event) => {
  if (interchange.detourMessage) {
    return interchange.detourMessage
      .replace(/{{eventType}}/gi, event.eventType || 'Event')
      .replace(/{{interchange}}/gi, interchange.name)
      .replace(/{{corridor}}/gi, event.corridor || interchange.corridor || '')
      .replace(/{{state}}/gi, event.state || interchange.stateKey.toUpperCase());
  }

  const base = `${event.eventType || 'Incident'} near ${interchange.name}`;
  const detail = event.lanesAffected ? `${event.lanesAffected}.` : 'Expect major delays.';
  return `${base}. ${detail} Consider activating detour messaging for alternate routes.`;
};

// Mapping of major corridors to states they pass through
const CORRIDOR_STATES = {
  'I-5': ['ca', 'or', 'wa'],
  'I-10': ['ca', 'az', 'nm', 'tx', 'la', 'ms', 'al', 'fl'],
  'I-15': ['ca', 'nv', 'az', 'ut', 'id', 'mt'],
  'I-20': ['tx', 'la', 'ms', 'al', 'ga', 'sc'],
  'I-25': ['nm', 'co', 'wy'],
  'I-29': ['mo', 'ia', 'sd', 'nd'],
  'I-35': ['tx', 'ok', 'ks', 'mo', 'ia', 'mn'],
  'I-40': ['ca', 'az', 'nm', 'tx', 'ok', 'ar', 'tn', 'nc'],
  'I-44': ['tx', 'ok', 'mo'],
  'I-55': ['la', 'ms', 'tn', 'ar', 'mo', 'il'],
  'I-64': ['va', 'wv', 'ky', 'in', 'il', 'mo'],
  'I-65': ['al', 'tn', 'ky', 'in'],
  'I-70': ['ut', 'co', 'ks', 'mo', 'il', 'in', 'oh', 'wv', 'pa', 'md'],
  'I-71': ['ky', 'oh'],
  'I-75': ['fl', 'ga', 'tn', 'ky', 'oh', 'mi'],
  'I-76': ['co', 'ne', 'pa', 'nj', 'oh'],
  'I-77': ['sc', 'nc', 'va', 'wv', 'oh'],
  'I-78': ['ny', 'nj', 'pa'],
  'I-79': ['wv', 'pa'],
  'I-80': ['ca', 'nv', 'ut', 'wy', 'ne', 'ia', 'il', 'in', 'oh', 'pa', 'nj', 'ny'],
  'I-81': ['tn', 'va', 'wv', 'md', 'pa', 'ny'],
  'I-84': ['or', 'id', 'ut', 'pa', 'ny', 'ct', 'ma'],
  'I-85': ['al', 'ga', 'sc', 'nc', 'va'],
  'I-87': ['ny'],
  'I-90': ['wa', 'id', 'mt', 'wy', 'sd', 'mn', 'wi', 'il', 'in', 'oh', 'pa', 'ny', 'ma'],
  'I-94': ['mt', 'nd', 'mn', 'wi', 'il', 'in', 'mi'],
  'I-95': ['fl', 'ga', 'sc', 'nc', 'va', 'md', 'de', 'pa', 'nj', 'ny', 'ct', 'ri', 'ma', 'nh', 'me']
};

// Get states that should be notified based on corridor relevance
const getRelevantStates = (eventCorridor, interchangeState, notifyStates) => {
  const relevantStates = new Set(interchangeState ? [interchangeState.toLowerCase()] : []);

  // Extract the main corridor (e.g., "I-80" from "I-80 / I-90")
  const corridorMatch = eventCorridor?.match(/I-\d+/);
  if (!corridorMatch) {
    // If no interstate corridor, only notify the interchange's state and explicitly listed states
    notifyStates.forEach(state => {
      if (state) relevantStates.add(state.toLowerCase());
    });
    return Array.from(relevantStates);
  }

  const mainCorridor = corridorMatch[0];
  const statesOnCorridor = CORRIDOR_STATES[mainCorridor] || [];

  // Only add notify states if they're on the affected corridor
  notifyStates.forEach(state => {
    if (!state) return;
    const normalizedState = state.toLowerCase();
    if (statesOnCorridor.includes(normalizedState)) {
      relevantStates.add(normalizedState);
    } else {
      console.log(`📍 Skipping ${normalizedState} - ${mainCorridor} doesn't pass through their state`);
    }
  });

  return Array.from(relevantStates);
};

const notifyDetourSubscribers = async (alertRecord, interchange, event) => {
  // notifyStates is a comma-separated string from DB, need to parse it into an array
  const notifyStates = interchange.notifyStates
    ? (typeof interchange.notifyStates === 'string'
        ? interchange.notifyStates.split(',').map(s => s.trim())
        : interchange.notifyStates)
    : [];
  const relevantStates = getRelevantStates(event.corridor, interchange.stateKey, notifyStates);

  console.log(`📨 Notifying ${relevantStates.length} relevant state(s) for ${event.corridor}: ${relevantStates.join(', ')}`);

  relevantStates.forEach(stateKey => {
    const normalizedState = stateKey.toLowerCase();

    // Check if we already sent a message for this event+state combination in the last hour
    try {
      const recentMessage = db.db.prepare(`
        SELECT id FROM state_messages
        WHERE event_id = ?
        AND to_state = ?
        AND subject LIKE '%Detour Advisory%'
        AND from_state = 'ADMIN'
        AND created_at > datetime('now', '-1 hour')
        LIMIT 1
      `).get(event.id, normalizedState);

      if (recentMessage) {
        console.log(`⏭️  Skipping duplicate detour message for ${normalizedState} (event ${event.id})`);
        return; // Skip sending duplicate message
      }
    } catch (err) {
      console.error('Error checking for duplicate message:', err);
    }

    db.sendMessage({
      fromState: 'ADMIN',
      toState: normalizedState,
      subject: `Detour Advisory: ${interchange.name}`,
      message: alertRecord.message,
      eventId: event.id,
      priority: 'high'
    });

    // Also add as event comment so it shows in the event modal
    // BUT - check if this exact message already exists in the last 24 hours to avoid spam
    const recentComments = db.db.prepare(`
      SELECT comment, created_at
      FROM event_comments
      WHERE event_id = ?
        AND state_name = 'DOT Corridor Communicator'
        AND comment = ?
        AND created_at > datetime('now', '-24 hours')
      LIMIT 1
    `).get(event.id, alertRecord.message);

    // Only add comment if it doesn't already exist recently
    const isNewAlert = !recentComments;
    if (isNewAlert) {
      db.addEventComment({
        eventId: event.id,
        stateKey: normalizedState,
        stateName: 'DOT Corridor Communicator',
        comment: alertRecord.message
      });
      console.log(`✅ Added new automated comment for event ${event.id}`);
    } else {
      console.log(`⏭️  Skipped duplicate automated comment for event ${event.id} (last posted ${recentComments.created_at})`);
    }

    // Only send email notifications for NEW alerts (not duplicates)
    // This prevents email spam when the same alert is detected repeatedly
    if (isNewAlert) {
      const recipients = db.getUsersForMessageNotification(normalizedState);
      if (Array.isArray(recipients)) {
        console.log(`📧 Sending detour alert emails to ${recipients.length} recipients for ${interchange.name}`);
        recipients.forEach(recipient => {
          emailService.sendDetourAlertNotification(recipient.email, recipient.fullName || recipient.username, {
            interchangeName: interchange.name,
            eventCorridor: event.corridor,
            interchangeCorridor: interchange.corridor,
            eventDescription: event.description,
            eventLocation: event.location,
            severity: event.severity,
            lanesAffected: event.lanesAffected,
            message: alertRecord.message
          }).catch(err => console.error('Email detour alert error:', err));
        });
      }
    } else {
      console.log(`📧 Skipped duplicate detour alert emails for event ${event.id}`);
    }
  });
};

const evaluateDetourAlerts = async () => {
  if (detourEvaluationRunning) return;
  detourEvaluationRunning = true;

  try {
    const interchanges = await db.getActiveInterchanges();
    if (!interchanges.length) {
      return;
    }

    const stateKeys = getAllStateKeys();
    const results = await Promise.all(stateKeys.map(fetchStateData));
    const allEvents = [];
    results.forEach(result => {
      allEvents.push(...result.events);
    });

    const activeAlerts = await db.getActiveDetourAlerts();
    const alertByInterchange = new Map();
    activeAlerts.forEach(alert => {
      alertByInterchange.set(alert.interchangeId, alert);
    });

    const processedInterchanges = new Set();
    const now = Date.now();

    interchanges.forEach(interchange => {
      const radius = interchange.watchRadiusKm || 15;

      const candidates = allEvents.filter(event => {
        if (!event.latitude || !event.longitude) return false;
        if (!isImpactfulEvent(event)) return false;

        const distance = haversineDistanceKm(
          parseFloat(event.latitude),
          parseFloat(event.longitude),
          interchange.latitude,
          interchange.longitude
        );
        if (distance > radius) return false;

        if (event.startTime) {
          const eventTime = new Date(event.startTime).getTime();
          if (!Number.isNaN(eventTime) && now - eventTime > 6 * 60 * 60 * 1000) {
            return false;
          }
        }

        return true;
      }).sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));

      if (candidates.length === 0) {
        processedInterchanges.add(interchange.id);
        const existingAlert = alertByInterchange.get(interchange.id);
        if (existingAlert) {
          db.resolveDetourAlert(existingAlert.id, 'No qualifying events in watch radius');
          console.log(`✅ Resolved detour alert at ${interchange.name}`);
        }
        return;
      }

      const event = candidates[0];
      processedInterchanges.add(interchange.id);
      const existingAlert = alertByInterchange.get(interchange.id);

      if (existingAlert && existingAlert.eventId === event.id) {
        return; // already active for this event
      }

      if (existingAlert && existingAlert.eventId !== event.id) {
        db.resolveDetourAlert(existingAlert.id, 'Superseded by new event');
      }

      const message = buildDetourMessage(interchange, event);
      const notifyStates = new Set(interchange.stateKey ? [interchange.stateKey.toLowerCase()] : []);
      // notifyStates is a comma-separated string from DB, need to split it
      const notifyStatesArray = interchange.notifyStates
        ? (typeof interchange.notifyStates === 'string'
            ? interchange.notifyStates.split(',').map(s => s.trim())
            : interchange.notifyStates)
        : [];
      notifyStatesArray.forEach(state => {
        if (state) notifyStates.add(state.toLowerCase());
      });

      const createResult = db.createDetourAlert({
        interchangeId: interchange.id,
        eventId: event.id,
        eventState: (event.state || '').toLowerCase(),
        eventCorridor: event.corridor || null,
        eventLocation: event.location || '',
        eventDescription: event.description || '',
        severity: event.severity || null,
        lanesAffected: event.lanesAffected || null,
        notifiedStates: Array.from(notifyStates),
        message
      });

      if (createResult.success) {
        console.log(`🚨 Detour alert created for ${interchange.name} (event ${event.id})`);
        notifyDetourSubscribers({
          id: createResult.id,
          message
        }, interchange, event);
      }
    });

    // Clean up alerts for interchanges no longer monitored
    activeAlerts.forEach(alert => {
      if (!processedInterchanges.has(alert.interchangeId)) {
        db.resolveDetourAlert(alert.id, 'Interchange no longer monitored');
      }
    });

    // Clean up alerts for events that no longer exist
    const currentEventIds = new Set(allEvents.map(e => e.id));
    activeAlerts.forEach(alert => {
      if (alert.eventId && !currentEventIds.has(alert.eventId)) {
        db.resolveDetourAlert(alert.id, 'Event no longer active');
      }
    });

    // Clean up alerts older than 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    activeAlerts.forEach(alert => {
      const createdAt = new Date(alert.createdAt);
      if (createdAt < twentyFourHoursAgo) {
        db.resolveDetourAlert(alert.id, 'Alert expired (>24 hours old)');
      }
    });
  } catch (error) {
    console.error('Error evaluating detour alerts:', error);
  } finally {
    detourEvaluationRunning = false;
  }
};

async function checkHighSeverityEvents() {
  try {
    // Fetch all current events
    const allStates = await db.getAllStates();
    const results = await Promise.all(
      allStates.map(state => fetchStateData(state.stateKey))
    );

    // Check each state's events for high severity
    for (const result of results) {
      const highSeverityEvents = result.events.filter(event =>
        event.severity === 'high' &&
        event.corridor &&
        !notifiedEvents.has(event.id)
      );

      if (highSeverityEvents.length > 0) {
        console.log(`🚨 Found ${highSeverityEvents.length} high-severity events in ${result.state}`);

        // Get users who should be notified for this state
        const usersToNotify = db.getUsersForHighSeverityNotification(result.state);

        // Send notifications for each high-severity event
        for (const event of highSeverityEvents) {
          console.log(`📧 Sending high-severity alerts for event ${event.id} in ${result.state}`);

          for (const user of usersToNotify) {
            await emailService.sendHighSeverityEventNotification(
              user.email,
              user.fullName || user.username,
              event
            );
          }

          // Mark this event as notified to avoid duplicate alerts
          notifiedEvents.add(event.id);
        }
      }
    }

    // Clean up old events from notified set (keep last 1000)
    if (notifiedEvents.size > 1000) {
      const eventsArray = Array.from(notifiedEvents);
      notifiedEvents.clear();
      eventsArray.slice(-500).forEach(id => notifiedEvents.add(id));
    }
  } catch (error) {
    console.error('Error checking high-severity events:', error);
  }
}

// ========================================
// Data Quality & Provenance API Endpoints
// ========================================

// Data quality tracking
const dataQualityTracker = require('./data_quality.js');

// Get data quality dashboard for all feeds
app.get('/api/quality/feeds', (req, res) => {
  try {
    const timeWindow = parseInt(req.query.hours) || 24;
    const feedHealth = dataQualityTracker.getAllFeedHealth(timeWindow);

    res.json({
      success: true,
      timeWindowHours: timeWindow,
      feeds: feedHealth,
      summary: {
        total: feedHealth.length,
        excellent: feedHealth.filter(f => f.status === 'EXCELLENT').length,
        operational: feedHealth.filter(f => f.status === 'OPERATIONAL').length,
        degraded: feedHealth.filter(f => f.status === 'DEGRADED').length,
        critical: feedHealth.filter(f => f.status === 'CRITICAL').length,
        avgUptime: feedHealth.reduce((sum, f) => sum + f.uptime, 0) / feedHealth.length,
        avgQuality: feedHealth.reduce((sum, f) => sum + f.avgQuality, 0) / feedHealth.length
      }
    });
  } catch (error) {
    console.error('Error fetching feed quality:', error);
    res.status(500).json({ error: 'Failed to fetch feed quality data' });
  }
});

// Get quality assessment for a specific event
app.get('/api/quality/event/:eventId', (req, res) => {
  try {
    const eventId = req.params.eventId;
    // This would need to be implemented to look up events
    // For now, return a placeholder
    res.json({
      success: true,
      message: 'Event quality assessment endpoint (placeholder)',
      eventId
    });
  } catch (error) {
    console.error('Error assessing event quality:', error);
    res.status(500).json({ error: 'Failed to assess event quality' });
  }
});

// Get feed health for specific feed
app.get('/api/quality/feed/:feedKey', (req, res) => {
  try {
    const feedKey = req.params.feedKey;
    const timeWindow = parseInt(req.query.hours) || 24;
    const health = dataQualityTracker.getFeedHealth(feedKey, timeWindow);

    res.json({
      success: true,
      timeWindowHours: timeWindow,
      ...health
    });
  } catch (error) {
    console.error('Error fetching feed health:', error);
    res.status(500).json({ error: 'Failed to fetch feed health' });
  }
});

// Get anomalies detected across all feeds
app.get('/api/quality/anomalies', (req, res) => {
  try {
    const feedKey = req.query.feed;
    const anomalies = [];

    if (feedKey) {
      // Get anomalies for specific feed
      const feedAnomalies = dataQualityTracker.detectAnomalies(feedKey, 0);
      if (feedAnomalies.length > 0) {
        anomalies.push({ feedKey, anomalies: feedAnomalies });
      }
    } else {
      // Get anomalies for all feeds
      const feeds = dataQualityTracker.getAllFeedHealth(24);
      feeds.forEach(feed => {
        const feedAnomalies = dataQualityTracker.detectAnomalies(feed.feedKey, 0);
        if (feedAnomalies.length > 0) {
          anomalies.push({ feedKey: feed.feedKey, anomalies: feedAnomalies });
        }
      });
    }

    res.json({
      success: true,
      count: anomalies.length,
      anomalies
    });
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

// ========================================
// Data Quality Grading System (MDODE-aligned)
// ========================================

// Get all corridors with quality scores
app.get('/api/data-quality/corridors', async (req, res) => {
  try {
    const corridors = await db.allAsync(
      `SELECT DISTINCT corridor_id, corridor_name
       FROM corridor_service_quality_latest
       ORDER BY corridor_name`
    );

    res.json({
      success: true,
      corridors
    });
  } catch (error) {
    console.error('Error fetching corridors:', error);
    res.status(500).json({ error: 'Failed to fetch corridors' });
  }
});

// Get quality scores for a specific corridor (all services)
app.get('/api/data-quality/corridor/:corridorId', async (req, res) => {
  try {
    const { corridorId } = req.params;
    const { minGrade, serviceType } = req.query;

    let sql = `SELECT * FROM corridor_service_quality_latest WHERE corridor_id = ?`;
    const params = [corridorId];

    if (serviceType) {
      sql += ` AND service_type_id = ?`;
      params.push(serviceType);
    }

    if (minGrade) {
      const gradeOrder = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
      const minIndex = gradeOrder.indexOf(minGrade);
      if (minIndex >= 0) {
        const acceptableGrades = gradeOrder.slice(minIndex);
        sql += ` AND letter_grade IN (${acceptableGrades.map(() => '?').join(',')})`;
        params.push(...acceptableGrades);
      }
    }

    sql += ` ORDER BY dqi DESC`;

    const services = await db.allAsync(sql, params);

    if (services.length === 0) {
      return res.status(404).json({ error: 'Corridor not found or no services match criteria' });
    }

    res.json({
      success: true,
      corridor: {
        id: corridorId,
        name: services[0].corridor_name
      },
      services,
      summary: {
        totalServices: services.length,
        avgDQI: services.reduce((sum, s) => sum + s.dqi, 0) / services.length,
        gradeDistribution: services.reduce((acc, s) => {
          acc[s.letter_grade] = (acc[s.letter_grade] || 0) + 1;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching corridor quality:', error);
    res.status(500).json({ error: 'Failed to fetch corridor quality data' });
  }
});

// Get detailed quality breakdown for specific corridor/service
app.get('/api/data-quality/corridor/:corridorId/service/:serviceTypeId', async (req, res) => {
  try {
    const { corridorId, serviceTypeId } = req.params;

    // Get the latest quality score
    const service = await db.getAsync(
      `SELECT * FROM corridor_service_quality_latest
       WHERE corridor_id = ? AND service_type_id = ?`,
      [corridorId, serviceTypeId]
    );

    if (!service) {
      return res.status(404).json({ error: 'Service not found for this corridor' });
    }

    // Get all validation runs for this feed
    const validationRuns = await db.allAsync(
      `SELECT vr.*, qs.dqi, qs.letter_grade, qs.acc_score, qs.cov_score,
              qs.tim_score, qs.std_score, qs.gov_score
       FROM validation_runs vr
       JOIN quality_scores qs ON vr.id = qs.validation_run_id
       WHERE vr.data_feed_id = ?
       ORDER BY vr.period_end DESC
       LIMIT 10`,
      [service.data_feed_id]
    );

    // Get detailed metrics for the latest validation run
    const metrics = await db.allAsync(
      `SELECT vr.id as validation_run_id, mv.*
       FROM validation_runs vr
       JOIN data_feeds df ON vr.data_feed_id = df.id
       JOIN metric_values mv ON vr.id = mv.validation_run_id
       WHERE df.corridor_id = ? AND df.service_type_id = ?
       ORDER BY vr.period_end DESC
       LIMIT 20`,
      [corridorId, serviceTypeId]
    );

    res.json({
      success: true,
      service,
      validationHistory: validationRuns,
      metrics
    });
  } catch (error) {
    console.error('Error fetching service quality details:', error);
    res.status(500).json({ error: 'Failed to fetch service quality details' });
  }
});

// Get all service types
app.get('/api/data-quality/service-types', async (req, res) => {
  try {
    const serviceTypes = await db.allAsync(
      `SELECT * FROM service_types ORDER BY category, display_name`
    );

    res.json({
      success: true,
      serviceTypes
    });
  } catch (error) {
    console.error('Error fetching service types:', error);
    res.status(500).json({ error: 'Failed to fetch service types' });
  }
});

// Get quality summary across all corridors
app.get('/api/data-quality/summary', async (req, res) => {
  try {
    const allScores = await db.allAsync(
      `SELECT corridor_id, corridor_name, service_type_id, service_display_name,
              category, dqi, letter_grade
       FROM corridor_service_quality_latest
       ORDER BY dqi DESC`
    );

    const summary = {
      totalScores: allScores.length,
      avgDQI: allScores.reduce((sum, s) => sum + s.dqi, 0) / allScores.length,
      gradeDistribution: allScores.reduce((acc, s) => {
        acc[s.letter_grade] = (acc[s.letter_grade] || 0) + 1;
        return acc;
      }, {}),
      categoryBreakdown: allScores.reduce((acc, s) => {
        if (!acc[s.category]) {
          acc[s.category] = { count: 0, avgDQI: 0, scores: [] };
        }
        acc[s.category].count++;
        acc[s.category].scores.push(s.dqi);
        return acc;
      }, {}),
      topPerformers: allScores.slice(0, 10),
      needsImprovement: allScores.filter(s => s.dqi < 70).slice(0, 10)
    };

    // Calculate category averages
    Object.keys(summary.categoryBreakdown).forEach(cat => {
      const scores = summary.categoryBreakdown[cat].scores;
      summary.categoryBreakdown[cat].avgDQI = scores.reduce((a, b) => a + b, 0) / scores.length;
      delete summary.categoryBreakdown[cat].scores;
    });

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error fetching quality summary:', error);
    res.status(500).json({ error: 'Failed to fetch quality summary' });
  }
});

// Run TETC Data Quality migrations (one-time setup)
app.post('/api/data-quality/migrate', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { Client } = require('pg');

    console.log('🔧 Starting TETC Data Quality migrations...');

    // Use PostgreSQL client for production
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Step 1: Apply schema migration
    console.log('📋 Applying schema migration...');
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/add_data_quality_schema_pg.sql'),
      'utf8'
    );
    await client.query(schemaSQL);
    console.log('✅ Schema migration applied');

    // Step 2: Apply TETC data migration
    console.log('📊 Applying TETC data migration...');
    const tetcSQL = fs.readFileSync(
      path.join(__dirname, 'migrations/tetc_data_quality_pg.sql'),
      'utf8'
    );
    await client.query(tetcSQL);
    console.log('✅ TETC data migration applied');

    // Step 3: Verify data
    console.log('🔍 Verifying data...');
    const corridorCount = await client.query('SELECT COUNT(*) as count FROM corridors');
    const feedCount = await client.query('SELECT COUNT(*) as count FROM data_feeds');
    const scoreCount = await client.query('SELECT COUNT(*) as count FROM quality_scores');

    const result = {
      success: true,
      message: 'TETC Data Quality migrations completed successfully!',
      summary: {
        corridors: parseInt(corridorCount.rows[0].count),
        data_feeds: parseInt(feedCount.rows[0].count),
        quality_scores: parseInt(scoreCount.rows[0].count)
      }
    };

    await client.end();
    console.log('✅ Migration complete:', result.summary);
    res.json(result);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check server logs for full error details'
    });
  }
});

// Run Users table migration for PostgreSQL
app.post('/api/admin/migrate-users', async (req, res) => {
  try {
    const { Client } = require('pg');

    console.log('🔧 Starting users table migration...');

    // Use PostgreSQL client for production
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Connected to PostgreSQL database');

    // Create users table
    console.log('📋 Creating users table...');
    const usersTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        organization TEXT,
        state_key TEXT,
        role TEXT DEFAULT 'user',
        active BOOLEAN DEFAULT TRUE,
        notify_on_messages BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_tokens (
        id SERIAL PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP,
        active BOOLEAN DEFAULT TRUE
      );
    `;

    await client.query(usersTableSQL);
    console.log('✅ Users table created');

    // Verify tables exist
    console.log('🔍 Verifying tables...');
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    const tokenCount = await client.query('SELECT COUNT(*) as count FROM admin_tokens');

    const result = {
      success: true,
      message: 'Users table migration completed successfully!',
      summary: {
        users: parseInt(userCount.rows[0].count),
        admin_tokens: parseInt(tokenCount.rows[0].count)
      }
    };

    await client.end();
    console.log('✅ Migration complete:', result.summary);
    res.json(result);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Check server logs for full error details'
    });
  }
});

// ========================================
// Truck Parking API Endpoints
// ========================================

const ParkingPredictor = require('./parking_prediction.js');
const parkingPredictor = new ParkingPredictor(db);

// Historical pattern-based parking service
const truckParkingService = require('./truck_parking_service.js');

// Load historical patterns on startup (async)
setTimeout(async () => {
  try {
    const loaded = await truckParkingService.loadPatterns();
    if (loaded) {
      console.log('✅ Truck parking historical patterns loaded successfully from database');
    } else {
      console.log('⚠️  Truck parking patterns not loaded - run: node scripts/migrate_parking_to_db.js');
    }
  } catch (error) {
    console.error('❌ Failed to load parking patterns:', error.message);
  }
}, 2000);

// TPIMS data fetcher
const { fetchTPIMSFeed, validatePredictions } = require('./scripts/fetch_tpims_data.js');

const TPIMS_FEEDS = [
  {
    name: 'TRIMARC TPIMS',
    url: 'http://www.trimarc.org/dat/tpims/TPIMS_Dynamic.json',
    state: 'KY',
    protocol: require('http')
  },
  {
    name: 'Minnesota DOT TPIMS',
    url: 'http://iris.dot.state.mn.us/iris/TPIMS_dynamic',
    state: 'MN',
    protocol: require('http')
  }
];

// Get all parking facilities
app.get('/api/parking/facilities', async (req, res) => {
  try {
    const stateFilter = req.query.state || null;
    const facilities = await db.getParkingFacilities(stateFilter);
    res.json({ success: true, facilities });
  } catch (error) {
    console.error('Error fetching parking facilities:', error);
    res.status(500).json({ error: 'Failed to fetch parking facilities' });
  }
});

// Get latest parking availability for all facilities
app.get('/api/parking/availability', (req, res) => {
  try {
    const availability = db.getLatestParkingAvailability();
    res.json({ success: true, availability });
  } catch (error) {
    console.error('Error fetching parking availability:', error);
    res.status(500).json({ error: 'Failed to fetch parking availability' });
  }
});

// Get parking availability for a specific facility
app.get('/api/parking/availability/:facilityId', (req, res) => {
  try {
    const facilityId = req.params.facilityId;
    const availability = db.getLatestParkingAvailability(facilityId);

    if (!availability) {
      return res.status(404).json({ error: 'Facility not found or no availability data' });
    }

    res.json({ success: true, availability });
  } catch (error) {
    console.error('Error fetching facility availability:', error);
    res.status(500).json({ error: 'Failed to fetch facility availability' });
  }
});

// Get parking history for a facility
app.get('/api/parking/history/:facilityId', (req, res) => {
  try {
    const facilityId = req.params.facilityId;
    const hours = parseInt(req.query.hours || '24', 10);
    const history = db.getParkingHistory(facilityId, hours);
    res.json({ success: true, history });
  } catch (error) {
    console.error('Error fetching parking history:', error);
    res.status(500).json({ error: 'Failed to fetch parking history' });
  }
});

// Admin: Add or update parking facility
app.post('/api/admin/parking/facility', requireAdmin, (req, res) => {
  try {
    const { facilityId, facilityName, state, latitude, longitude, address, totalSpaces, truckSpaces, amenities, facilityType } = req.body;

    if (!facilityId || !facilityName || !state || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'facilityId, facilityName, state, latitude, and longitude are required' });
    }

    const result = db.addParkingFacility({
      facilityId,
      facilityName,
      state,
      latitude,
      longitude,
      address,
      totalSpaces,
      truckSpaces,
      amenities,
      facilityType
    });

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error adding parking facility:', error);
    res.status(500).json({ error: 'Failed to add parking facility' });
  }
});

// Admin: Add parking availability data
app.post('/api/admin/parking/availability', requireAdmin, (req, res) => {
  try {
    const { facilityId, availableSpaces, occupiedSpaces, isPrediction, predictionConfidence } = req.body;

    if (!facilityId || availableSpaces === undefined || occupiedSpaces === undefined) {
      return res.status(400).json({ error: 'facilityId, availableSpaces, and occupiedSpaces are required' });
    }

    const result = db.addParkingAvailability({
      facilityId,
      availableSpaces,
      occupiedSpaces,
      isPrediction: isPrediction || false,
      predictionConfidence: predictionConfidence || null
    });

    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error adding parking availability:', error);
    res.status(500).json({ error: 'Failed to add parking availability' });
  }
});

// ========================================
// Parking Prediction Endpoints
// ========================================

// Get prediction for a specific facility
app.get('/api/parking/predict/:facilityId', (req, res) => {
  try {
    const facilityId = req.params.facilityId;
    const targetTime = req.query.time ? new Date(req.query.time) : new Date();

    const prediction = parkingPredictor.predictAvailability(facilityId, targetTime);

    if (!prediction.success) {
      return res.status(404).json({ error: prediction.error });
    }

    res.json({ success: true, ...prediction });
  } catch (error) {
    console.error('Error generating prediction:', error);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

// Get predictions for all facilities
app.get('/api/parking/predict-all', (req, res) => {
  try {
    const targetTime = req.query.time ? new Date(req.query.time) : new Date();
    const predictions = parkingPredictor.predictAllFacilities(targetTime);
    res.json({ success: true, predictions, count: predictions.length });
  } catch (error) {
    console.error('Error generating predictions:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// Find available parking nearby
app.get('/api/parking/nearby', (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const radius = parseFloat(req.query.radius) || 50;
    const minAvailable = parseInt(req.query.minAvailable) || 1;

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'lat and lon query parameters are required' });
    }

    const nearby = parkingPredictor.findAvailableNearby(lat, lon, radius, minAvailable);
    res.json({ success: true, facilities: nearby, count: nearby.length });
  } catch (error) {
    console.error('Error finding nearby parking:', error);
    res.status(500).json({ error: 'Failed to find nearby parking' });
  }
});

// Analyze utilization patterns for a facility
app.get('/api/parking/analyze/:facilityId', (req, res) => {
  try {
    const facilityId = req.params.facilityId;
    const days = parseInt(req.query.days) || 7;

    const analysis = parkingPredictor.analyzeUtilizationPattern(facilityId, days);

    if (analysis.error) {
      return res.status(404).json({ error: analysis.error });
    }

    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Error analyzing utilization:', error);
    res.status(500).json({ error: 'Failed to analyze utilization' });
  }
});

// Admin: Generate and store predictions for all facilities
app.post('/api/admin/parking/generate-predictions', requireAdmin, (req, res) => {
  try {
    const result = parkingPredictor.generateAndStorePredictions();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error generating predictions:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// ========================================
// Historical Pattern-Based Predictions
// ========================================

// Get prediction for a specific facility using historical patterns
app.get('/api/parking/historical/predict/:facilityId', (req, res) => {
  try {
    const facilityId = req.params.facilityId;
    const targetTime = req.query.time ? new Date(req.query.time) : new Date();

    const result = truckParkingService.predictAvailability(facilityId, targetTime);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error generating historical prediction:', error);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

// Facility metadata with friendly names and camera feeds
const FACILITY_METADATA = {
  'tpims-historical-ia00080is0030000wra300w00': {
    name: 'I-80 EB MM 300 (Davenport)',
    cameras: {
      center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-CENTER.jpg',
      entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-ENTRY.jpg',
      exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-EXIT.jpg'
    }
  },
  'tpims-historical-ia00080is0018000era180e00': {
    name: 'I-80 EB MM 180 (Grinnell)',
    cameras: {
      center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-CENTER.jpg',
      entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-ENTRY.jpg',
      exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-EXIT.jpg'
    }
  },
  'tpims-historical-ia00080is0014800wra148w00': {
    name: 'I-80 EB MM 148 (Mitchellville)',
    cameras: {
      center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-CENTER.jpg',
      entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-ENTRY.jpg',
      exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-EXIT.jpg'
    }
  },
  'tpims-historical-ia00080is0026800wra268w00': {
    name: 'I-80 WB MM 268 (Wilton)',
    cameras: {
      center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-CENTER.jpg',
      entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-ENTRY.jpg',
      exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-EXIT.jpg'
    }
  },
  'tpims-historical-ia00080is0018000wra180w00': {
    name: 'I-80 WB MM 180 (Grinnell)',
    cameras: {
      center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-CENTER.jpg',
      entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-ENTRY.jpg',
      exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-EXIT.jpg'
    }
  },
  'tpims-historical-ia00080is0001900wra19w000': {
    name: 'I-80 WB MM 19 (Underwood)',
    cameras: {
      center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-CENTER.jpg',
      entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-ENTRY.jpg',
      exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-EXIT.jpg'
    }
  },
  'tpims-historical-ia00035is0012000nra120n00': {
    name: 'I-35 NB MM 120 (Story City)',
    cameras: {
      truckParking1: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-TruckParking1.jpg',
      truckParking2: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-TruckParking2.jpg',
      entrance: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-Entrance.jpg',
      exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-01-EXIT.jpg'
    }
  },
  'tpims-historical-ia00035is0012000sra120s00': {
    name: 'I-35 SB MM 119 (Story City)',
    cameras: {
      truckParking1: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-TruckParking1.jpg',
      truckParking2: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-TruckParking2.jpg',
      entrance: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-Entrance.jpg',
      exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-01-EXIT.jpg'
    }
  }
};

// Get predictions for all facilities using historical patterns
app.get('/api/parking/historical/predict-all', (req, res) => {
  try {
    const targetTime = req.query.time ? new Date(req.query.time) : new Date();
    const result = truckParkingService.predictAll(targetTime);

    if (!result.success) {
      return res.status(503).json({ error: result.error });
    }

    // Enhance predictions with metadata (friendly names and camera feeds)
    const enhancedPredictions = result.predictions.map(pred => {
      const metadata = FACILITY_METADATA[pred.facilityId];
      return {
        ...pred,
        friendlyName: metadata?.name || null,
        cameras: metadata?.cameras || null
      };
    });

    res.json({
      ...result,
      predictions: enhancedPredictions
    });
  } catch (error) {
    console.error('Error generating historical predictions:', error);
    res.status(500).json({ error: 'Failed to generate predictions' });
  }
});

// Get facilities by state with predictions
app.get('/api/parking/historical/state/:stateCode', (req, res) => {
  try {
    const stateCode = req.params.stateCode.toUpperCase();
    const result = truckParkingService.getFacilitiesByState(stateCode);

    if (!result.success) {
      return res.status(503).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching state facilities:', error);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

// Get summary statistics
app.get('/api/parking/historical/summary', (req, res) => {
  try {
    const result = truckParkingService.getSummary();

    if (!result.success) {
      return res.status(503).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Reload parking patterns from database
app.post('/api/parking/historical/reload', async (req, res) => {
  try {
    console.log('🔄 Manually reloading truck parking patterns from database...');
    const loaded = await truckParkingService.loadPatterns();

    if (loaded) {
      const summary = truckParkingService.getSummary();
      console.log('✅ Parking patterns reloaded successfully from database');
      res.json({
        success: true,
        message: 'Parking patterns reloaded successfully from database',
        summary: summary.success ? summary : null
      });
    } else {
      console.log('⚠️  Failed to reload parking patterns');
      res.status(500).json({
        success: false,
        error: 'Failed to reload patterns from database'
      });
    }
  } catch (error) {
    console.error('Error reloading patterns:', error);
    res.status(500).json({ error: 'Failed to reload patterns' });
  }
});

// Ground-truthing endpoint - Get facilities with camera feeds for validation
app.get('/api/parking/ground-truth', async (req, res) => {
  try {
    // Camera-equipped facilities on Iowa I-80 and I-35
    const facilitiesWithCameras = [
      // I-80 Facilities
      {
        facilityId: 'tpims-historical-ia00080is0030000wra300w00',
        name: 'I-80 EB MM 300 (Davenport)',
        location: { lat: 41.59596, lon: -90.491053 },
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-EXIT.jpg'
        }
      },
      {
        facilityId: 'tpims-historical-ia00080is0018000era180e00',
        name: 'I-80 EB MM 180 (Grinnell)',
        location: { lat: 41.694153, lon: -92.773646 },
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-EXIT.jpg'
        }
      },
      {
        facilityId: 'tpims-historical-ia00080is0014800wra148w00',
        name: 'I-80 EB MM 148 (Mitchellville)',
        location: { lat: 41.679979, lon: -93.394699 },
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-EXIT.jpg'
        }
      },
      {
        facilityId: 'tpims-historical-ia00080is0026800wra268w00',
        name: 'I-80 WB MM 268 (Wilton)',
        location: { lat: 41.645429, lon: -91.086291 },
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-EXIT.jpg'
        }
      },
      {
        facilityId: 'tpims-historical-ia00080is0018000wra180w00',
        name: 'I-80 WB MM 180 (Grinnell)',
        location: { lat: 41.696185, lon: -92.772749 },
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-EXIT.jpg'
        }
      },
      {
        facilityId: 'tpims-historical-ia00080is0001900wra19w000',
        name: 'I-80 WB MM 19 (Underwood)',
        location: { lat: 41.403845, lon: -95.658712 },
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-EXIT.jpg'
        }
      },
      // I-35 Facilities (Story City) - With dedicated truck parking cameras
      {
        facilityId: 'tpims-historical-ia00035is0012000nra120n00',
        name: 'I-35 NB MM 120 (Story City)',
        location: { lat: 42.128125, lon: -93.553536 },
        cameras: {
          truckParking1: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-TruckParking1.jpg',
          truckParking2: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-TruckParking2.jpg',
          entrance: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-Entrance.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-01-EXIT.jpg'
        }
      },
      {
        facilityId: 'tpims-historical-ia00035is0012000sra120s00',
        name: 'I-35 SB MM 119 (Story City)',
        location: { lat: 42.110185, lon: -93.556607 },
        cameras: {
          truckParking1: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-TruckParking1.jpg',
          truckParking2: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-TruckParking2.jpg',
          entrance: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-Entrance.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-01-EXIT.jpg'
        }
      }
    ];

    // Get current predictions for each facility
    const targetTime = req.query.time ? new Date(req.query.time) : new Date();

    const facilitiesWithPredictions = facilitiesWithCameras.map(facility => {
      // Get prediction from truck parking service
      const prediction = truckParkingService.predictAvailability(
        facility.facilityId,
        targetTime
      );

      return {
        ...facility,
        prediction: prediction.success ? {
          available: prediction.prediction.predictedAvailable,
          occupied: prediction.prediction.predictedOccupied,
          capacity: prediction.prediction.capacity,
          occupancyRate: prediction.prediction.occupancyRate,
          confidence: prediction.prediction.confidence,
          predictedFor: prediction.prediction.predictedFor
        } : {},
        timestamp: new Date().toISOString()
      };
    });

    res.json({
      success: true,
      facilities: facilitiesWithPredictions,
      count: facilitiesWithPredictions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching ground-truth data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ground-truth data'
    });
  }
});

// Save ground-truth observation from user
app.post('/api/parking/ground-truth/observations', async (req, res) => {
  try {
    const {
      facilityId,
      cameraView,
      observedCount,
      observedTotalCapacity = null,
      predictedCount = null,
      predictedOccupancyRate = null,
      observerNotes = null
    } = req.body;

    // Validate required fields
    if (!facilityId || !cameraView || observedCount === undefined || observedCount === null) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: facilityId, cameraView, observedCount'
      });
    }

    // Validate observedCount is a non-negative integer
    if (!Number.isInteger(observedCount) || observedCount < 0) {
      return res.status(400).json({
        success: false,
        error: 'observedCount must be a non-negative integer'
      });
    }

    // Validate observedTotalCapacity if provided
    if (observedTotalCapacity !== null && (!Number.isInteger(observedTotalCapacity) || observedTotalCapacity < 0)) {
      return res.status(400).json({
        success: false,
        error: 'observedTotalCapacity must be a non-negative integer'
      });
    }

    // Save to database
    const query = `INSERT INTO parking_ground_truth_observations
       (facility_id, camera_view, observed_count, observed_total_capacity, predicted_count, predicted_occupancy_rate, observer_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`;

    const stmt = db.db.prepare(query);
    const result = stmt.run(
      facilityId,
      cameraView,
      observedCount,
      observedTotalCapacity,
      predictedCount,
      predictedOccupancyRate,
      observerNotes
    );

    const logMsg = observedTotalCapacity !== null
      ? `📝 Ground-truth observation saved: ${facilityId} - ${observedCount}/${observedTotalCapacity} occupied in ${cameraView}`
      : `📝 Ground-truth observation saved: ${facilityId} - ${observedCount} trucks in ${cameraView}`;
    console.log(logMsg);

    res.json({
      success: true,
      observationId: result.lastID,
      timestamp: new Date().toISOString(),
      message: 'Observation saved successfully'
    });
  } catch (error) {
    console.error('Error saving ground-truth observation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save observation'
    });
  }
});

// AI-powered truck counting using OpenAI Vision API
app.post('/api/parking/ground-truth/ai-count', async (req, res) => {
  try {
    const { facilityId, cameraView } = req.body;

    // Validate required fields
    if (!facilityId || !cameraView) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: facilityId, cameraView'
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    // Get the camera URL for this facility and view
    // Match the facilities from the ground-truth endpoint
    const cameraFacilities = {
      'tpims-historical-ia00080is0030000wra300w00': {
        name: 'I-80 EB MM 300 (Davenport)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0018000era180e00': {
        name: 'I-80 EB MM 180 (Grinnell)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0014800wra148w00': {
        name: 'I-80 EB MM 148 (Mitchellville)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0026800wra268w00': {
        name: 'I-80 WB MM 268 (Wilton)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0018000wra180w00': {
        name: 'I-80 WB MM 180 (Grinnell)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0001900wra19w000': {
        name: 'I-80 WB MM 19 (Underwood)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00035is0012000nra120n00': {
        name: 'I-35 NB MM 120 (Story City)',
        cameras: {
          truckParking1: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-TruckParking1.jpg',
          truckParking2: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-TruckParking2.jpg',
          entrance: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-Entrance.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00035is0012000sra120s00': {
        name: 'I-35 SB MM 119 (Story City)',
        cameras: {
          truckParking1: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-TruckParking1.jpg',
          truckParking2: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-TruckParking2.jpg',
          entrance: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-Entrance.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-01-EXIT.jpg'
        }
      }
    };

    const facility = cameraFacilities[facilityId];
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: `Facility not found: ${facilityId}`
      });
    }

    const cameraUrl = facility.cameras[cameraView];
    if (!cameraUrl) {
      return res.status(404).json({
        success: false,
        error: `Camera view not found: ${cameraView}. Available views: ${Object.keys(facility.cameras).join(', ')}`
      });
    }

    console.log(`🤖 AI counting trucks at ${facility.name} - ${cameraView}`);

    // Use OpenAI Vision API to count trucks
    // Using empty space counting method for better accuracy
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are analyzing a truck parking lot image. Your task is to count parking spaces and their occupancy.

Instructions:
1. Identify all truck parking spaces in the visible area (look for parking lines, marked stalls, or organized parking rows)
2. Count the TOTAL number of truck parking spaces visible (both empty and occupied)
3. Count how many spaces are OCCUPIED (have a semi-truck, tractor-trailer, or large commercial vehicle)
4. Count how many spaces are EMPTY (vacant, no truck present - you can clearly see the pavement/ground)

Focus on:
- Large commercial vehicles (semi-trucks with trailers, tractor-trailers, big rigs)
- Clearly marked or lined parking spaces designed for trucks
- If you see parking lot markings/lines, use those to count spaces
- Empty spaces are often easier to identify (clear pavement visible)
- Ensure: occupied + empty = total

Return your answer as a JSON object with this exact format:
{"occupied": <number>, "total": <number>}

For example: {"occupied": 15, "total": 25}

If image quality is too poor or no parking lot is visible, return {"occupied": 0, "total": 0}`
            },
            {
              type: 'image_url',
              image_url: {
                url: cameraUrl
              }
            }
          ]
        }
      ],
      max_tokens: 100
    });

    const aiResponse = response.choices[0].message.content.trim();

    // Parse JSON response (extract JSON from response)
    let parsedResponse;
    try {
      const cleanedResponse = extractJSON(aiResponse);
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('AI returned non-JSON response:', aiResponse);
      return res.status(500).json({
        success: false,
        error: 'AI returned invalid JSON response',
        aiResponse
      });
    }

    const occupiedCount = parseInt(parsedResponse.occupied);
    const totalCapacity = parseInt(parsedResponse.total);

    if (isNaN(occupiedCount) || isNaN(totalCapacity)) {
      console.error('AI returned invalid numbers:', parsedResponse);
      return res.status(500).json({
        success: false,
        error: 'AI returned invalid numbers',
        aiResponse: parsedResponse
      });
    }

    const availableCount = totalCapacity - occupiedCount;

    console.log(`✅ AI counted ${occupiedCount} occupied trucks out of ${totalCapacity} total spaces (${availableCount} available)`);

    res.json({
      success: true,
      count: occupiedCount,
      occupied: occupiedCount,
      totalCapacity: totalCapacity,
      available: availableCount,
      facilityId,
      cameraView,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting AI truck count:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI count'
    });
  }
});

// Helper function to extract JSON from AI responses
function extractJSON(text) {
  // Try to find JSON within the text
  // Handle cases like: "Here is the JSON: {...}" or "```json {...} ```"

  // First, try to extract from code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find JSON object by looking for balanced braces
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  // If no JSON found, return original text trimmed
  return text.trim();
}

// Multi-camera consensus AI counting with overlap detection
app.post('/api/parking/ground-truth/ai-count-consensus', async (req, res) => {
  try {
    const { facilityId } = req.body;

    // Validate required fields
    if (!facilityId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: facilityId'
      });
    }

    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI API key not configured'
      });
    }

    // Get the camera URLs for this facility
    const cameraFacilities = {
      'tpims-historical-ia00080is0030000wra300w00': {
        name: 'I-80 EB MM 300 (Davenport)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB300-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0018000era180e00': {
        name: 'I-80 EB MM 180 (Grinnell)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB180-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0014800wra148w00': {
        name: 'I-80 EB MM 148 (Mitchellville)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80EB148-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0026800wra268w00': {
        name: 'I-80 WB MM 268 (Wilton)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB268-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0018000wra180w00': {
        name: 'I-80 WB MM 180 (Grinnell)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB180-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00080is0001900wra19w000': {
        name: 'I-80 WB MM 19 (Underwood)',
        cameras: {
          center: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-CENTER.jpg',
          entry: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-ENTRY.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA80WB19-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00035is0012000nra120n00': {
        name: 'I-35 NB MM 120 (Story City)',
        cameras: {
          truckParking1: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-TruckParking1.jpg',
          truckParking2: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-TruckParking2.jpg',
          entrance: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-Entrance.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35NB120-01-EXIT.jpg'
        }
      },
      'tpims-historical-ia00035is0012000sra120s00': {
        name: 'I-35 SB MM 119 (Story City)',
        cameras: {
          truckParking1: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-TruckParking1.jpg',
          truckParking2: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-TruckParking2.jpg',
          entrance: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-Entrance.jpg',
          exit: 'https://atmsqf.iowadot.gov/snapshots/Public/RestAreas/RA35SB119-01-EXIT.jpg'
        }
      }
    };

    const facility = cameraFacilities[facilityId];
    if (!facility) {
      return res.status(404).json({
        success: false,
        error: `Facility not found: ${facilityId}`
      });
    }

    console.log(`🎯 Multi-camera consensus counting at ${facility.name}`);
    console.log(`📹 Analyzing ${Object.keys(facility.cameras).length} camera views...`);

    // Step 1: Analyze each camera view individually
    const cameraAnalyses = [];

    for (const [viewName, cameraUrl] of Object.entries(facility.cameras)) {
      console.log(`  📸 Analyzing ${viewName} camera...`);

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `You are analyzing one camera view of a truck parking lot. Your task is to count trucks and identify visible parking areas.

Instructions:
1. Count the TOTAL number of truck parking spaces visible in THIS camera view
2. Count how many spaces are OCCUPIED (have a semi-truck, tractor-trailer, or large commercial vehicle)
3. Describe what PART of the parking lot this camera shows (e.g., "main parking area", "entrance", "exit area", "left section", "right section")
4. Note if you can see any trucks that might be PARTIALLY visible (could be seen from another angle too)

Camera view name: ${viewName}

Return your answer as a JSON object with this exact format:
{
  "occupied": <number>,
  "total": <number>,
  "viewDescription": "<brief description>",
  "partialTrucksVisible": <number of trucks that might be visible from other cameras>,
  "confidence": "<high|medium|low>"
}

For example: {"occupied": 8, "total": 12, "viewDescription": "main central parking area", "partialTrucksVisible": 2, "confidence": "high"}

If image quality is too poor or no parking lot is visible, return {"occupied": 0, "total": 0, "viewDescription": "unclear", "partialTrucksVisible": 0, "confidence": "low"}`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: cameraUrl
                  }
                }
              ]
            }
          ],
          max_tokens: 200
        });

        const aiResponse = response.choices[0].message.content.trim();
        const cleanedResponse = extractJSON(aiResponse);
        const parsedResponse = JSON.parse(cleanedResponse);

        cameraAnalyses.push({
          viewName,
          url: cameraUrl,
          occupied: parseInt(parsedResponse.occupied),
          total: parseInt(parsedResponse.total),
          viewDescription: parsedResponse.viewDescription,
          partialTrucksVisible: parseInt(parsedResponse.partialTrucksVisible) || 0,
          confidence: parsedResponse.confidence
        });

        console.log(`    ✅ ${viewName}: ${parsedResponse.occupied}/${parsedResponse.total} occupied (${parsedResponse.confidence} confidence)`);
      } catch (error) {
        console.error(`    ❌ Error analyzing ${viewName}:`, error.message);
        cameraAnalyses.push({
          viewName,
          url: cameraUrl,
          occupied: 0,
          total: 0,
          viewDescription: 'error',
          partialTrucksVisible: 0,
          confidence: 'low',
          error: error.message
        });
      }
    }

    // Step 2: Use AI to synthesize the multi-camera analysis into a consensus estimate
    console.log(`  🧠 Generating consensus estimate from ${cameraAnalyses.length} camera views...`);

    const consensusResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `You are an expert at analyzing multiple camera views of the same truck parking lot to create an accurate count.

I have ${cameraAnalyses.length} different camera views of the same parking facility, each with their own truck counts. Your job is to create a CONSENSUS estimate that:
1. Avoids double-counting trucks that appear in multiple views
2. Identifies overlapping coverage areas
3. Provides the most accurate total count
4. Estimates the actual total parking capacity of the facility

Camera Analysis Data:
${JSON.stringify(cameraAnalyses, null, 2)}

Analysis Instructions:
1. Look for overlaps - cameras may show the same trucks from different angles
2. Consider the viewDescription to understand what each camera covers
3. Use partialTrucksVisible counts to estimate overlap
4. High confidence views should be weighted more heavily
5. The CENTER/main view typically has the most complete coverage
6. ENTRY and EXIT views often overlap with CENTER
7. For I-35 facilities: truckParking1 and truckParking2 usually show DIFFERENT sections

Return your consensus estimate as a JSON object:
{
  "consensusOccupied": <best estimate of actual occupied trucks>,
  "consensusTotalCapacity": <best estimate of total parking spaces>,
  "confidence": "<high|medium|low>",
  "reasoning": "<brief explanation of how you reconciled the counts>",
  "estimatedOverlapPercentage": <percentage of double-counting detected, 0-100>
}

Example: {"consensusOccupied": 25, "consensusTotalCapacity": 40, "confidence": "high", "reasoning": "Center camera shows 20 trucks, entry shows 8 with 3 overlapping with center, exit shows 5 with 2 overlapping. Total unique trucks: 25.", "estimatedOverlapPercentage": 20}`
        }
      ],
      max_tokens: 400
    });

    const consensusAI = consensusResponse.choices[0].message.content.trim();
    const cleanedConsensus = extractJSON(consensusAI);
    const consensus = JSON.parse(cleanedConsensus);

    const consensusOccupied = parseInt(consensus.consensusOccupied);
    const consensusTotal = parseInt(consensus.consensusTotalCapacity);
    const consensusAvailable = consensusTotal - consensusOccupied;

    console.log(`  ✅ Consensus: ${consensusOccupied}/${consensusTotal} occupied (${consensus.confidence} confidence)`);
    console.log(`     ${consensus.reasoning}`);
    console.log(`     Estimated overlap: ${consensus.estimatedOverlapPercentage}%`);

    res.json({
      success: true,
      facilityId,
      facilityName: facility.name,
      consensus: {
        occupied: consensusOccupied,
        totalCapacity: consensusTotal,
        available: consensusAvailable,
        occupancyRate: consensusTotal > 0 ? consensusOccupied / consensusTotal : 0,
        confidence: consensus.confidence,
        reasoning: consensus.reasoning,
        estimatedOverlapPercentage: consensus.estimatedOverlapPercentage
      },
      individualCameras: cameraAnalyses,
      cameraCount: cameraAnalyses.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in multi-camera consensus counting:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate consensus count'
    });
  }
});

// Get accuracy metrics from ground truth observations
app.get('/api/parking/ground-truth/accuracy', async (req, res) => {
  try {
    // Get all ground truth observations with predictions
    const observations = await db.db.prepare(`
      SELECT
        id,
        facility_id,
        camera_view,
        observed_count,
        predicted_count,
        predicted_occupancy_rate,
        timestamp as created_at,
        observer_notes
      FROM parking_ground_truth_observations
      WHERE predicted_count IS NOT NULL
      ORDER BY timestamp DESC
    `).all();

    if (!Array.isArray(observations) || observations.length === 0) {
      return res.json({
        success: true,
        message: 'No ground truth observations with predictions yet',
        totalObservations: 0,
        metrics: null
      });
    }

    // Calculate accuracy metrics
    let sumAbsoluteError = 0;
    let sumSquaredError = 0;
    let sumPercentError = 0;
    let validObservations = 0;

    const facilityMetrics = {};
    const recentObservations = observations.slice(0, 20);

    observations.forEach(obs => {
      const error = Math.abs(obs.predicted_count - obs.observed_count);
      const squaredError = Math.pow(obs.predicted_count - obs.observed_count, 2);

      // Calculate percent error (avoid divide by zero)
      const percentError = obs.observed_count > 0
        ? (error / obs.observed_count) * 100
        : (obs.predicted_count > 0 ? 100 : 0);

      sumAbsoluteError += error;
      sumSquaredError += squaredError;
      sumPercentError += percentError;
      validObservations++;

      // Track per-facility metrics
      if (!facilityMetrics[obs.facility_id]) {
        facilityMetrics[obs.facility_id] = {
          facilityId: obs.facility_id,
          count: 0,
          sumError: 0,
          sumSquaredError: 0,
          sumPercentError: 0
        };
      }

      facilityMetrics[obs.facility_id].count++;
      facilityMetrics[obs.facility_id].sumError += error;
      facilityMetrics[obs.facility_id].sumSquaredError += squaredError;
      facilityMetrics[obs.facility_id].sumPercentError += percentError;
    });

    // Calculate overall metrics
    const mae = sumAbsoluteError / validObservations; // Mean Absolute Error
    const rmse = Math.sqrt(sumSquaredError / validObservations); // Root Mean Squared Error
    const mape = sumPercentError / validObservations; // Mean Absolute Percentage Error

    // Calculate per-facility metrics
    const facilityStats = Object.values(facilityMetrics).map(fm => ({
      facilityId: fm.facilityId,
      observations: fm.count,
      mae: fm.sumError / fm.count,
      rmse: Math.sqrt(fm.sumSquaredError / fm.count),
      mape: fm.sumPercentError / fm.count
    })).sort((a, b) => b.observations - a.observations);

    res.json({
      success: true,
      totalObservations: observations.length,
      validPredictions: validObservations,
      metrics: {
        mae: parseFloat(mae.toFixed(2)),
        rmse: parseFloat(rmse.toFixed(2)),
        mape: parseFloat(mape.toFixed(2))
      },
      facilityStats: facilityStats.slice(0, 10), // Top 10 facilities
      recentObservations: recentObservations.map(obs => ({
        id: obs.id,
        facilityId: obs.facility_id,
        cameraView: obs.camera_view,
        observed: obs.observed_count,
        predicted: obs.predicted_count,
        error: Math.abs(obs.predicted_count - obs.observed_count),
        timestamp: obs.created_at
      })),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error calculating accuracy metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate accuracy metrics'
    });
  }
});

// Retrain model using ground truth observations
app.post('/api/parking/ground-truth/retrain', async (req, res) => {
  try {
    // Check authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    // Check if user is admin
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }

    const { minObservations = 3 } = req.body;

    console.log('🔄 Starting model retraining with ground truth data...');

    // Get all ground truth observations
    const query = db.isPostgres
      ? `SELECT
          facility_id,
          camera_view,
          observed_count,
          predicted_count,
          predicted_occupancy_rate,
          EXTRACT(HOUR FROM timestamp) as hour,
          EXTRACT(DOW FROM timestamp) as day_of_week,
          timestamp as created_at
        FROM parking_ground_truth_observations
        ORDER BY timestamp DESC`
      : `SELECT
          facility_id,
          camera_view,
          observed_count,
          predicted_count,
          predicted_occupancy_rate,
          strftime('%H', timestamp) as hour,
          strftime('%w', timestamp) as day_of_week,
          timestamp as created_at
        FROM parking_ground_truth_observations
        ORDER BY timestamp DESC`;

    const observations = await db.db.prepare(query).all();

    if (!Array.isArray(observations) || observations.length < minObservations) {
      return res.json({
        success: false,
        message: `Not enough observations yet. Need at least ${minObservations}, have ${observations.length}`,
        observationsNeeded: minObservations - observations.length
      });
    }

    // Group observations by facility and hour
    const facilityHourStats = {};

    observations.forEach(obs => {
      const key = `${obs.facility_id}|${obs.hour}`;

      if (!facilityHourStats[key]) {
        facilityHourStats[key] = {
          facilityId: obs.facility_id,
          hour: parseInt(obs.hour),
          observations: [],
          count: 0
        };
      }

      facilityHourStats[key].observations.push({
        observed: obs.observed_count,
        timestamp: obs.created_at
      });
      facilityHourStats[key].count++;
    });

    // Update patterns in database with weighted averages
    let updatedPatterns = 0;
    let newPatterns = 0;

    for (const [key, stats] of Object.entries(facilityHourStats)) {
      if (stats.count < 2) continue; // Need at least 2 observations to update

      // Calculate average observed occupancy for this hour
      const avgObserved = stats.observations.reduce((sum, o) => sum + o.observed, 0) / stats.count;

      // Get facility capacity to calculate occupancy rate
      const facility = await db.db.prepare(`
        SELECT capacity FROM parking_facilities WHERE facility_id = ?
      `).get(stats.facilityId);

      if (!facility || !facility.capacity) continue;

      const newOccupancyRate = Math.min(avgObserved / facility.capacity, 1.0);

      // Check if pattern exists
      const existingPattern = await db.db.prepare(`
        SELECT id, occupancy_rate FROM parking_patterns
        WHERE facility_id = ? AND hour = ?
      `).get(stats.facilityId, stats.hour);

      if (existingPattern) {
        // Update existing pattern with weighted average (70% old, 30% new observations)
        const updatedRate = (existingPattern.occupancy_rate * 0.7) + (newOccupancyRate * 0.3);

        await db.db.prepare(`
          UPDATE parking_patterns
          SET occupancy_rate = ?,
              sample_count = sample_count + ?,
              last_updated = CURRENT_TIMESTAMP
          WHERE facility_id = ? AND hour = ?
        `).run(updatedRate, stats.count, stats.facilityId, stats.hour);

        updatedPatterns++;
      } else {
        // Create new pattern
        await db.db.prepare(`
          INSERT INTO parking_patterns (facility_id, hour, occupancy_rate, sample_count, last_updated)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(stats.facilityId, stats.hour, newOccupancyRate, stats.count);

        newPatterns++;
      }
    }

    // Reload patterns into memory
    await loadParkingPatternsFromDatabase();

    console.log(`✅ Model retrained: ${updatedPatterns} patterns updated, ${newPatterns} new patterns created`);

    res.json({
      success: true,
      message: 'Model retrained successfully',
      stats: {
        totalObservations: observations.length,
        patternsUpdated: updatedPatterns,
        patternsCreated: newPatterns,
        facilitiesAffected: new Set(observations.map(o => o.facility_id)).size
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error retraining model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrain model'
    });
  }
});

// Diagnostic endpoint to check JSON file status
app.get('/api/parking/historical/diagnose', async (req, res) => {
  try {
    const jsonPath = path.join(__dirname, 'data/truck_parking_patterns.json');
    const diagnostic = {
      path: jsonPath,
      exists: fs.existsSync(jsonPath),
      cwd: process.cwd(),
      dirname: __dirname
    };

    if (diagnostic.exists) {
      const stats = fs.statSync(jsonPath);
      const rawData = fs.readFileSync(jsonPath, 'utf8');
      diagnostic.fileSize = stats.size;
      diagnostic.fileSizeKB = (stats.size / 1024).toFixed(2);
      diagnostic.first200Chars = rawData.substring(0, 200);

      try {
        const data = JSON.parse(rawData);
        diagnostic.parsedKeys = Object.keys(data);
        diagnostic.facilitiesCount = data.facilities?.length || 0;
        diagnostic.patternsCount = data.patterns?.length || 0;
        if (data.facilities && data.facilities.length > 0) {
          diagnostic.sampleFacility = data.facilities[0];
        }
      } catch (parseErr) {
        diagnostic.parseError = parseErr.message;
      }
    }

    res.json({ success: true, diagnostic });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fix stale parking data on Railway persistent volume
app.post('/api/parking/historical/fix-volume', async (req, res) => {
  try {
    const jsonPath = path.join(__dirname, 'data/truck_parking_patterns.json');

    if (!fs.existsSync(jsonPath)) {
      return res.json({
        success: false,
        message: 'File does not exist'
      });
    }

    // Read existing file
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const data = JSON.parse(rawData);

    const result = {
      path: jsonPath,
      originalSize: rawData.length,
      originalFacilities: data.facilities?.length || 0,
      originalPatterns: data.patterns?.length || 0
    };

    // Check if this is the fallback-empty file
    if (data.source === 'fallback-empty' || (data.facilities?.length === 0 && rawData.length < 1000)) {
      result.action = 'deleted_stale_file';
      result.message = 'Detected and deleted stale "fallback-empty" file';

      // Delete the stale file
      fs.unlinkSync(jsonPath);

      result.deleted = true;
      result.nextSteps = 'Restart the server to use the real bundled file from git';
    } else {
      result.action = 'no_action_needed';
      result.message = 'File looks good - contains real data';
      result.deleted = false;
    }

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Migrate parking patterns from JSON to database (one-time setup)
app.post('/api/parking/historical/migrate', async (req, res) => {
  try {
    console.log('🚛 Running parking patterns migration to database...');
    const { migrateParkingData } = require('./scripts/migrate_parking_to_db.js');

    // Run migration
    await migrateParkingData();

    // Reload patterns into memory
    await truckParkingService.loadPatterns();

    const summary = truckParkingService.getSummary();

    res.json({
      success: true,
      message: 'Migration completed successfully',
      summary
    });
  } catch (error) {
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration failed: ' + error.message
    });
  }
});

// Admin: Update parking facility coordinates
app.post('/api/parking/historical/update-coordinates', async (req, res) => {
  try {
    console.log('📍 Updating parking facility coordinates...');
    const { updateProductionCoordinates } = require('./scripts/update_production_coordinates.js');

    // Run coordinate update
    await updateProductionCoordinates();

    // Reload patterns into memory (to pick up new coordinates)
    await truckParkingService.loadPatterns();

    const summary = truckParkingService.getSummary();

    res.json({
      success: true,
      message: 'Coordinates updated successfully',
      summary
    });
  } catch (error) {
    console.error('❌ Coordinate update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Coordinate update failed: ' + error.message
    });
  }
});

// Admin: Fetch real-time TPIMS data
app.post('/api/admin/parking/fetch-tpims', requireAdmin, async (req, res) => {
  try {
    console.log('🚛 Manual TPIMS data fetch triggered by admin');

    const results = {
      imported: 0,
      updated: 0,
      failed: 0,
      feeds: []
    };

    for (const feed of TPIMS_FEEDS) {
      const feedResult = await fetchTPIMSFeed(feed);
      results.imported += feedResult.imported;
      results.updated += feedResult.updated;
      results.failed += feedResult.failed;
      results.feeds.push({
        name: feed.name,
        ...feedResult
      });
    }

    res.json({ success: true, ...results });
  } catch (error) {
    console.error('Error fetching TPIMS data:', error);
    res.status(500).json({ error: 'Failed to fetch TPIMS data' });
  }
});

// Get prediction validation results
app.get('/api/parking/validation', requireAdmin, async (req, res) => {
  try {
    const results = await validatePredictions();
    res.json({ success: true, ...results });
  } catch (error) {
    console.error('Error validating predictions:', error);
    res.status(500).json({ error: 'Failed to validate predictions' });
  }
});

// ==================== ChatGPT / External API Endpoints ====================
// These endpoints are designed for ChatGPT and other AI assistants to access
// the database with read-only permissions using API key authentication

// API Key authentication middleware for ChatGPT
const requireAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key. Include X-API-Key header.' });
  }

  // Verify API key using admin tokens table
  if (db.verifyAdminToken(apiKey)) {
    req.apiKeyAuth = true;
    return next();
  }

  return res.status(403).json({ error: 'Invalid API key' });
};

// Generate API key for ChatGPT (admin only)
app.post('/api/chatgpt/generate-key', requireAdmin, (req, res) => {
  try {
    const { description } = req.body;
    const apiKey = db.createAdminToken(description || 'ChatGPT API Access');

    res.json({
      success: true,
      apiKey,
      message: 'API key generated successfully. Store this securely - it cannot be retrieved again.',
      usage: 'Include this key in the X-API-Key header for all ChatGPT API requests'
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// Get all events (read-only for ChatGPT)
app.get('/api/chatgpt/events', requireAPIKey, async (req, res) => {
  try {
    const { state, severity, limit } = req.query;

    // Fetch all events using same logic as /api/events
    const allResults = await Promise.all(
      getAllStateKeys().map(stateKey => fetchStateData(stateKey))
    );

    const allEvents = [];
    allResults.forEach(result => {
      allEvents.push(...result.events);
    });

    // Add Ohio API events
    try {
      const ohioEvents = await fetchOhioEvents();
      if (ohioEvents && ohioEvents.length > 0) {
        allEvents.push(...ohioEvents);
      }
    } catch (error) {
      console.error('Error fetching Ohio events:', error.message);
    }

    // Add Caltrans LCS events
    try {
      const caltransEvents = await fetchCaltransLCS();
      if (caltransEvents && caltransEvents.length > 0) {
        allEvents.push(...caltransEvents);
      }
    } catch (error) {
      console.error('Error fetching Caltrans events:', error.message);
    }

    // Deduplicate
    const seenIds = new Set();
    const uniqueEvents = [];
    allEvents.forEach(event => {
      if (!seenIds.has(event.id)) {
        seenIds.add(event.id);
        uniqueEvents.push(event);
      }
    });

    let filtered = uniqueEvents;

    if (state) {
      filtered = filtered.filter(e => e.state?.toLowerCase() === state.toLowerCase());
    }

    if (severity) {
      filtered = filtered.filter(e => e.severity?.toLowerCase() === severity.toLowerCase());
    }

    if (limit) {
      filtered = filtered.slice(0, parseInt(limit));
    }

    res.json({
      success: true,
      count: filtered.length,
      events: filtered
    });
  } catch (error) {
    console.error('Error fetching events for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get events by state (read-only for ChatGPT)
app.get('/api/chatgpt/events/:state', requireAPIKey, async (req, res) => {
  try {
    const { state } = req.params;

    // Fetch all events
    const allResults = await Promise.all(
      getAllStateKeys().map(stateKey => fetchStateData(stateKey))
    );

    const allEvents = [];
    allResults.forEach(result => {
      allEvents.push(...result.events);
    });

    // Add Ohio API events
    try {
      const ohioEvents = await fetchOhioEvents();
      if (ohioEvents && ohioEvents.length > 0) {
        allEvents.push(...ohioEvents);
      }
    } catch (error) {
      // Silently skip
    }

    // Add Caltrans LCS events
    try {
      const caltransEvents = await fetchCaltransLCS();
      if (caltransEvents && caltransEvents.length > 0) {
        allEvents.push(...caltransEvents);
      }
    } catch (error) {
      // Silently skip
    }

    const filtered = allEvents.filter(e => e.state?.toLowerCase() === state.toLowerCase());

    res.json({
      success: true,
      state,
      count: filtered.length,
      events: filtered
    });
  } catch (error) {
    console.error('Error fetching state events for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch state events' });
  }
});

// Get single event by ID
app.get('/api/chatgpt/events/id/:eventId', requireAPIKey, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Fetch all events
    const allResults = await Promise.all(
      getAllStateKeys().map(stateKey => fetchStateData(stateKey))
    );

    const allEvents = [];
    allResults.forEach(result => {
      allEvents.push(...result.events);
    });

    // Add Ohio API events
    try {
      const ohioEvents = await fetchOhioEvents();
      if (ohioEvents && ohioEvents.length > 0) {
        allEvents.push(...ohioEvents);
      }
    } catch (error) {
      // Silently skip
    }

    // Add Caltrans LCS events
    try {
      const caltransEvents = await fetchCaltransLCS();
      if (caltransEvents && caltransEvents.length > 0) {
        allEvents.push(...caltransEvents);
      }
    } catch (error) {
      // Silently skip
    }

    const event = allEvents.find(e => e.id === eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get comments for this event
    const comments = await db.getEventComments(eventId);

    res.json({
      success: true,
      event,
      comments: comments || []
    });
  } catch (error) {
    console.error('Error fetching event for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Get parking facilities (read-only for ChatGPT)
app.get('/api/chatgpt/parking/facilities', requireAPIKey, (req, res) => {
  try {
    const { state } = req.query;
    const facilities = db.getParkingFacilities(state || null);

    res.json({
      success: true,
      count: facilities.length,
      facilities
    });
  } catch (error) {
    console.error('Error fetching parking facilities for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch parking facilities' });
  }
});

// Get parking availability (read-only for ChatGPT)
app.get('/api/chatgpt/parking/availability', requireAPIKey, (req, res) => {
  try {
    const { facilityId } = req.query;
    const availability = db.getLatestParkingAvailability(facilityId || null);

    res.json({
      success: true,
      availability
    });
  } catch (error) {
    console.error('Error fetching parking availability for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch parking availability' });
  }
});

// Get parking history (read-only for ChatGPT)
app.get('/api/chatgpt/parking/history/:facilityId', requireAPIKey, (req, res) => {
  try {
    const { facilityId } = req.params;
    const { hours } = req.query;
    const history = db.getParkingHistory(facilityId, parseInt(hours) || 24);

    res.json({
      success: true,
      facilityId,
      hours: parseInt(hours) || 24,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('Error fetching parking history for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch parking history' });
  }
});

// Get states list (read-only for ChatGPT)
app.get('/api/chatgpt/states', requireAPIKey, async (req, res) => {
  try {
    const states = await db.getAllStates(false); // Don't include credentials

    res.json({
      success: true,
      count: states.length,
      states
    });
  } catch (error) {
    console.error('Error fetching states for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
});

// Get messages/communications (read-only for ChatGPT)
app.get('/api/chatgpt/messages', requireAPIKey, async (req, res) => {
  try {
    const { state, limit } = req.query;

    // Get all event comments
    const comments = await db.getAllEventComments();

    let filtered = comments;

    if (state) {
      filtered = filtered.filter(c => c.state_key?.toLowerCase() === state.toLowerCase());
    }

    if (limit) {
      filtered = filtered.slice(0, parseInt(limit));
    }

    res.json({
      success: true,
      count: filtered.length,
      messages: filtered
    });
  } catch (error) {
    console.error('Error fetching messages for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get event comments for a specific event (read-only for ChatGPT)
app.get('/api/chatgpt/messages/event/:eventId', requireAPIKey, async (req, res) => {
  try {
    const { eventId } = req.params;
    const comments = await db.getEventComments(eventId);

    res.json({
      success: true,
      eventId,
      count: comments.length,
      comments
    });
  } catch (error) {
    console.error('Error fetching event comments for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch event comments' });
  }
});

// Get users list (limited info, read-only for ChatGPT)
app.get('/api/chatgpt/users', requireAPIKey, async (req, res) => {
  try {
    const users = await db.getAllUsers();

    // Strip sensitive information
    const sanitizedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      organization: u.organization,
      stateKey: u.stateKey,
      role: u.role,
      active: u.active
    }));

    res.json({
      success: true,
      count: sanitizedUsers.length,
      users: sanitizedUsers
    });
  } catch (error) {
    console.error('Error fetching users for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get interchanges (read-only for ChatGPT)
app.get('/api/chatgpt/interchanges', requireAPIKey, async (req, res) => {
  try {
    const interchanges = await db.getActiveInterchanges();

    res.json({
      success: true,
      count: interchanges.length,
      interchanges
    });
  } catch (error) {
    console.error('Error fetching interchanges for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch interchanges' });
  }
});

// Get detour alerts (read-only for ChatGPT)
app.get('/api/chatgpt/detour-alerts', requireAPIKey, async (req, res) => {
  try {
    const alerts = await db.getActiveDetourAlerts();

    res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error fetching detour alerts for ChatGPT:', error);
    res.status(500).json({ error: 'Failed to fetch detour alerts' });
  }
});

// API documentation endpoint
app.get('/api/chatgpt/docs', requireAPIKey, (req, res) => {
  res.json({
    success: true,
    documentation: {
      title: 'DOT Corridor Communicator - ChatGPT API',
      version: '1.0.0',
      authentication: 'Include X-API-Key header with your API key',
      endpoints: [
        {
          method: 'GET',
          path: '/api/chatgpt/events',
          description: 'Get all traffic events',
          queryParams: ['state', 'severity', 'limit']
        },
        {
          method: 'GET',
          path: '/api/chatgpt/events/:state',
          description: 'Get events for a specific state'
        },
        {
          method: 'GET',
          path: '/api/chatgpt/events/id/:eventId',
          description: 'Get a specific event with comments'
        },
        {
          method: 'GET',
          path: '/api/chatgpt/parking/facilities',
          description: 'Get truck parking facilities',
          queryParams: ['state']
        },
        {
          method: 'GET',
          path: '/api/chatgpt/parking/availability',
          description: 'Get current parking availability',
          queryParams: ['facilityId']
        },
        {
          method: 'GET',
          path: '/api/chatgpt/parking/history/:facilityId',
          description: 'Get parking availability history',
          queryParams: ['hours']
        },
        {
          method: 'GET',
          path: '/api/chatgpt/states',
          description: 'Get list of all states in the system'
        },
        {
          method: 'GET',
          path: '/api/chatgpt/messages',
          description: 'Get all event comments',
          queryParams: ['state', 'limit']
        },
        {
          method: 'GET',
          path: '/api/chatgpt/messages/event/:eventId',
          description: 'Get comments for a specific event'
        },
        {
          method: 'GET',
          path: '/api/chatgpt/users',
          description: 'Get list of users (limited info)'
        },
        {
          method: 'GET',
          path: '/api/chatgpt/interchanges',
          description: 'Get active interstate interchanges'
        },
        {
          method: 'GET',
          path: '/api/chatgpt/detour-alerts',
          description: 'Get active detour alerts'
        },
        {
          method: 'GET',
          path: '/api/chatgpt/docs',
          description: 'Get this API documentation'
        }
      ]
    }
  });
});

// ==================== End ChatGPT API Endpoints ====================

// ==================== GLOBAL ERROR HANDLER ====================

// Global error handler - catches any unhandled errors in async route handlers
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);
  console.error('Error stack:', err.stack);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);

  // Don't send error details to client in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack, details: err })
  });
});

// Handle 404s
app.use((req, res, next) => {
  // Skip for SPA routes (non-API)
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path
  });
});

// ==================== STATIC FILES & SPA ====================

// Serve static frontend files
app.use(express.static(FRONTEND_DIST_PATH));

// Catch-all route for SPA - serve index.html for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST_PATH, 'index.html'));
});

// Scheduled TPIMS data fetch
async function fetchTPIMSDataScheduled() {
  try {
    console.log('🕐 Scheduled TPIMS data fetch starting...');

    for (const feed of TPIMS_FEEDS) {
      await fetchTPIMSFeed(feed);
    }

    console.log('✅ Scheduled TPIMS data fetch completed');
  } catch (error) {
    console.error('❌ Error in scheduled TPIMS fetch:', error);
  }
}

// Start server function - called after database initialization
function startServer() {
  app.listen(PORT, async () => {
  console.log(`\n🚀 Traffic Dashboard Backend Server (Email Login Enabled)`);
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 API Endpoints:`);
  console.log(`   GET http://localhost:${PORT}/api/events - Get all events`);
  console.log(`   GET http://localhost:${PORT}/api/events/:state - Get events by state`);
  console.log(`   GET http://localhost:${PORT}/api/health - Health check`);
  console.log(`   GET http://localhost:${PORT}/api/analysis/normalization - Data quality report`);
  console.log(`   GET http://localhost:${PORT}/api/convert/tim - Convert to SAE J2735 TIM format`);
  console.log(`   GET http://localhost:${PORT}/api/convert/tim-cv - Convert to SAE J2540 Commercial Vehicle TIM format`);
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
  console.log(`\n👥 Admin User Management Endpoints (NEW):`);
  console.log(`   GET http://localhost:${PORT}/api/admin/users - List users`);
  console.log(`   POST http://localhost:${PORT}/api/admin/users - Create user`);
  console.log(`   PUT http://localhost:${PORT}/api/admin/users/:userId - Update user`);
  console.log(`   POST http://localhost:${PORT}/api/admin/users/:userId/reset-password - Reset user password`);
  console.log(`   DELETE http://localhost:${PORT}/api/admin/users/:userId - Delete user`);
  console.log(`\n📧 Email Notification Endpoints (NEW):`);
  console.log(`   PUT http://localhost:${PORT}/api/users/notifications - Update notification preferences`);

  const allStates = await db.getAllStates();
  console.log(`\n🌐 Connected to ${allStates.length} state DOT APIs`);

  // Run parking data migration on startup
  try {
    const { migrateParkingData } = require('./scripts/migrate_parking_to_db.js');
    await migrateParkingData();
  } catch (error) {
    console.error('⚠️  Parking migration error (continuing anyway):', error.message);
    console.error('⚠️  Stack trace:', error.stack);
    // Check if facilities were actually loaded
    try {
      const facilityCount = await db.db.prepare('SELECT COUNT(*) as count FROM parking_facilities').get();
      console.log(`📊 Parking facilities in database after migration attempt: ${facilityCount?.count || 0}`);
    } catch (countError) {
      console.error('❌ Could not check parking facility count:', countError.message);
    }
  }

  // Verify email configuration
  console.log(`\n📨 Email Notifications:`);
  const emailConfigured = await emailService.verifyEmailConfig();
  if (emailConfigured) {
    console.log(`   ✅ Email notifications enabled`);
    console.log(`   📧 Message notifications: Active`);
    console.log(`   🚨 High-severity alerts: Monitoring every 5 minutes`);

    // Start high-severity event monitoring (check every 5 minutes)
    checkHighSeverityEvents(); // Initial check
    setInterval(checkHighSeverityEvents, 5 * 60 * 1000); // Check every 5 minutes
  } else {
    console.log(`   ⚠️  Email notifications disabled (SMTP not configured)`);
    console.log(`   💡 See EMAIL_SETUP.md for configuration instructions`);
  }

  // Start TPIMS real-time data fetching
  console.log(`\n🚛 Truck Parking (TPIMS):`);
  console.log(`   📡 Real-time data feeds: ${TPIMS_FEEDS.length} sources`);
  console.log(`   🔄 Auto-refresh: Every 15 minutes`);
  console.log(`   🎯 Prediction validation: Enabled`);

  // Initial fetch
  setTimeout(() => fetchTPIMSDataScheduled(), 5000); // Wait 5 seconds after startup

  // Schedule periodic updates every 15 minutes
  setInterval(fetchTPIMSDataScheduled, 15 * 60 * 1000);

  // Diagnostic: Check truck parking JSON file
  console.log(`\n🔍 Diagnostic: Checking truck parking JSON file...`);
  const jsonPath = path.join(__dirname, 'data/truck_parking_patterns.json');
  console.log(`   Path: ${jsonPath}`);
  console.log(`   Exists: ${fs.existsSync(jsonPath)}`);
  if (fs.existsSync(jsonPath)) {
    try {
      const stats = fs.statSync(jsonPath);
      const rawData = fs.readFileSync(jsonPath, 'utf8');
      console.log(`   File size: ${stats.size} bytes (${(stats.size/1024).toFixed(2)} KB)`);
      console.log(`   First 150 chars: ${rawData.substring(0, 150)}`);
      const data = JSON.parse(rawData);
      console.log(`   Parsed keys: ${Object.keys(data).join(', ')}`);
      console.log(`   Facilities: ${data.facilities?.length || 0}`);
      console.log(`   Patterns: ${data.patterns?.length || 0}`);
      if (data.facilities && data.facilities.length > 0) {
        console.log(`   Sample facility: ${JSON.stringify(data.facilities[0])}`);
      }
    } catch (err) {
      console.log(`   ❌ Error reading file: ${err.message}`);
    }
  }

  evaluateDetourAlerts();
  setInterval(evaluateDetourAlerts, 5 * 60 * 1000);

  console.log(`\nPress Ctrl+C to stop the server\n`);
  });
}
// Force redeploy Mon Nov  3 02:54:25 PST 2025
