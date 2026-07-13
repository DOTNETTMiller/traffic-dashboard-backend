/**
 * MUTCD-aligned map markers.
 *
 * Maps a normalized event to one of a small set of MUTCD warning /
 * regulatory / guide signs, returns an SVG string sized 32×32 ready to drop
 * into a Leaflet divIcon. All signs use the established MUTCD palette:
 *
 *   safety orange  #FF8C2A   warning (W-series), temp guide (M-series)
 *   high-vis pink  #E63946   high-severity warning (matches florescent pink WZ)
 *   regulatory red #CC0000   regulatory (R-series)
 *   sign black     #1d1d1f   borders + symbols (matches dashboard fg)
 *   sign white     #FFFFFF   regulatory backgrounds + reverse glyphs
 *
 * Sign codes implemented (MUTCD reference in parentheses):
 *
 *   W21-1   Workers — construction / work-zone / maintenance
 *   W20-3   ROAD CLOSED AHEAD — generic full closure
 *   W20-5L  Left lane closed — merge right
 *   W20-5R  Right lane closed — merge left
 *   W20-7   Flagger — flagger ahead
 *   W23-1   Stopped traffic — congestion / queue
 *   W12-1   Low clearance — bridge / vertical restriction
 *   W8-5    Slippery — weather (snow / ice / rain)
 *   M4-9    Detour — diversion (orange rectangle, not diamond)
 *   R5-1    Do Not Enter — hard closure (regulatory red)
 *   I-1     Incident — crash / collision (high-vis red diamond)
 *   GEN     Generic — plain orange diamond (fallback)
 *
 * Classifier `signFor(event)` does a keyword match on event.eventType,
 * description, and lanesAffected — handles WZDx ("work-zone"), CIFS
 * ("Construction Work"), and free-text feeds emitting "ROAD CLOSED" /
 * "Left Shoulder Closed" / etc. all routing to the right sign.
 */

const COLORS = {
  orange: '#FF8C2A',
  orangeHi: '#E63946',   // florescent-pink stand-in for high severity
  red: '#CC0000',
  black: '#1d1d1f',
  white: '#FFFFFF'
};

/* ---------- shape helpers ---------- */

// Standard MUTCD diamond, 32×32 viewBox, point up. `fill` overrides for
// severity tint; `inner` is whatever the symbol/text payload renders inside.
function diamond(fill, inner) {
  return `
<svg width="50" height="50" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
  <polygon points="16,2 30,16 16,30 2,16" fill="${fill}" stroke="${COLORS.black}" stroke-width="0.9" stroke-linejoin="round"/>
  ${inner}
</svg>`.trim();
}

// MUTCD M-series guide rectangle (orange, landscape).
function rect(fill, inner) {
  return `
<svg width="50" height="50" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
  <rect x="2" y="6" width="28" height="20" rx="1" fill="${fill}" stroke="${COLORS.black}" stroke-width="0.9"/>
  ${inner}
</svg>`.trim();
}

// Regulatory red circle (R-series prohibitive signs like Do Not Enter).
function regCircle(inner) {
  return `
<svg width="50" height="50" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
  <circle cx="16" cy="16" r="14" fill="${COLORS.red}" stroke="${COLORS.black}" stroke-width="0.9"/>
  ${inner}
</svg>`.trim();
}

/* ---------- per-sign symbol payloads ---------- */

// W21-1 — Workers: MUTCD digging-worker silhouette (hard hat, bent torso,
// stance legs, arm on a shovel driven into a dirt mound).
const W21_1_SYMBOL = `
  <path d="M10.3 9.7 Q14 5 17.7 9.7 Z" fill="${COLORS.black}"/>
  <rect x="9.4" y="9.4" width="9.2" height="1.7" rx="0.8" fill="${COLORS.black}"/>
  <circle cx="14" cy="12" r="1.8" fill="${COLORS.black}"/>
  <path d="M11.5 13.8 Q10.7 17.2 12 20 L15.4 19.2 Q14.3 15.4 14.2 13.8 Z" fill="${COLORS.black}"/>
  <path d="M11.9 19.6 L11 25.4 L13 25.4 L13.9 20.1 Z" fill="${COLORS.black}"/>
  <path d="M14.3 19.4 L17.6 24.4 L19.3 23.4 L16.2 18.6 Z" fill="${COLORS.black}"/>
  <path d="M13 14.4 Q17 15.2 20 18.4 L18.7 19.8 Q15.8 16.9 12.3 16.4 Z" fill="${COLORS.black}"/>
  <line x1="19.8" y1="17.6" x2="23.6" y2="22.6" stroke="${COLORS.black}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M22 21.4 L25.6 22.8 L23.8 25 Z" fill="${COLORS.black}"/>
`;

