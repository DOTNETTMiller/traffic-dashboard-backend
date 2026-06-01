import { useEffect, useRef, useState } from 'react';

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

  {
    // Sub-items here are toggles, not view-changers — clicking flips the
    // matching map overlay's visibility instead of navigating. Each sub-item
    // declares an actionKey (the toggle handler in App.jsx) and a toggleProp
    // (the boolean field in mapLayerStates that decides the active style).
    //
    // Order is by usage frequency: events first (always-relevant), then the
    // operations toggles (parking, diversion routes, aerial overlays), then
    // infrastructure reference layers, then permit-rule layers.
    //
    // Sits directly under "Map" so the layer toggles are co-located with
    // the view they affect — users found them easier to discover that way.
    type: 'group',
    key: 'map-layers',
    icon: '🗺️',
    label: 'Map Layers',
    items: [
      { actionKey: 'toggle-events',           toggleProp: 'showEvents',              icon: '⚠️', label: 'Traffic Events' },
      { actionKey: 'toggle-interstate-only',  toggleProp: 'interstateOnly',          icon: '🛣️', label: 'Interstate Only' },
      { actionKey: 'toggle-weather-alerts',   toggleProp: 'showWeatherAlerts',       icon: '🌩️', label: 'Weather Alerts' },
      { actionKey: 'toggle-border-wait-times', toggleProp: 'showBorderWaitTimes',    icon: '🛂', label: 'Border Wait Times' },
      { actionKey: 'toggle-parking',          toggleProp: 'showParking',             icon: '🅿️', label: 'Truck Parking' },
      { actionKey: 'toggle-maasto-parking',   toggleProp: 'showMaastoParking',       icon: '🚛', label: 'MAASTO Parking (live)' },
      { actionKey: 'toggle-historical-crashes', toggleProp: 'showHistoricalCrashes', icon: '💥', label: 'Historical Crashes (FARS)' },
      { actionKey: 'toggle-diversion-routes', toggleProp: 'showDiversionRoutes',     icon: '🛣️', label: 'Diversion Routes' },
      { actionKey: 'toggle-aerial-overlays',  toggleProp: 'showAerialOverlays',      icon: '🛩️', label: 'Aerial Overlays' },
      { view: 'aerialOverlays',                                                      icon: '🛩️', label: 'Aerial Overlay Library' },
      { actionKey: 'toggle-its-equipment',    toggleProp: 'showITSEquipment',        icon: '📡', label: 'ITS Equipment' },
      { actionKey: 'toggle-v2x',              toggleProp: 'showV2XDeployments',      icon: '📶', label: 'V2X Deployments' },
      { actionKey: 'toggle-cadd',             toggleProp: 'showCADDElements',        icon: '📐', label: 'CADD Elements' },
      { actionKey: 'toggle-interchanges',     toggleProp: 'showInterchanges',        icon: '🔀', label: 'Interchanges' },
      { actionKey: 'toggle-bridge-clearance', toggleProp: 'showBridgeClearances',    icon: '🌉', label: 'Bridge Clearances' },
      { actionKey: 'toggle-corridor-regs',    toggleProp: 'showCorridorRegulations', icon: '🚛', label: 'OS/OW Permit Rules' }
    ]
  },

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
      { actionKey: 'export-data',          icon: '📥', label: 'Export Data' }
    ]
  },

  {
    // Data Quality is now focused on measurement + comparison only —
    // operational/forward-looking views (Predictive Analytics, Asset
    // Health, Procurement) moved to the new Operations group below so
    // this section reads as one coherent "how good is the data" topic.
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
      { view: 'vendorPortal',          icon: '🏢', label: 'Vendor Portal' }
    ]
  },
  {
    // Operations — workflow + decision-support tools. Pulled out of
    // Communications (which is now strictly messaging) and Data Quality
    // (which is now strictly measurement). DMS Messaging, Closure
    // Approval, Diversion Route Library, Corridor Delays do live ops;
    // Predictive Analytics, Asset Health, Procurement are forward-
    // looking decision support that shapes those ops.
    type: 'group',
    key: 'operations',
    icon: '🛠️',
    label: 'Operations',
    items: [
      { view: 'dmsMessaging',          icon: '🚧', label: 'DMS Messaging' },
      { view: 'closureApproval',       icon: '✅', label: 'Closure Approval' },
      { view: 'diversionRoutes',       icon: '🛣️', label: 'Diversion Route Library' },
      { view: 'corridorDelays',        icon: '⏰', label: 'Corridor Delays' },
      { view: 'crashAnalytics',        icon: '🚧', label: 'Crash Analytics' },
      { view: 'predictiveAnalytics',   icon: '🔮', label: 'Predictive Analytics' },
      { view: 'assetHealth',           icon: '🔧', label: 'Asset Health' },
      { view: 'feedSubmission',        icon: '📤', label: 'Feed Submission' }
    ]
  },
  {
    // Communications — strictly messaging + alerts now (the operational
    // workflows moved to the Operations group).
    type: 'group',
    key: 'communications',
    icon: '💬',
    label: 'Communications',
    items: [
      { view: 'messages',                    icon: '✉️', label: 'Messages' },
      { actionKey: 'open-corridor-briefing', icon: '📋', label: 'Corridor Briefing' },
      { actionKey: 'open-alerts',            icon: '🔔', label: 'Alerts' }
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
      { view: 'caddModels',            icon: '📐', label: 'CADD Models' },
      { view: 'digitalInfrastructure', icon: '🌉', label: 'Digital Infrastructure' },
      { view: 'procurement',           icon: '💰', label: 'Procurement' },
      { view: 'grants',                icon: '💵', label: 'Funding Opportunities' }
    ]
  },
  {
    type: 'group',
    key: 'commercial-freight',
    icon: '🚚',
    label: 'Commercial Freight',
    items: [
      { view: 'nasco-regulations', icon: '📜', label: 'NASCO Regulations' },
      { view: 'groundTruth',       icon: '🎯', label: 'Ground Truth' }
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
      { view: 'admin',           icon: '⚙️', label: 'Admin Panel' },
      { view: 'adminUsers',      icon: '👥', label: 'Users' },
      { view: 'adminFeeds',      icon: '📡', label: 'Feed Submissions' }
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

  // User-controlled top-level ordering. Persisted as an array of node ids
  // (item.view or group.key). New nodes added to NAV after the last save
  // are appended in their default position so updates don't lose the
  // user's customizations. `null` means "use NAV order as-is".
  const [navOrder, setNavOrder] = useState(() => {
    try {
      const raw = localStorage.getItem('nav.order');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  // Per-group sub-item ordering. Shape: { [groupKey]: [itemId, ...] }.
  // Item IDs are item.view || item.actionKey. Same append-on-update
  // behavior as top-level — newly-added sub-items appear at the end of
  // any group the user has customized.
  const [subOrders, setSubOrders] = useState(() => {
    try {
      const raw = localStorage.getItem('nav.subOrder');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  // Per-item group reassignment. Shape: { [itemId]: groupKey }.
  // Lets the user drag a sub-item out of its default group into a
  // different one (e.g. move "Predictive Analytics" from Operations
  // into State Tools). When unset for an item, the default group from
  // the NAV array applies.
  const [subAssign, setSubAssign] = useState(() => {
    try {
      const raw = localStorage.getItem('nav.subAssign');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });

  // Drag state. Top-level and sub-item drags are tracked separately so
  // a sub-item drag doesn't accidentally land on a top-level slot or
  // vice versa.
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [subDraggingId, setSubDraggingId] = useState(null);  // 'groupKey::itemId'
  const [subDragOverId, setSubDragOverId] = useState(null);

  // Auto-expand-on-hover timer for cross-group sub-item drags. When the
  // user hovers a closed group's header for ~500ms during a drag, the
  // group opens automatically so they can drop at a specific position.
  // Stored in a ref to avoid re-renders for every dragover event.
  const dragHoverTimer = useRef(null);
  const cancelDragHoverTimer = () => {
    if (dragHoverTimer.current) {
      clearTimeout(dragHoverTimer.current.id);
      dragHoverTimer.current = null;
    }
  };

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

  const nodeId = (node) => node.view || node.key;

  // Apply user-saved ordering on top of the default NAV array. Any nodes
  // not present in the saved order (newly-added entries since last save)
  // get appended at the end so they're discoverable.
  const orderedNav = (() => {
    if (!Array.isArray(navOrder) || navOrder.length === 0) return NAV;
    const byId = new Map(NAV.map(n => [nodeId(n), n]));
    const seen = new Set();
    const ordered = [];
    for (const id of navOrder) {
      if (byId.has(id) && !seen.has(id)) {
        ordered.push(byId.get(id));
        seen.add(id);
      }
    }
    for (const n of NAV) {
      if (!seen.has(nodeId(n))) ordered.push(n);
    }
    return ordered;
  })();

  const filteredNav = orderedNav.filter(node => {
    if (node.adminOnly && !isAdmin) return false;
    if (node.type === 'item' && node.view === 'admin' && !isAdmin) return false;
    return true;
  });

  // Persist a reorder. Captures the order from the *full* NAV (post-drag,
  // pre-filter) so admin items remain in the saved order even when the
  // current user can't see them.
  const persistOrder = (newOrderIds) => {
    setNavOrder(newOrderIds);
    try { localStorage.setItem('nav.order', JSON.stringify(newOrderIds)); } catch {}
  };

  const handleDragStart = (id) => (e) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Some browsers ignore drag without dataTransfer payload.
    try { e.dataTransfer.setData('text/plain', id); } catch {}
  };

  const handleDragOver = (id) => (e) => {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) setDragOverId(id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDrop = (targetId) => (e) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      handleDragEnd();
      return;
    }
    const currentIds = orderedNav.map(nodeId);
    const fromIdx = currentIds.indexOf(draggingId);
    const toIdx   = currentIds.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) { handleDragEnd(); return; }
    const next = [...currentIds];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggingId);
    persistOrder(next);
    handleDragEnd();
  };

  const resetOrder = () => {
    setNavOrder(null);
    setSubOrders({});
    setSubAssign({});
    try {
      localStorage.removeItem('nav.order');
      localStorage.removeItem('nav.subOrder');
      localStorage.removeItem('nav.subAssign');
    } catch {}
  };

  const hasCustomTopOrder  = Array.isArray(navOrder) && navOrder.length > 0;
  const hasCustomSubOrder  = subOrders && Object.keys(subOrders).length > 0;
  const hasCustomSubAssign = subAssign && Object.keys(subAssign).length > 0;
  const isCustomOrder = hasCustomTopOrder || hasCustomSubOrder || hasCustomSubAssign;

  // Sub-item helpers ------------------------------------------------------

  const subItemId = (item) => item.view || item.actionKey;

  // Default group key for each known sub-item, derived from NAV. Used to
  // resolve "where does this item live by default?" when the user has
  // not reassigned it. Stable per render since NAV is module-level.
  const defaultSubGroup = (() => {
    const m = new Map();
    for (const node of NAV) {
      if (node.type === 'group' && Array.isArray(node.items)) {
        for (const it of node.items) m.set(subItemId(it), node.key);
      }
    }
    return m;
  })();

  // Map of every sub-item definition keyed by id, regardless of which
  // group it currently belongs to. Cross-group moves still need the
  // original definition (icon, label, action wiring).
  const subItemRegistry = (() => {
    const m = new Map();
    for (const node of NAV) {
      if (node.type === 'group' && Array.isArray(node.items)) {
        for (const it of node.items) m.set(subItemId(it), it);
      }
    }
    return m;
  })();

  const effectiveGroupOf = (itemId) => subAssign[itemId] || defaultSubGroup.get(itemId);

  // The items that should render under this group, after both
  // reassignment (subAssign) and ordering (subOrders) are applied.
  // Ignores the group's own .items list at runtime — it's only used to
  // seed the default-group map above.
  const groupItems = (group) => {
    const collected = [];
    for (const [id, item] of subItemRegistry.entries()) {
      if (effectiveGroupOf(id) === group.key) collected.push(item);
    }
    const saved = subOrders[group.key];
    if (!Array.isArray(saved) || saved.length === 0) return collected;
    const byId = new Map(collected.map(it => [subItemId(it), it]));
    const seen = new Set();
    const out = [];
    for (const id of saved) {
      if (byId.has(id) && !seen.has(id)) {
        out.push(byId.get(id));
        seen.add(id);
      }
    }
    for (const it of collected) if (!seen.has(subItemId(it))) out.push(it);
    return out;
  };

  // One write that updates orders + assignment together. Used by every
  // drop handler to keep the three pieces of state in sync.
  const persistSub = ({ subOrders: nextOrders, subAssign: nextAssign }) => {
    if (nextOrders) {
      setSubOrders(nextOrders);
      try { localStorage.setItem('nav.subOrder', JSON.stringify(nextOrders)); } catch {}
    }
    if (nextAssign) {
      setSubAssign(nextAssign);
      try { localStorage.setItem('nav.subAssign', JSON.stringify(nextAssign)); } catch {}
    }
  };

  const handleSubDragStart = (groupKey, id) => (e) => {
    e.stopPropagation();
    setSubDraggingId(`${groupKey}::${id}`);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch {}
  };

  // Hover-over a sub-item in any group while dragging. Same-group drops
  // reorder; cross-group drops insert at the hovered item's position.
  const handleSubDragOver = (groupKey, id) => (e) => {
    if (!subDraggingId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const next = `${groupKey}::${id}`;
    if (subDragOverId !== next) setSubDragOverId(next);
  };

  // Hover-over a different group's *header* while dragging. Triggers
  // an "append to end of this group" drop indicator AND, if the group
  // is closed, schedules an auto-expand after a short delay so the
  // user can drop at a specific position inside.
  const handleSubDragOverGroupHeader = (groupKey) => (e) => {
    if (!subDraggingId) return;
    const [sourceGroupKey] = subDraggingId.split('::');
    if (sourceGroupKey === groupKey) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const next = `${groupKey}::__header__`;
    if (subDragOverId !== next) setSubDragOverId(next);

    // Schedule auto-expand if this group is closed and we aren't
    // already counting down for it.
    const alreadyOpen = openGroups[groupKey] || (expanded && isGroupActive(NAV.find(n => n.key === groupKey) || {}));
    if (!alreadyOpen && dragHoverTimer.current?.groupKey !== groupKey) {
      cancelDragHoverTimer();
      const id = setTimeout(() => {
        setOpenGroups(g => ({ ...g, [groupKey]: true }));
        dragHoverTimer.current = null;
      }, 500);
      dragHoverTimer.current = { id, groupKey };
    }
  };

  const handleSubDragEnd = () => {
    cancelDragHoverTimer();
    setSubDraggingId(null);
    setSubDragOverId(null);
  };

  // End-of-list drop zone — lets the user append a sub-item to a group
  // even when the group has no other sub-items they want to land on.
  const handleSubDragOverEnd = (groupKey) => (e) => {
    if (!subDraggingId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const next = `${groupKey}::__end__`;
    if (subDragOverId !== next) setSubDragOverId(next);
  };

  const handleSubDropAtEnd = (groupKey) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!subDraggingId) { handleSubDragEnd(); return; }
    const [sourceGroupKey, draggingItemId] = subDraggingId.split('::');
    const sourceGroup = NAV.find(n => n.key === sourceGroupKey);
    const targetGroup = NAV.find(n => n.key === groupKey);
    if (!sourceGroup || !targetGroup) { handleSubDragEnd(); return; }

    const nextOrders = { ...subOrders };
    const nextAssign = { ...subAssign };
    const targetIds  = groupItems(targetGroup).map(subItemId).filter(id => id !== draggingItemId);
    nextOrders[groupKey] = [...targetIds, draggingItemId];

    if (sourceGroupKey !== groupKey) {
      const sourceIds = groupItems(sourceGroup).map(subItemId).filter(id => id !== draggingItemId);
      nextOrders[sourceGroupKey] = sourceIds;
      if (defaultSubGroup.get(draggingItemId) === groupKey) delete nextAssign[draggingItemId];
      else nextAssign[draggingItemId] = groupKey;
    }
    persistSub({ subOrders: nextOrders, subAssign: nextAssign });
    handleSubDragEnd();
  };

  // Drop on a sub-item — same-group reorder OR cross-group move.
  const handleSubDrop = (groupKey, targetId) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!subDraggingId) { handleSubDragEnd(); return; }
    const [sourceGroupKey, draggingItemId] = subDraggingId.split('::');
    if (sourceGroupKey === groupKey && draggingItemId === targetId) {
      handleSubDragEnd();
      return;
    }
    const sourceGroup = NAV.find(n => n.key === sourceGroupKey);
    const targetGroup = NAV.find(n => n.key === groupKey);
    if (!sourceGroup || !targetGroup) { handleSubDragEnd(); return; }

    const nextOrders = { ...subOrders };
    const nextAssign = { ...subAssign };

    if (sourceGroupKey === groupKey) {
      // Same-group reorder
      const currentIds = groupItems(targetGroup).map(subItemId);
      const fromIdx = currentIds.indexOf(draggingItemId);
      const toIdx   = currentIds.indexOf(targetId);
      if (fromIdx < 0 || toIdx < 0) { handleSubDragEnd(); return; }
      const next = [...currentIds];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggingItemId);
      nextOrders[groupKey] = next;
    } else {
      // Cross-group move: drop the item at the position the user pointed at.
      const sourceIds = groupItems(sourceGroup).map(subItemId).filter(id => id !== draggingItemId);
      const targetIds = groupItems(targetGroup).map(subItemId);
      const toIdx     = targetIds.indexOf(targetId);
      const newTarget = [...targetIds];
      newTarget.splice(toIdx >= 0 ? toIdx : newTarget.length, 0, draggingItemId);
      nextOrders[sourceGroupKey] = sourceIds;
      nextOrders[groupKey]       = newTarget;
      // Default group? Drop the explicit assignment to keep state minimal.
      if (defaultSubGroup.get(draggingItemId) === groupKey) delete nextAssign[draggingItemId];
      else nextAssign[draggingItemId] = groupKey;
    }
    persistSub({ subOrders: nextOrders, subAssign: nextAssign });
    handleSubDragEnd();
  };

  // Drop on a different group's header — append to end of that group.
  const handleSubDropOnGroupHeader = (groupKey) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!subDraggingId) { handleSubDragEnd(); return; }
    const [sourceGroupKey, draggingItemId] = subDraggingId.split('::');
    if (sourceGroupKey === groupKey) { handleSubDragEnd(); return; }

    const sourceGroup = NAV.find(n => n.key === sourceGroupKey);
    const targetGroup = NAV.find(n => n.key === groupKey);
    if (!sourceGroup || !targetGroup) { handleSubDragEnd(); return; }

    const nextOrders = { ...subOrders };
    const nextAssign = { ...subAssign };

    const sourceIds = groupItems(sourceGroup).map(subItemId).filter(id => id !== draggingItemId);
    const targetIds = groupItems(targetGroup).map(subItemId);
    nextOrders[sourceGroupKey] = sourceIds;
    nextOrders[groupKey]       = [...targetIds, draggingItemId];

    if (defaultSubGroup.get(draggingItemId) === groupKey) delete nextAssign[draggingItemId];
    else nextAssign[draggingItemId] = groupKey;

    persistSub({ subOrders: nextOrders, subAssign: nextAssign });
    handleSubDragEnd();
  };

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
              const id = nodeId(node);
              // Drag is only meaningful when the user can see the labels —
              // collapsed mode hides reorder affordances entirely.
              const dragProps = expanded ? {
                draggable: true,
                onDragStart: handleDragStart(id),
                onDragOver:  handleDragOver(id),
                onDrop:      handleDrop(id),
                onDragEnd:   handleDragEnd
              } : {};
              const wrapClass = `nav-reorder-wrap`
                + (draggingId === id ? ' is-dragging' : '')
                + (dragOverId === id ? ' is-drag-over' : '');

              if (node.type === 'item') {
                const active = view === node.view;
                return (
                  <div key={node.view} className={wrapClass} {...dragProps}>
                    <NavLink
                      icon={node.icon}
                      label={node.label}
                      active={active}
                      expanded={expanded}
                      onClick={() => handleSelect(node.view)}
                    />
                  </div>
                );
              }

              const groupActive = isGroupActive(node);
              const open = openGroups[node.key] || (expanded && groupActive);
              // Cross-group drop indicator: when a sub-item from a
              // different group is hovering this group's header.
              const isHeaderDropTarget = subDragOverId === `${node.key}::__header__`;
              // Combined drag handlers: top-level drag uses the existing
              // wrapper handlers; sub-item drag intercepts onDragOver /
              // onDrop so a sub-item drop on a *different* group's
              // header appends to that group instead of reordering at
              // the top level.
              const groupDragHandlers = expanded ? {
                draggable: true,
                onDragStart: handleDragStart(id),
                onDragOver: (e) => {
                  if (subDraggingId) handleSubDragOverGroupHeader(node.key)(e);
                  else handleDragOver(id)(e);
                },
                onDrop: (e) => {
                  if (subDraggingId) handleSubDropOnGroupHeader(node.key)(e);
                  else handleDrop(id)(e);
                },
                onDragEnd: () => {
                  handleDragEnd();
                  handleSubDragEnd();
                }
              } : {};
              const groupWrapClass = `nav-group nav-reorder-wrap`
                + (draggingId === id ? ' is-dragging' : '')
                + (dragOverId === id ? ' is-drag-over' : '')
                + (isHeaderDropTarget ? ' is-drag-over' : '');

              return (
                <div key={node.key} className={groupWrapClass} {...groupDragHandlers}>
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
                      {groupItems(node).map(item => {
                        // Toggle sub-items (Map Layers): active when the
                        // bound state is on. View sub-items: active when
                        // current view matches.
                        const isToggle = !!item.toggleProp;
                        const isActive = isToggle
                          ? !!mapLayerStates[item.toggleProp]
                          : (item.view && view === item.view);
                        const itemId   = subItemId(item);
                        const subKey   = `${node.key}::${itemId}`;
                        const isSubDrag = subDraggingId === subKey;
                        const isSubOver = subDragOverId === subKey;
                        const subWrapClass = `nav-reorder-wrap nav-subitem-wrap`
                          + (isSubDrag ? ' is-dragging' : '')
                          + (isSubOver ? ' is-drag-over' : '');
                        return (
                          <div
                            key={itemId}
                            className={subWrapClass}
                            draggable
                            onDragStart={handleSubDragStart(node.key, itemId)}
                            onDragOver={handleSubDragOver(node.key, itemId)}
                            onDrop={handleSubDrop(node.key, itemId)}
                            onDragEnd={handleSubDragEnd}
                          >
                            <button
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
                          </div>
                        );
                      })}
                      {/* End-of-list drop zone — visible only mid-drag. Lets
                          the user land a sub-item at the bottom of this
                          group without needing an existing target. Hidden
                          when the dragged item is already last in this
                          group (no-op drop). */}
                      {subDraggingId && (() => {
                        const [src, dragId] = subDraggingId.split('::');
                        const items  = groupItems(node);
                        const lastId = items.length ? subItemId(items[items.length - 1]) : null;
                        if (src === node.key && dragId === lastId) return null;
                        const endKey = `${node.key}::__end__`;
                        const overEnd = subDragOverId === endKey;
                        return (
                          <div
                            className={`nav-subitem-end-zone ${overEnd ? 'is-drag-over' : ''}`}
                            onDragOver={handleSubDragOverEnd(node.key)}
                            onDrop={handleSubDropAtEnd(node.key)}
                          />
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Reset-order helper — only surfaced when the user has actually
              reordered something. Subtle text link so it doesn't compete
              with primary nav. */}
          {expanded && isCustomOrder && (
            <button
              type="button"
              onClick={resetOrder}
              className="nav-reset-order"
              title="Reset menu order to default"
            >
              ↻ Reset menu order
            </button>
          )}

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
