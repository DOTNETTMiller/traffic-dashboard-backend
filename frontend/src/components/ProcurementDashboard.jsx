import { useState, useEffect } from 'react';
import api from '../services/api';

const ProcurementDashboard = () => {
  const [contracts, setContracts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [costAnalysis, setCostAnalysis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);

  useEffect(() => {
    fetchProcurementData();
  }, []);

  const fetchProcurementData = async () => {
    try {
      setLoading(true);
      const [contractsResp, alertsResp, costResp] = await Promise.all([
        api.get('/procurement/contracts'),
        api.get('/procurement/expiration-alerts'),
        api.get('/procurement/cost-analysis')
      ]);

      if (contractsResp.data.success) setContracts(contractsResp.data.contracts);
      if (alertsResp.data.success) setAlerts(alertsResp.data.alerts);
      if (costResp.data.success) setCostAnalysis(costResp.data.analysis);
    } catch (err) {
      console.error('Error fetching procurement data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAlertColor = (level) => {
    const colors = {
      'URGENT': '#ef4444',
      'WARNING': '#f59e0b',
      'NOTICE': '#3b82f6',
      'OK': '#10b981'
    };
    return colors[level] || '#6b7280';
  };

  const getPerformanceColor = (rating) => {
    const colors = {
      'EXCELLENT': '#10b981',
      'GOOD': '#3b82f6',
      'FAIR': '#f59e0b',
      'POOR': '#ef4444'
    };
    return colors[rating] || '#6b7280';
  };

  const formatCurrency = (value) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontSize: '16px', color: '#6b7280' }}>
      Loading procurement data...
    </div>;
  }

  if (error) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
      Error: {error}
    </div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: 'bold', color: '#111827' }}>
          Procurement Transparency Dashboard
        </h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
          Phase 1.3: Vendor contract management, SLA tracking, and cost-benefit analysis
        </p>
      </div>

      {/* Contract Expiration Alerts */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            Contract Expiration Alerts
          </h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  border: `2px solid ${getAlertColor(alert.alert_level)}`,
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                    {alert.vendor_name} - {alert.data_type}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>
                    {alert.state_key} • {alert.contract_type}
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginLeft: '20px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: getAlertColor(alert.alert_level) }}>
                    {alert.days_until_expiration}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>days remaining</div>
                </div>
                <div style={{ marginLeft: '20px' }}>
                  <div
                    style={{
                      padding: '8px 16px',
                      background: getAlertColor(alert.alert_level),
                      color: 'white',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {alert.alert_level}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', textAlign: 'center' }}>
                    Expires: {new Date(alert.contract_end_date).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost-Benefit Analysis Summary */}
      {costAnalysis.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
            Cost Efficiency Analysis
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {costAnalysis.map((analysis, idx) => (
              <div
                key={idx}
                style={{
                  background: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '20px'
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>
                  {analysis.state_key}
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Cost per Event</span>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>
                      {formatCurrency(analysis.cost_per_event)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Peer State Avg</span>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: '#6b7280' }}>
                      {formatCurrency(analysis.peer_state_avg_cost_per_event)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280' }}>Savings vs Peers</span>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: analysis.savings_vs_peer_avg > 0 ? '#10b981' : '#ef4444'
                    }}>
                      {analysis.savings_vs_peer_avg > 0 ? '+' : ''}{formatCurrency(analysis.savings_vs_peer_avg)}
                    </span>
                  </div>

                  <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Efficiency Percentile</span>
                      <span style={{ fontSize: '20px', fontWeight: 'bold', color: analysis.cost_efficiency_percentile >= 75 ? '#10b981' : '#f59e0b' }}>
                        {analysis.cost_efficiency_percentile}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Benefit-Cost Ratio</span>
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: analysis.benefit_cost_ratio >= 2.0 ? '#10b981' : '#6b7280' }}>
                        {analysis.benefit_cost_ratio.toFixed(2)}:1
                      </span>
                    </div>
                  </div>

                  {analysis.renewal_recommended !== undefined && (
                    <div style={{
                      padding: '8px',
                      background: analysis.renewal_recommended ? '#dcfce7' : '#fee2e2',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textAlign: 'center',
                      color: analysis.renewal_recommended ? '#166534' : '#991b1b'
                    }}>
                      {analysis.renewal_recommended ? '✓ Renewal Recommended' : '⚠ Review Alternatives'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Contracts */}
      <div>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
          Active Vendor Contracts ({contracts.length})
        </h2>
        <div style={{ display: 'grid', gap: '16px' }}>
          {contracts.map((contract, idx) => (
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
              onClick={() => setSelectedContract(contract)}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
                    {contract.vendor_name}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#6b7280', marginBottom: '8px' }}>
                    <span>{contract.state_key}</span>
                    <span>•</span>
                    <span>{contract.contract_type}</span>
                    <span>•</span>
                    <span>{contract.data_type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                    {contract.status === 'ACTIVE' && (
                      <span style={{ padding: '2px 8px', background: '#dcfce7', color: '#166534', borderRadius: '4px', fontWeight: '600' }}>
                        {contract.status}
                      </span>
                    )}
                    {contract.renewal_option_available && (
                      <span style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontWeight: '600' }}>
                        Renewable
                      </span>
                    )}
                    {contract.auto_renew && (
                      <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '4px', fontWeight: '600' }}>
                        Auto-Renew
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '20px' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827' }}>
                    {formatCurrency(contract.contract_value_annual)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Annual Value</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Cost per Event</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                    {formatCurrency(contract.cost_per_event)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>SLA Uptime Target</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                    {contract.sla_uptime_target}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Data Freshness SLA</div>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827' }}>
                    {contract.sla_data_freshness_minutes} min
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Performance Rating</div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: getPerformanceColor(contract.performance_rating)
                  }}>
                    {contract.performance_rating}
                  </div>
                </div>
              </div>

              <div style={{ paddingTop: '12px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280' }}>
                <div>
                  <strong>Contract Period:</strong> {new Date(contract.contract_start_date).toLocaleDateString()} - {new Date(contract.contract_end_date).toLocaleDateString()}
                </div>
                <div>
                  <strong>SLA Compliance:</strong> <span style={{ color: contract.sla_compliance >= 95 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                    {contract.sla_compliance}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Detail Modal */}
      {selectedContract && (
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
          onClick={() => setSelectedContract(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
              Contract Details
            </h2>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                {selectedContract.vendor_name}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                {selectedContract.state_key} • {selectedContract.contract_type} • {selectedContract.data_type}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Annual Contract Value</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                  {formatCurrency(selectedContract.contract_value_annual)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Contract Value</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827' }}>
                  {formatCurrency(selectedContract.contract_value_total)}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                Performance Requirements (SLA)
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Uptime Target</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                    {selectedContract.sla_uptime_target}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Data Freshness</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                    {selectedContract.sla_data_freshness_minutes} minutes
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Completeness Target</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827' }}>
                    {selectedContract.sla_completeness_target}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: '#f9fafb', borderRadius: '6px' }}>
                  <span style={{ fontSize: '14px', color: '#374151' }}>Current Compliance</span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: selectedContract.sla_compliance >= 95 ? '#10b981' : '#ef4444'
                  }}>
                    {selectedContract.sla_compliance}%
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
                Procurement Details
              </div>
              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.6' }}>
                <div><strong>Method:</strong> {selectedContract.procurement_method}</div>
                <div><strong>Award Date:</strong> {new Date(selectedContract.award_date).toLocaleDateString()}</div>
                <div><strong>Payment Structure:</strong> {selectedContract.payment_structure}</div>
                {selectedContract.original_rfp_number && (
                  <div><strong>RFP Number:</strong> {selectedContract.original_rfp_number}</div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedContract(null)}
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
          <strong>Phase 1.3 MVP:</strong> Procurement transparency with contract tracking, SLA compliance monitoring, and cost-benefit analysis.
        </p>
        <p style={{ margin: '8px 0 0 0' }}>
          Automated budget justifications and peer state cost comparisons ready for deployment.
        </p>
      </div>
    </div>
  );
};

export default ProcurementDashboard;
