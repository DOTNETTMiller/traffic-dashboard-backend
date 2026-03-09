import { useState, useEffect } from 'react';
import { theme } from '../styles/theme';
import { config } from '../config';

/**
 * IPAWS Active Alerts Management
 *
 * Displays currently active IPAWS alerts and allows operators to:
 * - View active alerts
 * - Cancel alerts when hazard is cleared (SOP Section 8.6)
 * - Update alerts with new information
 * - View alert details and population impact
 */
export default function IPAWSActiveAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadActiveAlerts();
    // Refresh every 30 seconds
    const interval = setInterval(loadActiveAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadActiveAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiUrl}/api/ipaws/alerts/active`);
      const data = await response.json();

      if (data.success) {
        setAlerts(data.alerts || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load active alerts: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAlert = async (alertId) => {
    if (!cancelReason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }

    if (!confirm(`Cancel this IPAWS alert?\n\nReason: ${cancelReason}\n\nThis action will immediately stop the WEA from being sent to new users.`)) {
      return;
    }

    setCancelling(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/alerts/${alertId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason,
          user: { id: 'operator', name: 'TMC Operator' } // In production, use actual user
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Alert cancelled successfully!\n\nAlert ID: ${alertId}\nCancelled at: ${new Date(data.cancelledAt).toLocaleString()}`);
        setSelectedAlert(null);
        setCancelReason('');
        loadActiveAlerts(); // Refresh list
      } else {
        alert(`❌ Failed to cancel alert: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  if (loading && alerts.length === 0) {
    return (
      <div style={{
        padding: theme.spacing.lg,
        textAlign: 'center',
        color: theme.colors.text.secondary
      }}>
        Loading active alerts...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.error.light,
        borderRadius: '8px',
        color: theme.colors.error.main
      }}>
        ❌ {error}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div style={{
        padding: theme.spacing.xl,
        textAlign: 'center',
        backgroundColor: theme.colors.background.paper,
        borderRadius: '12px',
        border: `1px solid ${theme.colors.border.light}`
      }}>
        <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>✅</div>
        <div style={{
          fontSize: '18px',
          fontWeight: '700',
          color: theme.colors.text.primary,
          marginBottom: theme.spacing.sm
        }}>
          No Active Alerts
        </div>
        <div style={{
          fontSize: '14px',
          color: theme.colors.text.secondary
        }}>
          All IPAWS alerts have expired or been cancelled
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      border: `1px solid ${theme.colors.border.light}`,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: theme.spacing.lg,
        borderBottom: `2px solid ${theme.colors.border.light}`,
        backgroundColor: theme.colors.background.default,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '700',
            color: theme.colors.text.primary
          }}>
            🚨 Active IPAWS Alerts
          </h2>
          <div style={{
            fontSize: '13px',
            color: theme.colors.text.secondary,
            marginTop: '4px'
          }}>
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''} currently active
          </div>
        </div>
        <button
          onClick={loadActiveAlerts}
          style={{
            padding: '8px 16px',
            backgroundColor: theme.colors.primary.main,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Alerts List */}
      <div style={{ padding: theme.spacing.md }}>
        {alerts.map((alert) => (
          <div
            key={alert.alert_id}
            style={{
              padding: theme.spacing.md,
              marginBottom: theme.spacing.md,
              backgroundColor: theme.colors.background.paper,
              borderRadius: '8px',
              border: `2px solid ${theme.colors.warning.main}`
            }}
          >
            {/* Alert Header */}
            <div style={{
              display: 'flex',
              alignItems: 'start',
              justifyContent: 'space-between',
              marginBottom: theme.spacing.sm
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: theme.colors.text.primary,
                  marginBottom: '4px'
                }}>
                  {alert.corridor} {alert.direction} {alert.mile_marker_range && `• ${alert.mile_marker_range}`}
                </div>
                <div style={{
                  fontSize: '13px',
                  color: theme.colors.text.secondary
                }}>
                  {alert.location} • {alert.event_type}
                </div>
              </div>
              <div style={{
                padding: '4px 12px',
                backgroundColor: theme.colors.error.light,
                color: theme.colors.error.main,
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase'
              }}>
                ACTIVE
              </div>
            </div>

            {/* Alert Message */}
            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: theme.colors.background.default,
              borderRadius: '6px',
              marginBottom: theme.spacing.sm
            }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '600',
                color: theme.colors.text.primary,
                marginBottom: '4px'
              }}>
                {alert.headline_english}
              </div>
              <div style={{
                fontSize: '12px',
                color: theme.colors.text.secondary
              }}>
                {alert.instruction_english}
              </div>
            </div>

            {/* Alert Metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: theme.spacing.sm,
              marginBottom: theme.spacing.md
            }}>
              <div>
                <div style={{ fontSize: '10px', color: theme.colors.text.secondary }}>Population</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: theme.colors.text.primary }}>
                  {alert.estimated_population?.toLocaleString() || 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: theme.colors.text.secondary }}>Area</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: theme.colors.text.primary }}>
                  {alert.geofence_area_sq_miles?.toFixed(1) || 'N/A'} mi²
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: theme.colors.text.secondary }}>Duration</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: theme.colors.text.primary }}>
                  {alert.duration_minutes} min
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: theme.colors.text.secondary }}>Expires</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: theme.colors.text.primary }}>
                  {alert.expires_time ? new Date(alert.expires_time).toLocaleTimeString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Actions */}
            {selectedAlert === alert.alert_id ? (
              <div style={{
                padding: theme.spacing.md,
                backgroundColor: theme.colors.background.default,
                borderRadius: '6px'
              }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: theme.colors.text.primary,
                  marginBottom: theme.spacing.sm
                }}>
                  Cancel Alert - Provide Reason
                </div>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Roadway reopened, hazard cleared, traffic moving normally"
                  style={{
                    width: '100%',
                    padding: theme.spacing.sm,
                    borderRadius: '4px',
                    border: `1px solid ${theme.colors.border.light}`,
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    marginBottom: theme.spacing.sm,
                    minHeight: '60px'
                  }}
                />
                <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                  <button
                    onClick={() => handleCancelAlert(alert.alert_id)}
                    disabled={cancelling || !cancelReason.trim()}
                    style={{
                      flex: 1,
                      padding: '8px 16px',
                      backgroundColor: theme.colors.error.main,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: cancelling || !cancelReason.trim() ? 'not-allowed' : 'pointer',
                      opacity: cancelling || !cancelReason.trim() ? 0.5 : 1
                    }}
                  >
                    {cancelling ? '⏳ Cancelling...' : '✕ Confirm Cancellation'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAlert(null);
                      setCancelReason('');
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: theme.colors.background.paper,
                      color: theme.colors.text.primary,
                      border: `1px solid ${theme.colors.border.light}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                <button
                  onClick={() => setSelectedAlert(alert.alert_id)}
                  style={{
                    flex: 1,
                    padding: '8px 16px',
                    backgroundColor: theme.colors.error.main,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ✕ Cancel Alert
                </button>
                <button
                  onClick={() => alert('Update functionality coming soon')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: theme.colors.background.paper,
                    color: theme.colors.text.primary,
                    border: `1px solid ${theme.colors.border.light}`,
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  📝 Update
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
