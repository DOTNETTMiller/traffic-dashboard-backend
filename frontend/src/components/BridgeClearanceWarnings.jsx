import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';

export default function BridgeClearanceWarnings({ onViewOnMap }) {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true); // Start expanded by default

  useEffect(() => {
    fetchWarnings();
    // Refresh warnings every 60 seconds
    const interval = setInterval(fetchWarnings, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchWarnings = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/bridge-warnings/active');

      if (response.data.success) {
        setWarnings(response.data.warnings || []);
      } else {
        setError('Failed to load bridge clearance warnings');
      }
    } catch (err) {
      console.error('Error fetching bridge warnings:', err);
      setError('Unable to load bridge warnings: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleViewOnMap = (warning) => {
    if (onViewOnMap && warning.latitude && warning.longitude) {
      onViewOnMap({
        id: warning.id,
        latitude: warning.latitude,
        longitude: warning.longitude,
        description: warning.bridge_name,
        type: 'bridge-warning',
        clearance: warning.clearance_feet
      });
    }
  };

  const getClearanceColor = (clearanceFeet) => {
    if (clearanceFeet < 13.67) return '#dc2626'; // Critical (under 13'8")
    if (clearanceFeet < 14.0) return '#f59e0b'; // Warning (under 14'0")
    return '#3b82f6'; // Caution
  };

  const getClearanceBadge = (clearanceFeet) => {
    const color = getClearanceColor(clearanceFeet);
    const feet = Math.floor(clearanceFeet);
    const inches = Math.round((clearanceFeet - feet) * 12);

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: '700',
          backgroundColor: `${color}15`,
          color: color,
          border: `1.5px solid ${color}60`
        }}
      >
        <span style={{ fontSize: '14px' }}>🌉</span>
        {feet}' {inches}"
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

  if (loading && warnings.length === 0) {
    return (
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        <div style={{ textAlign: 'center', padding: '20px', color: '#6b7280' }}>
          Loading bridge warnings...
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
            🌉 Low Bridge Clearances
          </h2>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            {warnings.length === 0 ? 'No bridge clearance warnings' : `${warnings.length} active warning${warnings.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {warnings.length > 0 && (
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

      {isExpanded && warnings.length > 0 && (
        <div style={{
          maxHeight: '400px',
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: '6px'
        }}>
          {warnings.map((warning, index) => (
            <div
              key={warning.id}
              style={{
                padding: '16px',
                borderBottom: index < warnings.length - 1 ? '1px solid #f3f4f6' : 'none',
                backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                cursor: 'pointer',
                transition: 'background-color 0.15s'
              }}
              onClick={() => handleViewOnMap(warning)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'white' : '#f9fafb'}
            >
              {/* Warning Header */}
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
                    {warning.bridge_name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    {warning.route} • {warning.distance_km?.toFixed(1)} km from event • {formatDate(warning.created_at)}
                  </div>
                </div>
                {getClearanceBadge(warning.clearance_feet)}
              </div>

              {/* Event Description */}
              <div style={{
                fontSize: '13px',
                color: '#374151',
                marginBottom: '8px',
                lineHeight: '1.5',
                fontStyle: 'italic'
              }}>
                {warning.event_description}
              </div>

              {/* Warning Message */}
              <div style={{
                padding: '8px',
                backgroundColor: '#f9fafb',
                borderRadius: '4px',
                fontSize: '13px',
                lineHeight: '1.5',
                color: '#374151'
              }}>
                {warning.message}
              </div>

              {/* Clearance Info */}
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#6b7280',
                fontWeight: '500'
              }}>
                🌉 Clearance: {Math.floor(warning.clearance_feet)}' {Math.round((warning.clearance_feet - Math.floor(warning.clearance_feet)) * 12)}" ({warning.clearance_feet.toFixed(2)} ft / {(warning.clearance_feet * 0.3048).toFixed(2)} m)
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
