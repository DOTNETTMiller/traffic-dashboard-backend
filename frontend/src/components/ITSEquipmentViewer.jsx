/**
 * ITS Equipment Inventory Viewer
 *
 * View uploaded GIS equipment (cameras, DMS, RSUs, sensors)
 * Export for ARC-IT compliance and grant applications
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../config';
import './ITSEquipmentViewer.css';

function ITSEquipmentViewer() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedState, setSelectedState] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [summary, setSummary] = useState(null);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    fetchEquipment();
    fetchSummary();
  }, [selectedState, selectedType]);

  const fetchEquipment = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedState !== 'all') params.append('stateKey', selectedState);
      if (selectedType !== 'all') params.append('equipmentType', selectedType);

      const response = await axios.get(`${config.apiUrl}/api/its-equipment?${params.toString()}`);
      setEquipment(response.data.equipment || []);
    } catch (err) {
      console.error('Error fetching equipment:', err);
      setError('Failed to load equipment inventory');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get(`${config.apiUrl}/api/its-equipment/summary`);
      setSummary(response.data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const handleExport = (format) => {
    const params = new URLSearchParams();
    if (selectedState !== 'all') params.append('stateKey', selectedState);
    params.append('format', format);

    const url = `${config.apiUrl}/api/its-equipment/export?${params.toString()}`;
    window.open(url, '_blank');
  };

  const getEquipmentIcon = (type) => {
    switch (type) {
      case 'camera': return '📹';
      case 'dms': return '🪧';
      case 'rsu': return '📡';
      case 'sensor': return '🌡️';
      default: return '📍';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return '#10b981';
      case 'ok': return '#10b981';
      case 'inactive': return '#6b7280';
      case 'maintenance': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  if (loading && equipment.length === 0) {
    return (
      <div className="its-equipment-viewer loading">
        <div className="loading-spinner"></div>
        <p>Loading ITS equipment inventory...</p>
      </div>
    );
  }

  return (
    <div className="its-equipment-viewer">
      {/* Header */}
      <div className="equipment-header">
        <div className="header-content">
          <h2>🏗️ ITS Equipment Inventory</h2>
          <p className="subtitle">Uploaded GIS equipment for ARC-IT compliance and V2X deployment planning</p>
        </div>

        {summary && (
          <div className="equipment-stats">
            <div className="stat-card">
              <div className="stat-value">{summary.total_equipment || 0}</div>
              <div className="stat-label">Total Equipment</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{summary.states || 0}</div>
              <div className="stat-label">States</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{summary.cameras || 0}</div>
              <div className="stat-label">📹 Cameras</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{summary.dms || 0}</div>
              <div className="stat-label">🪧 DMS</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{summary.rsus || 0}</div>
              <div className="stat-label">📡 RSUs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{summary.sensors || 0}</div>
              <div className="stat-label">🌡️ Sensors</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="equipment-filters">
        <div className="filter-group">
          <label>State:</label>
          <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
            <option value="all">All States</option>
            <option value="ia">Iowa (IA)</option>
            <option value="co">Colorado (CO)</option>
            <option value="ca">California (CA)</option>
            <option value="tx">Texas (TX)</option>
            <option value="multi-state">Multi-State</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Equipment Type:</label>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="camera">📹 Cameras</option>
            <option value="dms">🪧 DMS Signs</option>
            <option value="rsu">📡 RSUs (V2X)</option>
            <option value="sensor">🌡️ Sensors</option>
          </select>
        </div>

        <div className="filter-actions">
          <button onClick={() => setShowMap(!showMap)} className="btn-secondary">
            {showMap ? '📋 Show List' : '🗺️ Show Map'}
          </button>
        </div>
      </div>

      {/* Export Tools */}
      <div className="export-section">
        <h3>📥 Export Equipment Data</h3>
        <p>Download equipment inventory for grant applications and regional architecture tools</p>

        <div className="export-buttons">
          <button onClick={() => handleExport('json')} className="export-btn">
            📊 Export JSON
          </button>
          <button onClick={() => handleExport('xml')} className="export-btn">
            📄 Export ARC-IT XML
          </button>
          <button onClick={() => handleExport('csv')} className="export-btn">
            📑 Export CSV
          </button>
          <button onClick={() => handleExport('geojson')} className="export-btn">
            🗺️ Export GeoJSON
          </button>
        </div>

        <div className="export-info">
          <strong>Use Cases:</strong>
          <ul>
            <li><strong>ARC-IT XML/JSON:</strong> National ITS Architecture compliance</li>
            <li><strong>RAD-IT Import:</strong> Regional architecture development</li>
            <li><strong>Grant Applications:</strong> SMART, RAISE, ATCMTD funding</li>
            <li><strong>V2X Planning:</strong> RSU deployment gap analysis</li>
          </ul>
        </div>
      </div>

      {/* Equipment List */}
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {!error && equipment.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No Equipment Found</h3>
          <p>Upload GIS files (Shapefiles, KML, GeoJSON) in the Feed Submission page to populate your ITS equipment inventory.</p>
        </div>
      )}

      {!error && equipment.length > 0 && (
        <div className="equipment-list">
          <div className="list-header">
            <h3>Equipment Inventory ({equipment.length} items)</h3>
          </div>

          <div className="equipment-grid">
            {equipment.map((item, index) => (
              <div key={item.id || index} className="equipment-card">
                <div className="card-header">
                  <span className="equipment-icon">{getEquipmentIcon(item.equipment_type)}</span>
                  <div className="card-title">
                    <h4>{item.id || `Equipment ${index + 1}`}</h4>
                    <span className="equipment-type">{item.equipment_type}</span>
                  </div>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(item.status) }}
                  >
                    {item.status || 'Unknown'}
                  </span>
                </div>

                <div className="card-body">
                  {item.location_description && (
                    <div className="info-row">
                      <span className="label">📍 Location:</span>
                      <span className="value">{item.location_description}</span>
                    </div>
                  )}

                  {item.route && (
                    <div className="info-row">
                      <span className="label">🛣️ Route:</span>
                      <span className="value">{item.route}</span>
                      {item.milepost && <span className="milepost">MP {item.milepost}</span>}
                    </div>
                  )}

                  <div className="info-row">
                    <span className="label">🌐 Coordinates:</span>
                    <span className="value coords">
                      {item.latitude?.toFixed(6)}, {item.longitude?.toFixed(6)}
                    </span>
                  </div>

                  {item.sensor_type && (
                    <div className="info-row">
                      <span className="label">🔧 Sensor Type:</span>
                      <span className="value">{item.sensor_type}</span>
                    </div>
                  )}

                  {item.measurement_types && (
                    <div className="info-row">
                      <span className="label">📊 Measurements:</span>
                      <span className="value">
                        {JSON.parse(item.measurement_types).join(', ')}
                      </span>
                    </div>
                  )}

                  {item.notes && (
                    <div className="info-row notes">
                      <span className="label">📝 Notes:</span>
                      <span className="value">{item.notes}</span>
                    </div>
                  )}
                </div>

                <div className="card-footer">
                  <span className="state-badge">{item.state_key?.toUpperCase()}</span>
                  <span className="upload-info">
                    Uploaded: {item.uploaded_by || 'Unknown'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ITSEquipmentViewer;
