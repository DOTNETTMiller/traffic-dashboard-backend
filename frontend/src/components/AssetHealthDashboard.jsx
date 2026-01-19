import { useState, useEffect } from 'react';
import api from '../services/api';

const AssetHealthDashboard = () => {
  const [assets, setAssets] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    fetchAssetData();
  }, []);

  const fetchAssetData = async () => {
    try {
      setLoading(true);
      const [assetsResp, predictionsResp, alertsResp] = await Promise.all([
        api.get('/assets/health'),
        api.get('/assets/predictive-maintenance'),
        api.get('/assets/critical-alerts')
      ]);

      if (assetsResp.data.success) setAssets(assetsResp.data.assets);
      if (predictionsResp.data.success) setPredictions(predictionsResp.data.predictions);
      if (alertsResp.data.success) setCriticalAlerts(alertsResp.data.alerts);
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

  const filteredAssets = assets.filter(asset => {
    if (filterType !== 'ALL' && asset.asset_type !== filterType) return false;
    if (filterStatus !== 'ALL' && asset.status !== filterStatus) return false;
    return true;
  });

  const assetTypes = ['ALL', 'CCTV', 'RSU', 'DMS', 'RWIS', 'DETECTOR'];
  const statusTypes = ['ALL', 'OPERATIONAL', 'DEGRADED', 'FAILED', 'MAINTENANCE', 'OFFLINE'];

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
          Phase 2.1 & 2.2: Real-time asset monitoring and AI-powered failure prediction
        </p>
      </div>

      {/* Critical Alerts Section */}
      {criticalAlerts.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            Critical Alerts ({criticalAlerts.length})
          </h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {criticalAlerts.map((alert, idx) => (
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
                    {alert.asset_name || alert.asset_id}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    {alert.corridor} • {alert.asset_type}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                    <span style={{
                      padding: '2px 8px',
                      background: getStatusColor(alert.status),
                      color: 'white',
                      borderRadius: '4px',
                      fontWeight: '600'
                    }}>
                      {alert.status}
                    </span>
                    {alert.failure_risk_level && (
                      <span style={{
                        padding: '2px 8px',
                        background: getRiskColor(alert.failure_risk_level),
                        color: 'white',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}>
                        {alert.failure_risk_level} RISK
                      </span>
                    )}
                    {alert.recommended_action && (
                      <span style={{
                        padding: '2px 8px',
                        background: '#dbeafe',
                        color: '#1e40af',
                        borderRadius: '4px',
                        fontWeight: '600'
                      }}>
                        {alert.recommended_action}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      padding: '8px 16px',
                      background: getAlertPriorityColor(alert.alert_priority),
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {alert.alert_priority}
                  </div>
                  {alert.failure_probability_30d !== undefined && (
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444', marginTop: '4px' }}>
                      {(alert.failure_probability_30d * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictive Maintenance Section */}
      {predictions.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            Predictive Maintenance Recommendations
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
            {predictions.slice(0, 6).map((pred, idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  border: `2px solid ${getRiskColor(pred.failure_risk_level)}`,
                  borderRadius: '12px',
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '32px' }}>
                    {getAssetIcon(pred.asset_type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827' }}>
                      {pred.asset_id}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {pred.asset_type}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '4px 12px',
                      background: getRiskColor(pred.failure_risk_level),
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 'bold'
                    }}
                  >
                    {pred.failure_risk_level}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ textAlign: 'center', padding: '8px', background: '#fef3c7', borderRadius: '6px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#92400e' }}>
                      {(pred.failure_probability_7d * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '10px', color: '#92400e' }}>7-day</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', background: '#fed7aa', borderRadius: '6px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#9a3412' }}>
                      {(pred.failure_probability_14d * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '10px', color: '#9a3412' }}>14-day</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', background: '#fecaca', borderRadius: '6px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#991b1b' }}>
                      {(pred.failure_probability_30d * 100).toFixed(0)}%
                    </div>
                    <div style={{ fontSize: '10px', color: '#991b1b' }}>30-day</div>
                  </div>
                </div>

                <div style={{ marginBottom: '12px', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Recommended Action
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}>
                    {pred.recommended_action}
                  </div>
                  {pred.recommended_action_by_date && (
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      By: {new Date(pred.recommended_action_by_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: '#6b7280', marginBottom: '2px' }}>Preventive Cost</div>
                    <div style={{ fontWeight: 'bold', color: '#10b981' }}>
                      ${pred.preventive_maintenance_cost.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#6b7280', marginBottom: '2px' }}>Emergency Cost</div>
                    <div style={{ fontWeight: 'bold', color: '#ef4444' }}>
                      ${pred.emergency_repair_cost.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>ROI: Preventive Maintenance</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>
                    {pred.roi_preventive_maintenance.toFixed(1)}x
                  </div>
                </div>
              </div>
            ))}
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
                    color: asset.uptime_percentage_30d >= 99 ? '#10b981' : asset.uptime_percentage_30d >= 95 ? '#f59e0b' : '#ef4444'
                  }}>
                    {asset.uptime_percentage_30d.toFixed(1)}%
                  </div>
                </div>
                {asset.performance_score !== undefined && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Performance</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
                      {asset.performance_score}/100
                    </div>
                  </div>
                )}
                {asset.next_maintenance_due && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Next Maintenance</div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: new Date(asset.next_maintenance_due) < new Date() ? '#ef4444' : '#111827'
                    }}>
                      {new Date(asset.next_maintenance_due).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {asset.estimated_remaining_life_years !== undefined && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Est. Remaining Life</div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: asset.estimated_remaining_life_years < 2 ? '#ef4444' : '#111827'
                    }}>
                      {asset.estimated_remaining_life_years.toFixed(1)} yrs
                    </div>
                  </div>
                )}
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
                  {selectedAsset.uptime_percentage_30d.toFixed(2)}%
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                Equipment Details
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Manufacturer</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                    {selectedAsset.manufacturer || 'N/A'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Model</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                    {selectedAsset.model || 'N/A'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Age</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                    {selectedAsset.age_years ? `${selectedAsset.age_years.toFixed(1)} years` : 'N/A'}
                  </span>
                </div>
                {selectedAsset.estimated_remaining_life_years !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                    <span style={{ fontSize: '14px', color: '#374151' }}>Est. Remaining Life</span>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: selectedAsset.estimated_remaining_life_years < 2 ? '#ef4444' : '#10b981'
                    }}>
                      {selectedAsset.estimated_remaining_life_years.toFixed(1)} years
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                Maintenance Schedule
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {selectedAsset.last_maintenance_date && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                    <span style={{ fontSize: '14px', color: '#374151' }}>Last Maintenance</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                      {new Date(selectedAsset.last_maintenance_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {selectedAsset.next_maintenance_due && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                    <span style={{ fontSize: '14px', color: '#374151' }}>Next Maintenance Due</span>
                    <span style={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: new Date(selectedAsset.next_maintenance_due) < new Date() ? '#ef4444' : '#10b981'
                    }}>
                      {new Date(selectedAsset.next_maintenance_due).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

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
          <strong>Phase 2.1 & 2.2 MVP:</strong> Real-time asset health monitoring with AI-powered predictive maintenance.
        </p>
        <p style={{ margin: '8px 0 0 0' }}>
          Failure prediction models estimate 7/14/30-day failure probabilities with cost-benefit analysis for preventive vs emergency maintenance.
        </p>
      </div>
    </div>
  );
};

export default AssetHealthDashboard;
