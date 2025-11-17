import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';

export default function DetourAlerts({ authToken, onViewOnMap }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded by default

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
      backgroundColor: 'white',
      borderRadius: '8px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      marginBottom: '24px',
      transition: `all ${theme.transitions.medium}`
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            🚗 Interstate Detour Alerts
          </h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            {alerts.length === 0 ? 'No active detour alerts' : `${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {alerts.length > 0 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fee2e2',
          borderRadius: '6px',
          color: '#991b1b',
          fontSize: '14px',
          marginBottom: '16px',
          borderLeft: '4px solid #ef4444'
        }}>
          {error}
        </div>
      )}

      {isExpanded && alerts.length > 0 && (
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: '6px'
        }}>
          {alerts.map((alert, index) => (
            <div
              key={alert.id}
              style={{
                padding: '16px',
                borderBottom: index < alerts.length - 1 ? '1px solid #f3f4f6' : 'none',
                backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onClick={() => handleViewOnMap(alert)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9fafb'}
            >
              {/* Alert Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: '600',
                    fontSize: '14px',
                    color: '#111827',
                    marginBottom: '4px'
                  }}>
                    {alert.interchange_name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    {alert.event_corridor} • {formatDate(alert.created_at)}
                  </div>
                </div>
                {getSeverityBadge(alert.severity)}
              </div>

              {/* Event Description */}
              <div style={{
                fontSize: '13px',
                color: '#374151',
                marginBottom: '8px',
                lineHeight: '1.5'
              }}>
                {alert.event_description || alert.event_location}
              </div>

              {/* Detour Message */}
              <div style={{
                padding: '8px',
                backgroundColor: '#f9fafb',
                borderRadius: '4px',
                fontSize: '13px',
                lineHeight: '1.5',
                color: '#374151'
              }}>
                {alert.message}
              </div>

              {/* Lanes Affected (if available) */}
              {alert.lanes_affected && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontWeight: '500'
                }}>
                  🚧 Lanes affected: {alert.lanes_affected}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
