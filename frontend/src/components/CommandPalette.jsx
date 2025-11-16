import { useState, useEffect, useMemo, useRef } from 'react';
import { theme } from '../styles/theme';

export default function CommandPalette({
  isOpen,
  onClose,
  onExecuteCommand,
  currentView,
  currentFilters,
  autoRefresh,
  showParking,
  showInterchanges
}) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Define all available commands
  const allCommands = useMemo(() => [
    // Navigation Commands
    {
      id: 'nav-map',
      category: 'Navigation',
      title: 'Go to Map View',
      icon: '🗺️',
      keywords: ['map', 'view', 'navigate'],
      shortcut: 'G then M',
      action: () => onExecuteCommand({ type: 'navigate', view: 'map' })
    },
    {
      id: 'nav-table',
      category: 'Navigation',
      title: 'Go to Table View',
      icon: '📊',
      keywords: ['table', 'list', 'view', 'navigate'],
      shortcut: 'G then T',
      action: () => onExecuteCommand({ type: 'navigate', view: 'table' })
    },
    {
      id: 'nav-timeline',
      category: 'Navigation',
      title: 'Go to Timeline View',
      icon: '📜',
      keywords: ['timeline', 'activity', 'feed', 'history', 'navigate'],
      shortcut: 'G then L',
      action: () => onExecuteCommand({ type: 'navigate', view: 'timeline' })
    },
    {
      id: 'nav-dashboard',
      category: 'Navigation',
      title: 'Go to Dashboard',
      icon: '📊',
      keywords: ['dashboard', 'widgets', 'stats', 'overview', 'navigate'],
      shortcut: 'G then B',
      action: () => onExecuteCommand({ type: 'navigate', view: 'dashboard' })
    },
    {
      id: 'nav-report',
      category: 'Navigation',
      title: 'Go to Data Quality Report',
      icon: '📈',
      keywords: ['report', 'quality', 'data', 'navigate'],
      shortcut: 'G then R',
      action: () => onExecuteCommand({ type: 'navigate', view: 'report' })
    },
    {
      id: 'nav-alignment',
      category: 'Navigation',
      title: 'Go to Feed Alignment',
      icon: '🔄',
      keywords: ['alignment', 'feed', 'navigate'],
      shortcut: 'G then A',
      action: () => onExecuteCommand({ type: 'navigate', view: 'alignment' })
    },
    {
      id: 'nav-messages',
      category: 'Navigation',
      title: 'Go to Messages',
      icon: '💬',
      keywords: ['messages', 'communication', 'navigate'],
      shortcut: 'G then C',
      action: () => onExecuteCommand({ type: 'navigate', view: 'messages' })
    },
    {
      id: 'nav-docs',
      category: 'Navigation',
      title: 'Go to Documentation',
      icon: '📚',
      keywords: ['docs', 'documentation', 'help', 'navigate'],
      shortcut: 'G then D',
      action: () => onExecuteCommand({ type: 'navigate', view: 'docs' })
    },
    {
      id: 'open-briefing',
      category: 'Navigation',
      title: 'Open Corridor Briefing',
      icon: '📋',
      keywords: ['corridor', 'briefing', 'report', 'pilot', 'travel'],
      shortcut: 'B',
      action: () => onExecuteCommand({ type: 'action', action: 'openBriefing' })
    },

    // Toggle Commands
    {
      id: 'toggle-refresh',
      category: 'Toggles',
      title: `${autoRefresh ? 'Disable' : 'Enable'} Auto-Refresh`,
      icon: autoRefresh ? '⏸️' : '▶️',
      keywords: ['auto', 'refresh', 'toggle', 'enable', 'disable'],
      shortcut: 'R',
      action: () => onExecuteCommand({ type: 'toggle', feature: 'autoRefresh', value: !autoRefresh })
    },
    {
      id: 'toggle-parking',
      category: 'Toggles',
      title: `${showParking ? 'Hide' : 'Show'} Truck Parking`,
      icon: '🚛',
      keywords: ['parking', 'truck', 'toggle', 'show', 'hide'],
      shortcut: 'P',
      action: () => onExecuteCommand({ type: 'toggle', feature: 'showParking', value: !showParking })
    },
    {
      id: 'toggle-interchanges',
      category: 'Toggles',
      title: `${showInterchanges ? 'Hide' : 'Show'} Interstate Coordination Points`,
      icon: '🎯',
      keywords: ['interchanges', 'coordination', 'toggle', 'show', 'hide'],
      shortcut: 'I',
      action: () => onExecuteCommand({ type: 'toggle', feature: 'showInterchanges', value: !showInterchanges })
    },

    // Action Commands
    {
      id: 'refresh-data',
      category: 'Actions',
      title: 'Refresh Data Now',
      icon: '🔄',
      keywords: ['refresh', 'reload', 'update', 'data'],
      shortcut: 'Ctrl+R',
      action: () => onExecuteCommand({ type: 'action', action: 'refresh' })
    },
    {
      id: 'clear-filters',
      category: 'Actions',
      title: 'Clear All Filters',
      icon: '🧹',
      keywords: ['clear', 'reset', 'filters', 'remove'],
      shortcut: 'Ctrl+X',
      action: () => onExecuteCommand({ type: 'action', action: 'clearFilters' })
    },
    {
      id: 'expand-stats',
      category: 'Actions',
      title: 'Toggle Statistics Panel',
      icon: '📊',
      keywords: ['statistics', 'stats', 'panel', 'toggle'],
      shortcut: 'S',
      action: () => onExecuteCommand({ type: 'action', action: 'toggleStats' })
    },
    {
      id: 'export-data',
      category: 'Actions',
      title: 'Export Data',
      icon: '📥',
      keywords: ['export', 'download', 'save', 'csv', 'json', 'pdf'],
      shortcut: 'Ctrl+E',
      action: () => onExecuteCommand({ type: 'action', action: 'export' })
    },

    // Filter Commands
    {
      id: 'filter-high',
      category: 'Filters',
      title: 'Filter by High Severity',
      icon: '🔴',
      keywords: ['filter', 'severity', 'high', 'critical'],
      action: () => onExecuteCommand({ type: 'filter', filter: 'severity', value: 'high' })
    },
    {
      id: 'filter-medium',
      category: 'Filters',
      title: 'Filter by Medium Severity',
      icon: '🟡',
      keywords: ['filter', 'severity', 'medium'],
      action: () => onExecuteCommand({ type: 'filter', filter: 'severity', value: 'medium' })
    },
    {
      id: 'filter-low',
      category: 'Filters',
      title: 'Filter by Low Severity',
      icon: '🟢',
      keywords: ['filter', 'severity', 'low'],
      action: () => onExecuteCommand({ type: 'filter', filter: 'severity', value: 'low' })
    },
  ], [autoRefresh, showParking, showInterchanges, onExecuteCommand]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search.trim()) return allCommands;

    const searchLower = search.toLowerCase();
    return allCommands.filter(cmd => {
      const titleMatch = cmd.title.toLowerCase().includes(searchLower);
      const keywordsMatch = cmd.keywords.some(kw => kw.includes(searchLower));
      const categoryMatch = cmd.category.toLowerCase().includes(searchLower);
      return titleMatch || keywordsMatch || categoryMatch;
    });
  }, [search, allCommands]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups = {};
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
          animation: 'fadeIn 0.15s ease-out'
        }}
      />

      {/* Command Palette */}
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '640px',
        maxHeight: '60vh',
        background: theme.colors.glassDark,
        backdropFilter: 'blur(20px)',
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '16px',
        boxShadow: theme.shadows.xl,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideDown 0.2s ease-out'
      }}>
        {/* Search Input */}
        <div style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border}`
        }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              style={{
                width: '100%',
                padding: '12px 16px 12px 48px',
                fontSize: '16px',
                border: `2px solid ${theme.colors.accentBlue}40`,
                borderRadius: '12px',
                backgroundColor: theme.colors.glassLight,
                color: theme.colors.text,
                outline: 'none',
                transition: `all ${theme.transitions.fast}`
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = theme.colors.accentBlue}
              onBlur={(e) => e.currentTarget.style.borderColor = `${theme.colors.accentBlue}40`}
            />
            <span style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '20px'
            }}>
              🔍
            </span>
          </div>
        </div>

        {/* Commands List */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: theme.spacing.sm
          }}
        >
          {filteredCommands.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: theme.colors.textSecondary
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <div style={{ fontWeight: '600', marginBottom: '8px' }}>
                No commands found
              </div>
              <div style={{ fontSize: '14px' }}>
                Try searching for something else
              </div>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, commands]) => (
              <div key={category} style={{ marginBottom: theme.spacing.md }}>
                {/* Category Header */}
                <div style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  color: theme.colors.textSecondary,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  marginBottom: theme.spacing.xs
                }}>
                  {category}
                </div>

                {/* Commands in Category */}
                {commands.map((cmd, cmdIndex) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  const isSelected = globalIndex === selectedIndex;

                  return (
                    <div
                      key={cmd.id}
                      data-index={globalIndex}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      style={{
                        padding: theme.spacing.md,
                        margin: `${theme.spacing.xs} 0`,
                        borderRadius: '8px',
                        backgroundColor: isSelected ? theme.colors.accentBlue : theme.colors.glassLight,
                        color: isSelected ? 'white' : theme.colors.text,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: `all ${theme.transitions.fast}`,
                        border: `1px solid ${isSelected ? theme.colors.accentBlue : 'transparent'}`
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = `${theme.colors.accentBlue}20`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = theme.colors.glassLight;
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                        <span style={{ fontSize: '20px' }}>{cmd.icon}</span>
                        <span style={{ fontSize: '14px', fontWeight: '600' }}>
                          {cmd.title}
                        </span>
                      </div>

                      {cmd.shortcut && (
                        <div style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : theme.colors.gray[200],
                          fontSize: '11px',
                          fontWeight: '700',
                          color: isSelected ? 'white' : theme.colors.textSecondary,
                          fontFamily: 'monospace'
                        }}>
                          {cmd.shortcut}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: theme.spacing.md,
          borderTop: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.glassLight,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: theme.colors.textSecondary
        }}>
          <div style={{ display: 'flex', gap: theme.spacing.md }}>
            <span>
              <kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> Navigate
            </span>
            <span>
              <kbd style={kbdStyle}>Enter</kbd> Select
            </span>
            <span>
              <kbd style={kbdStyle}>Esc</kbd> Close
            </span>
          </div>
          <span style={{ fontWeight: '600' }}>
            {filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </>
  );
}

const kbdStyle = {
  padding: '2px 6px',
  borderRadius: '4px',
  backgroundColor: '#e5e7eb',
  border: '1px solid #d1d5db',
  fontFamily: 'monospace',
  fontSize: '11px',
  fontWeight: '700'
};
