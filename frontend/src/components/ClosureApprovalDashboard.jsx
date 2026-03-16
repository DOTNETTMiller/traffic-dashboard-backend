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
      const response = await fetch(`${config.apiUrl}/api/closures?status=pending_approval&state=${userState}`, {
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
        credentials: 'include'
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
          approver_state: userState,
          comment
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Closure Approval Workflow</span>
                <span className="sm:hidden">Closures</span>
              </h2>
              <p className="text-indigo-100 text-xs sm:text-sm mt-1 hidden sm:block">
                Multi-State Coordination • Real-time Collaboration
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-indigo-500 rounded-full p-2 transition-colors ml-2"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div className={`mx-4 mt-4 p-4 rounded-lg border-l-4 flex items-start gap-3 ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-500 text-green-800'
              : 'bg-red-50 border-red-500 text-red-800'
          }`}>
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {notification.type === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
            <p className="flex-1 text-sm font-medium">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b bg-gray-50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('my-closures')}
            className={`px-4 sm:px-6 py-2 sm:py-3 font-medium transition-colors text-sm sm:text-base whitespace-nowrap ${
              activeTab === 'my-closures'
                ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="hidden sm:inline">My Closures ({filteredClosures.length})</span>
            <span className="sm:hidden">Mine ({filteredClosures.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('pending-approval')}
            className={`px-4 sm:px-6 py-2 sm:py-3 font-medium transition-colors relative text-sm sm:text-base whitespace-nowrap ${
              activeTab === 'pending-approval'
                ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="hidden sm:inline">Pending My Approval ({pendingApprovals.length})</span>
            <span className="sm:hidden">Pending ({pendingApprovals.length})</span>
            {pendingApprovals.length > 0 && (
              <span className="absolute top-1 right-1 sm:top-2 sm:right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </button>
          <button
            onClick={() => setShowNewClosureForm(true)}
            className="ml-auto px-4 sm:px-6 py-2 sm:py-3 font-medium text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2 text-sm sm:text-base whitespace-nowrap"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Request</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>

        {/* Search and Filter Bar */}
        {activeTab === 'my-closures' && !showNewClosureForm && (
          <div className="p-4 bg-gray-50 border-b flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search closures..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
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
        <div className="flex-1 overflow-y-auto">
          {error && !notification && (
            <div className="m-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* New Closure Form */}
          {showNewClosureForm && (
            <div className="p-4 sm:p-6">
              <div className="bg-white border-2 border-indigo-300 rounded-lg p-4 sm:p-6 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900">New Closure Request</h3>
                  <button
                    onClick={() => setShowNewClosureForm(false)}
                    className="text-gray-500 hover:text-gray-700 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Closure Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Closure Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.closure_name}
                      onChange={(e) => setFormData({ ...formData, closure_name: e.target.value })}
                      placeholder="e.g., I-35 Bridge Deck Repairs - MP 87-92"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Type and Scope */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Closure Type <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.closure_type}
                        onChange={(e) => setFormData({ ...formData, closure_type: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                      >
                        <option value="construction">Construction</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="bridge_work">Bridge Work</option>
                        <option value="utility">Utility Work</option>
                        <option value="special_event">Special Event</option>
                        <option value="emergency_repair">Emergency Repair</option>
                      </select>
                      <span className="absolute left-3 top-2.5 text-xl">{getTypeIcon(formData.closure_type)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Closure Scope <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.closure_scope}
                        onChange={(e) => setFormData({ ...formData, closure_scope: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                      >
                        <option value="full">Full Closure</option>
                        <option value="partial">Partial (Lane Closure)</option>
                        <option value="shoulder">Shoulder Only</option>
                        <option value="ramp">Ramp Closure</option>
                      </select>
                      <span className="absolute left-3 top-2.5 text-xl">{getScopeIcon(formData.closure_scope)}</span>
                    </div>
                  </div>

                  {/* Route */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Route <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.route}
                      onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                      placeholder="e.g., I-35, I-80, US-20"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Locations */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.start_location}
                      onChange={(e) => setFormData({ ...formData, start_location: e.target.value })}
                      placeholder="e.g., Exit 87 (Milepost 87.5)"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Location <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.end_location}
                      onChange={(e) => setFormData({ ...formData, end_location: e.target.value })}
                      placeholder="e.g., Exit 92 (Milepost 92.3)"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Date/Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Planned Start <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.planned_start}
                      onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Planned End <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.planned_end}
                      onChange={(e) => setFormData({ ...formData, planned_end: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Detour Route */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Detour Route (if applicable)
                    </label>
                    <input
                      type="text"
                      value={formData.detour_route}
                      onChange={(e) => setFormData({ ...formData, detour_route: e.target.value })}
                      placeholder="e.g., Exit 87 → US-69 → Exit 92"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Contact Info */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      placeholder="e.g., John Smith"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      placeholder="e.g., (515) 555-0100"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>

                  {/* Reason */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason for Closure <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="e.g., Bridge deck rehabilitation and joint replacement"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Detailed Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                      placeholder="Detailed description of work activities, traffic control measures, expected impacts, and any additional information relevant to neighboring states..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Auto-detection preview */}
                {formData.start_location && formData.route && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Smart Coordination Active</p>
                        <p className="text-sm text-blue-800 mt-1">
                          System will automatically detect proximity to state borders and notify affected states for approval.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
                  <button
                    onClick={() => setShowNewClosureForm(false)}
                    className="px-6 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitClosure}
                    disabled={loading || !formData.closure_name || !formData.route || !formData.start_location || !formData.end_location || !formData.planned_start || !formData.planned_end || !formData.reason}
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="p-4 sm:p-6">
              {filteredClosures.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-lg font-medium mb-2">
                    {searchTerm || filterStatus !== 'all' ? 'No matching closures found' : 'No closure requests yet'}
                  </p>
                  <p className="text-sm text-gray-400 mb-6">
                    {searchTerm || filterStatus !== 'all'
                      ? 'Try adjusting your search or filter'
                      : 'Get started by creating your first closure request'}
                  </p>
                  {!searchTerm && filterStatus === 'all' && (
                    <button
                      onClick={() => setShowNewClosureForm(true)}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium inline-flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create First Closure Request
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredClosures.map(closure => (
                    <div
                      key={closure.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => fetchClosureDetails(closure.id)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">{getScopeIcon(closure.closure_scope)}</span>
                            <div>
                              <h4 className="font-semibold text-base sm:text-lg text-gray-900">
                                {closure.closure_name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 mt-1">
                                <span className="font-medium inline-flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                  </svg>
                                  {closure.route}
                                </span>
                                <span className="hidden sm:inline">•</span>
                                <span className="text-xs sm:text-sm">{closure.start_location}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 ml-3">
                          <span
                            className="px-3 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap"
                            style={{ backgroundColor: getStatusColor(closure.approval_status) }}
                          >
                            {closure.approval_status?.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(closure.submitted_at || closure.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-gray-600">Start:</span>
                          <span className="font-medium text-gray-900">
                            {format(new Date(closure.planned_start), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-medium text-gray-900">
                            {closure.duration_hours || Math.round((new Date(closure.planned_end) - new Date(closure.planned_start)) / (1000 * 60 * 60))} hours
                          </span>
                        </div>
                      </div>

                      {closure.requires_multistate_approval && (
                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-l-4 border-orange-500 rounded-lg p-3">
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-orange-900">Multi-State Coordination</p>
                              <p className="text-xs text-orange-800 mt-1">
                                {closure.border_proximity_miles && `${closure.border_proximity_miles} mi from border • `}
                                Notified: <span className="font-medium">{closure.states_to_notify?.join(', ') || 'N/A'}</span>
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
            <div className="p-4 sm:p-6">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg font-medium mb-2">All caught up!</p>
                  <p className="text-sm text-gray-400">No closures pending your approval</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingApprovals.map(closure => (
                    <div key={closure.id} className="bg-gradient-to-r from-white to-indigo-50 border-2 border-indigo-300 rounded-xl p-4 sm:p-6 shadow-sm">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">{getScopeIcon(closure.closure_scope)}</span>
                            <div>
                              <h4 className="font-semibold text-base sm:text-lg text-gray-900">
                                {closure.closure_name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-600 mt-1">
                                <span className="inline-flex items-center gap-1 font-medium">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  {closure.state || closure.source_state}
                                </span>
                                <span className="hidden sm:inline">•</span>
                                <span className="text-xs sm:text-sm">{closure.route}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-amber-500 text-white rounded-full text-xs font-bold whitespace-nowrap ml-3 shadow-sm">
                          NEEDS REVIEW
                        </span>
                      </div>

                      {closure.response_due && (
                        <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-sm mb-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-blue-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-semibold text-blue-900">Response Due: </span>
                            <span className="text-blue-800">
                              {format(new Date(closure.response_due), 'MMM d, yyyy')}
                              <span className="text-xs ml-1">({formatDistanceToNow(new Date(closure.response_due))})</span>
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                        <button
                          onClick={() => setShowApprovalModal({ closure, action: 'approve' })}
                          disabled={loading}
                          className="px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 font-medium shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Approve
                        </button>
                        <button
                          onClick={() => setShowApprovalModal({ closure, action: 'reject' })}
                          disabled={loading}
                          className="px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 font-medium shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Reject
                        </button>
                        <button
                          onClick={() => fetchClosureDetails(closure.id)}
                          className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                CCAI UC #15
              </span>
              <span className="hidden sm:inline">Multi-State Closure Coordination</span>
            </div>
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
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
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Closure Details</h3>
            <button
              onClick={onClose}
              className="text-white hover:bg-indigo-500 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <h4 className="text-2xl font-bold text-gray-900 mb-4">{closure.closure_name}</h4>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-sm font-medium text-gray-500">Route</label>
              <p className="text-lg font-semibold text-gray-900">{closure.route}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Closure Type</label>
              <p className="text-lg font-semibold text-gray-900 capitalize">{closure.closure_type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Start Location</label>
              <p className="text-base text-gray-900">{closure.start_location}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">End Location</label>
              <p className="text-base text-gray-900">{closure.end_location}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Planned Start</label>
              <p className="text-base text-gray-900">{format(new Date(closure.planned_start), 'MMM d, yyyy h:mm a')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Planned End</label>
              <p className="text-base text-gray-900">{format(new Date(closure.planned_end), 'MMM d, yyyy h:mm a')}</p>
            </div>
          </div>

          {closure.reason && (
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-500">Reason</label>
              <p className="text-base text-gray-900 mt-1">{closure.reason}</p>
            </div>
          )}

          {closure.description && (
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-500">Description</label>
              <p className="text-base text-gray-900 mt-1 whitespace-pre-wrap">{closure.description}</p>
            </div>
          )}

          {closure.detour_route && (
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-500">Detour Route</label>
              <p className="text-base text-gray-900 mt-1">{closure.detour_route}</p>
            </div>
          )}

          {/* Approval Timeline */}
          {closure.approvals && closure.approvals.length > 0 && (
            <div className="mt-8">
              <h5 className="text-lg font-semibold text-gray-900 mb-4">Approval Timeline</h5>
              <div className="space-y-4">
                {closure.approvals.map((approval, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      approval.approval_status === 'approved' ? 'bg-green-100' :
                      approval.approval_status === 'rejected' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {approval.approval_status === 'approved' ? '✓' : approval.approval_status === 'rejected' ? '✗' : '⏱️'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{approval.approver_state}</p>
                      <p className="text-sm text-gray-600">{approval.approval_status}</p>
                      {approval.comment && <p className="text-sm text-gray-700 mt-1 italic">"{approval.comment}"</p>}
                      <p className="text-xs text-gray-500 mt-1">{formatDistanceToNow(new Date(approval.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className={`p-6 rounded-t-lg ${
          action === 'approve' ? 'bg-gradient-to-r from-green-600 to-green-700' : 'bg-gradient-to-r from-red-600 to-red-700'
        } text-white`}>
          <h3 className="text-xl font-bold">
            {action === 'approve' ? 'Approve Closure Request' : 'Reject Closure Request'}
          </h3>
          <p className="text-sm opacity-90 mt-1">{closure.closure_name}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comments {action === 'reject' && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder={action === 'approve'
              ? "Optional: Add any conditions or notes..."
              : "Required: Explain reason for rejection..."}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            required={action === 'reject'}
          />
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(comment)}
            disabled={loading || (action === 'reject' && !comment.trim())}
            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 ${
              action === 'approve'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? 'Processing...' : action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}
