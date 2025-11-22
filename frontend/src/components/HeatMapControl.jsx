import { useState } from 'react';
import { theme } from '../styles/theme';

export default function HeatMapControl({ onToggle, onModeChange, isActive, mode = 'density' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const modes = [
    {
      id: 'density',
      label: 'Event Density',
      icon: '🔥',
      description: 'Shows areas with high event concentration'
    },
    {
      id: 'severity',
      label: 'Severity Heat',
      icon: '⚠️',
      description: 'Shows areas with high-severity events'
    },
    {
      id: 'recent',
      label: 'Recent Activity',
      icon: '⏱️',
      description: 'Shows recently active areas'
    }
  ];

  return (
    <div style={{
      position: 'absolute',
      bottom: '90px',
      left: '24px',
      zIndex: 1000
    }}>
      {/* Toggle Button */}
      <button
        onClick={() => {
          if (!isActive) {
            onToggle(true);
            setIsExpanded(true);
          } else {
            setIsExpanded(!isExpanded);
          }
        }}
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: `2px solid ${isActive ? theme.colors.accentBlue : theme.colors.border}`,
          background: isActive
            ? `${theme.colors.accentBlue}20`
            : theme.colors.glassDark,
          backdropFilter: 'blur(20px)',
          boxShadow: theme.shadows.lg,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          transition: `all ${theme.transitions.fast}`,
          marginBottom: theme.spacing.sm
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = theme.shadows.xl;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = theme.shadows.lg;
        }}
        title="Heat Map Visualization"
      >
        🔥
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div style={{
          position: 'absolute',
          bottom: '60px',
          left: '0',
          background: theme.colors.glassDark,
          backdropFilter: 'blur(20px)',
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '12px',
          boxShadow: theme.shadows.xl,
          padding: theme.spacing.md,
          minWidth: '280px',
          animation: 'slideUp 0.2s ease-out'
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
            <span style={{
              fontSize: '14px',
              fontWeight: '700',
              color: theme.colors.text
            }}>
              Heat Map Overlay
            </span>
            <button
              onClick={() => setIsExpanded(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.colors.textSecondary,
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Active Toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: theme.spacing.md,
            padding: theme.spacing.sm,
            background: theme.colors.glassLight,
            borderRadius: '8px'
          }}>
            <span style={{
              fontSize: '13px',
              fontWeight: '600',
              color: theme.colors.text
            }}>
              Enable Heat Map
            </span>
            <button
              onClick={() => onToggle(!isActive)}
              style={{
                width: '48px',
                height: '24px',
                borderRadius: '12px',
                border: `2px solid ${isActive ? theme.colors.accentBlue : theme.colors.border}`,
                background: isActive ? theme.colors.accentBlue : theme.colors.gray[300],
                position: 'relative',
                cursor: 'pointer',
                transition: `all ${theme.transitions.fast}`
              }}
            >
              <div style={{
                position: 'absolute',
                top: '1px',
                left: isActive ? 'calc(100% - 21px)' : '1px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: 'white',
                boxShadow: theme.shadows.sm,
                transition: `all ${theme.transitions.fast}`
              }} />
            </button>
          </div>

          {/* Mode Selection */}
          {isActive && (
            <>
              <div style={{
                fontSize: '11px',
                fontWeight: '700',
                textTransform: 'uppercase',
                color: theme.colors.textSecondary,
                marginBottom: theme.spacing.sm
              }}>
                Heat Map Mode
              </div>
              {modes.map(modeOption => (
                <div
                  key={modeOption.id}
                  onClick={() => onModeChange(modeOption.id)}
                  style={{
                    padding: theme.spacing.sm,
                    marginBottom: theme.spacing.xs,
                    borderRadius: '8px',
                    border: `2px solid ${mode === modeOption.id ? theme.colors.accentBlue : 'transparent'}`,
                    background: mode === modeOption.id
                      ? `${theme.colors.accentBlue}15`
                      : theme.colors.glassLight,
                    cursor: 'pointer',
                    transition: `all ${theme.transitions.fast}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing.sm
                  }}
                  onMouseEnter={(e) => {
                    if (mode !== modeOption.id) {
                      e.currentTarget.style.background = `${theme.colors.accentBlue}08`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (mode !== modeOption.id) {
                      e.currentTarget.style.background = theme.colors.glassLight;
                    }
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{modeOption.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: theme.colors.text,
                      marginBottom: '2px'
                    }}>
                      {modeOption.label}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary
                    }}>
                      {modeOption.description}
                    </div>
                  </div>
                  {mode === modeOption.id && (
                    <span style={{
                      fontSize: '16px',
                      color: theme.colors.accentBlue
                    }}>
                      ✓
                    </span>
                  )}
                </div>
              ))}

              {/* Legend */}
              <div style={{
                marginTop: theme.spacing.md,
                padding: theme.spacing.sm,
                background: theme.colors.glassLight,
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  color: theme.colors.textSecondary,
                  marginBottom: theme.spacing.xs
                }}>
                  Heat Map Legend
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  marginBottom: theme.spacing.xs
                }}>
                  <div style={{
                    width: '100%',
                    height: '20px',
                    borderRadius: '4px',
                    background: 'linear-gradient(to right, rgba(34, 197, 94, 0.3), rgba(251, 191, 36, 0.5), rgba(239, 68, 68, 0.7))'
                  }} />
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '10px',
                  color: theme.colors.textSecondary,
                  fontWeight: '600'
                }}>
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
