/**
 * WZDx (Work Zone Data Exchange) View Component
 *
 * Displays work zone data consumed from state DOT WZDx feeds
 * and provides WZDx v4.2 compliant export capabilities.
 */

import React, { useState, useEffect } from 'react';
import './WZDxView.css';

function WZDxView() {
  const [workZones, setWorkZones] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [feedSources, setFeedSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('zones'); // zones, sources, export, stats
  const [selectedState, setSelectedState] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('active');

  // Fetch statistics
  useEffect(() => {
    fetchStatistics();
    fetchFeedSources();
  }, []);

  // Fetch work zones when filters change
  useEffect(() => {
    fetchWorkZones();
  }, [selectedState, selectedStatus]);

  async function fetchStatistics() {
    try {
      const response = await fetch('/api/wzdx/statistics');
      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      console.error('Error fetching WZDx statistics:', err);
    }
  }

  async function fetchFeedSources() {
    try {
      const response = await fetch('/api/wzdx/sources');
      const data = await response.json();
      setFeedSources(data);
    } catch (err) {
      console.error('Error fetching feed sources:', err);
    }
  }

  async function fetchWorkZones() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedState !== 'all') params.append('state', selectedState);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      params.append('limit', '100');

      const response = await fetch(`/api/wzdx/feed?${params}`);
      const feed = await response.json();

      setWorkZones(feed.features || []);
    } catch (err) {
      setError('Failed to load work zones: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateAllFeeds() {
    try {
      const response = await fetch('/api/wzdx/update', { method: 'POST' });
      const result = await response.json();
      alert(result.message);

      // Refresh data after update
      setTimeout(() => {
        fetchStatistics();
        fetchWorkZones();
      }, 2000);
    } catch (err) {
      alert('Failed to update feeds: ' + err.message);
    }
  }

  async function updateFeedSource(sourceId) {
    try {
      const response = await fetch(`/api/wzdx/update/${sourceId}`, { method: 'POST' });
      const result = await response.json();
      alert(`Feed updated successfully!\n\nStats:\n- Processed: ${result.stats.processed}\n- Inserted: ${result.stats.inserted}\n- Updated: ${result.stats.updated}`);

      fetchStatistics();
      fetchFeedSources();
      fetchWorkZones();
    } catch (err) {
      alert('Failed to update feed: ' + err.message);
    }
  }

  function downloadWZDxFeed() {
    const params = new URLSearchParams();
    if (selectedState !== 'all') params.append('state', selectedState);
    if (selectedStatus !== 'all') params.append('status', selectedStatus);

    window.open(`/api/wzdx/feed?${params}`, '_blank');
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  return (
    <div className="wzdx-view">
      {/* Header */}
      <div className="wzdx-header">
        <div className="header-content">
          <h1>🚧 Work Zone Data Exchange (WZDx)</h1>
          <p>WZDx v4.2 - USDOT Standard for Work Zone Data Sharing</p>
        </div>
        <button className="update-btn" onClick={updateAllFeeds}>
          🔄 Update All Feeds
        </button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-icon">🚧</div>
            <div className="stat-content">
              <div className="stat-value">{statistics.total_work_zones}</div>
              <div className="stat-label">Total Work Zones</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📡</div>
            <div className="stat-content">
              <div className="stat-value">{statistics.feed_sources?.active || 0}</div>
              <div className="stat-label">Active Feed Sources</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🗺️</div>
            <div className="stat-content">
              <div className="stat-value">{statistics.by_state?.length || 0}</div>
              <div className="stat-label">States Covered</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-value">v4.2</div>
              <div className="stat-label">WZDx Version</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="wzdx-tabs">
        <button
          className={activeTab === 'zones' ? 'active' : ''}
          onClick={() => setActiveTab('zones')}
        >
          🚧 Work Zones
        </button>
        <button
          className={activeTab === 'sources' ? 'active' : ''}
          onClick={() => setActiveTab('sources')}
        >
          📡 Feed Sources
        </button>
        <button
          className={activeTab === 'stats' ? 'active' : ''}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
        <button
          className={activeTab === 'export' ? 'active' : ''}
          onClick={() => setActiveTab('export')}
        >
          💾 Export Feed
        </button>
      </div>

      {/* Work Zones Tab */}
      {activeTab === 'zones' && (
        <div className="tab-content">
          {/* Filters */}
          <div className="filters">
            <div className="filter-group">
              <label>State:</label>
              <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                <option value="all">All States</option>
                {statistics?.by_state?.map(s => (
                  <option key={s.state} value={s.state}>{s.state} ({s.count})</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Status:</label>
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="planned">Planned</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Work Zones List */}
          {loading ? (
            <div className="loading">Loading work zones...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : workZones.length === 0 ? (
            <div className="no-data">No work zones found. Try updating the feeds.</div>
          ) : (
            <div className="work-zones-list">
              {workZones.map((feature, idx) => {
                const props = feature.properties;
                const core = props.core_details || {};

                return (
                  <div key={idx} className="work-zone-card">
                    <div className="zone-header">
                      <h3>{core.road_names?.join(', ') || 'Unknown Road'}</h3>
                      <span className={`status-badge status-${props.event_status || 'unknown'}`}>
                        {props.event_status || 'Unknown'}
                      </span>
                    </div>

                    <div className="zone-details">
                      <div className="detail-row">
                        <strong>Direction:</strong> {core.direction || 'N/A'}
                      </div>
                      <div className="detail-row">
                        <strong>Type:</strong> {core.event_type || 'N/A'}
                      </div>
                      <div className="detail-row">
                        <strong>Impact:</strong> {props.vehicle_impact || 'N/A'}
                      </div>
                      <div className="detail-row">
                        <strong>Start:</strong> {formatDate(props.start_date)}
                      </div>
                      <div className="detail-row">
                        <strong>End:</strong> {formatDate(props.end_date)}
                      </div>
                      {core.description && (
                        <div className="detail-row description">
                          <strong>Description:</strong> {core.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Feed Sources Tab */}
      {activeTab === 'sources' && (
        <div className="tab-content">
          <div className="sources-list">
            {feedSources.map(source => (
              <div key={source.id} className="source-card">
                <div className="source-header">
                  <h3>{source.organization_name}</h3>
                  <div className="source-badges">
                    <span className={`badge ${source.active ? 'active' : 'inactive'}`}>
                      {source.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="badge state">{source.state_code}</span>
                  </div>
                </div>

                <div className="source-details">
                  <div className="detail-row">
                    <strong>Feed URL:</strong>
                    <a href={source.feed_url} target="_blank" rel="noopener noreferrer">
                      {source.feed_url}
                    </a>
                  </div>
                  <div className="detail-row">
                    <strong>Last Fetch:</strong> {formatDate(source.last_successful_fetch)}
                  </div>
                  <div className="detail-row">
                    <strong>Status:</strong> {source.last_fetch_status || 'Never fetched'}
                  </div>
                  {source.total_features_last_fetch > 0 && (
                    <div className="detail-row">
                      <strong>Last Import:</strong> {source.total_features_last_fetch} features
                      ({source.valid_features_last_fetch} valid)
                    </div>
                  )}
                </div>

                <div className="source-actions">
                  <button onClick={() => updateFeedSource(source.id)}>
                    🔄 Update Feed
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && statistics && (
        <div className="tab-content">
          <div className="stats-section">
            <h3>Work Zones by State</h3>
            <div className="stats-table">
              <table>
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.by_state?.map(s => (
                    <tr key={s.state}>
                      <td>{s.state}</td>
                      <td>{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="stats-section">
            <h3>Work Zones by Status</h3>
            <div className="stats-table">
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.by_status?.map(s => (
                    <tr key={s.status}>
                      <td>{s.status}</td>
                      <td>{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="stats-section">
            <h3>Recent Imports</h3>
            <div className="stats-table">
              <table>
                <thead>
                  <tr>
                    <th>Feed</th>
                    <th>State</th>
                    <th>Timestamp</th>
                    <th>Status</th>
                    <th>Features</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.recent_imports?.map((imp, idx) => (
                    <tr key={idx}>
                      <td>{imp.feed_name}</td>
                      <td>{imp.state_code}</td>
                      <td>{formatDate(imp.import_timestamp)}</td>
                      <td>{imp.status}</td>
                      <td>{imp.features_processed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="tab-content">
          <div className="export-section">
            <h3>Export WZDx v4.2 Feed</h3>
            <p>
              Download work zone data in WZDx v4.2 compliant GeoJSON format.
              This feed can be consumed by other systems that support the WZDx standard.
            </p>

            <div className="export-options">
              <div className="filter-group">
                <label>Filter by State:</label>
                <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                  <option value="all">All States</option>
                  {statistics?.by_state?.map(s => (
                    <option key={s.state} value={s.state}>{s.state}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Filter by Status:</label>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                </select>
              </div>
            </div>

            <button className="export-btn" onClick={downloadWZDxFeed}>
              💾 Download WZDx Feed (GeoJSON)
            </button>

            <div className="feed-info">
              <h4>Feed Information</h4>
              <ul>
                <li><strong>Format:</strong> GeoJSON FeatureCollection</li>
                <li><strong>WZDx Version:</strong> 4.2</li>
                <li><strong>Publisher:</strong> DOT Corridor Communicator</li>
                <li><strong>License:</strong> CC0 1.0 Universal</li>
                <li><strong>Update Frequency:</strong> 5 minutes (300 seconds)</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WZDxView;
