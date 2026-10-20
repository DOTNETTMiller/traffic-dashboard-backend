import { useEffect, useId, useState } from 'react';
import { Camera, Navigation, Radio, TriangleAlert, ZoomIn, ZoomOut, LocateFixed, Pause, Play, WifiOff } from 'lucide-react';
import { corridorProjection, lineParts } from './simulationGeometry.mjs';

export function CorridorScene({ world, devices, selected, onSelect }) {
  const id = useId().replaceAll(':', '');
  const [zoom, setZoom] = useState(1);
  const xy = corridorProjection(world.road.features);
  const roadPoints = geometry => lineParts(geometry).map(part => part.map(xy).map(p => p.join(',')).join(' '));
  const routeAnchor = (route, direction, fraction) => {
    const coordinates = world.road.features.find(f => f.properties.route === route && f.properties.direction === direction)?.geometry.coordinates;
    return coordinates ? xy(coordinates[Math.floor((coordinates.length - 1) * fraction)]) : [480, 255];
  };
  const [i80x, i80y] = routeAnchor('I-80', 'eastbound', .23), [i35x, i35y] = routeAnchor('I-35', 'southbound', .25);
  const markers = [
    ...devices.filter(d => d.driver === 'simulator').map(d => ({ id: d.id, type: 'sign', point: world.signLocations?.find(p => p.id === d.id)?.location || [d.longitude, d.latitude], label: d.id.replace('TRAIN-', ''), offline: !!d.communicationFault })),
    ...world.cameras.map(c => ({ id: c.id, type: 'camera', point: [c.longitude, c.latitude], label: 'CAM 01', offline: !c.online })),
    ...world.responders.map(r => ({ id: r.id, type: 'responder', point: [r.longitude, r.latitude], label: 'RSS 01' })),
    ...world.cad.map(c => ({ id: c.id, type: 'incident', point: c.location, label: world.scene === 'crash' ? 'TWO LANES BLOCKED' : world.scene.toUpperCase() }))
  ];
  const icon = { sign: Radio, camera: Camera, responder: Navigation, incident: TriangleAlert };
  return <div className="sim-map-stage">
    <div className="sim-map-heading"><span><i />ROAD-ALIGNED TRAINING CORRIDOR</span><span>N ↑ · IOWA DOT GEOMETRY</span></div>
    <svg viewBox="0 0 960 510" role="group" aria-label="Iowa DOT I-80 and I-35 road alignment with selectable simulated signs, camera, responder and incident">
      <defs>
        <pattern id={id + 'grid'} width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#233c43" strokeWidth=".6" /></pattern>
        <radialGradient id={id + 'ground'}><stop stopColor="#1c363b" /><stop offset="1" stopColor="#0d2029" /></radialGradient>
        <filter id={id + 'glow'} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" /></filter>
      </defs>
      <rect width="960" height="510" fill={`url(#${id}ground)`} />
      <rect width="960" height="510" fill={`url(#${id}grid)`} />
      <g transform={`translate(${480 * (1 - zoom)} ${255 * (1 - zoom)}) scale(${zoom})`}>
        <text {...{ x: xy([-93.625, 41.725])[0], y: xy([-93.625, 41.725])[1] }} className="sim-map-district">ANKENY</text>
        <text {...{ x: xy([-93.50, 41.642])[0], y: xy([-93.50, 41.642])[1] }} className="sim-map-district">ALTOONA</text>
        {world.road.features.map(f => roadPoints(f.geometry).map((points, part) => {
          const primary = ['eastbound', 'southbound'].includes(f.properties.direction);
          return <g key={f.properties.id + '-' + part}>
            <polyline points={points} fill="none" stroke="#080f17" strokeWidth={primary ? 19 : 12} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={points} fill="none" stroke="#52636a" strokeWidth={primary ? 15 : 9} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={points} fill="none" stroke="#293d47" strokeWidth={primary ? 12 : 6} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={points} fill="none" stroke="#a0b1ad" strokeWidth=".7" strokeDasharray="4 7" />
            <polyline className={'sim-traffic-flow ' + (world.scene === 'clear' ? 'free' : '')} points={points} fill="none" stroke={f.properties.route === 'I-80' && world.scene !== 'clear' ? '#e8aa6f' : '#81d0bc'} strokeWidth="3" strokeDasharray="3 58" strokeLinecap="round" />
          </g>;
        }))}
        <g className="sim-route-label" transform={`translate(${i35x + 35} ${i35y - 10})`}><rect width="51" height="27" rx="6" /><text x="25" y="18">I-35</text></g>
        <g className="sim-route-label" transform={`translate(${i80x - 25} ${Math.min(i80y + 48, 470)})`}><rect width="51" height="27" rx="6" /><text x="25" y="18">I-80</text><text className="sim-route-direction" x="110" y="18">EASTBOUND →</text></g>
        {world.affectedGeometry && roadPoints(world.affectedGeometry).map((points, i) => <g key={i}><polyline points={points} fill="none" stroke="#e5a169" strokeWidth="26" opacity=".2" filter={`url(#${id}glow)`} /><polyline points={points} fill="none" stroke="#f0ac86" strokeWidth="4" strokeOpacity=".65" strokeLinecap="round" /></g>)}
        {markers.map(m => {
          const [x, y] = xy(m.point), Icon = icon[m.type], active = selected === m.id;
          return <g key={m.id} className={`sim-map-marker ${m.type} ${m.offline ? 'offline' : ''} ${active ? 'active' : ''}`} role="button" tabIndex="0" aria-label={`Inspect ${m.label}${m.offline ? ', unavailable' : ''}`} onClick={() => onSelect(m.id)} onKeyDown={e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); onSelect(m.id); } }} transform={`translate(${x} ${y})`}>
            {m.type === 'incident' && <circle className="sim-incident-pulse" r="27" />}
            <circle className="sim-marker-halo" r="24" /><rect className="sim-marker-body" x="-16" y="-16" width="32" height="32" rx={m.type === 'incident' ? 10 : 8} /><Icon x="-8" y="-8" width="16" height="16" strokeWidth="1.7" />
            <g transform={`translate(${m.type === 'incident' ? -80 : -39} ${m.type === 'camera' ? 29 : -45})`}><rect className="sim-marker-label" width={m.type === 'incident' ? 160 : 78} height="22" rx="4" /><text x={m.type === 'incident' ? 80 : 39} y="15">{m.label}</text></g>
          </g>;
        })}
      </g>
    </svg>
    <div className="sim-map-controls"><button aria-label="Zoom in corridor" disabled={zoom >= 1.8} onClick={() => setZoom(z => Math.min(1.8, z + .2))}><ZoomIn size={17} /></button><button aria-label="Zoom out corridor" disabled={zoom <= .8} onClick={() => setZoom(z => Math.max(.8, z - .2))}><ZoomOut size={17} /></button><button aria-label="Reset corridor view" onClick={() => setZoom(1)}><LocateFixed size={17} /></button></div>
    <div className="sim-map-legend"><span><i className="incident" />Event</span><span><i className="sign" />Sign</span><span><i className="camera" />Camera</span><span><i className="responder" />Responder</span><small>Animated flow is illustrative</small></div>
    <div className="sim-map-attribution"><a href={world.road.metadata?.sourceUrl || 'https://gis.iowadot.gov'} target="_blank" rel="noreferrer">Road alignment: Iowa DOT RAMS</a><span>Simulated assets & affected limits · {world.road.features.reduce((n, f) => n + lineParts(f.geometry).flat().length, 0)} road vertices</span></div>
  </div>;
}

