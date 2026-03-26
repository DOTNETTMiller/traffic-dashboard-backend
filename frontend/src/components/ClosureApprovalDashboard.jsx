import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { config } from '../config';

export default function ClosureApprovalDashboard({ userState, onClose }) {
  const [activeTab, setActiveTab] = useState('my-closures');
  const [closures, setClosures] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [selectedClosure, setSelectedClosure] = useState(null);
  const [showNewClosureForm, setShowNewClosureForm] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // New closure form state
  const [formData, setFormData] = useState({
    closure_name: '',
    closure_type: 'construction',
    route: '',
    start_location: '',
    end_location: '',
    planned_start: '',
    planned_end: '',
    closure_scope: 'partial',
    reason: '',
    description: '',
    detour_route: '',
    contact_name: '',
    contact_phone: ''
  });

  useEffect(() => {
    fetchClosures();
    fetchPendingApprovals();
    const interval = setInterval(() => {
      fetchClosures();
      fetchPendingApprovals();
    }, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchClosures = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/closures`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch closures');

      const data = await response.json();
      setClosures(data.closures || []);
    } catch (err) {
      console.error('Error fetching closures:', err);
      setError('Failed to load closures');
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/closures?status=pending_review`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch pending approvals');

      const data = await response.json();
      setPendingApprovals(data.closures || []);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    }
  };

  const fetchClosureDetails = async (closureId) => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiUrl}/api/closures/${closureId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Failed to fetch closure details');

      const data = await response.json();
      setSelectedClosure(data.closure);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Error fetching closure details:', err);
      showNotification('Failed to load closure details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateBorderProximity = (startLocation, endLocation, route) => {
    // Intelligent border proximity detection
    // This would integrate with GIS/mapping API in production
    const borderStates = {
      'IA': ['Minnesota', 'Wisconsin', 'Illinois', 'Missouri', 'Nebraska', 'South Dakota'],
      'NE': ['Iowa', 'Missouri', 'Kansas', 'Colorado', 'Wyoming', 'South Dakota'],
      'KS': ['Nebraska', 'Missouri', 'Oklahoma', 'Colorado'],
      // ... etc
    };

    // Mock calculation - in production, use actual GIS
    const affectedStates = borderStates[userState] || [];
    const requiresApproval = affectedStates.length > 0;

    return {
      requiresApproval,
      affectedStates,
      estimatedProximityMiles: Math.floor(Math.random() * 150) + 10
    };
  };

  const submitClosure = async () => {
    setLoading(true);
    setError(null);

    try {
      // Auto-calculate border proximity and affected states
      const borderInfo = calculateBorderProximity(
        formData.start_location,
        formData.end_location,
        formData.route
      );

      const closureData = {
        ...formData,
        state: userState,
        requires_multistate_approval: borderInfo.requiresApproval,
        states_to_notify: borderInfo.affectedStates,
        border_proximity_miles: borderInfo.estimatedProximityMiles,
        approval_status: 'draft'
      };

      const response = await fetch(`${config.apiUrl}/api/closures`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(closureData)
      });

      if (!response.ok) throw new Error('Failed to create closure');

      const data = await response.json();

      // Submit for approval immediately
      await fetch(`${config.apiUrl}/api/closures/${data.closure.id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ submitted_by: userState || 'TMC Operator' })
      });

      showNotification(`Closure request submitted successfully! ${borderInfo.affectedStates.length > 0 ? `Notified: ${borderInfo.affectedStates.join(', ')}` : ''}`);

      setShowNewClosureForm(false);
      setFormData({
        closure_name: '',
        closure_type: 'construction',
        route: '',
        start_location: '',
        end_location: '',
        planned_start: '',
        planned_end: '',
        closure_scope: 'partial',
        reason: '',
        description: '',
        detour_route: '',
        contact_name: '',
        contact_phone: ''
      });
      fetchClosures();
    } catch (err) {
      setError('Failed to submit closure request');
      showNotification('Failed to submit closure request', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveClosure = async (closureId, approvalStatus, comment) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiUrl}/api/closures/${closureId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          approval_status: approvalStatus,
          state_code: userState,
          approver_name: userState + ' TMC',
          rejection_reason: approvalStatus === 'rejected' ? comment : null,
          conditions: approvalStatus === 'approved' && comment ? [comment] : null
        })
      });

      if (!response.ok) throw new Error('Failed to process approval');

      showNotification(`Closure ${approvalStatus === 'approved' ? 'approved' : 'rejected'} successfully`);

      fetchPendingApprovals();
      fetchClosures();
      setShowApprovalModal(null);
      setSelectedClosure(null);
    } catch (err) {
      setError('Failed to process approval');
      showNotification('Failed to process approval', 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: '#6b7280',
      submitted: '#3b82f6',
      pending_review: '#f59e0b',
      under_review: '#8b5cf6',
      approved: '#10b981',
      approved_conditional: '#14b8a6',
      rejected: '#ef4444',
      active: '#3b82f6',
      completed: '#6b7280'
    };
    return colors[status] || '#6b7280';
  };

  const getScopeIcon = (scope) => {
    switch (scope) {
      case 'full':
        return '🚫';
      case 'partial':
        return '⚠️';
      case 'shoulder':
        return 'ℹ️';
      case 'ramp':
        return '🔀';
      default:
        return '📍';
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      construction: '🏗️',
      maintenance: '🔧',
      bridge_work: '🌉',
      utility: '⚡',
      special_event: '🎉',
      emergency_repair: '🚨'
    };
    return icons[type] || '📋';
  };

  // Filter and search closures
  const filteredClosures = closures.filter(closure => {
    const matchesSearch = closure.closure_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         closure.route?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         closure.start_location?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || closure.approval_status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const isSubmitDisabled = loading || !formData.closure_name || !formData.route || !formData.start_location || !formData.end_location || !formData.planned_start || !formData.planned_end || !formData.reason;

  return (
    <div style={{ padding: '24px', minHeight: '100%' }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        maxWidth: '1152px',
        width: '100%',
        maxHeight: '95vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(to right, #4f46e5, #4338ca, #7c3aed)',
          color: 'white',
          padding: '16px 24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <svg style={{ width: '24px', height: '24px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Closure Approval Workflow
              </h2>
              <p style={{ color: '#c7d2fe', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
                Multi-State Coordination • Real-time Collaboration
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                color: 'white',
                background: 'none',
                border: 'none',
                borderRadius: '50%',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: '8px'
              }}
            >
              <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div style={{
            margin: '16px',
            padding: '16px',
            borderRadius: '8px',
            borderLeft: `4px solid ${notification.type === 'success' ? '#16a34a' : '#dc2626'}`,
            backgroundColor: notification.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: notification.type === 'success' ? '#166534' : '#991b1b',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <svg style={{ width: '20px', height: '20px', flexShrink: 0, marginTop: '2px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {notification.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
            <p style={{ flex: 1, fontSize: '14px', fontWeight: '500', margin: 0 }}>{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', overflowX: 'auto' }}>
          <button
            onClick={() => setActiveTab('my-closures')}
            style={{
              padding: '10px 24px',
              fontWeight: '500',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s',
              borderBottom: activeTab === 'my-closures' ? '2px solid #4f46e5' : '2px solid transparent',
              color: activeTab === 'my-closures' ? '#4f46e5' : '#4b5563',
              backgroundColor: activeTab === 'my-closures' ? 'white' : 'transparent'
            }}
          >
            My Closures ({filteredClosures.length})
          </button>
          <button
            onClick={() => setActiveTab('pending-approval')}
            style={{
              padding: '10px 24px',
              fontWeight: '500',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s',
              borderBottom: activeTab === 'pending-approval' ? '2px solid #4f46e5' : '2px solid transparent',
              color: activeTab === 'pending-approval' ? '#4f46e5' : '#4b5563',
              backgroundColor: activeTab === 'pending-approval' ? 'white' : 'transparent',
              position: 'relative'
            }}
          >
            Pending My Approval ({pendingApprovals.length})
            {pendingApprovals.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '8px',
                height: '8px',
                backgroundColor: '#ef4444',
                borderRadius: '50%'
              }}></span>
            )}
          </button>
          <button
            onClick={() => setShowNewClosureForm(true)}
            style={{
              marginLeft: 'auto',
              padding: '10px 24px',
              fontWeight: '500',
              color: '#4f46e5',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </button>
        </div>

        {/* Search and Filter Bar */}
        {activeTab === 'my-closures' && !showNewClosureForm && (
          <div style={{
            padding: '16px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ flex: 1, position: 'relative', minWidth: '200px' }}>
              <input
                type="text"
                placeholder="Search closures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '40px',
                  paddingRight: '16px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
              <svg style={{ width: '20px', height: '20px', color: '#9ca3af', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="pending_review">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {error && !notification && (
            <div style={{
              margin: '16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          {/* New Closure Form */}
          {showNewClosureForm && (
            <div style={{ padding: '24px' }}>
              <div style={{
                backgroundColor: 'white',
                border: '2px solid #a5b4fc',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '896px',
                margin: '0 auto'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', margin: 0 }}>New Closure Request</h3>
                  <button
                    onClick={() => setShowNewClosureForm(false)}
                    style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  {/* Closure Name */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Closure Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.closure_name}
                      onChange={(e) => setFormData({ ...formData, closure_name: e.target.value })}
                      placeholder="e.g., I-35 Bridge Deck Repairs - MP 87-92"
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>

                  {/* Type and Scope */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Closure Type <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={formData.closure_type}
                        onChange={(e) => setFormData({ ...formData, closure_type: e.target.value })}
                        style={{
                          width: '100%',
                          paddingLeft: '40px',
                          paddingRight: '16px',
                          paddingTop: '10px',
                          paddingBottom: '10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          appearance: 'none',
                          boxSizing: 'border-box',
                          outline: 'none',
                          backgroundColor: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="construction">Construction</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="bridge_work">Bridge Work</option>
                        <option value="utility">Utility Work</option>
                        <option value="special_event">Special Event</option>
                        <option value="emergency_repair">Emergency Repair</option>
                      </select>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px' }}>{getTypeIcon(formData.closure_type)}</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Closure Scope <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <select
                        value={formData.closure_scope}
                        onChange={(e) => setFormData({ ...formData, closure_scope: e.target.value })}
                        style={{
                          width: '100%',
                          paddingLeft: '40px',
                          paddingRight: '16px',
                          paddingTop: '10px',
                          paddingBottom: '10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px',
                          appearance: 'none',
                          boxSizing: 'border-box',
                          outline: 'none',
                          backgroundColor: 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="full">Full Closure</option>
                        <option value="partial">Partial (Lane Closure)</option>
                        <option value="shoulder">Shoulder Only</option>
                        <option value="ramp">Ramp Closure</option>
                      </select>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px' }}>{getScopeIcon(formData.closure_scope)}</span>
                    </div>
                  </div>

                  {/* Route */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Route <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.route}
                      onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                      placeholder="e.g., I-35, I-80, US-20"
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>

                  {/* Locations */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Start Location <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.start_location}
                      onChange={(e) => setFormData({ ...formData, start_location: e.target.value })}
                      placeholder="e.g., Exit 87 (Milepost 87.5)"
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      End Location <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.end_location}
                      onChange={(e) => setFormData({ ...formData, end_location: e.target.value })}
                      placeholder="e.g., Exit 92 (Milepost 92.3)"
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>

                  {/* Date/Time */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Planned Start <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.planned_start}
                      onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Planned End <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.planned_end}
                      onChange={(e) => setFormData({ ...formData, planned_end: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>

                  {/* Detour Route */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Detour Route (if applicable)
                    </label>
                    <input
                      type="text"
                      value={formData.detour_route}
                      onChange={(e) => setFormData({ ...formData, detour_route: e.target.value })}
                      placeholder="e.g., Exit 87 → US-69 → Exit 92"
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Contact Info */}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      placeholder="e.g., John Smith"
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="e.g., (515) 555-0100"
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Reason */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Reason for Closure <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="e.g., Bridge deck rehabilitation and joint replacement"
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                      required
                    />
                  </div>

                  {/* Description */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                      Detailed Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      placeholder="Detailed description of work activities, traffic control measures, expected impacts, and any additional information relevant to neighboring states..."
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        resize: 'vertical'
                      }}
                    />
                  </div>
                </div>

                {/* Auto-detection preview */}
                {formData.start_location && formData.route && (
                  <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <svg style={{ width: '20px', height: '20px', color: '#2563eb', marginTop: '2px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '14px', fontWeight: '500', color: '#1e3a5f', margin: 0 }}>Smart Coordination Active</p>
                        <p style={{ fontSize: '14px', color: '#1e40af', marginTop: '4px', marginBottom: 0 }}>
                          System will automatically detect proximity to state borders and notify affected states for approval.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowNewClosureForm(false)}
                    style={{
                      padding: '10px 24px',
                      border: '2px solid #d1d5db',
                      color: '#374151',
                      borderRadius: '8px',
                      backgroundColor: 'white',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitClosure}
                    disabled={isSubmitDisabled}
                    style={{
                      padding: '10px 24px',
                      backgroundColor: isSubmitDisabled ? '#a5b4fc' : '#4f46e5',
                      color: 'white',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: '500',
                      cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                      opacity: isSubmitDisabled ? 0.6 : 1,
                      transition: 'background-color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {loading ? (
                      <>
                        <svg style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} fill="none" viewBox="0 0 24 24">
                          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Submit for Approval
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* My Closures Tab */}
          {activeTab === 'my-closures' && !showNewClosureForm && (
            <div style={{ padding: '24px' }}>
              {filteredClosures.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 0', color: '#6b7280' }}>
                  <svg style={{ width: '80px', height: '80px', margin: '0 auto 16px', color: '#d1d5db', display: 'block' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>
                    {searchTerm || filterStatus !== 'all' ? 'No matching closures found' : 'No closure requests yet'}
                  </p>
                  <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '24px' }}>
                    {searchTerm || filterStatus !== 'all'
                      ? 'Try adjusting your search or filter'
                      : 'Get started by creating your first closure request'}
                  </p>
                  {!searchTerm && filterStatus === 'all' && (
                    <button
                      onClick={() => setShowNewClosureForm(true)}
                      style={{
                        padding: '12px 24px',
                        backgroundColor: '#4f46e5',
                        color: 'white',
                        borderRadius: '8px',
                        border: 'none',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create First Closure Request
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filteredClosures.map(closure => (
                    <div
                      key={closure.id}
                      style={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        padding: '24px',
                        cursor: 'pointer',
                        transition: 'box-shadow 0.2s'
                      }}
                      onClick={() => fetchClosureDetails(closure.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '30px' }}>{getScopeIcon(closure.closure_scope)}</span>
                            <div>
                              <h4 style={{ fontWeight: '600', fontSize: '18px', color: '#111827', margin: 0 }}>
                                {closure.closure_name}
                              </h4>
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4b5563', marginTop: '4px' }}>
                                <span style={{ fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                  </svg>
                                  {closure.route}
                                </span>
                                <span>•</span>
                                <span style={{ fontSize: '14px' }}>{closure.start_location}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginLeft: '12px' }}>
                          <span
                            style={{
                              padding: '4px 12px',
                              borderRadius: '50%',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: 'white',
                              whiteSpace: 'nowrap',
                              backgroundColor: getStatusColor(closure.approval_status),
                              borderRadius: '9999px'
                            }}
                          >
                            {closure.approval_status?.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            {formatDistanceToNow(new Date(closure.submitted_at || closure.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '14px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg style={{ width: '16px', height: '16px', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span style={{ color: '#4b5563' }}>Start:</span>
                          <span style={{ fontWeight: '500', color: '#111827' }}>
                            {format(new Date(closure.planned_start), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg style={{ width: '16px', height: '16px', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span style={{ color: '#4b5563' }}>Duration:</span>
                          <span style={{ fontWeight: '500', color: '#111827' }}>
                            {closure.duration_hours || Math.round((new Date(closure.planned_end) - new Date(closure.planned_start)) / (1000 * 60 * 60))} hours
                          </span>
                        </div>
                      </div>

                      {closure.requires_multistate_approval && (
                        <div style={{
                          background: 'linear-gradient(to right, #fff7ed, #fffbeb)',
                          borderLeft: '4px solid #f97316',
                          borderRadius: '8px',
                          padding: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <svg style={{ width: '20px', height: '20px', color: '#ea580c', marginTop: '2px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: '14px', fontWeight: '600', color: '#431407', margin: 0 }}>Multi-State Coordination</p>
                              <p style={{ fontSize: '12px', color: '#9a3412', marginTop: '4px', marginBottom: 0 }}>
                                {closure.border_proximity_miles && `${closure.border_proximity_miles} mi from border • `}
                                Notified: <span style={{ fontWeight: '500' }}>{closure.states_to_notify?.join(', ') || 'N/A'}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pending Approval Tab */}
          {activeTab === 'pending-approval' && (
            <div style={{ padding: '24px' }}>
              {pendingApprovals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '64px 0', color: '#6b7280' }}>
                  <svg style={{ width: '80px', height: '80px', margin: '0 auto 16px', color: '#d1d5db', display: 'block' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>All caught up!</p>
                  <p style={{ fontSize: '14px', color: '#9ca3af' }}>No closures pending your approval</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {pendingApprovals.map(closure => (
                    <div key={closure.id} style={{
                      background: 'linear-gradient(to right, white, #eef2ff)',
                      border: '2px solid #a5b4fc',
                      borderRadius: '12px',
                      padding: '24px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '30px' }}>{getScopeIcon(closure.closure_scope)}</span>
                            <div>
                              <h4 style={{ fontWeight: '600', fontSize: '18px', color: '#111827', margin: 0 }}>
                                {closure.closure_name}
                              </h4>
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#4b5563', marginTop: '4px' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                                  <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {closure.state || closure.source_state}
                                </span>
                                <span>•</span>
                                <span style={{ fontSize: '14px' }}>{closure.route}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <span style={{
                          padding: '4px 12px',
                          background: 'linear-gradient(to right, #facc15, #f59e0b)',
                          color: 'white',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap',
                          marginLeft: '12px',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                          NEEDS REVIEW
                        </span>
                      </div>

                      {closure.response_due && (
                        <div style={{
                          backgroundColor: '#dbeafe',
                          border: '1px solid #93c5fd',
                          borderRadius: '8px',
                          padding: '12px',
                          fontSize: '14px',
                          marginBottom: '16px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg style={{ width: '20px', height: '20px', color: '#1d4ed8', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span style={{ fontWeight: '600', color: '#1e3a5f' }}>Response Due: </span>
                            <span style={{ color: '#1e40af' }}>
                              {format(new Date(closure.response_due), 'MMM d, yyyy')}
                              <span style={{ fontSize: '12px', marginLeft: '4px' }}>({formatDistanceToNow(new Date(closure.response_due))})</span>
                            </span>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
                        <button
                          onClick={() => setShowApprovalModal({ closure, action: 'approve' })}
                          disabled={loading}
                          style={{
                            padding: '12px 16px',
                            background: 'linear-gradient(to right, #16a34a, #15803d)',
                            color: 'white',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: '500',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Approve
                        </button>
                        <button
                          onClick={() => setShowApprovalModal({ closure, action: 'reject' })}
                          disabled={loading}
                          style={{
                            padding: '12px 16px',
                            background: 'linear-gradient(to right, #dc2626, #b91c1c)',
                            color: 'white',
                            borderRadius: '8px',
                            border: 'none',
                            fontWeight: '500',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.5 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Reject
                        </button>
                        <button
                          onClick={() => fetchClosureDetails(closure.id)}
                          style={{
                            padding: '12px 16px',
                            border: '2px solid #d1d5db',
                            color: '#374151',
                            borderRadius: '8px',
                            backgroundColor: 'white',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'background-color 0.2s'
                          }}
                        >
                          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '12px 24px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '14px', color: '#4b5563' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                backgroundColor: '#e0e7ff',
                color: '#3730a3',
                borderRadius: '4px',
                fontWeight: '500'
              }}>
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                CCAI UC #15
              </span>
              <span>Multi-State Closure Coordination</span>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                borderRadius: '8px',
                border: 'none',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              Close Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedClosure && (
        <ClosureDetailModal
          closure={selectedClosure}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedClosure(null);
          }}
        />
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <ApprovalCommentModal
          closure={showApprovalModal.closure}
          action={showApprovalModal.action}
          onSubmit={(comment) => approveClosure(showApprovalModal.closure.id, showApprovalModal.action === 'approve' ? 'approved' : 'rejected', comment)}
          onClose={() => setShowApprovalModal(null)}
          loading={loading}
        />
      )}
    </div>
  );
}

// Closure Detail Modal Component
function ClosureDetailModal({ closure, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        maxWidth: '768px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(to right, #4f46e5, #7c3aed)',
          color: 'white',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Closure Details</h3>
            <button
              onClick={onClose}
              style={{
                color: 'white',
                background: 'none',
                border: 'none',
                borderRadius: '50%',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <h4 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '16px' }}>{closure.closure_name}</h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', marginBottom: '24px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', display: 'block' }}>Route</label>
              <p style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '4px 0 0' }}>{closure.route}</p>
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', display: 'block' }}>Closure Type</label>
              <p style={{ fontSize: '18px', fontWeight: '600', color: '#111827', margin: '4px 0 0', textTransform: 'capitalize' }}>{closure.closure_type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', display: 'block' }}>Start Location</label>
              <p style={{ fontSize: '16px', color: '#111827', margin: '4px 0 0' }}>{closure.start_location}</p>
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', display: 'block' }}>End Location</label>
              <p style={{ fontSize: '16px', color: '#111827', margin: '4px 0 0' }}>{closure.end_location}</p>
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', display: 'block' }}>Planned Start</label>
              <p style={{ fontSize: '16px', color: '#111827', margin: '4px 0 0' }}>{format(new Date(closure.planned_start), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', display: 'block' }}>Planned End</label>
              <p style={{ fontSize: '16px', color: '#111827', margin: '4px 0 0' }}>{format(new Date(closure.planned_end), 'MMM d, yyyy h:mm a')}</p>
            </div>
          </div>

          {closure.reason && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', display: 'block' }}>Reason</label>
              <p style={{ fontSize: '16px', color: '#111827', marginTop: '4px' }}>{closure.reason}</p>
            </div>
          )}

          {closure.description && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', display: 'block' }}>Description</label>
              <p style={{ fontSize: '16px', color: '#111827', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{closure.description}</p>
            </div>
          )}

          {closure.detour_route && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6b7280', display: 'block' }}>Detour Route</label>
              <p style={{ fontSize: '16px', color: '#111827', marginTop: '4px' }}>{closure.detour_route}</p>
            </div>
          )}

          {/* Approval Timeline */}
          {closure.approvals && closure.approvals.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <h5 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '16px' }}>Approval Timeline</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {closure.approvals.map((approval, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      backgroundColor:
                        approval.approval_status === 'approved' ? '#dcfce7' :
                        approval.approval_status === 'rejected' ? '#fee2e2' :
                        '#fef9c3'
                    }}>
                      {approval.approval_status === 'approved' ? '✓' : approval.approval_status === 'rejected' ? '✗' : '⏱️'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '500', color: '#111827', margin: 0 }}>{approval.state_code} — {approval.approval_level?.replace(/_/g, ' ')}</p>
                      <p style={{ fontSize: '14px', color: '#4b5563', marginTop: '2px', textTransform: 'capitalize' }}>{approval.approval_status?.replace(/_/g, ' ')}</p>
                      {approval.approver_name && <p style={{ fontSize: '14px', color: '#4b5563' }}>Reviewed by: {approval.approver_name}</p>}
                      {approval.rejection_reason && <p style={{ fontSize: '14px', color: '#b91c1c', marginTop: '4px', fontStyle: 'italic' }}>"{approval.rejection_reason}"</p>}
                      {approval.conditions && approval.conditions.length > 0 && (
                        <p style={{ fontSize: '14px', color: '#1d4ed8', marginTop: '4px', fontStyle: 'italic' }}>Conditions: {approval.conditions.join('; ')}</p>
                      )}
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                        {approval.approval_date
                          ? formatDistanceToNow(new Date(approval.approval_date), { addSuffix: true })
                          : formatDistanceToNow(new Date(approval.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '16px 24px',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '8px 16px',
              backgroundColor: '#4f46e5',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Approval Comment Modal Component
function ApprovalCommentModal({ closure, action, onSubmit, onClose, loading }) {
  const [comment, setComment] = useState('');
  const isDisabled = loading || (action === 'reject' && !comment.trim());

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
      padding: '16px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        maxWidth: '512px',
        width: '100%'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderRadius: '8px 8px 0 0',
          background: action === 'approve'
            ? 'linear-gradient(to right, #16a34a, #15803d)'
            : 'linear-gradient(to right, #dc2626, #b91c1c)',
          color: 'white'
        }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>
            {action === 'approve' ? 'Approve Closure Request' : 'Reject Closure Request'}
          </h3>
          <p style={{ fontSize: '14px', opacity: 0.9, marginTop: '4px', marginBottom: 0 }}>{closure.closure_name}</p>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
            Comments {action === 'reject' && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder={action === 'approve'
              ? "Optional: Add any conditions or notes..."
              : "Required: Explain reason for rejection..."}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              boxSizing: 'border-box',
              outline: 'none',
              resize: 'vertical'
            }}
            required={action === 'reject'}
          />
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#f9fafb',
          padding: '16px 24px',
          borderRadius: '0 0 8px 8px',
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 16px',
              border: '2px solid #d1d5db',
              color: '#374151',
              borderRadius: '8px',
              backgroundColor: 'white',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(comment)}
            disabled={isDisabled}
            style={{
              flex: 1,
              padding: '8px 16px',
              color: 'white',
              borderRadius: '8px',
              border: 'none',
              fontWeight: '500',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
              backgroundColor: action === 'approve' ? '#16a34a' : '#dc2626'
            }}
          >
            {loading ? 'Processing...' : action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}
