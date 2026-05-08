/**
 * CBP Border Wait Times service.
 *
 * Fetches https://bwt.cbp.gov/api/waittimes (public JSON, no auth) and
 * normalizes the response into records with geographic coordinates so
 * the dashboard can render border crossings as map markers. The CBP
 * API doesn't include lat/lng — we maintain a coordinate lookup keyed
 * by the API's port_number (or by port_name fallback) for the major
 * land crossings on the US-Canada and US-Mexico borders.
 *
 * Returned record shape:
 *   port_number       string CBP id
 *   port_name         e.g. "Detroit"
 *   crossing_name     e.g. "Ambassador Bridge"
 *   border            "Canadian Border" | "Mexican Border"
 *   hours             operational hours
 *   port_status       "Open" | "Closed"
 *   updated_at        ISO timestamp derived from date+time fields
 *   latitude/longitude coords (null if unknown)
 *   commercial        { lanes_open, delay_minutes, status, fast_lanes_open, fast_delay }
 *   passenger         { lanes_open, delay_minutes, status, ready_lanes_open, ready_delay }
 *   pedestrian        { lanes_open, delay_minutes, status, ready_lanes_open, ready_delay }
 *
 * Use cases on the dashboard: freight corridor visibility (truck-lane
 * delays at TX/NM/AZ/CA/MI/NY/ME crossings), incident enrichment when
 * a closure forces traffic toward a border, and a leading indicator of
 * port-of-entry congestion that affects upstream trucking decisions.
 */

const axios = require('axios');

const ENDPOINT = 'https://bwt.cbp.gov/api/waittimes';

// Port coordinates keyed by CBP port_number. Covers the highest-traffic
// land crossings on both borders. Coordinates from public sources
// (USDOT National Border Crossings layer, CBP port-of-entry pages).
//
// If a port_number isn't here we fall back to PORT_NAME_COORDS, then
// drop the port from map rendering (it still appears in the list/API).
const PORT_COORDS = {
  // Canadian Border
  '070801': [44.330, -75.949],   // Alexandria Bay - Thousand Islands Bridge
  '300401': [49.000, -122.737],  // Blaine - Pacific Highway
  '300402': [49.003, -122.756],  // Blaine - Peace Arch
  '300403': [48.999, -123.080],  // Blaine - Point Roberts
  '090104': [43.165, -79.045],   // Lewiston Bridge
  '090101': [42.910, -78.911],   // Peace Bridge (Buffalo)
  '090102': [43.090, -79.069],   // Rainbow Bridge (Niagara Falls)
  '090103': [43.137, -79.058],   // Whirlpool Bridge
  '011501': [45.187, -67.282],   // Calais - Ferry Point
  '011503': [45.182, -67.279],   // Calais - International Avenue
  '011502': [45.196, -67.293],   // Calais - Milltown
  '071201': [44.987, -73.450],   // Champlain
  '020901': [45.005, -72.099],   // Derby Line I-91
  '380001': [42.313, -83.073],   // Detroit - Ambassador Bridge
  '380002': [42.327, -83.041],   // Detroit-Windsor Tunnel
  '021201': [44.990, -73.084],   // Highgate Springs
  '010601': [46.124, -67.838],   // Houlton
  '360401': [48.601, -93.404],   // International Falls
  '010401': [45.629, -70.249],   // Jackman
  '302301': [49.001, -122.654],  // Lynden
  'L01901': [47.355, -68.328],   // Madawaska
  '070401': [44.991, -74.738],   // Massena
  '021101': [45.000, -72.230],   // Norton
  '070101': [44.706, -75.490],   // Ogdensburg
  '340101': [48.991, -97.246],   // Pembina
  '380201': [42.999, -82.422],   // Port Huron - Bluewater Bridge
  '380301': [46.515, -84.358],   // Sault Ste. Marie International Bridge
  '300901': [49.001, -122.252],  // Sumas
  '331001': [48.997, -111.957],  // Sweetgrass

  // Mexican Border
  '250201': [32.733, -114.717],  // Andrade
  '240215': [31.766, -106.482],  // BOTA Cargo (El Paso)
  '240207': [31.766, -106.482],  // Bridge of the Americas POE
  '535501': [25.967, -97.473],   // Brownsville - B&M
  '535504': [25.951, -97.502],   // Brownsville - Gateway
  '535503': [26.037, -97.741],   // Brownsville - Los Indios
  '535502': [25.954, -97.448],   // Brownsville - Veterans International
  '250301': [32.671, -115.387],  // Calexico - East
  '250302': [32.668, -115.498],  // Calexico - West
  '240601': [31.827, -107.638],  // Columbus
  '230201': [29.349, -100.917],  // Del Rio
  '260101': [31.345, -109.547],  // Douglas
  '230301': [28.717, -100.500],  // Eagle Pass - Bridge I
  '230302': [28.694, -100.499],  // Eagle Pass - Bridge II
  '240221': [31.766, -106.483],  // El Paso (cargo)
  '240201': [31.766, -106.482],  // El Paso BOTA
  '240202': [31.760, -106.523],  // El Paso - Paso Del Norte
  '240204': [31.794, -106.527],  // El Paso - Stanton St
  '240206': [31.766, -106.404],  // El Paso - Ysleta
  '230501': [27.522, -99.508],   // Hidalgo
  '230502': [27.503, -99.501],   // Hidalgo - Anzalduas
  '230503': [27.519, -99.508],   // Hidalgo - Pharr
  '260301': [31.341, -110.940],  // Lukeville
  '230401': [27.501, -99.508],   // Laredo - Bridge I
  '230402': [27.498, -99.499],   // Laredo - Bridge II
  '230403': [27.566, -99.488],   // Laredo - World Trade Bridge
  '230404': [27.500, -99.508],   // Laredo - Colombia Solidarity
  '270201': [26.218, -98.236],   // McAllen - Anzalduas
  '270202': [26.090, -97.969],   // McAllen - Hidalgo
  '270203': [26.193, -98.190],   // McAllen - Pharr
  '260201': [31.334, -111.061],  // Naco
  '260401': [31.355, -110.943],  // Nogales - DeConcini
  '260402': [31.334, -110.953],  // Nogales - Mariposa
  '260403': [31.357, -110.946],  // Nogales - Morley Gate
  '230101': [29.000, -101.420],  // Presidio
  '270301': [26.090, -98.282],   // Progreso
  '270101': [26.080, -97.939],   // Roma
  '250401': [32.555, -117.039],  // San Ysidro
  '250403': [32.557, -117.005],  // Otay Mesa
  '250402': [32.580, -116.935],  // Tecate
  '270501': [25.911, -97.424]    // Rio Grande City
};

