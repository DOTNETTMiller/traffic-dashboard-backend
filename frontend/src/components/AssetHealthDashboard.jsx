import { useState, useEffect } from 'react';
import api from '../services/api';

const AssetHealthDashboard = ({ stateKey = 'OH' }) => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    fetchAssetData();
  }, [stateKey]);

  const fetchAssetData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/asset-health/dashboard/${stateKey}`);

      if (response.data.success) {
        setDashboard(response.data);
      }
    } catch (err) {
      console.error('Error fetching asset data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'OPERATIONAL': '#10b981',
      'DEGRADED': '#f59e0b',
      'FAILED': '#ef4444',
      'MAINTENANCE': '#3b82f6',
      'OFFLINE': '#6b7280',
      'UNKNOWN': '#9ca3af'
    };
    return colors[status] || '#6b7280';
  };

  const getRiskColor = (level) => {
    const colors = {
      'CRITICAL': '#ef4444',
      'HIGH': '#f59e0b',
      'MODERATE': '#fbbf24',
      'LOW': '#10b981'
    };
    return colors[level] || '#6b7280';
  };

  const getAlertPriorityColor = (priority) => {
    const colors = {
      'IMMEDIATE': '#dc2626',
      'URGENT': '#ef4444',
      'HIGH': '#f59e0b',
      'OVERDUE': '#f97316',
      'NORMAL': '#10b981'
    };
    return colors[priority] || '#6b7280';
  };

  const getAssetIcon = (type) => {
    const icons = {
      'CCTV': '📹',
      'RSU': '📡',
      'DMS': '🚦',
      'RWIS': '🌡️',
      'DETECTOR': '🔍',
      'BEACON': '💡'
    };
    return icons[type] || '🔧';
  };

  const assets = dashboard?.assets || [];
  const alerts = dashboard?.alerts || [];
  const maintenanceDue = dashboard?.maintenance_due || [];
  const summary = dashboard?.summary || {};
  const byType = dashboard?.by_type || {};

  const filteredAssets = assets.filter(asset => {
    if (filterType !== 'ALL' && asset.asset_type !== filterType) return false;
    if (filterStatus !== 'ALL' && asset.status !== filterStatus) return false;
    return true;
  });

  const assetTypes = ['ALL', 'CCTV', 'RSU', 'DMS', 'RWIS', 'DETECTOR'];
  const statusTypes = ['ALL', 'OPERATIONAL', 'DEGRADED', 'FAILED', 'MAINTENANCE'];

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontSize: '16px', color: '#6b7280' }}>
      Loading asset health data...
    </div>;
  }

  if (error) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
      Error: {error}
    </div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
          Asset Health & Predictive Maintenance
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Phase 2.1: Real-time asset monitoring for {stateKey}
        </p>
      </div>

      {/* Summary Statistics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Total Assets</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#111827' }}>{summary.total_assets || 0}</div>
        </div>
        <div style={{ background: 'white', border: '2px solid #10b981', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Operational</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#10b981' }}>{summary.operational || 0}</div>
        </div>
        <div style={{ background: 'white', border: '2px solid #f59e0b', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Degraded</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#f59e0b' }}>{summary.degraded || 0}</div>
        </div>
        <div style={{ background: 'white', border: '2px solid #ef4444', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Failed</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#ef4444' }}>{summary.failed || 0}</div>
        </div>
        <div style={{ background: 'white', border: '2px solid #8b5cf6', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>Health Score</div>
          <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#8b5cf6' }}>{summary.overall_health_score || 0}</div>
        </div>
      </div>

      {/* Asset Type Breakdown */}
      {Object.keys(byType).length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            Asset Types
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {Object.entries(byType).map(([type, data]) => (
              <div key={type} style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '32px' }}>{getAssetIcon(type)}</div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>{type}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{data.total} total</div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Health Score</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
                  {data.health_score.toFixed(1)}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', fontSize: '11px' }}>
                  <span style={{ color: '#10b981' }}>✓ {data.operational}</span>
                  <span style={{ color: '#f59e0b' }}>⚠ {data.degraded}</span>
                  <span style={{ color: '#ef4444' }}>✗ {data.failed}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Alerts Section */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            Recent Alerts (Last 7 Days)
          </h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  border: `3px solid ${getAlertPriorityColor(alert.alert_priority)}`,
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}
              >
                <div style={{ fontSize: '32px' }}>
                  {getAssetIcon(alert.asset_type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                    {alert.asset_id}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    {alert.corridor} • {alert.asset_type}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: getAlertPriorityColor(alert.alert_type),
                      color: 'white',
                      borderRadius: '4px',
                      fontWeight: '600'
                    }}>
                      {alert.alert_type}
                    </span>
                    {alert.performance_metric !== undefined && (
                      <span style={{
                        padding: '2px 8px',
                        background: '#f3f4f6',
                        color: '#374151',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}>
                        Metric: {alert.performance_metric.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {new Date(alert.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Maintenance Section */}
      {maintenanceDue.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            Upcoming Maintenance (Next 30 Days)
          </h2>
          <div style={{ background: 'white', border: '2px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Asset</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Corridor</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Scheduled</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Days Until Due</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Priority</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Maintenance Type</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceDue.map((maint, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', fontSize: '14px', color: '#111827' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>{getAssetIcon(maint.asset_type)}</span>
                        {maint.asset_id}
                      </div>
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280' }}>{maint.asset_type}</td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280' }}>{maint.corridor}</td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#111827' }}>
                      {new Date(maint.scheduled_date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', color: maint.days_until_due < 7 ? '#ef4444' : '#111827' }}>
                      {maint.days_until_due} days
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '4px 8px',
                        background: maint.priority === 'CRITICAL' ? '#ef4444' : maint.priority === 'HIGH' ? '#f59e0b' : '#10b981',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {maint.priority}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#6b7280' }}>{maint.maintenance_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Asset Health Grid */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            All Assets ({filteredAssets.length})
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '2px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {assetTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'ALL' ? 'All Types' : type}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '2px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {statusTypes.map(status => (
                <option key={status} value={status}>
                  {status === 'ALL' ? 'All Status' : status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          {filteredAssets.map((asset, idx) => (
            <div
              key={idx}
              style={{
                background: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'box-shadow 0.2s'
              }}
              onClick={() => setSelectedAsset(asset)}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div style={{ fontSize: '40px' }}>
                    {getAssetIcon(asset.asset_type)}
                  </div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                      {asset.asset_name || asset.asset_id}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '13px', color: '#6b7280' }}>
                      <span>{asset.asset_type}</span>
                      <span>•</span>
                      <span>{asset.corridor || asset.state_key}</span>
                      {asset.manufacturer && (
                        <>
                          <span>•</span>
                          <span>{asset.manufacturer}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      padding: '8px 16px',
                      background: getStatusColor(asset.status),
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginBottom: '8px'
                    }}
                  >
                    {asset.status}
                  </div>
                  {asset.age_years !== undefined && (
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      Age: {asset.age_years.toFixed(1)} years
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>30-Day Uptime</div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: (asset.uptime_30d || 0) >= 99 ? '#10b981' : (asset.uptime_30d || 0) >= 95 ? '#f59e0b' : '#ef4444'
                  }}>
                    {(asset.uptime_30d || 0).toFixed(1)}%
                  </div>
                </div>
              </div>

              {asset.last_online && (
                <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb', fontSize: '12px', color: '#6b7280' }}>
                  Last Online: {new Date(asset.last_online).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setSelectedAsset(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
              Asset Details
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '48px' }}>
                {getAssetIcon(selectedAsset.asset_type)}
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                  {selectedAsset.asset_name || selectedAsset.asset_id}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {selectedAsset.asset_type} • {selectedAsset.corridor || selectedAsset.state_key}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Status</div>
                <div style={{
                  display: 'inline-block',
                  padding: '6px 12px',
                  background: getStatusColor(selectedAsset.status),
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}>
                  {selectedAsset.status}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Uptime (30 days)</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                  {(selectedAsset.uptime_30d || 0).toFixed(2)}%
                </div>
              </div>
            </div>

            {selectedAsset.last_online && (
              <div style={{ marginBottom: '20px', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Last Online</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                  {new Date(selectedAsset.last_online).toLocaleString()}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedAsset(null)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: '32px',
        padding: '20px',
        background: '#f9fafb',
        borderRadius: '8px',
        textAlign: 'center',
        fontSize: '13px',
        color: '#6b7280'
      }}>
        <p style={{ margin: 0 }}>
          <strong>Phase 2.1:</strong> Real-time asset health monitoring for ITS equipment (CCTV, RSU, DMS, RWIS, Detectors).
        </p>
        <p style={{ margin: '8px 0 0 0' }}>
          Tracks uptime, performance metrics, alerts, and maintenance schedules. Predictive maintenance AI coming in Phase 2.2.
        </p>
      </div>
    </div>
  );
};

export default AssetHealthDashboard;