// W20-3 — ROAD CLOSED AHEAD: stylized horizontal road with an X over it
const W20_3_SYMBOL = `
  <rect x="6"  y="14.5" width="20" height="3"  fill="${COLORS.black}"/>
  <line x1="9"  y1="11" x2="23" y2="22" stroke="${COLORS.black}" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="23" y1="11" x2="9"  y2="22" stroke="${COLORS.black}" stroke-width="1.6" stroke-linecap="round"/>
`;

// W20-5L — Left lane closed (merge right): plan-view road, left lane tapers
// closed, dashed centerline (MUTCD lane-ends style).
function w20_5L_SYMBOL() {
  return `
    <path d="M11 25 L21 25 L21 6.5 L17 6.5 L17 12.5 L11 18 Z" fill="${COLORS.black}"/>
    <line x1="16" y1="24" x2="16" y2="13.5" stroke="${COLORS.white}" stroke-width="1" stroke-dasharray="2 1.7" stroke-linecap="round"/>
  `;
}

// W20-5R — Right lane closed (merge left): plan-view road, right lane tapers
// closed, dashed centerline.
function w20_5R_SYMBOL() {
  return `
    <path d="M11 25 L21 25 L21 18 L15 12.5 L15 6.5 L11 6.5 Z" fill="${COLORS.black}"/>
    <line x1="16" y1="24" x2="16" y2="13.5" stroke="${COLORS.white}" stroke-width="1" stroke-dasharray="2 1.7" stroke-linecap="round"/>
  `;
}

// W20-7 — Flagger: MUTCD silhouette of a person holding a flag out to the side.
const W20_7_SYMBOL = `
  <path d="M11.4 8.9 Q13.5 5.6 15.6 8.9 Z" fill="${COLORS.black}"/>
  <rect x="10.7" y="8.6" width="5.6" height="1.2" rx="0.6" fill="${COLORS.black}"/>
  <circle cx="13.5" cy="11" r="1.5" fill="${COLORS.black}"/>
  <path d="M12 12.2 Q11.3 16 12.4 19 L15.4 18.4 Q14.6 15 14.5 12.2 Z" fill="${COLORS.black}"/>
  <path d="M12.6 18.6 L12 24.6 L13.6 24.6 L14 19 Z" fill="${COLORS.black}"/>
  <path d="M14.4 18.6 L16.4 23.8 L17.8 23.2 L15.6 18.2 Z" fill="${COLORS.black}"/>
  <path d="M14.3 12.8 L20.8 9.6 L21.4 10.9 L14.9 14.1 Z" fill="${COLORS.black}"/>
  <rect x="20" y="6.4" width="5" height="3.6" fill="${COLORS.black}"/>
`;

// W23-1 — Stopped/slow traffic: stacked vehicle outlines (queue)
const W23_1_SYMBOL = `
  <rect x="9"  y="10" width="14" height="4" rx="0.8" fill="${COLORS.black}"/>
  <rect x="9"  y="16" width="14" height="4" rx="0.8" fill="${COLORS.black}"/>
  <rect x="9"  y="22" width="14" height="4" rx="0.8" fill="${COLORS.black}"/>
`;

// W12-1 — Low clearance: bridge arch with downward arrow
const W12_1_SYMBOL = `
  <path d="M 7 21 L 7 16 Q 7 9 16 9 Q 25 9 25 16 L 25 21" fill="none" stroke="${COLORS.black}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M 16 14 L 16 22 M 13 19 L 16 22 L 19 19" fill="none" stroke="${COLORS.black}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
`;

