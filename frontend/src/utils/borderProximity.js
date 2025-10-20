// Utility to detect if events are within 30 miles of state borders
// This helps identify events that may require cross-state collaboration

// Approximate state border crossing points for major corridors (lat, lon)
const STATE_BORDERS = {
  // I-80 corridor (west to east)
  'I-80': [
    { lat: 41.001, lon: -111.047, states: ['UT', 'WY'], name: 'Utah-Wyoming border' },
    { lat: 41.000, lon: -104.053, states: ['WY', 'NE'], name: 'Wyoming-Nebraska border' },
    { lat: 41.135, lon: -95.917, states: ['NE', 'IA'], name: 'Nebraska-Iowa border' },
    { lat: 41.658, lon: -90.187, states: ['IA', 'IL'], name: 'Iowa-Illinois border' },
    { lat: 41.506, lon: -87.528, states: ['IL', 'IN'], name: 'Illinois-Indiana border' },
    { lat: 41.598, lon: -84.809, states: ['IN', 'OH'], name: 'Indiana-Ohio border' },
    { lat: 41.502, lon: -80.519, states: ['OH', 'PA'], name: 'Ohio-Pennsylvania border' },
    { lat: 40.996, lon: -75.091, states: ['PA', 'NJ'], name: 'Pennsylvania-New Jersey border' }
  ],

  // I-35 corridor (south to north)
  'I-35': [
    { lat: 36.999, lon: -97.066, states: ['OK', 'KS'], name: 'Oklahoma-Kansas border' },
    { lat: 39.999, lon: -95.064, states: ['KS', 'MO'], name: 'Kansas-Missouri border (western branch)' },
    { lat: 40.585, lon: -94.892, states: ['MO', 'IA'], name: 'Missouri-Iowa border' },
    { lat: 43.500, lon: -93.500, states: ['IA', 'MN'], name: 'Iowa-Minnesota border' }
  ],

  // I-70 corridor (west to east)
  'I-70': [
    { lat: 39.094, lon: -110.002, states: ['UT', 'CO'], name: 'Utah-Colorado border' },
    { lat: 39.054, lon: -102.052, states: ['CO', 'KS'], name: 'Colorado-Kansas border' },
    { lat: 39.095, lon: -94.611, states: ['KS', 'MO'], name: 'Kansas-Missouri border' },
    { lat: 38.750, lon: -89.165, states: ['MO', 'IL'], name: 'Missouri-Illinois border' },
    { lat: 39.741, lon: -81.466, states: ['OH', 'WV'], name: 'Ohio-West Virginia border' },
    { lat: 39.721, lon: -79.477, states: ['WV', 'PA'], name: 'West Virginia-Pennsylvania border' },
    { lat: 39.723, lon: -77.719, states: ['PA', 'MD'], name: 'Pennsylvania-Maryland border' }
  ],

  // I-90 corridor (west to east)
  'I-90': [
    { lat: 45.684, lon: -116.998, states: ['WA', 'ID'], name: 'Washington-Idaho border' },
    { lat: 47.659, lon: -104.047, states: ['MT', 'ND'], name: 'Montana-North Dakota border' },
    { lat: 43.501, lon: -96.458, states: ['SD', 'MN'], name: 'South Dakota-Minnesota border' },
    { lat: 43.848, lon: -91.228, states: ['MN', 'WI'], name: 'Minnesota-Wisconsin border' },
    { lat: 42.494, lon: -87.820, states: ['WI', 'IL'], name: 'Wisconsin-Illinois border' },
    { lat: 41.524, lon: -84.811, states: ['IN', 'OH'], name: 'Indiana-Ohio border' },
    { lat: 41.999, lon: -80.519, states: ['OH', 'PA'], name: 'Ohio-Pennsylvania border' },
    { lat: 42.263, lon: -73.258, states: ['MA', 'NY'], name: 'Massachusetts-New York border' }
  ],

  // I-95 corridor (south to north)
  'I-95': [
    { lat: 32.049, lon: -81.033, states: ['FL', 'GA'], name: 'Florida-Georgia border' },
    { lat: 33.033, lon: -80.903, states: ['SC', 'NC'], name: 'South Carolina-North Carolina border' },
    { lat: 36.545, lon: -77.591, states: ['NC', 'VA'], name: 'North Carolina-Virginia border' },
    { lat: 38.029, lon: -77.047, states: ['VA', 'MD'], name: 'Virginia-Maryland border' },
    { lat: 39.722, lon: -75.787, states: ['MD', 'DE'], name: 'Maryland-Delaware border' },
    { lat: 39.842, lon: -75.559, states: ['DE', 'PA'], name: 'Delaware-Pennsylvania border' },
    { lat: 40.000, lon: -75.200, states: ['PA', 'NJ'], name: 'Pennsylvania-New Jersey border' },
    { lat: 40.876, lon: -73.879, states: ['NJ', 'NY'], name: 'New Jersey-New York border' },
    { lat: 41.134, lon: -73.498, states: ['NY', 'CT'], name: 'New York-Connecticut border' },
    { lat: 42.028, lon: -71.800, states: ['CT', 'MA'], name: 'Connecticut-Massachusetts border' }
  ]
};

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Check if event is within specified miles of a state border
export function isNearBorder(event, thresholdMiles = 30) {
  if (!event.latitude || !event.longitude || !event.corridor) {
    return false;
  }

  const corridor = event.corridor;
  const borders = STATE_BORDERS[corridor];

  if (!borders) {
    return false;
  }

  // Check distance to each border point for this corridor
  for (const border of borders) {
    const distance = calculateDistance(
      event.latitude,
      event.longitude,
      border.lat,
      border.lon
    );

    if (distance <= thresholdMiles) {
      return {
        nearBorder: true,
        distance: Math.round(distance),
        borderName: border.name,
        borderStates: border.states
      };
    }
  }

  return false;
}

// Get all events near borders
export function filterBorderEvents(events, thresholdMiles = 30) {
  return events.map(event => {
    const borderInfo = isNearBorder(event, thresholdMiles);
    return {
      ...event,
      ...(borderInfo ? { borderProximity: borderInfo } : {})
    };
  });
}

// Group border events by border crossing
export function groupByBorder(events) {
  const groups = {};

  events.forEach(event => {
    if (event.borderProximity) {
      const key = event.borderProximity.borderName;
      if (!groups[key]) {
        groups[key] = {
          borderName: key,
          states: event.borderProximity.borderStates,
          events: []
        };
      }
      groups[key].events.push(event);
    }
  });

  return Object.values(groups);
}
