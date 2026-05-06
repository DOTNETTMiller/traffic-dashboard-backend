import { useEffect, useState } from 'react';

/**
 * Left-rail navigation. 5 core views as always-visible icons + 4 collapsible
 * groups for the long tail. Hovering an icon while collapsed reveals the
 * label as a tooltip. Click the chevron at the top to keep the rail expanded.
 *
 * Data-driven so that adding a new view is a one-line edit.
 */

// Items can be:
//   { view: 'xxx' }         -> calls onViewChange('xxx')
//   { actionKey: 'open-x' } -> calls actions['open-x']() — for modals
const NAV = [
  { type: 'item', view: 'map',       icon: '🗺️', label: 'Map' },
  { type: 'item', view: 'table',     icon: '📋', label: 'Table' },
  { type: 'item', view: 'timeline',  icon: '⏱️', label: 'Timeline' },
  { type: 'item', view: 'dashboard', icon: '📊', label: 'Dashboard' },
  { type: 'item', view: 'calendar',  icon: '📅', label: 'Calendar' },

  {
    // Quick actions — replaces the floating ⚡ menu that used to sit in the
    // bottom-right. Actions fire one-shot handlers; the Interstate Only
    // entry is a stateful toggle (On/Off pill like Map Layers).
    type: 'group',
    key: 'actions',
    icon: '⚡',
    label: 'Actions',
    items: [
      { actionKey: 'open-command-palette', icon: '⌘', label: 'Command Palette' },
      { actionKey: 'refresh-data',         icon: '🔄', label: 'Refresh Data' },
      { actionKey: 'clear-filters',        icon: '🧹', label: 'Clear Filters' },
      { actionKey: 'export-data',          icon: '📥', label: 'Export Data' },
      { actionKey: 'toggle-interstate-only', toggleProp: 'interstateOnly', icon: '🛣️', label: 'Interstate Only' }
    ]
  },

  {
    // Sub-items here are toggles, not view-changers — clicking flips the
    // matching map overlay's visibility instead of navigating. Each sub-item
    // declares an actionKey (the toggle handler in App.jsx) and a toggleProp
    // (the boolean field in mapLayerStates that decides the active style).
    type: 'group',
    key: 'map-layers',
    icon: '🗺️',
    label: 'Map Layers',
    items: [
      { actionKey: 'toggle-events',           toggleProp: 'showEvents',              icon: '⚠️', label: 'Traffic Events' },
      { actionKey: 'toggle-parking',          toggleProp: 'showParking',             icon: '🅿️', label: 'Truck Parking' },
      { actionKey: 'toggle-its-equipment',    toggleProp: 'showITSEquipment',        icon: '📡', label: 'ITS Equipment' },
      { actionKey: 'toggle-v2x',              toggleProp: 'showV2XDeployments',      icon: '📶', label: 'V2X Deployments' },
      { actionKey: 'toggle-cadd',             toggleProp: 'showCADDElements',        icon: '📐', label: 'CADD Elements' },
      { actionKey: 'toggle-interchanges',     toggleProp: 'showInterchanges',        icon: '🔀', label: 'Interchanges' },
      { actionKey: 'toggle-bridge-clearance', toggleProp: 'showBridgeClearances',    icon: '🌉', label: 'Bridge Clearances' },
      { actionKey: 'toggle-corridor-regs',    toggleProp: 'showCorridorRegulations', icon: '📜', label: 'Corridor Regulations' },
      { actionKey: 'toggle-diversion-routes', toggleProp: 'showDiversionRoutes',     icon: '🛣️', label: 'Diversion Routes' }
    ]
  },

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
      { view: 'assetHealth',           icon: '🔧', label: 'Asset Health' }
    ]
  },
  {
    type: 'group',
    key: 'communications',
    icon: '💬',
    label: 'Communications',
    items: [
      { view: 'messages',                  icon: '✉️', label: 'Messages' },
      { actionKey: 'open-corridor-briefing', icon: '📋', label: 'Corridor Briefing' },
      { actionKey: 'open-alerts',          icon: '🔔', label: 'Alerts' },
      { view: 'dmsMessaging',              icon: '🚧', label: 'DMS Messaging' },
      { view: 'closureApproval',           icon: '✅', label: 'Closure Approval' },
      { view: 'diversionRoutes',           icon: '🛣️', label: 'Diversion Routes' },
      { view: 'corridorDelays',            icon: '⏰', label: 'Corridor Delays' }
    ]
  },
  {
    type: 'group',
    key: 'ipaws',
    icon: '🚨',
    label: 'IPAWS',
    items: [
      { actionKey: 'open-ipaws-active',       icon: '⏰', label: 'Active Alerts' },
      { actionKey: 'open-ipaws-rules',        icon: '⚙️', label: 'Rules Config' },
      { actionKey: 'open-ipaws-after-action', icon: '📋', label: 'After-Action Reviews' }
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
      { view: 'grants',          icon: '💵', label: 'Funding Opportunities' }
    ]
  },

  { type: 'item', view: 'docs', icon: '📚', label: 'Docs' },

  {
    type: 'group',
    key: 'admin',
    icon: '⚙️',
    label: 'Admin',
    adminOnly: true,
    items: [
      { view: 'admin',       icon: '⚙️', label: 'Admin Panel' },
      { view: 'adminUsers',  icon: '👥', label: 'Users' },
      { view: 'adminFeeds',  icon: '📡', label: 'Feed Submissions' }
    ]
  }
];

