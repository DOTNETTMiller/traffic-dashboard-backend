import { useEffect, useState } from 'react';

/**
 * Left-rail navigation. 5 core views as always-visible icons + 4 collapsible
 * groups for the long tail. Hovering an icon while collapsed reveals the
 * label as a tooltip. Click the chevron at the top to keep the rail expanded.
 *
 * Data-driven so that adding a new view is a one-line edit.
 */

const NAV = [
  { type: 'item', view: 'map',       icon: '🗺️', label: 'Map' },
  { type: 'item', view: 'table',     icon: '📋', label: 'Table' },
  { type: 'item', view: 'timeline',  icon: '⏱️', label: 'Timeline' },
  { type: 'item', view: 'dashboard', icon: '📊', label: 'Dashboard' },
  { type: 'item', view: 'calendar',  icon: '📅', label: 'Calendar' },

  {
    type: 'group',
    key: 'data-quality',
    icon: '📈',
    label: 'Data Quality',
    items: [
      { view: 'report',                icon: '📊', label: 'Quality Report' },
      { view: 'tetcGrading',           icon: '⭐', label: 'TETC Grading' },
      { view: 'stateQualityRankings',  icon: '🎖️', label: 'State Rankings' },
      { view: 'vendorLeaderboard',     icon: '🏆', label: 'Vendor Leaderboard' },
      { view: 'vendorComparison',      icon: '🔄', label: 'Vendor Comparison' },
      { view: 'gapAnalysis',           icon: '📊', label: 'Vendor Gap Analysis' },
      { view: 'coverageGaps',          icon: '🗺️', label: 'Coverage Gap Analysis' },
      { view: 'alignment',             icon: '🔗', label: 'Feed Alignment' },
      { view: 'eventConfidence',       icon: '✓',  label: 'Event Confidence' },
      { view: 'procurement',           icon: '💰', label: 'Procurement' },
      { view: 'predictiveAnalytics',   icon: '🔮', label: 'Predictive Analytics' },
      { view: 'assetHealth',           icon: '🩺', label: 'Asset Health' }
    ]
  },
  {
    type: 'group',
    key: 'communications',
    icon: '💬',
    label: 'Communications',
    items: [
      { view: 'messages',         icon: '✉️', label: 'Messages' },
      { view: 'dmsMessaging',     icon: '🚧', label: 'DMS Messaging' },
      { view: 'closureApproval',  icon: '✅', label: 'Closure Approval' },
      { view: 'diversionRoutes',  icon: '🛣️', label: 'Diversion Routes' },
      { view: 'corridorDelays',   icon: '⏰', label: 'Corridor Delays' }
    ]
  },
  {
    type: 'group',
    key: 'state-tools',
    icon: '🏛️',
    label: 'State Tools',
    items: [
      { view: 'standardsCrosswalk',    icon: '🔀', label: 'Standards Crosswalk' },
      { view: 'nasco-regulations',     icon: '📜', label: 'NASCO Regulations' },
      { view: 'caddModels',            icon: '📐', label: 'CADD Models' },
      { view: 'digitalInfrastructure', icon: '🌉', label: 'Digital Infrastructure' },
      { view: 'groundTruth',           icon: '🎯', label: 'Ground Truth' }
    ]
  },
  {
    type: 'group',
    key: 'commercial-freight',
    icon: '🚚',
    label: 'Commercial Freight',
    items: [
      { view: 'vendorPortal',    icon: '🏢', label: 'Vendor Portal' },
      { view: 'feedSubmission',  icon: '📤', label: 'Feed Submission' },
      { view: 'grants',          icon: '💵', label: 'Grants' }
    ]
  },

  { type: 'item', view: 'docs',  icon: '📚', label: 'Docs' },
  { type: 'item', view: 'admin', icon: '⚙️', label: 'Admin' }
];

const COLLAPSED_W = 56;
const EXPANDED_W = 220;

