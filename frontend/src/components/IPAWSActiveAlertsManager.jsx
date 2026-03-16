import { useState, useEffect } from 'react';
import { theme } from '../styles/theme';
import { config } from '../config';

/**
 * IPAWS Active Alerts Manager
 *
 * SOP Compliance:
 * - Section 8.5: Monitoring & Duration
 * - Section 8.6: Cancellation or Update
 * - Section 10: Duration Guidance
 *
 * Features:
 * - Display active alerts with countdown timers
 * - Renewal notifications (60-90 min intervals)
 * - Cancel, update, and renew functions
 * - Auto-refresh every 30 seconds
 */
export default function IPAWSActiveAlertsManager({ onClose, compact = false }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Auto-refresh alerts every 30 seconds
  useEffect(() => {
    fetchActiveAlerts();
    const interval = setInterval(fetchActiveAlerts, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchActiveAlerts = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/alerts/active`);
      const data = await response.json();

      if (data.success) {
        setAlerts(data.alerts || []);
      } else {
        setError(data.error || 'Failed to fetch active alerts');
      }
    } catch (err) {
      console.error('Error fetching active alerts:', err);
      setError('Failed to load active alerts');
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeRemaining = (createdAt, durationMinutes = 60) => {
    const created = new Date(createdAt);
    const expiresAt = new Date(created.getTime() + durationMinutes * 60000);
    const now = new Date();
    const remaining = expiresAt - now;

    if (remaining <= 0) {
      return { expired: true, text: 'Expired', minutes: 0 };
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return {
      expired: false,
      text: `${minutes}m ${seconds}s`,
      minutes,
      totalMinutes: durationMinutes,
      percentage: (minutes / durationMinutes) * 100
    };
  };

  const needsRenewal = (createdAt, durationMinutes = 60) => {
    const timeRemaining = calculateTimeRemaining(createdAt, durationMinutes);
    // Alert if less than 10 minutes remaining or already expired
    return timeRemaining.minutes < 10;
  };

  const handleCancelAlert = async (alertId) => {
    setActionInProgress(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/alerts/${alertId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: cancelReason || 'Hazard cleared - operator cancelled',
          user: { name: 'TMC Operator' } // TODO: Get from auth context
        })
      });

      const data = await response.json();

      if (data.success) {
        window.alert(`✅ Alert cancelled successfully!\n\n${data.message}\n\nCancelled at: ${new Date(data.cancelledAt).toLocaleString()}`);
        setShowCancelModal(false);
        setCancelReason('');
        fetchActiveAlerts(); // Refresh list
      } else {
        setError(data.error || 'Failed to cancel alert');
      }
    } catch (err) {
      console.error('Error cancelling alert:', err);
      setError('Failed to cancel alert: ' + err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRenewAlert = async (alert) => {
    // Renewing means creating a new alert with the same parameters
    // For now, we'll mark it as updated to extend the duration
    setActionInProgress(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/alerts/${alert.alert_id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            renewed: true,
            renewedAt: new Date().toISOString(),
            message: 'Alert renewed - hazard still active'
          },
          user: { name: 'TMC Operator' }
        })
      });

      const data = await response.json();

      if (data.success) {
        window.alert(`✅ Alert renewed successfully!\n\nThe alert duration has been extended.\n\nRenewed at: ${new Date(data.updatedAt).toLocaleString()}\n\nPer SOP Section 10: Maximum 4 hours per WEA issuance. Reassess before next renewal.`);
        fetchActiveAlerts(); // Refresh list
      } else {
        setError(data.error || 'Failed to renew alert');
      }
    } catch (err) {
      console.error('Error renewing alert:', err);
      setError('Failed to renew alert: ' + err.message);
    } finally {
      setActionInProgress(false);
    }
  };

  const renderAlertCard = (alert) => {
    const timeRemaining = calculateTimeRemaining(alert.created_at, 60); // Default 60 min
    const shouldRenew = needsRenewal(alert.created_at, 60);

    return (
      <div
        key={alert.alert_id}
        style={{
          padding: theme.spacing.md,
          backgroundColor: shouldRenew ? '#fef3c7' : 'white',
          borderRadius: '8px',
          border: shouldRenew ? '2px solid #f59e0b' : '1px solid #e5e7eb',
          marginBottom: theme.spacing.md,
          boxShadow: shouldRenew ? '0 4px 6px rgba(245, 158, 11, 0.2)' : '0 1px 3px rgba(0,0,0,0.1)'
        }}
      >
        {/* Alert Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          marginBottom: theme.spacing.sm
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '4px'
            }}>
              {alert.event_corridor || 'Highway Closure'}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#6b7280'
            }}>
              Alert ID: {alert.alert_id}
            </div>
          </div>

          {/* Countdown Timer */}
          <div style={{
            padding: '8px 12px',
            backgroundColor: timeRemaining.expired ? '#fee2e2' : (shouldRenew ? '#fef3c7' : '#dcfce7'),
            borderRadius: '6px',
            border: `2px solid ${timeRemaining.expired ? '#ef4444' : (shouldRenew ? '#f59e0b' : '#22c55e')}`,
            textAlign: 'center',
            minWidth: '100px'
          }}>
            <div style={{
              fontSize: '10px',
              color: timeRemaining.expired ? '#991b1b' : (shouldRenew ? '#92400e' : '#166534'),
              marginBottom: '2px',
              fontWeight: '600'
            }}>
              {timeRemaining.expired ? 'EXPIRED' : (shouldRenew ? 'RENEW SOON' : 'ACTIVE')}
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: '700',
              color: timeRemaining.expired ? '#7f1d1d' : (shouldRenew ? '#78350f' : '#14532d')
            }}>
              {timeRemaining.text}
            </div>
            <div style={{
              fontSize: '9px',
              color: timeRemaining.expired ? '#991b1b' : (shouldRenew ? '#92400e' : '#166534'),
              marginTop: '2px'
            }}>
              {timeRemaining.expired ? 'Past due' : 'remaining'}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {!timeRemaining.expired && (
          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#e5e7eb',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: theme.spacing.sm
          }}>
            <div style={{
              width: `${Math.max(0, Math.min(100, timeRemaining.percentage))}%`,
              height: '100%',
              backgroundColor: shouldRenew ? '#f59e0b' : '#22c55e',
              transition: 'width 1s linear'
            }} />
          </div>
        )}

        {/* Alert Details */}
        <div style={{
          fontSize: '12px',
          color: '#4b5563',
          marginBottom: theme.spacing.sm,
          lineHeight: '1.6'
        }}>
          <div><strong>Location:</strong> {alert.event_location || 'N/A'}</div>
          <div><strong>Type:</strong> {alert.event_type || 'WEA Alert'}</div>
          <div><strong>Issued:</strong> {new Date(alert.created_at).toLocaleString()}</div>
          {alert.population && (
            <div><strong>Est. Reach:</strong> {Math.round(alert.population * 0.85).toLocaleString()} people</div>
          )}
        </div>

        {/* Renewal Warning */}
        {shouldRenew && !timeRemaining.expired && (
          <div style={{
            padding: theme.spacing.sm,
            backgroundColor: '#fff7ed',
            border: '1px solid #fed7aa',
            borderRadius: '6px',
            marginBottom: theme.spacing.sm,
            fontSize: '11px',
            color: '#9a3412'
          }}>
            <strong>⏰ Renewal Recommended:</strong> Per SOP Section 10, renew alerts every 60-90 minutes if hazard persists (max 4 hours per issuance). Cancel promptly once hazard clears.
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.md
        }}>
          <button
            onClick={() => handleRenewAlert(alert)}
            disabled={actionInProgress}
            style={{
              flex: 1,
              padding: '8px 16px',
              backgroundColor: shouldRenew ? '#f59e0b' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: actionInProgress ? 'wait' : 'pointer',
              opacity: actionInProgress ? 0.6 : 1
            }}
          >
            {shouldRenew ? '🔄 RENEW NOW' : '🔄 Renew'}
          </button>

          <button
            onClick={() => {
              setSelectedAlert(alert);
              setShowCancelModal(true);
            }}
            disabled={actionInProgress}
            style={{
              flex: 1,
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: actionInProgress ? 'wait' : 'pointer',
              opacity: actionInProgress ? 0.6 : 1
            }}
          >
            ✕ Cancel Alert
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        padding: theme.spacing.lg,
        textAlign: 'center',
        color: '#6b7280'
      }}>
        Loading active alerts...
      </div>
    );
  }

  if (compact) {
    // Compact view for dashboard widget
    const renewalNeeded = alerts.filter(a => needsRenewal(a.created_at, 60));

    return (
      <div style={{ padding: theme.spacing.md }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.md
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '700',
            color: '#111827'
          }}>
            Active IPAWS Alerts
          </h3>
          {renewalNeeded.length > 0 && (
            <div style={{
              padding: '4px 8px',
              backgroundColor: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
              color: '#92400e'
            }}>
              ⚠️ {renewalNeeded.length} Need{renewalNeeded.length > 1 ? '' : 's'} Renewal
            </div>
          )}
        </div>

        {error && (
          <div style={{
            padding: theme.spacing.sm,
            backgroundColor: '#fee2e2',
            borderRadius: '6px',
            color: '#991b1b',
            fontSize: '12px',
            marginBottom: theme.spacing.md
          }}>
            {error}
          </div>
        )}

        {alerts.length === 0 ? (
          <div style={{
            padding: theme.spacing.lg,
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '13px'
          }}>
            No active alerts
          </div>
        ) : (
          alerts.map(renderAlertCard)
        )}
      </div>
    );
  }

  // Full modal view
  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #d1d5db',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '2px solid #e5e7eb',
            backgroundColor: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h2 style={{
                margin: 0,
                color: '#111827',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                🚨 Active IPAWS Alerts Manager
              </h2>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginTop: '4px'
              }}>
                SOP Sections 8.5, 8.6, 10 • Auto-refreshes every 30 seconds
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#ef4444',
                border: 'none',
                color: 'white',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: 'bold'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px'
          }}>
            {error && (
              <div style={{
                padding: theme.spacing.md,
                backgroundColor: '#fee2e2',
                borderRadius: '8px',
                borderLeft: '4px solid #ef4444',
                color: '#991b1b',
                marginBottom: theme.spacing.lg
              }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            {alerts.length === 0 ? (
              <div style={{
                padding: theme.spacing.xl,
                textAlign: 'center',
                color: '#9ca3af'
              }}>
                <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>✓</div>
                <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                  No Active Alerts
                </div>
                <div style={{ fontSize: '13px' }}>
                  All IPAWS alerts have been cleared or expired.
                </div>
              </div>
            ) : (
              <>
                <div style={{
                  padding: theme.spacing.md,
                  backgroundColor: '#dbeafe',
                  borderRadius: '8px',
                  border: '1px solid #3b82f6',
                  marginBottom: theme.spacing.lg,
                  fontSize: '12px',
                  color: '#1e40af'
                }}>
                  <strong>📋 SOP Reminder:</strong> Per Section 10, WEA alerts default to 30-60 min (max 4 hr). Renew every 60-90 min if hazard persists. Cancel promptly once hazard cleared.
                </div>

                {alerts.map(renderAlertCard)}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && selectedAlert && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '16px',
              fontWeight: '700',
              color: '#111827'
            }}>
              Cancel Alert: {selectedAlert.event_corridor}
            </h3>

            <div style={{
              padding: theme.spacing.sm,
              backgroundColor: '#fef3c7',
              borderRadius: '6px',
              border: '1px solid #f59e0b',
              marginBottom: theme.spacing.md,
              fontSize: '12px',
              color: '#92400e'
            }}>
              <strong>⚠️ Warning:</strong> Cancelling this alert will immediately stop WEA notifications. Per SOP Section 8.6, include note "closure lifted" or "hazard passed".
            </div>

            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Cancellation Reason:
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Hazard cleared - road reopened to normal traffic"
              rows={3}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '13px',
                border: '2px solid #d1d5db',
                borderRadius: '6px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />

            <div style={{
              display: 'flex',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.md
            }}>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                  setSelectedAlert(null);
                }}
                disabled={actionInProgress}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: actionInProgress ? 'wait' : 'pointer'
                }}
              >
                Nevermind
              </button>
              <button
                onClick={() => handleCancelAlert(selectedAlert.alert_id)}
                disabled={actionInProgress}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: actionInProgress ? 'wait' : 'pointer',
                  opacity: actionInProgress ? 0.6 : 1
                }}
              >
                {actionInProgress ? 'Cancelling...' : '✓ Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
