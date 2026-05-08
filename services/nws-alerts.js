/**
 * NWS (National Weather Service) Alerts service.
 *
 * Fetches active CAP alerts from the NWS API and filters to road-impacting
 * types so the dashboard can show weather-driven hazards on the map alongside
 * DOT events. NWS doesn't require an API key — only a User-Agent header
 * identifying the consumer (their guideline, not strictly enforced).
 *
 * Coverage: every US state, DC, and territories. This is the single biggest
 * gap-filler for the ~17 states that publish no public WZDx or 511 feed —
 * NWS alerts are uniform nationwide and authoritative.
 *
 * Returns normalized records with:
 *   id            NWS alert id
 *   event         human label (e.g. "Winter Storm Warning")
 *   severity      Extreme | Severe | Moderate | Minor | Unknown
 *   urgency       Immediate | Expected | Future | Past | Unknown
 *   certainty     Observed | Likely | Possible | Unlikely | Unknown
 *   areaDesc      county/zone names (NWS-supplied free text)
 *   states        derived 2-letter state codes
 *   sent / onset / expires   ISO timestamps
 *   description / instruction
 *   geometry      GeoJSON polygon when present, else null
 *   senderName
 *   url           web link to the alert
 *
 * The endpoint that consumes this caches with a 90s TTL because NWS alerts
 * change minute-to-minute during severe events but typically stay stable
 * during quiet weather; 90s is the right balance.
 */

const axios = require('axios');

const ENDPOINT = 'https://api.weather.gov/alerts/active';

// Road-impacting alert types we surface on the map. NWS publishes ~70 event
// types; most aren't relevant to ground-transportation operators. This filter
// is conservative on purpose — it's easier to add types later than to teach
// operators to ignore noise (heat advisories, beach hazards, surf warnings).
const ROAD_IMPACTING_EVENTS = new Set([
  // Winter
  'Winter Storm Warning', 'Winter Storm Watch', 'Winter Weather Advisory',
  'Ice Storm Warning', 'Blizzard Warning', 'Snow Squall Warning',
  'Wind Chill Warning', 'Wind Chill Advisory', 'Lake Effect Snow Warning',
  'Lake Effect Snow Advisory', 'Heavy Freezing Spray Warning',
  'Freezing Rain Advisory', 'Freezing Fog Advisory',

  // Wind
  'High Wind Warning', 'High Wind Watch', 'Wind Advisory',
  'Extreme Wind Warning',

  // Flooding
  'Flash Flood Warning', 'Flash Flood Watch', 'Flood Warning', 'Flood Watch',
  'Flood Advisory', 'Coastal Flood Warning', 'Coastal Flood Watch',
  'Coastal Flood Advisory', 'Hydrologic Outlook',

  // Severe / tornado
  'Tornado Warning', 'Tornado Watch', 'Severe Thunderstorm Warning',
  'Severe Thunderstorm Watch',

  // Tropical
  'Hurricane Warning', 'Hurricane Watch', 'Tropical Storm Warning',
  'Tropical Storm Watch',

  // Visibility
  'Dense Fog Advisory', 'Dense Smoke Advisory', 'Blowing Dust Advisory',
  'Blowing Dust Warning', 'Dust Storm Warning',

  // Heat (still road-impacting via tire blowouts, asphalt softening)
  'Excessive Heat Warning', 'Excessive Heat Watch', 'Heat Advisory',

  // Generic / civil
  'Air Quality Alert', 'Avalanche Warning', 'Avalanche Watch'
]);

// US state abbreviations → 2-letter codes. NWS gives free-text area
// descriptions like "Polk County, IA; Story County, IA". We tease out
// the state codes for filtering / labeling. Best-effort only; if the
// regex misses a format we just leave states empty.
function deriveStates(areaDesc) {
  if (!areaDesc) return [];
  const matches = areaDesc.match(/\b[A-Z]{2}\b/g) || [];
  // Filter to actual US state/territory codes
  const VALID = new Set([
    'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID',
    'IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO',
    'MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
    'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
    'PR','VI','GU','AS','MP'
  ]);
  return [...new Set(matches.filter(m => VALID.has(m)))];
}

function normalize(feature) {
  const p = feature.properties || {};
  const event = p.event || 'Unknown';
  return {
    id: p.id || feature.id,
    event,
    headline: p.headline || event,
    severity: p.severity || 'Unknown',
    urgency: p.urgency || 'Unknown',
    certainty: p.certainty || 'Unknown',
    areaDesc: p.areaDesc || '',
    states: deriveStates(p.areaDesc),
    sent: p.sent || null,
    effective: p.effective || null,
    onset: p.onset || null,
    expires: p.expires || null,
    description: p.description || '',
    instruction: p.instruction || '',
    senderName: p.senderName || '',
    url: p.web || (p.id ? `https://api.weather.gov/alerts/${encodeURIComponent(p.id)}` : null),
    geometry: feature.geometry || null
  };
}

async function fetchActiveAlerts({ limit = 500 } = {}) {
  try {
    const res = await axios.get(ENDPOINT, {
      headers: {
        // NWS asks for a User-Agent identifying the consumer (their docs say
        // "your_email_or_organization"). They don't enforce it but using a
        // descriptive one is good citizenship.
        'User-Agent': 'MattsExperimentalSandbox (matt-corridor-communicator)',
        'Accept': 'application/geo+json'
      },
      timeout: 30000,
      params: { limit }
    });
    const features = Array.isArray(res.data?.features) ? res.data.features : [];
    return features
      .map(normalize)
      .filter(a => ROAD_IMPACTING_EVENTS.has(a.event));
  } catch (err) {
    console.warn('NWS alerts fetch failed:', err.message);
    return [];
  }
}

module.exports = { fetchActiveAlerts, ROAD_IMPACTING_EVENTS };
