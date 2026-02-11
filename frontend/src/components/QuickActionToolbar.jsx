import { useState } from 'react';
import { theme } from '../styles/theme';

export default function QuickActionToolbar({
  onRefresh,
  onClearFilters,
  onToggleParking,
  onToggleInterchanges,
  onToggleInterstateOnly,
  onOpenCommandPalette,
  onFilterSeverity,
  onExport,
  autoRefresh,
  showParking,
  showInterchanges,
  interstateOnly,
  currentSeverityFilter,
  eventCount
}) {
  const [expanded, setExpanded] = useState(false);
  const [tooltip, setTooltip] = useState(null);

  const actions = [
    {
      id: 'command-palette',
      icon: '⌘',
      label: 'Command Palette',
      shortcut: 'Cmd+K',
      onClick: onOpenCommandPalette,
      color: theme.colors.accentBlue,
      primary: true
    },
    {
      id: 'refresh',
      icon: '🔄',
      label: 'Refresh Data',
      shortcut: 'Ctrl+R',
      onClick: onRefresh,
      color: theme.colors.accentBlue
    },
    {
      id: 'clear-filters',
      icon: '🧹',
      label: 'Clear Filters',
      shortcut: 'Ctrl+X',
      onClick: onClearFilters,
      color: theme.colors.accentPurple
    },
    {
      id: 'export',
      icon: '📥',
      label: 'Export Data',
      shortcut: 'Ctrl+E',
      onClick: onExport,
      color: theme.colors.accentPurple
    },
    {
      id: 'filter-high',
      icon: '🔴',
      label: 'High Severity',
      onClick: () => onFilterSeverity('high'),
      color: theme.colors.error.main,
      active: currentSeverityFilter === 'high'
    },
    {
      id: 'filter-medium',
      icon: '🟡',
      label: 'Medium Severity',
      onClick: () => onFilterSeverity('medium'),
      color: theme.colors.warning.main,
      active: currentSeverityFilter === 'medium'
    },
    {
      id: 'filter-low',
      icon: '🟢',
      label: 'Low Severity',
      onClick: () => onFilterSeverity('low'),
      color: theme.colors.success.main,
      active: currentSeverityFilter === 'low'
    },
    {
      id: 'toggle-parking',
      icon: '🚛',
      label: showParking ? 'Hide Parking' : 'Show Parking',
      shortcut: 'P',
      onClick: onToggleParking,
      color: theme.colors.accentBlue,
      active: showParking
    },
    {
      id: 'toggle-interchanges',
      icon: '🎯',
      label: showInterchanges ? 'Hide Interchanges' : 'Show Interchanges',
      shortcut: 'I',
      onClick: onToggleInterchanges,
      color: theme.colors.accentPurple,
      active: showInterchanges
    },
    {
      id: 'toggle-interstate',
      icon: '🛣️',
      label: interstateOnly ? 'Show All Routes' : 'Interstate Only',
      onClick: onToggleInterstateOnly,
      color: theme.colors.accentBlue,
      active: interstateOnly
    }
  ];

  return (
    <>
      {/* Floating Action Button */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000
        }}
      >
        {/* Expanded Actions */}
        {expanded && (
          <div
            style={{
              position: 'absolute',
              bottom: '80px',
              right: '0',
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.sm,
              animation: 'slideUp 0.2s ease-out'
            }}
          >
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                  if (!action.primary) {
                    setExpanded(false);
                  }
                }}
                onMouseEnter={() => setTooltip(action.label)}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  border: action.active ? `3px solid ${action.color}` : 'none',
                  backgroundColor: action.active ? `${action.color}20` : theme.colors.glassDark,
                  backdropFilter: 'blur(20px)',
                  boxShadow: theme.shadows.lg,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  transition: `all ${theme.transitions.fast}`,
                  position: 'relative',
                  marginLeft: 'auto'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                title={action.label}
              >
                {action.icon}

                {/* Tooltip */}
                {tooltip === action.label && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '70px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      padding: '8px 12px',
                      backgroundColor: theme.colors.gray[900],
                      color: '#111827',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      boxShadow: theme.shadows.xl,
                      pointerEvents: 'none',
                      zIndex: 10001
                    }}
                  >
                    {action.label}
                    {action.shortcut && (
                      <span style={{
                        marginLeft: '8px',
                        opacity: 0.7,
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}>
                        {action.shortcut}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Main Toggle Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            border: 'none',
            background: expanded
              ? theme.colors.gradients.error
              : theme.colors.gradients.primary,
            boxShadow: theme.shadows.xl,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            transition: `all ${theme.transitions.medium}`,
            transform: expanded ? 'rotate(45deg)' : 'rotate(0deg)',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            if (!expanded) {
              e.currentTarget.style.transform = 'scale(1.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!expanded) {
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          {expanded ? '✕' : '⚡'}

          {/* Event Count Badge */}
          {!expanded && eventCount > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '24px',
                height: '24px',
                padding: '0 6px',
                borderRadius: '12px',
                backgroundColor: theme.colors.error.main,
                color: '#111827',
                fontSize: '11px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: theme.shadows.md,
                border: '2px solid white'
              }}
            >
              {eventCount > 99 ? '99+' : eventCount}
            </div>
          )}
        </button>

        {/* Auto-refresh Indicator */}
        {autoRefresh && !expanded && (
          <div
            style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: theme.colors.success.main,
              boxShadow: `0 0 8px ${theme.colors.success.main}`,
              animation: 'pulse 2s ease-in-out infinite'
            }}
          />
        )}
      </div>

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
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: translateX(-50%) scale(1);
          }
          50% {
            opacity: 0.5;
            transform: translateX(-50%) scale(1.3);
          }
        }
      `}</style>
    </>
  );
}
