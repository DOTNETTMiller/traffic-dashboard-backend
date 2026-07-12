import { useEffect, useState } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import api from '../services/api';

// TomTom incidents are drawn as CIRCLES (not the DOT MUTCD diamonds) so the two
// sources are visually distinct when overlaid — the point of the deviation view.
const catColor = (code) => {
  if ([1, 14].includes(code)) return '#dc2626'; // accident / broken-down
  if (code === 8) return '#991b1b';              // road closed
  if ([7, 9].includes(code)) return '#ea580c';   // lane closed / road works
  if (code === 6) return '#b45309';              // jam
  if ([2, 3, 4, 5, 10, 11].includes(code)) return '#2563eb'; // weather
  return '#6b7280';
};

const createIncidentIcon = (incident) => {
  const color = catColor(incident.categoryCode);
  const svg = `
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="8.5" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="11" cy="11" r="3" fill="#ffffff" opacity="0.85"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: 'tomtom-incident-icon',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11]
  });
};

export default function TomTomIncidentsLayer() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const resp = await api.get('/api/tomtom/incidents');
        if (!cancelled && resp.data?.success) {
          setIncidents(resp.data.incidents || []);
          console.log('🚗 TomTom incidents loaded:', resp.data.count, '(consumer-nav source)');
        }
      } catch (e) {
        console.error('Error loading TomTom incidents:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  return (
    <MarkerClusterGroup chunkedLoading maxClusterRadius={45} showCoverageOnHover={false} zoomToBoundsOnClick>
      {incidents.map((inc) => {
        if (!Number.isFinite(inc.latitude) || !Number.isFinite(inc.longitude)) return null;
        return (
          <Marker key={inc.id} position={[inc.latitude, inc.longitude]} icon={createIncidentIcon(inc)}>
            <Tooltip direction="top" offset={[0, -8]} opacity={0.9}>
              <span style={{ fontSize: '11px', fontWeight: 600 }}>{inc.category} (TomTom)</span>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 230, padding: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{
                    width: 12, height: 12, borderRadius: '50%', background: catColor(inc.categoryCode),
                    display: 'inline-block', border: '2px solid #fff', boxShadow: '0 0 0 1px #ccc'
                  }} />
                  <strong style={{ fontSize: 13, color: '#111827' }}>{inc.category}</strong>
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: '#3730a3',
                    background: '#e0e7ff', border: '1px solid #c7d2fe', borderRadius: 4, padding: '1px 5px'
                  }}>TomTom · consumer nav</span>
                </div>
                {inc.description && (
                  <div style={{ fontSize: 12, color: '#374151', marginBottom: 6, lineHeight: 1.4 }}>{inc.description}</div>
                )}
                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
                  {inc.roadNumbers?.length > 0 && <div><strong>Road:</strong> {inc.roadNumbers.join(', ')}</div>}
                  {(inc.from || inc.to) && <div><strong>Where:</strong> {[inc.from, inc.to].filter(Boolean).join(' → ')}</div>}
                  <div><strong>Severity:</strong> {inc.severity}{inc.delaySeconds ? ` · ${Math.round(inc.delaySeconds / 60)} min delay` : ''}</div>
                  {inc.startTime && <div><strong>Since:</strong> {new Date(inc.startTime).toLocaleString()}</div>}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}
