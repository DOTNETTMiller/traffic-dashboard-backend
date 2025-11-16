import { useState, useEffect, useMemo } from 'react';
import { theme } from '../styles/theme';

// Animated counter hook
const useAnimatedCounter = (target, duration = 1000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    let animationFrame;

    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      setCount(Math.floor(progress * target));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration]);

  return count;
};

export default function LiveStatistics({ events, isExpanded = true, onToggle }) {
  const stats = useMemo(() => {
    // Calculate comprehensive statistics
    const severityCounts = { high: 0, medium: 0, low: 0 };
    const corridorCounts = {};
    const stateCounts = {};
    const typeCounts = {};

    events.forEach(event => {
      // Severity
      const severity = (event.severity || 'low').toLowerCase();
      severityCounts[severity] = (severityCounts[severity] || 0) + 1;

      // Corridor
      const corridor = event.corridor || 'Unknown';
      corridorCounts[corridor] = (corridorCounts[corridor] || 0) + 1;

      // State
      const state = event.state || 'Unknown';
      stateCounts[state] = (stateCounts[state] || 0) + 1;

      // Type
      const type = event.eventType || 'Unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Top corridors
    const topCorridors = Object.entries(corridorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top states
    const topStates = Object.entries(stateCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      total: events.length,
      severityCounts,
      topCorridors,
      topStates,
      typeCounts
    };
  }, [events]);

  const totalCount = useAnimatedCounter(stats.total, 800);
  const highCount = useAnimatedCounter(stats.severityCounts.high, 1000);
  const mediumCount = useAnimatedCounter(stats.severityCounts.medium, 1000);
  const lowCount = useAnimatedCounter(stats.severityCounts.low, 1000);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return theme.colors.error.main;
      case 'medium': return theme.colors.warning.main;
      default: return theme.colors.success.main;
    }
  };

  const getSeverityGradient = (severity) => {
    switch (severity) {
      case 'high': return theme.colors.gradients.error;
      case 'medium': return theme.colors.gradients.warning;
      default: return theme.colors.gradients.success;
    }
  };

  if (!isExpanded) {
    return (
      <div
        onClick={onToggle}
        style={{
          background: theme.colors.glassDark,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '12px',
          padding: theme.spacing.md,
          boxShadow: theme.shadows.lg,
          cursor: 'pointer',
          transition: `all ${theme.transitions.medium}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = theme.shadows.xl;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = theme.shadows.lg;
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <span style={{ fontSize: '20px' }}>📊</span>
          <span style={{ fontWeight: '700', color: theme.colors.text }}>
            Live Statistics
          </span>
        </div>
        <div style={{
          background: theme.colors.accentBlue,
          color: 'white',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '700'
        }}>
          {totalCount}
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
      transition: `all ${theme.transitions.medium}`
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
        paddingBottom: theme.spacing.sm,
        borderBottom: `2px solid ${theme.colors.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          <span style={{ fontSize: '24px' }}>📊</span>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '700',
            background: theme.colors.gradients.primary,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Live Statistics
          </h3>
        </div>
        <button
          onClick={onToggle}
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
          Collapse
        </button>
      </div>

      {/* Main Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.lg
      }}>
        {/* Total Events */}
        <div style={{
          background: theme.colors.glassLight,
          borderRadius: '12px',
          padding: theme.spacing.md,
          border: `2px solid ${theme.colors.accentBlue}40`,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '60px',
            height: '60px',
            background: `${theme.colors.accentBlue}10`,
            borderRadius: '50%',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary, marginBottom: '4px', position: 'relative', zIndex: 1 }}>
            Total Events
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: theme.colors.accentBlue, position: 'relative', zIndex: 1 }}>
            {totalCount}
          </div>
        </div>

        {/* High Severity */}
        <div style={{
          background: theme.colors.glassLight,
          borderRadius: '12px',
          padding: theme.spacing.md,
          border: `2px solid ${theme.colors.error.main}40`,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '60px',
            height: '60px',
            background: `${theme.colors.error.main}10`,
            borderRadius: '50%',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary, marginBottom: '4px', position: 'relative', zIndex: 1 }}>
            🔴 High Severity
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: theme.colors.error.main, position: 'relative', zIndex: 1 }}>
            {highCount}
          </div>
        </div>

        {/* Medium Severity */}
        <div style={{
          background: theme.colors.glassLight,
          borderRadius: '12px',
          padding: theme.spacing.md,
          border: `2px solid ${theme.colors.warning.main}40`,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '60px',
            height: '60px',
            background: `${theme.colors.warning.main}10`,
            borderRadius: '50%',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary, marginBottom: '4px', position: 'relative', zIndex: 1 }}>
            🟡 Medium Severity
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: theme.colors.warning.main, position: 'relative', zIndex: 1 }}>
            {mediumCount}
          </div>
        </div>

        {/* Low Severity */}
        <div style={{
          background: theme.colors.glassLight,
          borderRadius: '12px',
          padding: theme.spacing.md,
          border: `2px solid ${theme.colors.success.main}40`,
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '60px',
            height: '60px',
            background: `${theme.colors.success.main}10`,
            borderRadius: '50%',
            transform: 'translate(30%, -30%)'
          }} />
          <div style={{ fontSize: '11px', fontWeight: '600', color: theme.colors.textSecondary, marginBottom: '4px', position: 'relative', zIndex: 1 }}>
            🟢 Low Severity
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: theme.colors.success.main, position: 'relative', zIndex: 1 }}>
            {lowCount}
          </div>
        </div>
      </div>

      {/* Severity Distribution Bar */}
      <div style={{ marginBottom: theme.spacing.lg }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: theme.colors.textSecondary, marginBottom: theme.spacing.sm }}>
          Severity Distribution
        </div>
        <div style={{
          display: 'flex',
          height: '8px',
          borderRadius: '4px',
          overflow: 'hidden',
          background: theme.colors.gray[200]
        }}>
          {stats.total > 0 && (
            <>
              <div
                style={{
                  width: `${(stats.severityCounts.high / stats.total) * 100}%`,
                  background: theme.colors.gradients.error,
                  transition: `all ${theme.transitions.medium}`
                }}
                title={`High: ${stats.severityCounts.high}`}
              />
              <div
                style={{
                  width: `${(stats.severityCounts.medium / stats.total) * 100}%`,
                  background: theme.colors.gradients.warning,
                  transition: `all ${theme.transitions.medium}`
                }}
                title={`Medium: ${stats.severityCounts.medium}`}
              />
              <div
                style={{
                  width: `${(stats.severityCounts.low / stats.total) * 100}%`,
                  background: theme.colors.gradients.success,
                  transition: `all ${theme.transitions.medium}`
                }}
                title={`Low: ${stats.severityCounts.low}`}
              />
            </>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: theme.spacing.md
      }}>
        {/* Top Corridors */}
        <div style={{
          background: theme.colors.glassLight,
          borderRadius: '12px',
          padding: theme.spacing.md,
          border: `1px solid ${theme.colors.border}`
        }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🛣️</span> Top Corridors
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {stats.topCorridors.map(([corridor, count], index) => (
              <div
                key={corridor}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: index === 0 ? `${theme.colors.accentBlue}10` : 'transparent',
                  border: index === 0 ? `1px solid ${theme.colors.accentBlue}30` : '1px solid transparent'
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: '600', color: theme.colors.text }}>
                  {index === 0 && '👑 '}{corridor}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  background: theme.colors.accentBlue,
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '8px'
                }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top States */}
        <div style={{
          background: theme.colors.glassLight,
          borderRadius: '12px',
          padding: theme.spacing.md,
          border: `1px solid ${theme.colors.border}`
        }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📍</span> Top States
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
            {stats.topStates.map(([state, count], index) => (
              <div
                key={state}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: index === 0 ? `${theme.colors.accentPurple}10` : 'transparent',
                  border: index === 0 ? `1px solid ${theme.colors.accentPurple}30` : '1px solid transparent'
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: '600', color: theme.colors.text }}>
                  {index === 0 && '👑 '}{state}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  background: theme.colors.accentPurple,
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '8px'
                }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
