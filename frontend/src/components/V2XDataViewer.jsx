/**
 * V2X Data Viewer Component
 * Displays real-time connected vehicle data from ITS JPO ODE
 *
 * Supported message types:
 * - BSM (Basic Safety Messages) - Vehicle positions and movements
 * - TIM (Traveler Information Messages) - Road advisories and alerts
 * - SPaT (Signal Phase and Timing) - Traffic signal status
 * - MAP (Map Data) - Intersection geometry
 */

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import './V2XDataViewer.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Custom icons for different message types
const bsmIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiM0Mjg1RjQiLz4KPHBhdGggZD0iTTEyIDZWMThNNiAxMkgxOCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPg==',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

const timIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMiAyMkgyMkwxMiAyWiIgZmlsbD0iI0ZCQkMwNCIvPgo8cGF0aCBkPSJNMTIgOVYxM00xMiAxNkgxMi4wMSIgc3Ryb2tlPSJibGFjayIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPC9zdmc+',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
});

function V2XDataViewer() {
  const [activeTab, setActiveTab] = useState('bsm');
  const [bsmData, setBsmData] = useState([]);
  const [timData, setTimData] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [mapCenter, setMapCenter] = useState([41.5868, -93.6250]); // Default to Iowa I-80

  // Fetch V2X data
  useEffect(() => {
    fetchData();
    const interval = autoRefresh ? setInterval(fetchData, 5000) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch statistics
      const statsResponse = await fetch(`${API_URL}/api/v2x/statistics`);
      const statsData = await statsResponse.json();
      if (statsData.success) {
        const statsMap = {};
        statsData.statistics.forEach(stat => {
          statsMap[stat.message_type] = stat;
        });
        setStatistics(statsMap);
      }

      // Fetch BSM data
      const bsmResponse = await fetch(`${API_URL}/api/v2x/bsm?limit=100`);
      const bsmResult = await bsmResponse.json();
      if (bsmResult.success) {
        setBsmData(bsmResult.messages);
      }

      // Fetch active TIM messages
      const timResponse = await fetch(`${API_URL}/api/v2x/tim?active=true&limit=50`);
      const timResult = await timResponse.json();
      if (timResult.success) {
        setTimData(timResult.messages);
      }

    } catch (error) {
      console.error('Error fetching V2X data:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStatistics = () => (
    <div className="v2x-statistics">
      <h3>V2X Message Statistics</h3>
      <div className="stats-grid">
        {Object.entries(statistics).map(([type, stat]) => (
          <div key={type} className="stat-card">
            <div className="stat-type">{type}</div>
            <div className="stat-count">{stat.count?.toLocaleString() || 0}</div>
            <div className="stat-last">
              Last: {stat.last_received ? new Date(stat.last_received).toLocaleTimeString() : 'N/A'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBSMView = () => (
    <div className="v2x-content">
      <div className="v2x-header">
        <h3>Basic Safety Messages (BSM)</h3>
        <p className="message-description">
          Real-time vehicle position, speed, and heading data from connected vehicles
        </p>
        <div className="message-count">
          {bsmData.length} vehicles tracked
        </div>
      </div>

      <div className="v2x-map-container">
        <MapContainer
          center={mapCenter}
          zoom={10}
          style={{ height: '500px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />

          {bsmData.map((bsm, idx) => (
            <Marker
              key={`bsm-${idx}`}
              position={[bsm.latitude, bsm.longitude]}
              icon={bsmIcon}
            >
              <Popup>
                <div className="bsm-popup">
                  <h4>Vehicle {bsm.temporary_id}</h4>
                  <div><strong>Speed:</strong> {bsm.speed} m/s</div>
                  <div><strong>Heading:</strong> {bsm.heading}°</div>
                  <div><strong>Elevation:</strong> {bsm.elevation} m</div>
                  <div><strong>Time:</strong> {new Date(bsm.timestamp).toLocaleTimeString()}</div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="bsm-table">
        <table>
          <thead>
            <tr>
              <th>Vehicle ID</th>
              <th>Speed (m/s)</th>
              <th>Heading</th>
              <th>Location</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {bsmData.slice(0, 20).map((bsm, idx) => (
              <tr key={idx}>
                <td>{bsm.temporary_id}</td>
                <td>{bsm.speed?.toFixed(2)}</td>
                <td>{bsm.heading}°</td>
                <td>{bsm.latitude?.toFixed(5)}, {bsm.longitude?.toFixed(5)}</td>
                <td>{new Date(bsm.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTIMView = () => (
    <div className="v2x-content">
      <div className="v2x-header">
        <h3>Traveler Information Messages (TIM)</h3>
        <p className="message-description">
          Active road advisories, incidents, and construction alerts
        </p>
        <div className="message-count">
          {timData.length} active messages
        </div>
      </div>

      <div className="tim-list">
        {timData.length === 0 ? (
          <div className="no-data">No active traveler information messages</div>
        ) : (
          timData.map((tim, idx) => (
            <div key={idx} className="tim-card">
              <div className="tim-header">
                <span className="tim-id">Message ID: {tim.msg_id}</span>
                <span className={`tim-priority priority-${tim.priority}`}>
                  Priority: {tim.priority}
                </span>
              </div>
              <div className="tim-content">
                {tim.content && typeof tim.content === 'object' ? (
                  <pre>{JSON.stringify(tim.content, null, 2)}</pre>
                ) : (
                  <div>{tim.content}</div>
                )}
              </div>
              <div className="tim-footer">
                <div className="tim-time">
                  <strong>Start:</strong> {tim.start_time ? new Date(tim.start_time).toLocaleString() : 'N/A'}
                </div>
                <div className="tim-duration">
                  <strong>Duration:</strong> {tim.duration_time} minutes
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSPaTView = () => (
    <div className="v2x-content">
      <div className="v2x-header">
        <h3>Signal Phase and Timing (SPaT)</h3>
        <p className="message-description">
          Real-time traffic signal status and timing information
        </p>
      </div>
      <div className="coming-soon">
        <h4>SPaT data visualization coming soon</h4>
        <p>This feature will display real-time traffic signal phases and countdown timers</p>
      </div>
    </div>
  );

  const renderMAPView = () => (
    <div className="v2x-content">
      <div className="v2x-header">
        <h3>MAP Data</h3>
        <p className="message-description">
          Intersection geometry and lane configuration
        </p>
      </div>
      <div className="coming-soon">
        <h4>MAP data visualization coming soon</h4>
        <p>This feature will display intersection geometry and lane configurations</p>
      </div>
    </div>
  );

  return (
    <div className="v2x-viewer">
      <div className="v2x-controls">
        <h2>🚗 V2X Connected Vehicle Data</h2>
        <div className="control-buttons">
          <button
            className={autoRefresh ? 'active' : ''}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '⏸️ Pause' : '▶️ Resume'} Auto-refresh
          </button>
          <button onClick={fetchData}>🔄 Refresh Now</button>
        </div>
      </div>

      {renderStatistics()}

      <div className="v2x-tabs">
        <button
          className={activeTab === 'bsm' ? 'active' : ''}
          onClick={() => setActiveTab('bsm')}
        >
          BSM ({bsmData.length})
        </button>
        <button
          className={activeTab === 'tim' ? 'active' : ''}
          onClick={() => setActiveTab('tim')}
        >
          TIM ({timData.length})
        </button>
        <button
          className={activeTab === 'spat' ? 'active' : ''}
          onClick={() => setActiveTab('spat')}
        >
          SPaT
        </button>
        <button
          className={activeTab === 'map' ? 'active' : ''}
          onClick={() => setActiveTab('map')}
        >
          MAP
        </button>
      </div>

      <div className="v2x-tab-content">
        {loading && <div className="loading">Loading V2X data...</div>}
        {!loading && activeTab === 'bsm' && renderBSMView()}
        {!loading && activeTab === 'tim' && renderTIMView()}
        {!loading && activeTab === 'spat' && renderSPaTView()}
        {!loading && activeTab === 'map' && renderMAPView()}
      </div>
    </div>
  );
}

export default V2XDataViewer;
