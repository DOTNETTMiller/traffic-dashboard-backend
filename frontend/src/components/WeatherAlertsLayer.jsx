import { Fragment, useEffect, useState } from 'react';
import { Polygon, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import api from '../services/api';

/**
 * NWS Weather Alerts map layer.
 *
 * Fetches /api/weather-alerts (90s server-side cache) and draws each
 * road-impacting alert as a translucent polygon when it carries a
 * geometry, or as a marker at the centroid of its first state when it
 * doesn't (NWS publishes some alerts with only "areaDesc" text and no
 * polygon — common for SAME-code-only county warnings).
 *
 * Severity tones map to the NWS severity field, not our brand palette
 * directly — operators expect winter storms to read in the colors they
 * already see on weather.gov radar overlays:
 *
 *   Extreme  → magenta (#c026d3)   tornado, hurricane core, ice storm
 *   Severe   → red (#dc2626)       blizzard, severe thunderstorm, hurricane warning
 *   Moderate → orange (#ea580c)    winter storm, flood warning, high wind
 *   Minor    → yellow (#ca8a04)    advisory-tier
 *   Unknown  → gray
 */

const SEVERITY_TONES = {
  Extreme:  { stroke: '#c026d3', fill: '#c026d3' },
  Severe:   { stroke: '#dc2626', fill: '#dc2626' },
  Moderate: { stroke: '#ea580c', fill: '#ea580c' },
  Minor:    { stroke: '#ca8a04', fill: '#ca8a04' },
  Unknown:  { stroke: '#6b7280', fill: '#6b7280' }
};

// Approximate state centroids for fallback marker placement when an
// alert has no geometry. Best-effort — only used when the alert lacks
// a polygon, which is uncommon but happens for some zone-only warnings.
const STATE_CENTROIDS = {
  AL: [32.806, -86.791], AK: [61.370, -152.404], AZ: [33.729, -111.431], AR: [34.969, -92.373],
  CA: [36.116, -119.682], CO: [39.059, -105.311], CT: [41.598, -72.755], DE: [39.318, -75.507],
  DC: [38.897, -77.026], FL: [27.766, -81.687], GA: [33.040, -83.643], HI: [21.094, -157.498],
  ID: [44.240, -114.479], IL: [40.349, -88.986], IN: [39.849, -86.258], IA: [42.011, -93.210],
  KS: [38.526, -96.726], KY: [37.668, -84.670], LA: [31.169, -91.867], ME: [44.693, -69.381],
  MD: [39.063, -76.802], MA: [42.230, -71.530], MI: [43.326, -84.536], MN: [45.694, -93.900],
  MS: [32.741, -89.678], MO: [38.456, -92.288], MT: [46.921, -110.454], NE: [41.125, -98.268],
  NV: [38.313, -117.055], NH: [43.452, -71.563], NJ: [40.298, -74.521], NM: [34.840, -106.248],
  NY: [42.165, -74.948], NC: [35.630, -79.806], ND: [47.528, -99.784], OH: [40.388, -82.764],
  OK: [35.565, -96.928], OR: [44.572, -122.070], PA: [40.590, -77.209], RI: [41.680, -71.512],
  SC: [33.857, -80.945], SD: [44.299, -99.439], TN: [35.747, -86.692], TX: [31.054, -97.563],
  UT: [40.150, -111.862], VT: [44.045, -72.711], VA: [37.769, -78.169], WA: [47.400, -121.490],
  WV: [38.491, -80.954], WI: [44.268, -89.616], WY: [42.756, -107.302]
};

// Convert GeoJSON coordinates to Leaflet [lat, lng] format.
// NWS alerts can be Polygon or MultiPolygon.
function coordsToLatLngs(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(ring => ring.map(([lng, lat]) => [lat, lng]));
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap(poly =>
      poly.map(ring => ring.map(([lng, lat]) => [lat, lng]))
    );
  }
  return null;
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
}

const weatherIcon = (severity) => L.divIcon({
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: ${(SEVERITY_TONES[severity] || SEVERITY_TONES.Unknown).fill};
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px;
  ">⚠</div>`,
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

export default function WeatherAlertsLayer({ visible = false }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/api/weather-alerts');
        if (!cancelled) setAlerts(res?.data?.alerts || []);
      } catch (err) {
        if (!cancelled) setAlerts([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {alerts.map(a => {
        const tone = SEVERITY_TONES[a.severity] || SEVERITY_TONES.Unknown;
        const polys = coordsToLatLngs(a.geometry);

        if (polys && polys.length > 0) {
          return (
            <Polygon
              key={a.id}
              positions={polys}
              pathOptions={{
                color: tone.stroke,
                fillColor: tone.fill,
                fillOpacity: 0.18,
                weight: 1.8,
                opacity: 0.85
              }}
            >
              <Tooltip sticky direction="top" offset={[0, -4]}>
                <strong>{a.event}</strong>
                <br />
                {a.severity} · {a.urgency}
              </Tooltip>
              <AlertPopup a={a} />
            </Polygon>
          );
        }

        // Fallback: marker at the centroid of the first state listed.
        const center = STATE_CENTROIDS[a.states[0]];
        if (!center) return null;
        return (
          <Marker key={a.id} position={center} icon={weatherIcon(a.severity)}>
            <Tooltip direction="top" offset={[0, -14]}>
              <strong>{a.event}</strong> · {a.areaDesc.split(';')[0]?.trim()}
            </Tooltip>
            <AlertPopup a={a} />
          </Marker>
        );
      })}
    </>
  );
}

function AlertPopup({ a }) {
  return (
    <Popup>
      <div style={{ minWidth: 240, maxWidth: 340, fontFamily: 'var(--font-sans)' }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 14, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.02em',
          color: 'var(--accent)', marginBottom: 6,
          paddingBottom: 4, borderBottom: '2px solid var(--accent)'
        }}>
          {a.event}
        </div>
        <Row label="Severity" value={`${a.severity} · ${a.urgency}`} />
        <Row label="Areas" value={a.areaDesc.length > 100 ? a.areaDesc.slice(0, 100) + '…' : a.areaDesc} />
        <Row label="Effective" value={fmtTime(a.effective || a.sent)} />
        <Row label="Expires" value={fmtTime(a.expires)} />
        {a.instruction && (
          <div style={{
            marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb',
            fontSize: 11, color: '#374151', lineHeight: 1.5,
            maxHeight: 100, overflowY: 'auto'
          }}>
            <strong>Instructions:</strong> {a.instruction}
          </div>
        )}
        {a.url && (
          <div style={{ marginTop: 6, fontSize: 11 }}>
            <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: '#C66A1F' }}>
              Full alert ↗
            </a>
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 10, color: '#6b7280' }}>
          {a.senderName || 'NWS'}
        </div>
      </div>
    </Popup>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ fontSize: 12, marginBottom: 3 }}>
      <strong style={{ color: '#1d1d1f' }}>{label}:</strong>{' '}
      <span style={{ color: '#374151' }}>{value}</span>
    </div>
  );
}