export function CameraScene({ world, clip }) {
  const uid = useId().replaceAll(':', '');
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const preference = window.matchMedia('(prefers-reduced-motion: reduce)'); const change = e => setMotion(!e.matches); preference.addEventListener('change', change); return () => preference.removeEventListener('change', change); }, []);
  const camera = world.cameras[0], blocked = ['crash', 'work-zone'].includes(world.scene);
  return <div className={'sim-camera-stage ' + (!camera.online ? 'offline' : '')}>
    {clip && camera.online ? <video src={clip} controls autoPlay muted loop playsInline aria-label="Local recorded traffic clip in simulated agency" /> : <svg viewBox="0 0 600 340" role="img" aria-label={camera.online ? `Synthetic traffic camera, ${camera.preset} preset` : 'Simulated camera disconnected'}>
      <defs>
        <linearGradient id={uid + 'sky'} x2="0" y2="1"><stop stopColor={world.scene === 'storm' ? '#354752' : '#8b9e9e'} /><stop offset="1" stopColor="#bdc8bc" /></linearGradient>
        <linearGradient id={uid + 'road'} x2="0" y2="1"><stop stopColor="#4e5c5a" /><stop offset="1" stopColor="#293636" /></linearGradient>
        <radialGradient id={uid + 'vignette'}><stop offset=".3" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#041017" stopOpacity=".65" /></radialGradient>
        <pattern id={uid + 'scan'} width="2" height="4" patternUnits="userSpaceOnUse"><path d="M0 3H600" stroke="#07171a" strokeOpacity=".12" /></pattern>
      </defs>
      <rect width="600" height="340" fill={`url(#${uid}sky)`} />
      <path d="M0 91L55 69L110 94L170 80L240 102L300 90L374 85L435 67L508 81L600 62V340H0Z" fill="#425d54" />
      {Array.from({ length: 23 }, (_, n) => <path key={n} d={`M${n * 30 - 15} 135l17-55l18 55Z`} fill={n % 2 ? '#38574b' : '#4c6655'} />)}
      <g transform={`translate(${camera.preset === 'upstream' ? 28 : camera.preset === 'downstream' ? -28 : 0},0)`}>
        <path d="M-50 340L247 91H347L690 340Z" fill="#798678" />
        <path d="M-35 340L251 91H343L665 340Z" fill={`url(#${uid}road)`} />
        <path d="M246 94L136 340M267 94L244 340M313 94L406 340M338 94L620 340" stroke="#d1d4b9" strokeWidth="2" opacity=".75" strokeDasharray="12 18" />
        <path d="M289 90L312 340" stroke="#c8cfb9" strokeWidth="5" /><path d="M293 90L319 340" stroke="#252f2d" strokeWidth="4" />
        <path d="M251 90L-20 340M343 90L660 340" stroke="#a6b0a0" strokeWidth="3" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map(n => {
          const left = n % 2 === 0, lane = n % 3;
          const fromX = left ? 258 - lane * 9 : 318 + lane * 6, toX = left ? 10 + lane * 92 : 385 + lane * 91;
          return <g key={n} className="sim-camera-car" transform={`translate(${fromX + (toX - fromX) * (n + 1) / 10} ${100 + (n + 1) * 22})`}>{motion && camera.online && <animateTransform attributeName="transform" type="translate" from={`${fromX} 100`} to={`${toX} 350`} dur={`${world.scene === 'clear' ? 5 + n % 3 : 13 + n % 4}s`} begin={`${-n * 2.4}s`} repeatCount="indefinite" />}<g transform="scale(.65)">{motion && camera.online && <animateTransform attributeName="transform" type="scale" from=".24" to="1.25" dur={`${world.scene === 'clear' ? 5 + n % 3 : 13 + n % 4}s`} begin={`${-n * 2.4}s`} repeatCount="indefinite" />}<ellipse cy="14" rx="11" ry="17" fill="#152522" opacity=".55" /><rect x="-9" y="-16" width="18" height={n === 5 ? 45 : 29} rx="4" fill={['#d6ddce', '#7d999b', '#464f57', '#b4b6a3'][n % 4]} /><rect x="-6" y="-11" width="12" height="7" rx="2" fill="#263d42" /><rect x="-6" y="6" width="12" height="3" fill="#b4c2b8" /><path d="M-7 12h3m8 0h3" stroke={left ? '#e89775' : '#f9e3ac'} strokeWidth="2" /></g></g>;
        })}
        {blocked && <g><path d="M359 216L448 216M372 230L469 230" stroke="#e7a66c" strokeWidth="4" strokeDasharray="10 5" /><path d="M365 202l-4 10h9ZM390 202l-4 10h9ZM415 202l-4 10h9Z" fill="#e9a05f" /><rect x="387" y="179" width="27" height="17" rx="4" fill="#b4c5c1" transform="rotate(25 387 179)" /><circle cx="424" cy="186" r="2" fill="#ff856e" /></g>}
        <path d="M113 122V81H481V139M113 85H481" fill="none" stroke="#61716b" strokeWidth="3" /><rect x="205" y="84" width="71" height="21" fill="#1c3a31" /><rect x="323" y="84" width="71" height="21" fill="#1c3a31" />
      </g>
      {world.scene === 'storm' && <g className="sim-rain" opacity=".35">{Array.from({ length: 24 }, (_, n) => <path key={n} d={`M${n * 29} 0l-100 340`} stroke="#d0e4e4" strokeWidth="1" />)}</g>}
      <rect width="600" height="340" fill={`url(#${uid}scan)`} /><rect width="600" height="340" fill={`url(#${uid}vignette)`} />
      <path d="M280 170h12m16 0h12M300 150v12m0 16v12" stroke="#e2eee5" strokeWidth="1" opacity=".45" />
    </svg>}
    {!camera.online && <div className="sim-camera-disconnected"><WifiOff size={30} /><strong>Camera disconnected</strong><span>No fresh frame available</span></div>}
    <div className="sim-camera-hud"><span><i className={camera.online ? '' : 'off'} />{clip ? 'LOCAL RECORDING' : 'SYNTHETIC CAMERA'}</span></div>
    {!clip && camera.online && <button className="sim-camera-motion" aria-label={motion ? 'Pause camera illustration' : 'Animate camera illustration'} aria-pressed={!motion} onClick={() => setMotion(m => !m)}>{motion ? <Pause size={12} /> : <Play size={12} />}</button>}
    <div className="sim-camera-bottom"><span>CAM 01 <b>I-80 · {camera.preset.toUpperCase()}</b></span><time>{camera.online ? new Date(camera.frameAt).toLocaleTimeString([], { hour12: false }) : 'OFFLINE'}</time></div>
  </div>;
}
