import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import '../styles/sensor-dashboard.css';

// Fix Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SensorDashboard = () => {
  const [sensors, setSensors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [sensorReadings, setSensorReadings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/sensors/dashboard`);
      setDashboardData(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    }
  };

  // Fetch sensors
  const fetchSensors = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/sensors`);
      setSensors(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching sensors:', err);
      setError('Failed to load sensors');
    }
  };

  // Fetch active alerts
  const fetchAlerts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/sensors/alerts?status=active`);
      setAlerts(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to load alerts');
    }
  };

  // Fetch sensor readings
  const fetchSensorReadings = async (sensorId, sensorType) => {
    try {
      const response = await axios.get(`${API_BASE}/api/sensors/readings/${sensorType}/${sensorId}`);
      setSensorReadings(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching sensor readings:', err);
      setError('Failed to load sensor readings');
    }
  };

  // Trigger manual poll
  const handleManualPoll = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/api/sensors/poll`);

      // Refresh data after poll
      setTimeout(() => {
        fetchDashboardData();
        fetchSensors();
        fetchAlerts();
        setLoading(false);
      }, 2000);
    } catch (err) {
      console.error('Error polling sensors:', err);
      setError('Failed to poll sensors');
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDashboardData(),
        fetchSensors(),
        fetchAlerts()
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchDashboardData();
      fetchAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Load sensor readings when sensor is selected
  useEffect(() => {
    if (selectedSensor) {
      fetchSensorReadings(selectedSensor.sensor_id, selectedSensor.sensor_type);
    }
  }, [selectedSensor]);

  // Helper functions
  const getSensorStatusColor = (status) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'gray';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getSeverityBadge = (severity) => {
    if (severity >= 6) return { text: 'Critical', class: 'severity-critical' };
    if (severity >= 4) return { text: 'High', class: 'severity-high' };
    if (severity >= 2) return { text: 'Medium', class: 'severity-medium' };
    return { text: 'Low', class: 'severity-low' };
  };

  const getAlertTypeIcon = (type) => {
    const icons = {
      ice: '❄️',
      black_ice: '🧊',
      slippery: '⚠️',
      low_visibility: '🌫️',
      high_winds: '💨',
      over_height: '📏',
      congestion: '🚗',
      incident: '🚨'
    };
    return icons[type] || '⚠️';
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading || !dashboardData || !dashboardData.summary) {
    return (
      <div className="sensor-dashboard loading">
        <div className="loading-spinner"></div>
        <p>Loading sensor data...</p>
      </div>
    );
  }

  return (
    <div className="sensor-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-title">
          <h2>🛰️ Sensor & V2X Dashboard</h2>
          <p>Real-time monitoring of RWIS, traffic, and bridge sensors</p>
        </div>

        <div className="header-actions">
          <button
            className={`auto-refresh-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '🔄 Auto-Refresh ON' : '⏸️ Auto-Refresh OFF'}
          </button>

          <button
            className="manual-poll-btn"
            onClick={handleManualPoll}
            disabled={loading}
          >
            {loading ? '⏳ Polling...' : '🔄 Poll Now'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`tab ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          🚨 Active Alerts ({alerts.length})
        </button>
        <button
          className={`tab ${activeTab === 'sensors' ? 'active' : ''}`}
          onClick={() => setActiveTab('sensors')}
        >
          🛰️ Sensors ({sensors.length})
        </button>
        <button
          className={`tab ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          🗺️ Map
        </button>
        <button
          className={`tab ${activeTab === 'tim' ? 'active' : ''}`}
          onClick={() => setActiveTab('tim')}
        >
          📡 TIM Broadcasts
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboardData && dashboardData.summary && (
        <div className="overview-tab">
          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🛰️</div>
              <div className="stat-content">
                <div className="stat-label">Total Sensors</div>
                <div className="stat-value">{dashboardData.summary.total_sensors || 0}</div>
                <div className="stat-detail">
                  {dashboardData.summary.active_sensors || 0} active
                </div>
              </div>
            </div>

            <div className="stat-card alert">
              <div className="stat-icon">🚨</div>
              <div className="stat-content">
                <div className="stat-label">Active Alerts</div>
                <div className="stat-value">{dashboardData.summary.active_alerts || 0}</div>
                <div className="stat-detail">
                  {dashboardData.summary.critical_alerts || 0} critical
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📡</div>
              <div className="stat-content">
                <div className="stat-label">TIM Broadcasts</div>
                <div className="stat-value">{dashboardData.summary.tim_broadcasts_24h || 0}</div>
                <div className="stat-detail">Last 24 hours</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-label">Readings</div>
                <div className="stat-value">{dashboardData.summary.recent_readings || 0}</div>
                <div className="stat-detail">Last hour</div>
              </div>
            </div>
          </div>

          {/* Sensor Types Breakdown */}
          <div className="sensor-types">
            <h3>Sensor Types</h3>
            <div className="types-grid">
              {(dashboardData.sensor_types || []).map(type => (
                <div key={type.sensor_type} className="type-card">
                  <div className="type-icon">
                    {type.sensor_type === 'rwis' && '❄️'}
                    {type.sensor_type === 'traffic' && '🚗'}
                    {type.sensor_type === 'bridge' && '🌉'}
                  </div>
                  <div className="type-name">{type.sensor_type.toUpperCase()}</div>
                  <div className="type-count">{type.count} sensors</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="recent-alerts">
            <h3>Recent Alerts</h3>
            {(dashboardData.recent_alerts || []).length > 0 ? (
              <div className="alerts-list">
                {(dashboardData.recent_alerts || []).slice(0, 5).map(alert => (
                  <div key={alert.id} className="alert-item">
                    <div className="alert-icon">{getAlertTypeIcon(alert.alert_type)}</div>
                    <div className="alert-content">
                      <div className="alert-header">
                        <span className="alert-type">{alert.alert_type.replace('_', ' ')}</span>
                        <span className={`severity-badge ${getSeverityBadge(alert.severity).class}`}>
                          {getSeverityBadge(alert.severity).text}
                        </span>
                      </div>
                      <div className="alert-location">
                        {alert.sensor_name} - {alert.roadway} MP {alert.milepost}
                      </div>
                      <div className="alert-time">{formatTimestamp(alert.detected_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">✅ No active alerts</div>
            )}
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="alerts-tab">
          <div className="tab-header">
            <h3>🚨 Active Alerts</h3>
            <span className="count-badge">{alerts.length} active</span>
          </div>

          {alerts.length > 0 ? (
            <div className="alerts-table-container">
              <table className="alerts-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Sensor</th>
                    <th>Location</th>
                    <th>Severity</th>
                    <th>Detected</th>
                    <th>V2X Status</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map(alert => (
                    <tr key={alert.id}>
                      <td>
                        <span className="alert-type-cell">
                          {getAlertTypeIcon(alert.alert_type)} {alert.alert_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{alert.sensor_name}</td>
                      <td>{alert.roadway} MP {alert.milepost}</td>
                      <td>
                        <span className={`severity-badge ${getSeverityBadge(alert.severity).class}`}>
                          {getSeverityBadge(alert.severity).text}
                        </span>
                      </td>
                      <td>{formatTimestamp(alert.detected_at)}</td>
                      <td>
                        {alert.v2x_broadcast_status === 'sent' && (
                          <span className="broadcast-status sent">📡 Broadcast</span>
                        )}
                        {alert.v2x_broadcast_status === 'pending' && (
                          <span className="broadcast-status pending">⏳ Pending</span>
                        )}
                        {!alert.v2x_broadcast_status && (
                          <span className="broadcast-status none">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data large">
              <div className="no-data-icon">✅</div>
              <h4>No Active Alerts</h4>
              <p>All sensors are reporting normal conditions</p>
            </div>
          )}
        </div>
      )}

      {/* Sensors Tab */}
      {activeTab === 'sensors' && (
        <div className="sensors-tab">
          <div className="tab-header">
            <h3>🛰️ Sensor Inventory</h3>
            <span className="count-badge">{sensors.length} sensors</span>
          </div>

          <div className="sensors-grid">
            {sensors.map(sensor => (
              <div
                key={sensor.id}
                className={`sensor-card ${selectedSensor?.id === sensor.id ? 'selected' : ''}`}
                onClick={() => setSelectedSensor(sensor)}
              >
                <div className="sensor-header">
                  <div className="sensor-icon">
                    {sensor.sensor_type === 'rwis' && '❄️'}
                    {sensor.sensor_type === 'traffic' && '🚗'}
                    {sensor.sensor_type === 'bridge' && '🌉'}
                  </div>
                  <div className={`sensor-status ${sensor.status}`}>
                    <span className={`status-dot ${getSensorStatusColor(sensor.status)}`}></span>
                    {sensor.status}
                  </div>
                </div>

                <h4 className="sensor-name">{sensor.sensor_name}</h4>

                <div className="sensor-details">
                  <div className="detail-row">
                    <span className="label">ID:</span>
                    <span className="value">{sensor.sensor_id}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Type:</span>
                    <span className="value">{sensor.sensor_type.toUpperCase()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Location:</span>
                    <span className="value">{sensor.roadway} MP {sensor.milepost}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Coordinates:</span>
                    <span className="value">{sensor.latitude?.toFixed(4)}, {sensor.longitude?.toFixed(4)}</span>
                  </div>
                </div>

                {sensor.last_reading_time && (
                  <div className="sensor-footer">
                    Last reading: {formatTimestamp(sensor.last_reading_time)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Sensor Details Panel */}
          {selectedSensor && (
            <div className="sensor-details-panel">
              <div className="panel-header">
                <h3>{selectedSensor.sensor_name} - Recent Readings</h3>
                <button
                  className="close-btn"
                  onClick={() => setSelectedSensor(null)}
                >
                  ✕
                </button>
              </div>

              {sensorReadings.length > 0 ? (
                <div className="readings-table-container">
                  <table className="readings-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        {selectedSensor.sensor_type === 'rwis' && (
                          <>
                            <th>Air Temp (°F)</th>
                            <th>Pavement Temp (°F)</th>
                            <th>Friction</th>
                            <th>Visibility (ft)</th>
                            <th>Wind (mph)</th>
                            <th>Warning</th>
                          </>
                        )}
                        {selectedSensor.sensor_type === 'traffic' && (
                          <>
                            <th>Volume (vph)</th>
                            <th>Speed (mph)</th>
                            <th>Occupancy (%)</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {sensorReadings.slice(0, 10).map((reading, idx) => (
                        <tr key={idx}>
                          <td>{formatTimestamp(reading.reading_timestamp)}</td>
                          {selectedSensor.sensor_type === 'rwis' && (
                            <>
                              <td>{reading.air_temperature?.toFixed(1) || '-'}</td>
                              <td>{reading.pavement_temperature?.toFixed(1) || '-'}</td>
                              <td>{reading.pavement_friction?.toFixed(2) || '-'}</td>
                              <td>{reading.visibility?.toFixed(0) || '-'}</td>
                              <td>{reading.wind_speed?.toFixed(1) || '-'}</td>
                              <td>
                                {reading.warning_level > 0 && (
                                  <span className={`severity-badge severity-${reading.warning_level >= 5 ? 'high' : 'medium'}`}>
                                    Level {reading.warning_level}
                                  </span>
                                )}
                              </td>
                            </>
                          )}
                          {selectedSensor.sensor_type === 'traffic' && (
                            <>
                              <td>{reading.volume || '-'}</td>
                              <td>{reading.speed || '-'}</td>
                              <td>{reading.occupancy || '-'}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-data">No readings available</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Map Tab */}
      {activeTab === 'map' && (
        <div className="map-tab">
          <div className="tab-header">
            <h3>🗺️ Sensor Map</h3>
            <div className="map-legend">
              <span><span style={{color: '#2563eb'}}>●</span> RWIS (150)</span>
              <span><span style={{color: '#dc2626'}}>●</span> Traffic (1700)</span>
              <span><span style={{color: '#ea580c'}}>●</span> Unknown</span>
            </div>
          </div>

          {sensors.length > 0 ? (
            <div className="map-container" style={{ height: '700px', width: '100%' }}>
              <MapContainer
                center={[42.0, -93.5]}
                zoom={7}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {sensors.map(sensor => {
                  if (!sensor.latitude || !sensor.longitude) return null;

                  const color = sensor.sensor_type === 'rwis' ? '#2563eb' :
                                sensor.sensor_type === 'traffic' ? '#dc2626' : '#ea580c';

                  return (
                    <CircleMarker
                      key={sensor.id}
                      center={[sensor.latitude, sensor.longitude]}
                      radius={5}
                      fillColor={color}
                      color={color}
                      weight={1}
                      opacity={0.8}
                      fillOpacity={0.6}
                    >
                      <Popup>
                        <div style={{ minWidth: '200px' }}>
                          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>{sensor.sensor_name}</h4>
                          <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                            <div><strong>Type:</strong> {sensor.sensor_type?.toUpperCase()}</div>
                            <div><strong>ID:</strong> {sensor.sensor_id}</div>
                            <div><strong>Status:</strong> {sensor.status}</div>
                            {sensor.roadway && <div><strong>Route:</strong> {sensor.roadway}</div>}
                            {sensor.milepost && <div><strong>Milepost:</strong> {sensor.milepost}</div>}
                            <div><strong>Coordinates:</strong> {sensor.latitude.toFixed(4)}, {sensor.longitude.toFixed(4)}</div>
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
          ) : (
            <div className="no-data">No sensors with location data available</div>
          )}
        </div>
      )}

      {/* TIM Broadcasts Tab */}
      {activeTab === 'tim' && dashboardData && (
        <div className="tim-tab">
          <div className="tab-header">
            <h3>📡 Recent TIM Broadcasts</h3>
            <span className="count-badge">
              {dashboardData.summary.tim_broadcasts_24h} last 24h
            </span>
          </div>

          {dashboardData.recent_tim_broadcasts && dashboardData.recent_tim_broadcasts.length > 0 ? (
            <div className="tim-table-container">
              <table className="tim-table">
                <thead>
                  <tr>
                    <th>Packet ID</th>
                    <th>Priority</th>
                    <th>Source</th>
                    <th>RSUs Targeted</th>
                    <th>Status</th>
                    <th>Broadcast Time</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recent_tim_broadcasts.map(broadcast => (
                    <tr key={broadcast.id}>
                      <td className="packet-id">{broadcast.packet_id}</td>
                      <td>
                        <span className={`priority-badge priority-${broadcast.priority >= 5 ? 'high' : 'normal'}`}>
                          {broadcast.priority}
                        </span>
                      </td>
                      <td>{broadcast.source_type?.replace('_', ' ') || '-'}</td>
                      <td>
                        {broadcast.rsus_targeted ? JSON.parse(broadcast.rsus_targeted).length : 0} RSUs
                      </td>
                      <td>
                        <span className={`status-badge ${broadcast.status}`}>
                          {broadcast.status}
                        </span>
                      </td>
                      <td>{formatTimestamp(broadcast.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-data large">
              <div className="no-data-icon">📡</div>
              <h4>No TIM Broadcasts</h4>
              <p>No V2X broadcasts in the last 24 hours</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SensorDashboard;