export default function NavSidebar({ view, onViewChange, isAdmin = true }) {
  // User preference: persist expanded state across sessions.
  const [expanded, setExpanded] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nav.expanded') ?? 'false'); }
    catch { return false; }
  });
  const [openGroups, setOpenGroups] = useState({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredView, setHoveredView] = useState(null);

  useEffect(() => {
    try { localStorage.setItem('nav.expanded', JSON.stringify(expanded)); } catch {}
    // Make the rail width readable from anywhere (App.css uses var(--nav-w)
    // on `.controls` and `.main-content` to leave room beside the rail).
    document.documentElement.style.setProperty(
      '--nav-w',
      `${expanded ? EXPANDED_W : COLLAPSED_W}px`
    );
  }, [expanded]);

  // Mark <body> so the layout rule activates only when the rail is mounted.
  useEffect(() => {
    document.body.classList.add('has-nav-sidebar');
    return () => document.body.classList.remove('has-nav-sidebar');
  }, []);

  // When collapsed, treat hovers as temporary expansions of the relevant group.
  // When expanded, openGroups is sticky.
  const isGroupActive = (group) =>
    group.items.some(item => item.view === view);

  const toggleGroup = (key) => {
    setOpenGroups(g => ({ ...g, [key]: !g[key] }));
  };

  const handleSelect = (nextView) => {
    onViewChange(nextView);
    setMobileOpen(false);
  };

  const filteredNav = NAV.filter(node => {
    if (node.type === 'item' && node.view === 'admin' && !isAdmin) return false;
    return true;
  });

  const railWidth = expanded ? EXPANDED_W : COLLAPSED_W;

  return (
    <>
      {/* Mobile hamburger — only visible <= 768px via CSS rule below */}
      <button
        type="button"
        className="nav-mobile-toggle"
        aria-label="Open navigation"
        onClick={() => setMobileOpen(true)}
      >
        ☰
      </button>

      {/* Backdrop on mobile when open */}
      {mobileOpen && (
        <div
          className="nav-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`nav-sidebar ${expanded ? 'is-expanded' : 'is-collapsed'} ${mobileOpen ? 'is-mobile-open' : ''}`}
        style={{ '--nav-w': `${railWidth}px` }}
        aria-label="Primary navigation"
      >
        <div className="nav-rail">
          <button
            type="button"
            className="nav-toggle"
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d={expanded ? 'M9 3 L4 7 L9 11' : 'M5 3 L10 7 L5 11'}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>

          <nav className="nav-list">
            {filteredNav.map((node, i) => {
              if (node.type === 'item') {
                const active = view === node.view;
                return (
                  <NavLink
                    key={node.view}
                    icon={node.icon}
                    label={node.label}
                    active={active}
                    expanded={expanded}
                    onClick={() => handleSelect(node.view)}
                  />
                );
              }

              const groupActive = isGroupActive(node);
              const open = openGroups[node.key] || (expanded && groupActive);

              return (
                <div key={node.key} className="nav-group">
                  <NavLink
                    icon={node.icon}
                    label={node.label}
                    active={groupActive && !open}
                    expanded={expanded}
                    isGroupHeader
                    isGroupOpen={open}
                    onClick={() => {
                      if (!expanded) {
                        setExpanded(true);
                        setOpenGroups(g => ({ ...g, [node.key]: true }));
                      } else {
                        toggleGroup(node.key);
                      }
                    }}
                  />
                  {open && expanded && (
                    <div className="nav-subitems">
                      {node.items.map(item => (
                        <button
                          key={item.view}
                          type="button"
                          className={`nav-subitem ${view === item.view ? 'is-active' : ''}`}
                          onClick={() => handleSelect(item.view)}
                        >
                          <span className="nav-subitem-icon" aria-hidden>{item.icon}</span>
                          <span className="nav-subitem-label">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}

function NavLink({ icon, label, active, expanded, onClick, isGroupHeader, isGroupOpen }) {
  return (
    <button
      type="button"
      className={`nav-link ${active ? 'is-active' : ''} ${isGroupHeader ? 'is-group' : ''}`}
      onClick={onClick}
      title={expanded ? '' : label}
    >
      <span className="nav-link-icon" aria-hidden>{icon}</span>
      {expanded && (
        <>
          <span className="nav-link-label">{label}</span>
          {isGroupHeader && (
            <span
              className="nav-link-chev"
              style={{ transform: isGroupOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
              aria-hidden
            >
              ›
            </span>
          )}
        </>
      )}
    </button>
  );
}