// W8-5 — Slippery When Wet: skidding car with curved skid trail
const W8_5_SYMBOL = `
  <rect x="9" y="13" width="14" height="6" rx="1.2" fill="${COLORS.black}"/>
  <circle cx="12" cy="20" r="1.4" fill="${COLORS.black}"/>
  <circle cx="20" cy="20" r="1.4" fill="${COLORS.black}"/>
  <path d="M 6 24 Q 12 21 18 24 Q 24 27 26 24" fill="none" stroke="${COLORS.black}" stroke-width="1.2" stroke-linecap="round"/>
`;

// M4-9 — Detour: bent right arrow on orange rectangle
const M4_9_SYMBOL = `
  <text x="6" y="15" font-family="Arial Black, Arial, sans-serif" font-size="6" font-weight="900" fill="${COLORS.black}" letter-spacing="0.05em">DETOUR</text>
  <path d="M 6 22 L 20 22 L 20 18 L 26 22 L 20 26 L 20 22" fill="${COLORS.black}" stroke="${COLORS.black}" stroke-width="0.6" stroke-linejoin="round"/>
`;

// R5-1 — Do Not Enter: white horizontal bar on red circle
const R5_1_SYMBOL = `
  <rect x="6" y="14" width="20" height="4" rx="0.6" fill="${COLORS.white}"/>
`;

// Incident / crash: high-vis red diamond with collision burst
const INCIDENT_SYMBOL = `
  <circle cx="16" cy="14" r="2" fill="${COLORS.white}"/>
  <line x1="16" y1="9"  x2="16" y2="11" stroke="${COLORS.white}" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="16" y1="17" x2="16" y2="19" stroke="${COLORS.white}" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="11" y1="14" x2="13" y2="14" stroke="${COLORS.white}" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="19" y1="14" x2="21" y2="14" stroke="${COLORS.white}" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="12" y1="10" x2="13.5" y2="11.5" stroke="${COLORS.white}" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="20" y1="10" x2="18.5" y2="11.5" stroke="${COLORS.white}" stroke-width="1.4" stroke-linecap="round"/>
  <text x="16" y="27" font-family="Arial Black, Arial, sans-serif" font-size="6" font-weight="900" fill="${COLORS.white}" text-anchor="middle">CRASH</text>
`;

/* ---------- sign factories ---------- */

const SIGNS = {
  'W21-1': (sev) => diamond(sev === 'high' ? COLORS.orangeHi : COLORS.orange, W21_1_SYMBOL),
  'W20-3': (sev) => diamond(sev === 'high' ? COLORS.orangeHi : COLORS.orange, W20_3_SYMBOL),
  'W20-5L': (sev) => diamond(sev === 'high' ? COLORS.orangeHi : COLORS.orange, w20_5L_SYMBOL()),
  'W20-5R': (sev) => diamond(sev === 'high' ? COLORS.orangeHi : COLORS.orange, w20_5R_SYMBOL()),
  'W20-7': (sev) => diamond(sev === 'high' ? COLORS.orangeHi : COLORS.orange, W20_7_SYMBOL),
  'W23-1': (sev) => diamond(sev === 'high' ? COLORS.orangeHi : COLORS.orange, W23_1_SYMBOL),
  'W12-1': (sev) => diamond(sev === 'high' ? COLORS.orangeHi : COLORS.orange, W12_1_SYMBOL),
  'W8-5':  (sev) => diamond(sev === 'high' ? COLORS.orangeHi : COLORS.orange, W8_5_SYMBOL),
  'M4-9':  () => rect(COLORS.orange, M4_9_SYMBOL),
  'R5-1':  () => regCircle(R5_1_SYMBOL),
  'I-1':   () => diamond(COLORS.red, INCIDENT_SYMBOL),
  'GEN':   (sev) => diamond(sev === 'high' ? COLORS.orangeHi : COLORS.orange, '')
};

/* ---------- classifier ---------- */

