import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';

export default function DetourAlerts({ authToken, onViewOnMap }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed by default

  useEffect(() => {
    if (authToken) {
      fetchAlerts();
      // Refresh alerts every 30 seconds
      const interval = setInterval(fetchAlerts, 30000);
      return () => clearInterval(interval);
    } else {
      setAlerts([]);
    }
  }, [authToken]);

  const fetchAlerts = async () => {
    if (!authToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/detour-alerts/active', {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (response.data.success) {
        setAlerts(response.data.alerts || []);
      } else {
        setError('Failed to load detour alerts');
      }
    } catch (err) {
      console.error('Error fetching detour alerts:', err);
      if (err.response?.status !== 403) {
        setError('Unable to load detour alerts: ' + (err.response?.data?.error || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewOnMap = (alert) => {
    if (onViewOnMap && alert.latitude && alert.longitude) {
      onViewOnMap({
        id: alert.id,
        latitude: alert.latitude,
        longitude: alert.longitude,
        description: alert.interchange_name,
        type: 'detour-alert',
        severity: alert.severity
      });
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return '#dc2626'; // red-600
      case 'medium':
      case 'moderate':
        return '#f59e0b'; // amber-500
      default:
        return '#3b82f6'; // blue-500
    }
  };

  const getSeverityBadge = (severity) => {
    const color = getSeverityColor(severity);
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '600',
          textTransform: 'uppercase',
          backgroundColor: `${color}20`,
          color: color,
          border: `1px solid ${color}40`
        }}
      >
        {severity || 'Medium'}
      </span>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!authToken) {
    return null;
  }

  if (loading && alerts.length === 0) {
    return (
      <div style={{
        background: theme.colors.glassDark,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '16px',
        padding: theme.spacing.lg,
        boxShadow: theme.shadows.xl,
        color: theme.colors.text,
        maxHeight: '500px',
        overflow: 'auto'
      }}>
        <div style={{ textAlign: 'center', padding: '20px', color: theme.colors.textSecondary }}>
          Loading detour alerts...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: theme.colors.glassDark,
      backdropFilter: 'blur(20px)',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '16px',
      padding: theme.spacing.lg,
      boxShadow: theme.shadows.xl,
      color: theme.colors.text,
      maxHeight: isExpanded ? '400px' : 'auto',
      overflow: isExpanded ? 'auto' : 'visible',
      transition: `all ${theme.transitions.medium}`
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
        paddingBottom: theme.spacing.sm,
        borderBottom: `1px solid ${theme.colors.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '700',
            background: theme.colors.gradients.primary,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Interstate Detour Alerts
          </h3>
          {alerts.length > 0 && (
            <span style={{
              background: theme.colors.accentBlue,
              color: 'white',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {alerts.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.colors.accentBlue,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: `all ${theme.transitions.fast}`,
            ':hover': {
              background: `${theme.colors.accentBlue}10`
            }
          }}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: theme.spacing.md,
          background: `${theme.colors.error}10`,
          borderRadius: '12px',
          color: theme.colors.error,
          fontSize: '14px',
          marginBottom: theme.spacing.md
        }}>
          {error}
        </div>
      )}

      {isExpanded && (
        <>
          {alerts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: theme.colors.textSecondary,
              fontSize: '14px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>✅</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>No Active Detour Alerts</div>
              <div style={{ fontSize: '13px' }}>All interstate interchanges are clear</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    background: theme.colors.glassLight,
                    borderRadius: '12px',
                    padding: theme.spacing.md,
                    border: `1px solid ${getSeverityColor(alert.severity)}40`,
                    transition: `all ${theme.transitions.fast}`,
                    cursor: 'pointer'
                  }}
                  onClick={() => handleViewOnMap(alert)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = theme.shadows.lg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Alert Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: theme.spacing.sm
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: '700',
                        fontSize: '15px',
                        color: theme.colors.text,
                        marginBottom: '4px'
                      }}>
                        {alert.interchange_name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary
                      }}>
                        {alert.event_corridor} • {formatDate(alert.created_at)}
                      </div>
                    </div>
                    {getSeverityBadge(alert.severity)}
                  </div>

                  {/* Event Description */}
                  <div style={{
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    marginBottom: theme.spacing.sm,
                    lineHeight: '1.5'
                  }}>
                    {alert.event_description || alert.event_location}
                  </div>

                  {/* Detour Message */}
                  <div style={{
                    background: `${getSeverityColor(alert.severity)}10`,
                    borderRadius: '8px',
                    padding: theme.spacing.sm,
                    fontSize: '13px',
                    lineHeight: '1.6',
                    borderLeft: `3px solid ${getSeverityColor(alert.severity)}`,
                    color: theme.colors.text
                  }}>
                    {alert.message}
                  </div>

                  {/* Lanes Affected (if available) */}
                  {alert.lanes_affected && (
                    <div style={{
                      marginTop: theme.spacing.sm,
                      fontSize: '12px',
                      color: theme.colors.textSecondary,
                      fontWeight: '600'
                    }}>
                      🚧 Lanes affected: {alert.lanes_affected}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