// Footer rail items — pinned to the bottom of the sidebar so they're
// always one click away regardless of scroll position. These open
// floating panels rather than switching views.
const NAV_FOOTER = [
  { type: 'action', actionKey: 'toggle-messages', icon: '📨', label: 'Inbox',        toggleProp: 'messagesOpen' },
  { type: 'action', actionKey: 'toggle-ai',       icon: '🤖', label: 'AI Assistant', toggleProp: 'chatOpen' }
];

const COLLAPSED_W = 56;
const EXPANDED_W = 220;

const SECONDARY_W = 360;

export default function NavSidebar({
  view,
  onViewChange,
  isAdmin = true,
  actions = {},
  chatOpen = false,
  messagesOpen = false,
  // Boolean states for toggle-style sub-items. Sub-items in the Map Layers
  // group declare a toggleProp; if mapLayerStates[toggleProp] is truthy the
  // sub-item paints active. Wired by App.jsx with showParking / showV2X / etc.
  mapLayerStates = {},
  // Optional content rendered in a panel attached to the rail's right edge.
  // Provided by the parent based on which footer item (Inbox / AI) is active.
  secondary = null
}) {
  const footerToggleStates = { chatOpen, messagesOpen };
  const hasSecondary = !!secondary;
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
    // --nav-w  = rail width only (icon strip)
    // --nav-total-w = rail + secondary panel; what main-content needs to clear
    const railW = expanded ? EXPANDED_W : COLLAPSED_W;
    const total = railW + (hasSecondary ? SECONDARY_W : 0);
    document.documentElement.style.setProperty('--nav-w',       `${railW}px`);
    document.documentElement.style.setProperty('--nav-total-w', `${total}px`);
  }, [expanded, hasSecondary]);

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

  // Either selects a view or fires a registered modal-opener action.
  const handleSubItem = (item) => {
    if (item.view) {
      handleSelect(item.view);
    } else if (item.actionKey && typeof actions[item.actionKey] === 'function') {
      actions[item.actionKey]();
      setMobileOpen(false);
    }
  };

  const filteredNav = NAV.filter(node => {
    if (node.adminOnly && !isAdmin) return false;
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
        className={`nav-sidebar ${expanded ? 'is-expanded' : 'is-collapsed'} ${mobileOpen ? 'is-mobile-open' : ''} ${hasSecondary ? 'has-secondary' : ''}`}
        style={{ '--nav-w': `${railWidth}px`, '--nav-secondary-w': `${SECONDARY_W}px` }}
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
                      {node.items.map(item => {
                        // Toggle sub-items (Map Layers): active when the
                        // bound state is on. View sub-items: active when
                        // current view matches.
                        const isToggle = !!item.toggleProp;
                        const isActive = isToggle
                          ? !!mapLayerStates[item.toggleProp]
                          : (item.view && view === item.view);
                        return (
                          <button
                            key={item.view || item.actionKey}
                            type="button"
                            className={`nav-subitem ${isActive ? 'is-active' : ''}`}
                            onClick={() => handleSubItem(item)}
                            title={item.preview ? `${item.label} — preview (data wiring incomplete)` : undefined}
                          >
                            <span className="nav-subitem-icon" aria-hidden>{item.icon}</span>
                            <span className="nav-subitem-label">{item.label}</span>
                            {isToggle && (
                              <span
                                aria-hidden
                                style={{
                                  marginLeft: 'auto',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                  color: isActive ? 'var(--accent)' : 'var(--fg-muted)',
                                  opacity: isActive ? 1 : 0.5
                                }}
                              >
                                {isActive ? 'On' : 'Off'}
                              </span>
                            )}
                            {item.preview && (
                              <span className="nav-subitem-badge" aria-label="Preview">Preview</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer rail — pinned to the bottom. Persistent shortcuts to
              the floating Inbox + AI Assistant panels. */}
          <nav className="nav-footer">
            {NAV_FOOTER.map(item => {
              const active = item.toggleProp ? !!footerToggleStates[item.toggleProp] : false;
              return (
                <NavLink
                  key={item.actionKey}
                  icon={item.icon}
                  label={item.label}
                  active={active}
                  expanded={expanded}
                  onClick={() => {
                    if (typeof actions[item.actionKey] === 'function') {
                      actions[item.actionKey]();
                    }
                    setMobileOpen(false);
                  }}
                />
              );
            })}
          </nav>
        </div>

        {hasSecondary && (
          <div className="nav-secondary" role="region" aria-label="Sidebar panel">
            {secondary}
          </div>
        )}
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
