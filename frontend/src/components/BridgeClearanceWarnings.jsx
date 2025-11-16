import { useState, useEffect } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';

export default function BridgeClearanceWarnings({ onViewOnMap }) {
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false); // Start collapsed by default

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
          Loading bridge warnings...
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
            🌉 Low Bridge Clearances
          </h3>
          {warnings.length > 0 && (
            <span style={{
              background: theme.colors.warning,
              color: 'white',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {warnings.length}
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
            transition: `all ${theme.transitions.fast}`
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = `${theme.colors.accentBlue}10`}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
          {warnings.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: theme.colors.textSecondary,
              fontSize: '14px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: theme.spacing.md }}>✅</div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>No Bridge Clearance Warnings</div>
              <div style={{ fontSize: '13px' }}>No events detected near low-clearance bridges</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              {warnings.map((warning) => (
                <div
                  key={warning.id}
                  style={{
                    background: theme.colors.glassLight,
                    borderRadius: '12px',
                    padding: theme.spacing.md,
                    border: `1px solid ${getClearanceColor(warning.clearance_feet)}40`,
                    transition: `all ${theme.transitions.fast}`,
                    cursor: 'pointer'
                  }}
                  onClick={() => handleViewOnMap(warning)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = theme.shadows.lg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Warning Header */}
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
                        {warning.bridge_name}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: theme.colors.textSecondary
                      }}>
                        {warning.route} • {warning.distance_km?.toFixed(1)} km from event • {formatDate(warning.created_at)}
                      </div>
                    </div>
                    {getClearanceBadge(warning.clearance_feet)}
                  </div>

                  {/* Event Description */}
                  <div style={{
                    fontSize: '13px',
                    color: theme.colors.textSecondary,
                    marginBottom: theme.spacing.sm,
                    lineHeight: '1.5',
                    fontStyle: 'italic'
                  }}>
                    {warning.event_description}
                  </div>

                  {/* Warning Message */}
                  <div style={{
                    background: `${getClearanceColor(warning.clearance_feet)}10`,
                    borderRadius: '8px',
                    padding: theme.spacing.sm,
                    fontSize: '13px',
                    lineHeight: '1.6',
                    borderLeft: `3px solid ${getClearanceColor(warning.clearance_feet)}`,
                    color: theme.colors.text
                  }}>
                    {warning.message}
                  </div>

                  {/* Clearance Info */}
                  <div style={{
                    marginTop: theme.spacing.sm,
                    display: 'flex',
                    gap: theme.spacing.md,
                    fontSize: '12px',
                    color: theme.colors.textSecondary
                  }}>
                    <span>
                      <strong>Clearance:</strong> {Math.floor(warning.clearance_feet)}' {Math.round((warning.clearance_feet - Math.floor(warning.clearance_feet)) * 12)}" ({warning.clearance_feet.toFixed(2)} ft / {(warning.clearance_feet * 0.3048).toFixed(2)} m)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
