import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, GeoJSON, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function Focus({ selected }) {
  const map = useMap();
  useEffect(() => {
    if (!selected) return;
    const geometry = selected.geometry;
    if (geometry && ['LineString', 'MultiLineString'].includes(geometry.type)) {
      const points = geometry.type === 'LineString' ? geometry.coordinates : geometry.coordinates.flat();
      map.fitBounds(points.map(p => [p[1], p[0]]), { padding: [35, 35], maxZoom: 14 });
    } else if (Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)) map.flyTo([selected.latitude, selected.longitude], 10, { duration: 0.5 });
  }, [selected?.id, selected?.geometryEvidence?.fingerprint]);
  return null;
}
const colors = { critical: '#e76a59', major: '#ed9c4b', moderate: '#e5c85b', minor: '#66b4ac' };
export default function OperationsMap({ incidents, devices, selected, onSelect, training, onCamera }) {
  const [tileError, setTileError] = useState(false);
  const active = incidents.filter(i => !['resolved', 'closed'].includes(i.status));
  const located = active.filter(i => Number.isFinite(i.latitude) && Number.isFinite(i.longitude));
  const center = located[0] ? [located[0].latitude, located[0].longitude] : [39.8, -98.5];
  return <div className="ops-map"><MapContainer center={center} zoom={located.length ? 8 : 4} scrollWheelZoom className="atms-map" aria-label="Corridor operations map">
    <TileLayer url={import.meta.env.VITE_ATMS_TILE_URL || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'} attribution={import.meta.env.VITE_ATMS_TILE_ATTRIBUTION || 'Imagery &copy; Esri, Maxar, Earthstar Geographics, GIS User Community'} maxZoom={19} errorTileUrl="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" eventHandlers={{ tileerror: () => setTileError(true) }} />
    {!import.meta.env.VITE_ATMS_TILE_URL && <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" maxZoom={19} attribution="Road labels &copy; Esri" />}
    {located.filter(i => ['LineString', 'MultiLineString'].includes(i.geometry?.type)).map(i => <GeoJSON key={i.id + ':' + (i.geometryEvidence?.fingerprint || i.version)} data={i.geometry} style={{ color: colors[i.severity], weight: selected?.id === i.id ? 7 : 4, opacity: 0.9, dashArray: i.geometryEvidence?.status === 'operator_reviewed' ? undefined : '8 6' }} eventHandlers={{ click: () => onSelect(i.id) }}><Tooltip><strong>{i.number}</strong><br />{i.geometryEvidence?.status?.replaceAll('_', ' ')}<br />{i.geometryEvidence?.method}</Tooltip></GeoJSON>)}
    {located.map(i => <CircleMarker key={i.id} center={[i.latitude, i.longitude]} radius={selected?.id === i.id ? 12 : 8} pathOptions={{ color: selected?.id === i.id ? '#fff' : colors[i.severity], weight: selected?.id === i.id ? 3 : 2, fillColor: colors[i.severity], fillOpacity: 0.95 }} eventHandlers={{ click: () => onSelect(i.id) }}><Tooltip direction="top"><strong>{i.number}</strong><br />{i.title}</Tooltip></CircleMarker>)}
    {devices.filter(d => Number.isFinite(d.latitude) && Number.isFinite(d.longitude)).map(d => <CircleMarker key={d.id} center={[d.latitude, d.longitude]} radius={5} pathOptions={{ color: '#4b849d', fillColor: '#a8dbed', fillOpacity: 0.9, weight: 2 }} eventHandlers={d.type === 'camera' ? { click: () => onCamera?.(d) } : {}}><Tooltip>{d.name}<br />{d.driver === 'simulator' ? 'Virtual device' : d.controllable ? 'Gateway configured' : 'Read-only device'}</Tooltip></CircleMarker>)}
    <Focus selected={selected} />
  </MapContainer><div className="map-caption"><span><i className="legend-dot major" />Incident <i className="legend-dot device" />Device</span><span>{training ? 'Synthetic training locations' : 'Dashed lines need review · solid lines operator reviewed'}</span></div>{tileError && <div className="map-tile-error">Basemap unavailable. Located incidents and devices remain visible.</div>}</div>;
}
