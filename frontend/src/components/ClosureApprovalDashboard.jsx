import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import config from '../config';

export default function ClosureApprovalDashboard({ userState, onClose }) {
  const [activeTab, setActiveTab] = useState('my-closures');
  const [closures, setClosures] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [selectedClosure, setSelectedClosure] = useState(null);
  const [showNewClosureForm, setShowNewClosureForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    description: ''
  });

  useEffect(() => {
    fetchClosures();
    fetchPendingApprovals();
  }, []);

  const fetchClosures = async () => {
    // Mock data - in production would fetch from API
    const mockClosures = [
      {
        id: 1,
        closure_name: 'I-35 Bridge Rehabilitation - Des Moines',
        closure_type: 'bridge_work',
        route: 'I-35',
        state: 'IA',
        start_location: 'I-35 Exit 87 (Des Moines)',
        end_location: 'I-35 Exit 92 (Ankeny)',
        planned_start: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        planned_end: new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString(),
        duration_hours: 48,
        closure_scope: 'partial',
        lanes_affected: '2 of 4 lanes',
        approval_status: 'pending_review',
        border_proximity_miles: 125,
        requires_multistate_approval: true,
        states_to_notify: ['Minnesota', 'Missouri'],
        submitted_by: 'TMC Supervisor - Iowa DOT',
        submitted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    setClosures(mockClosures);
  };

  const fetchPendingApprovals = async () => {
    // Mock pending approvals for current state
    const mockApprovals = [
      {
        id: 1,
        closure_id: 1,
        closure_name: 'I-35 Bridge Rehabilitation - Des Moines',
        source_state: 'IA',
        approval_level: 'tmc_supervisor',
        approval_status: 'pending',
        response_due: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        priority_level: 'normal'
      }
    ];

    setPendingApprovals(mockApprovals);
  };

  const submitClosure = async () => {
    setLoading(true);
    setError(null);

    try {
      // In production, POST to API
      // const response = await fetch(`${config.apiUrl}/api/closures`, { method: 'POST', body: JSON.stringify(formData) });

      alert(`Closure Request Submitted!\n\n` +
            `${formData.closure_name}\n` +
            `Route: ${formData.route}\n` +
            `Scope: ${formData.closure_scope}\n\n` +
            `Approval workflow initiated.\n` +
            `Adjacent states will be notified automatically.`);

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
        description: ''
      });
      fetchClosures();
    } catch (err) {
      setError('Failed to submit closure request');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const approveClosure = async (closureId, approvalId, status) => {
    setLoading(true);
    setError(null);

    try {
      // In production, POST to API
      alert(`Closure ${status === 'approved' ? 'APPROVED' : 'REJECTED'}!\n\n` +
            `Your decision has been recorded.\n` +
            `Source state will be notified automatically.`);

      fetchPendingApprovals();
      setSelectedClosure(null);
    } catch (err) {
      setError('Failed to process approval');
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
      default:
        return '📍';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Closure Approval Workflow
              </h2>
              <p className="text-indigo-100 text-sm mt-1">
                Multi-State Coordination for Planned Closures
              </p>
            </div>
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

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('my-closures')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'my-closures'
                ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Closures ({closures.length})
          </button>
          <button
            onClick={() => setActiveTab('pending-approval')}
            className={`px-6 py-3 font-medium transition-colors relative ${
              activeTab === 'pending-approval'
                ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pending My Approval ({pendingApprovals.length})
            {pendingApprovals.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
          <button
            onClick={() => setShowNewClosureForm(true)}
            className="ml-auto px-6 py-3 font-medium text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Closure Request
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* New Closure Form */}
          {showNewClosureForm && (
            <div className="mb-6 bg-white border-2 border-indigo-300 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">New Closure Request</h3>
                <button
                  onClick={() => setShowNewClosureForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Closure Name *
                  </label>
                  <input
                    type="text"
                    value={formData.closure_name}
                    onChange={(e) => setFormData({ ...formData, closure_name: e.target.value })}
                    placeholder="e.g., I-35 Bridge Deck Repairs"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Closure Type *
                  </label>
                  <select
                    value={formData.closure_type}
                    onChange={(e) => setFormData({ ...formData, closure_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="construction">Construction</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="bridge_work">Bridge Work</option>
                    <option value="utility">Utility Work</option>
                    <option value="special_event">Special Event</option>
                    <option value="emergency_repair">Emergency Repair</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Closure Scope *
                  </label>
                  <select
                    value={formData.closure_scope}
                    onChange={(e) => setFormData({ ...formData, closure_scope: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="full">Full Closure</option>
                    <option value="partial">Partial (Lane Closure)</option>
                    <option value="shoulder">Shoulder Only</option>
                    <option value="ramp">Ramp Closure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route *
                  </label>
                  <input
                    type="text"
                    value={formData.route}
                    onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                    placeholder="e.g., I-35"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Location *
                  </label>
                  <input
                    type="text"
                    value={formData.start_location}
                    onChange={(e) => setFormData({ ...formData, start_location: e.target.value })}
                    placeholder="e.g., Exit 87"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Planned Start *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.planned_start}
                    onChange={(e) => setFormData({ ...formData, planned_start: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Planned End *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.planned_end}
                    onChange={(e) => setFormData({ ...formData, planned_end: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Closure *
                  </label>
                  <input
                    type="text"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Brief reason"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Detailed description of work, detour information, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowNewClosureForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitClosure}
                  disabled={loading || !formData.closure_name || !formData.route}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  Submit for Approval
                </button>
              </div>
            </div>
          )}

          {/* My Closures Tab */}
          {activeTab === 'my-closures' && (
            <div className="space-y-3">
              {closures.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>No closure requests submitted yet</p>
                  <button
                    onClick={() => setShowNewClosureForm(true)}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                    Create First Closure Request
                  </button>
                </div>
              ) : (
                closures.map(closure => (
                  <div key={closure.id} className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">{getScopeIcon(closure.closure_scope)}</span>
                          <h4 className="font-semibold text-lg text-gray-900">
                            {closure.closure_name}
                          </h4>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                          <span className="font-medium">{closure.route}</span>
                          <span>•</span>
                          <span>{closure.start_location}</span>
                          {closure.lanes_affected && (
                            <>
                              <span>•</span>
                              <span>{closure.lanes_affected}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: getStatusColor(closure.approval_status) }}
                      >
                        {closure.approval_status.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-600">Planned Start:</span>
                        <span className="ml-2 font-medium">
                          {format(new Date(closure.planned_start), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-medium">{closure.duration_hours} hours</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Closure Type:</span>
                        <span className="ml-2 font-medium capitalize">{closure.closure_type.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Submitted:</span>
                        <span className="ml-2 font-medium">
                          {formatDistanceToNow(new Date(closure.submitted_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {closure.requires_multistate_approval && (
                      <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm">
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 text-orange-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <strong className="text-orange-900">Multi-State Coordination Required</strong>
                            <p className="text-orange-800 mt-1">
                              Within {closure.border_proximity_miles} miles of border. Approval needed from:{' '}
                              <strong>{closure.states_to_notify.join(', ')}</strong>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pending Approval Tab */}
          {activeTab === 'pending-approval' && (
            <div className="space-y-3">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>No closures pending your approval</p>
                </div>
              ) : (
                pendingApprovals.map(approval => (
                  <div key={approval.id} className="bg-white border-2 border-indigo-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg text-gray-900 mb-1">
                          {approval.closure_name}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                          <span className="font-medium">Requested by: {approval.source_state}</span>
                          <span>•</span>
                          <span className="capitalize">{approval.approval_level.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        AWAITING YOUR APPROVAL
                      </span>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900 mb-4">
                      <strong>Response Due:</strong> {format(new Date(approval.response_due), 'MMM d, yyyy')}
                      {' '}({formatDistanceToNow(new Date(approval.response_due))})
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => approveClosure(approval.closure_id, approval.id, 'approved')}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => approveClosure(approval.closure_id, approval.id, 'rejected')}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        ✗ Reject
                      </button>
                      <button
                        onClick={() => setSelectedClosure(approval)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <strong>CCAI UC #15:</strong> Multi-State Closure Coordination
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