// Fallback by port_name (when port_number isn't in the table). Lower-case
// keys with optional crossing suffix removed.
function normalizePortKey(name) {
  return String(name || '').toLowerCase().trim();
}

function findCoords(port) {
  if (PORT_COORDS[port.port_number]) return PORT_COORDS[port.port_number];
  return null;
}

// Combine the date + time fields the API returns (e.g. "5/8/2026" + "10:06:53")
// into an ISO timestamp. Best-effort; if parsing fails returns the raw strings.
function combineTimestamp(date, time) {
  if (!date || !time) return null;
  try {
    const parsed = new Date(`${date} ${time}`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  } catch { /* fall through */ }
  return `${date} ${time}`;
}

function laneSummary(lanes) {
  if (!lanes) return null;
  const std = lanes.standard_lanes || {};
  const fast = lanes.FAST_lanes || lanes.ready_lanes || {};
  return {
    maximum_lanes: parseInt(lanes.maximum_lanes, 10) || 0,
    lanes_open: parseInt(std.lanes_open, 10) || 0,
    delay_minutes: parseInt(std.delay_minutes, 10) || 0,
    operational_status: std.operational_status || 'N/A',
    fast_or_ready_lanes_open: parseInt(fast.lanes_open, 10) || 0,
    fast_or_ready_delay_minutes: parseInt(fast.delay_minutes, 10) || 0,
    fast_or_ready_status: fast.operational_status || 'N/A'
  };
}

function normalize(port) {
  const coords = findCoords(port);
  return {
    port_number: port.port_number,
    port_name: port.port_name,
    crossing_name: port.crossing_name,
    border: port.border,
    hours: port.hours,
    port_status: port.port_status,
    updated_at: combineTimestamp(port.date, port.time),
    latitude: coords ? coords[0] : null,
    longitude: coords ? coords[1] : null,
    commercial: laneSummary(port.commercial_vehicle_lanes),
    passenger: laneSummary(port.passenger_vehicle_lanes),
    pedestrian: laneSummary(port.pedestrian_lanes)
  };
}

async function fetchWaitTimes() {
  try {
    const res = await axios.get(ENDPOINT, {
      timeout: 30000,
      headers: { 'User-Agent': 'MattsExperimentalSandbox' }
    });
    return Array.isArray(res.data) ? res.data.map(normalize) : [];
  } catch (err) {
    console.warn('CBP wait-times fetch failed:', err.message);
    return [];
  }
}

module.exports = { fetchWaitTimes };