function normalizeSeverity(sev) {
  const s = String(sev || '').toLowerCase();
  if (s.includes('high') || s.includes('major') || s.includes('severe')) return 'high';
  if (s.includes('medium') || s.includes('moderate')) return 'medium';
  return 'low';
}

function pickClosureCode(text) {
  // Reads description + lanesAffected for left/right/full hints.
  if (/full[- ]?clos|all lanes|both directions|road closed/i.test(text)) return 'W20-3';
  if (/left lane|left shoulder|outside.*left|merge right/i.test(text)) return 'W20-5L';
  if (/right lane|right shoulder|outside.*right|merge left/i.test(text)) return 'W20-5R';
  return 'W20-3';
}

function pickWeatherCode(text) {
  // All weather routes through W8-5 (slippery) — single recognizable warning.
  // Future: split into snow/ice/wind variants if we add their symbols.
  if (/snow|ice|black ice|slick|slippery|wet|rain|frost|sleet/i.test(text)) return 'W8-5';
  return 'W8-5';
}

/**
 * Classify a normalized event to a MUTCD sign code.
 * Returns { code, label, svg } where svg is a 32×32 string ready for divIcon.
 */
function signFor(event) {
  const eventType = String(event?.eventType || '').toLowerCase().trim();
  const desc = String(event?.description || '').toLowerCase();
  const lanes = String(event?.lanesAffected || '').toLowerCase();
  const text = `${eventType} ${desc} ${lanes}`;
  const sev = normalizeSeverity(event?.severityLevel || event?.severity);

  let code = 'GEN';

  // Specific keyword overrides first — these win regardless of eventType.
  if (/flagger/.test(text)) code = 'W20-7';
  else if (/low clearance|height restriction|bridge.*height|overpass/.test(text)) code = 'W12-1';
  else if (/detour|diversion|reroute/.test(text)) code = 'M4-9';
  else if (/crash|collision|accident|rollover|overturn/.test(text)) code = 'I-1';

  // Then by event type.
  else if (/incident/.test(eventType)) code = 'I-1';
  else if (/closure|closed/.test(eventType)) {
    code = /full|all lanes|do not enter/i.test(text) ? 'R5-1' : pickClosureCode(text);
  }
  else if (/construction|work[- ]?zone|maintenance|roadwork|road work|paving/.test(eventType + ' ' + text)) code = 'W21-1';
  else if (/weather|winter|snow|ice|rain|fog|storm/.test(eventType + ' ' + text)) code = pickWeatherCode(text);
  else if (/congestion|slow|queue|backup|heavy traffic|stopped traffic/.test(text)) code = 'W23-1';
  else if (/special event|event/.test(eventType)) code = 'GEN';

  const labels = {
    'W21-1': 'Workers (W21-1)',
    'W20-3': 'Road Closed Ahead (W20-3)',
    'W20-5L': 'Left Lane Closed (W20-5)',
    'W20-5R': 'Right Lane Closed (W20-5)',
    'W20-7': 'Flagger (W20-7)',
    'W23-1': 'Stopped Traffic (W23-1)',
    'W12-1': 'Low Clearance (W12-1)',
    'W8-5':  'Slippery When Wet (W8-5)',
    'M4-9':  'Detour (M4-9)',
    'R5-1':  'Do Not Enter (R5-1)',
    'I-1':   'Incident',
    'GEN':   'Generic Warning'
  };

  const factory = SIGNS[code] || SIGNS.GEN;
  return {
    code,
    label: labels[code] || code,
    svg: factory(sev),
    url: SIGN_LIBRARY_CODES.has(code) ? `${SIGN_LIBRARY}/${code}.svg` : null
  };
}

// Official MUTCD sign SVGs hosted on the DTCD sign library (Cloudflare, free/
// cached). Where a code exists there, markers use the real sign artwork; the
// rest fall back to the inline symbol above.
const SIGN_LIBRARY = 'https://purposebuilt.systems/signs';
const SIGN_LIBRARY_CODES = new Set([
  'W21-1', 'W20-3', 'W20-5L', 'W20-5R', 'W20-7', 'W23-1', 'M4-9', 'R5-1'
]);

export { signFor, SIGNS };
