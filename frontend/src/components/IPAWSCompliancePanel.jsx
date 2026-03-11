import { useState, useEffect } from 'react';
import { theme } from '../styles/theme';
import { config } from '../config';

/**
 * IPAWS SOP Compliance Panel
 * Implements Iowa DOT IPAWS SOP Sections 11, 13, and 14:
 * - Section 11: After-Action Reviews (7-day window)
 * - Section 13: Training & Certification Tracking
 * - Section 14: Compliance & Enforcement
 */
export default function IPAWSCompliancePanel() {
  const [activeTab, setActiveTab] = useState('certifications');
  const [loading, setLoading] = useState(false);

  // Certification Data
  const [users, setUsers] = useState([]);
  const [refresherDue, setRefresherDue] = useState([]);
  const [certsExpiring, setCertsExpiring] = useState([]);

  // After-Action Review Data
  const [aarsOutstanding, setAarsOutstanding] = useState([]);
  const [recentAARs, setRecentAARs] = useState([]);

  // Violations Data
  const [violations, setViolations] = useState([]);
  const [violationsSummary, setViolationsSummary] = useState([]);

  // Forms
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showAARForm, setShowAARForm] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'certifications') {
        await Promise.all([
          loadUsers(),
          loadRefresherDue(),
          loadExpiring Certs()
        ]);
      } else if (activeTab === 'aar') {
        await Promise.all([
          loadOutstandingAARs(),
          loadRecentAARs()
        ]);
      } else if (activeTab === 'violations') {
        await loadViolations();
      }
    } catch (error) {
      console.error('Error loading compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/users`);
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadRefresherDue = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/users/refresher-due`);
      const data = await response.json();
      if (data.success) {
        setRefresherDue(data.users);
      }
    } catch (error) {
      console.error('Error loading refresher due:', error);
    }
  };

  const loadExpiringCerts = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/certifications/expiring`);
      const data = await response.json();
      if (data.success) {
        setCertsExpiring(data.certifications);
      }
    } catch (error) {
      console.error('Error loading expiring certs:', error);
    }
  };

  const loadOutstandingAARs = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/after-action-reviews/outstanding`);
      const data = await response.json();
      if (data.success) {
        setAarsOutstanding(data.outstanding);
      }
    } catch (error) {
      console.error('Error loading outstanding AARs:', error);
    }
  };

  const loadRecentAARs = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/after-action-reviews`);
      const data = await response.json();
      if (data.success) {
        setRecentAARs(data.reviews.slice(0, 10)); // Show most recent 10
      }
    } catch (error) {
      console.error('Error loading recent AARs:', error);
    }
  };

  const loadViolations = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/ipaws/violations`);
      const data = await response.json();
      if (data.success) {
        setViolations(data.violations);
      }
    } catch (error) {
      console.error('Error loading violations:', error);
    }
  };

  const renderCertificationsTab = () => {
    return (
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: theme.spacing.lg
        }}>
          <h3 style={{ margin: 0, color: '#111827' }}>SOP Section 13: Authorized Users</h3>
          <button
            onClick={() => setShowAddUserForm(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: theme.colors.primary.main,
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            + Add User
          </button>
        </div>

        {/* Refresher Training Alert */}
        {refresherDue.length > 0 && (
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            marginBottom: theme.spacing.lg
          }}>
            <div style={{ fontWeight: '700', color: '#92400e', marginBottom: '8px' }}>
              ⚠️ {refresherDue.length} Users Need Refresher Training
            </div>
            <div style={{ fontSize: '13px', color: '#78350f' }}>
              {refresherDue.filter(u => u.refresher_status === 'OVERDUE').length} overdue,{' '}
              {refresherDue.filter(u => u.refresher_status === 'DUE_SOON').length} due within 30 days
            </div>
          </div>
        )}

        {/* Expiring Certifications Alert */}
        {certsExpiring.filter(c => c.cert_status !== 'CURRENT').length > 0 && (
          <div style={{
            padding: theme.spacing.md,
            backgroundColor: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            marginBottom: theme.spacing.lg
          }}>
            <div style={{ fontWeight: '700', color: '#991b1b', marginBottom: '8px' }}>
              🔴 {certsExpiring.filter(c => c.cert_status !== 'CURRENT').length} Certifications Expiring Soon
            </div>
            <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
              FEMA certifications (IS-247, IS-251, IS-315) require renewal
            </div>
          </div>
        )}

        {/* Users Table */}
        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>User</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Role</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>IS-247</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>IS-251</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>IS-315</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Refresher Due</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr key={user.user_id} style={{ borderTop: idx > 0 ? '1px solid #e5e7eb' : 'none' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: '600', color: '#111827' }}>{user.full_name}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>{user.email}</div>
                  </td>
                  <td style={{ padding: '12px', color: '#374151' }}>{user.role || 'N/A'}</td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {user.fema_is247_certified ? '✅' : '❌'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {user.fema_is251_certified ? '✅' : '❌'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {user.fema_is315_certified ? '✅' : '❌'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#6b7280' }}>
                    {user.next_refresher_due ? new Date(user.next_refresher_due).toLocaleDateString() : 'Not set'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {user.suspended ? (
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        SUSPENDED
                      </span>
                    ) : user.revoked ? (
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        REVOKED
                      </span>
                    ) : user.authorized ? (
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#dcfce7',
                        color: '#166534',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        AUTHORIZED
                      </span>
                    ) : (
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#f3f4f6',
                        color: '#6b7280',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        INACTIVE
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              No authorized users found. Click "Add User" to create one.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAARTab = () => {
    return (
      <div>
        <h3 style={{ marginTop: 0, marginBottom: theme.spacing.lg, color: '#111827' }}>SOP Section 11: After-Action Reviews</h3>

        <div style={{
          padding: theme.spacing.md,
          backgroundColor: '#eff6ff',
          border: '2px solid #3b82f6',
          borderRadius: '8px',
          marginBottom: theme.spacing.lg
        }}>
          <div style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.6' }}>
            <strong>SOP Requirement:</strong> All IPAWS activations must undergo an after-action review within <strong>7 days</strong> of transmission.
            Reviews analyze timing, scope, unintended effects, and identify lessons learned for future improvements.
          </div>
        </div>

        {/* Outstanding AARs */}
        {aarsOutstanding.length > 0 && (
          <div style={{ marginBottom: theme.spacing.xl }}>
            <h4 style={{ color: '#111827', marginBottom: theme.spacing.md }}>
              ⚠️ Outstanding Reviews ({aarsOutstanding.length})
            </h4>
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f3f4f6' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Alert ID</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Activation Date</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Activated By</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Days Since</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {aarsOutstanding.map((aar, idx) => (
                    <tr key={aar.alert_id} style={{ borderTop: idx > 0 ? '1px solid #e5e7eb' : 'none' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: '12px', color: '#374151' }}>
                        {aar.alert_id}
                      </td>
                      <td style={{ padding: '12px', color: '#374151' }}>
                        {new Date(aar.activation_date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px', color: '#374151' }}>{aar.activated_by}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>
                        {aar.days_since_activation}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {aar.aar_status === 'OVERDUE' ? (
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            OVERDUE
                          </span>
                        ) : aar.aar_status === 'DUE_SOON' ? (
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            DUE SOON
                          </span>
                        ) : (
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            IN WINDOW
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedAlert(aar);
                            setShowAARForm(true);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: theme.colors.primary.main,
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Complete AAR
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent AARs */}
        <div>
          <h4 style={{ color: '#111827', marginBottom: theme.spacing.md }}>
            Recent Reviews
          </h4>
          {recentAARs.length > 0 ? (
            <div style={{
              display: 'grid',
              gap: theme.spacing.md
            }}>
              {recentAARs.map(aar => (
                <div key={aar.id} style={{
                  padding: theme.spacing.md,
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '8px'
                  }}>
                    <div style={{ fontWeight: '600', color: '#111827' }}>
                      Alert: {aar.alert_id}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Reviewed: {new Date(aar.review_date).toLocaleDateString()}
                    </div>
                  </div>
                  {aar.lessons_learned && (
                    <div style={{
                      padding: '8px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '4px',
                      fontSize: '13px',
                      color: '#374151',
                      marginTop: '8px'
                    }}>
                      <strong>Lessons Learned:</strong> {aar.lessons_learned}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              color: '#9ca3af'
            }}>
              No after-action reviews completed yet
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderViolationsTab = () => {
    return (
      <div>
        <h3 style={{ marginTop: 0, marginBottom: theme.spacing.lg, color: '#111827' }}>SOP Section 14: Compliance & Enforcement</h3>

        <div style={{
          padding: theme.spacing.md,
          backgroundColor: '#fef3c7',
          border: '2px solid #f59e0b',
          borderRadius: '8px',
          marginBottom: theme.spacing.lg
        }}>
          <div style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.6' }}>
            <strong>SOP Requirement:</strong> Policy violations may result in warning, retraining, suspension, or revocation of IPAWS authorization.
            Misuse may be reported to federal oversight authorities per 47 CFR 10.
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ backgroundColor: '#f3f4f6' }}>
              <tr>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>User</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Violation Type</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Severity</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Enforcement</th>
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v, idx) => (
                <tr key={v.id} style={{ borderTop: idx > 0 ? '1px solid #e5e7eb' : 'none' }}>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#374151' }}>
                    {new Date(v.violation_date).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#374151', fontWeight: '600' }}>
                    {v.user_id}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#374151' }}>
                    {v.violation_type.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {v.violation_severity === 'critical' ? (
                      <span style={{ padding: '4px 8px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                        CRITICAL
                      </span>
                    ) : v.violation_severity === 'severe' ? (
                      <span style={{ padding: '4px 8px', backgroundColor: '#fed7aa', color: '#9a3412', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                        SEVERE
                      </span>
                    ) : v.violation_severity === 'moderate' ? (
                      <span style={{ padding: '4px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                        MODERATE
                      </span>
                    ) : (
                      <span style={{ padding: '4px 8px', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                        MINOR
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: '#374151' }}>
                    {v.enforcement_action || 'None'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    {v.resolved ? (
                      <span style={{ padding: '4px 8px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                        RESOLVED
                      </span>
                    ) : (
                      <span style={{ padding: '4px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                        OPEN
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {violations.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
              No policy violations recorded
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#f9fafb',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ marginBottom: theme.spacing.xl }}>
        <h2 style={{ margin: 0, color: '#111827', fontSize: '24px', fontWeight: '700' }}>
          🔐 IPAWS SOP Compliance Management
        </h2>
        <p style={{ marginTop: '8px', color: '#6b7280', fontSize: '14px' }}>
          Certification tracking, after-action reviews, and compliance enforcement per Iowa DOT IPAWS SOP
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: theme.spacing.lg,
        borderBottom: '2px solid #e5e7eb'
      }}>
        {[
          { id: 'certifications', label: '👤 Certifications (§13)', icon: '👤' },
          { id: 'aar', label: '📋 After-Action Reviews (§11)', icon: '📋' },
          { id: 'violations', label: '⚖️ Violations (§14)', icon: '⚖️' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `3px solid ${theme.colors.primary.main}` : '3px solid transparent',
              color: activeTab === tab.id ? theme.colors.primary.main : '#6b7280',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
          Loading compliance data...
        </div>
      ) : (
        <div>
          {activeTab === 'certifications' && renderCertificationsTab()}
          {activeTab === 'aar' && renderAARTab()}
          {activeTab === 'violations' && renderViolationsTab()}
        </div>
      )}
    </div>
  );
}
