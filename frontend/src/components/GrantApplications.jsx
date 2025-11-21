import { useState, useEffect } from 'react';
import api from '../services/api';
import theme from './theme';

export default function GrantApplications({ user }) {
  const [applications, setApplications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list, details, create

  // Form state
  const [formData, setFormData] = useState({
    grantProgram: '',
    grantYear: new Date().getFullYear(),
    applicationTitle: '',
    projectDescription: '',
    requestedAmount: '',
    matchingFunds: '',
    totalProjectCost: '',
    primaryCorridor: '',
    affectedRoutes: [],
    geographicScope: 'state'
  });

  // Proposal upload state
  const [proposalFile, setProposalFile] = useState(null);
  const [uploadingProposal, setUploadingProposal] = useState(false);

  // Status messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchApplications();
    fetchTemplates();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/grants/applications', {
        params: user?.stateKey ? { stateKey: user.stateKey } : {}
      });

      if (response.data.success) {
        setApplications(response.data.applications);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      setErrorMessage('Failed to load grant applications');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/api/grants/templates');
      if (response.data.success) {
        setTemplates(response.data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleCreateApplication = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await api.post('/api/grants/applications', {
        ...formData,
        stateKey: user.stateKey,
        createdBy: user.username
      });

      if (response.data.success) {
        setSuccessMessage('Grant application created successfully!');
        setShowCreateForm(false);
        fetchApplications();

        // Reset form
        setFormData({
          grantProgram: '',
          grantYear: new Date().getFullYear(),
          applicationTitle: '',
          projectDescription: '',
          requestedAmount: '',
          matchingFunds: '',
          totalProjectCost: '',
          primaryCorridor: '',
          affectedRoutes: [],
          geographicScope: 'state'
        });
      }
    } catch (error) {
      console.error('Error creating application:', error);
      setErrorMessage(error.response?.data?.error || 'Failed to create application');
    }
  };

  const handleGenerateMetrics = async (applicationId) => {
    try {
      setSuccessMessage('');
      setErrorMessage('');

      const response = await api.post(`/api/grants/applications/${applicationId}/generate-metrics`);

      if (response.data.success) {
        setSuccessMessage('Metrics generated successfully from system data!');
        // Refresh application details
        if (selectedApp?.id === applicationId) {
          viewApplicationDetails(applicationId);
        }
      }
    } catch (error) {
      console.error('Error generating metrics:', error);
      setErrorMessage('Failed to generate metrics');
    }
  };

  const handleProposalUpload = async (applicationId) => {
    if (!proposalFile) {
      setErrorMessage('Please select a file to upload');
      return;
    }

    try {
      setUploadingProposal(true);
      setErrorMessage('');
      setSuccessMessage('');

      const formData = new FormData();
      formData.append('proposal', proposalFile);

      const response = await api.post(
        `/api/grants/applications/${applicationId}/proposal`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      if (response.data.success) {
        setSuccessMessage('Proposal uploaded successfully!');
        setProposalFile(null);
        viewApplicationDetails(applicationId);
      }
    } catch (error) {
      console.error('Error uploading proposal:', error);
      setErrorMessage('Failed to upload proposal');
    } finally {
      setUploadingProposal(false);
    }
  };

  const viewApplicationDetails = async (applicationId) => {
    try {
      const response = await api.get(`/api/grants/applications/${applicationId}`);

      if (response.data.success) {
        setSelectedApp(response.data);
        setViewMode('details');
      }
    } catch (error) {
      console.error('Error fetching application details:', error);
      setErrorMessage('Failed to load application details');
    }
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setFormData({
      ...formData,
      grantProgram: template.grant_program
    });
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'awarded': return '#10b981';
      case 'submitted': return '#3b82f6';
      case 'draft': return '#6b7280';
      case 'denied': return '#ef4444';
      case 'withdrawn': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>💰</div>
        <div>Loading grant applications...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: '700' }}>
            💰 Grant Applications
          </h2>
          <p style={{ margin: 0, color: theme.colors.textSecondary, fontSize: '14px' }}>
            Federal & State Funding Support with Automated Data Packages
          </p>
        </div>

        {viewMode === 'list' && (
          <button
            onClick={() => {
              setShowCreateForm(true);
              setViewMode('create');
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: theme.colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: theme.borderRadius.md,
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: theme.shadows.md,
              transition: 'all 0.2s ease'
            }}
            onMouseOver={e => e.target.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.target.style.transform = 'translateY(0)'}
          >
            + New Application
          </button>
        )}

        {viewMode !== 'list' && (
          <button
            onClick={() => {
              setViewMode('list');
              setSelectedApp(null);
              setShowCreateForm(false);
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.md,
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ← Back to List
          </button>
        )}
      </div>

      {/* Status Messages */}
      {successMessage && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#d1fae5',
          border: '1px solid #10b981',
          borderRadius: theme.borderRadius.md,
          marginBottom: '20px',
          color: '#065f46',
          fontSize: '14px'
        }}>
          ✅ {successMessage}
        </div>
      )}

      {errorMessage && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#fee2e2',
          border: '1px solid #ef4444',
          borderRadius: theme.borderRadius.md,
          marginBottom: '20px',
          color: '#991b1b',
          fontSize: '14px'
        }}>
          ❌ {errorMessage}
        </div>
      )}

      {/* Create Application Form */}
      {viewMode === 'create' && (
        <div style={{
          background: theme.colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: '30px',
          boxShadow: theme.shadows.lg
        }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Create New Grant Application</h3>

          {/* Template Selection */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', fontSize: '14px' }}>
              Select Grant Program Template
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
              {templates.map(template => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  style={{
                    padding: '20px',
                    border: `2px solid ${selectedTemplate?.id === template.id ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: theme.borderRadius.md,
                    cursor: 'pointer',
                    backgroundColor: selectedTemplate?.id === template.id ? `${theme.colors.primary}15` : 'white',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '8px' }}>
                    {template.template_name}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.colors.textSecondary, marginBottom: '12px' }}>
                    {template.grant_program}
                  </div>
                  {template.scoring_criteria && (
                    <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
                      {Object.keys(template.scoring_criteria).length} scoring criteria
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Application Form */}
          <form onSubmit={handleCreateApplication}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>
                  Application Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.applicationTitle}
                  onChange={e => setFormData({ ...formData, applicationTitle: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>
                  Grant Year *
                </label>
                <input
                  type="number"
                  required
                  value={formData.grantYear}
                  onChange={e => setFormData({ ...formData, grantYear: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>
                Project Description
              </label>
              <textarea
                value={formData.projectDescription}
                onChange={e => setFormData({ ...formData, projectDescription: e.target.value })}
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.sm,
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>
                  Requested Amount ($)
                </label>
                <input
                  type="number"
                  value={formData.requestedAmount}
                  onChange={e => setFormData({ ...formData, requestedAmount: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>
                  Matching Funds ($)
                </label>
                <input
                  type="number"
                  value={formData.matchingFunds}
                  onChange={e => setFormData({ ...formData, matchingFunds: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>
                  Total Project Cost ($)
                </label>
                <input
                  type="number"
                  value={formData.totalProjectCost}
                  onChange={e => setFormData({ ...formData, totalProjectCost: parseFloat(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>
                  Primary Corridor
                </label>
                <input
                  type="text"
                  value={formData.primaryCorridor}
                  onChange={e => setFormData({ ...formData, primaryCorridor: e.target.value })}
                  placeholder="e.g., I-95, I-10 Corridor"
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px' }}>
                  Geographic Scope
                </label>
                <select
                  value={formData.geographicScope}
                  onChange={e => setFormData({ ...formData, geographicScope: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: theme.borderRadius.sm,
                    fontSize: '14px'
                  }}
                >
                  <option value="state">State</option>
                  <option value="regional">Regional</option>
                  <option value="national">National</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                style={{
                  padding: '12px 32px',
                  backgroundColor: theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: theme.shadows.md
                }}
              >
                Create Application
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setViewMode('list');
                }}
                style={{
                  padding: '12px 32px',
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Application Details View */}
      {viewMode === 'details' && selectedApp && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {/* Application Header */}
          <div style={{
            background: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            padding: '30px',
            boxShadow: theme.shadows.lg
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>
                  {selectedApp.application.application_title}
                </h3>
                <div style={{ fontSize: '14px', color: theme.colors.textSecondary }}>
                  {selectedApp.application.grant_program} {selectedApp.application.grant_year}
                </div>
              </div>
              <div style={{
                padding: '6px 16px',
                backgroundColor: getStatusBadgeColor(selectedApp.application.status),
                color: 'white',
                borderRadius: theme.borderRadius.full,
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'capitalize'
              }}>
                {selectedApp.application.status}
              </div>
            </div>

            {selectedApp.application.project_description && (
              <p style={{ margin: '0 0 20px 0', color: theme.colors.textSecondary, lineHeight: '1.6' }}>
                {selectedApp.application.project_description}
              </p>
            )}

            {/* Funding Overview */}
            {selectedApp.application.requested_amount && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '15px',
                marginTop: '20px',
                padding: '20px',
                backgroundColor: '#f9fafb',
                borderRadius: theme.borderRadius.md
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                    Requested Amount
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: theme.colors.primary }}>
                    ${selectedApp.application.requested_amount?.toLocaleString()}
                  </div>
                </div>
                {selectedApp.application.matching_funds && (
                  <div>
                    <div style={{ fontSize: '11px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                      Matching Funds
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700' }}>
                      ${selectedApp.application.matching_funds?.toLocaleString()}
                    </div>
                  </div>
                )}
                {selectedApp.application.total_project_cost && (
                  <div>
                    <div style={{ fontSize: '11px', color: theme.colors.textSecondary, marginBottom: '4px' }}>
                      Total Project Cost
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700' }}>
                      ${selectedApp.application.total_project_cost?.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Proposal Upload Section */}
          <div style={{
            background: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            padding: '30px',
            boxShadow: theme.shadows.lg
          }}>
            <h4 style={{ margin: '0 0 15px 0' }}>📄 Proposal Document</h4>

            {selectedApp.application.proposal_document_name ? (
              <div style={{
                padding: '15px',
                backgroundColor: '#d1fae5',
                borderRadius: theme.borderRadius.md,
                border: '1px solid #10b981'
              }}>
                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                  {selectedApp.application.proposal_document_name}
                </div>
                <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                  Uploaded: {new Date(selectedApp.application.proposal_uploaded_at).toLocaleString()}
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  onChange={e => setProposalFile(e.target.files[0])}
                  style={{ marginBottom: '12px', display: 'block' }}
                />
                <button
                  onClick={() => handleProposalUpload(selectedApp.application.id)}
                  disabled={!proposalFile || uploadingProposal}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: theme.colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: theme.borderRadius.md,
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: proposalFile && !uploadingProposal ? 'pointer' : 'not-allowed',
                    opacity: proposalFile && !uploadingProposal ? 1 : 0.5
                  }}
                >
                  {uploadingProposal ? 'Uploading...' : 'Upload Proposal'}
                </button>
              </div>
            )}
          </div>

          {/* Metrics Section */}
          <div style={{
            background: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            padding: '30px',
            boxShadow: theme.shadows.lg
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4 style={{ margin: 0 }}>📊 Auto-Generated Metrics</h4>
              <button
                onClick={() => handleGenerateMetrics(selectedApp.application.id)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: theme.colors.accent,
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🔄 Regenerate Metrics
              </button>
            </div>

            {selectedApp.metrics ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '15px'
              }}>
                <MetricCard
                  label="Total Incidents"
                  value={selectedApp.metrics.total_incidents || 0}
                  icon="🚨"
                />
                <MetricCard
                  label="High Severity"
                  value={selectedApp.metrics.high_severity_incidents || 0}
                  icon="⚠️"
                />
                <MetricCard
                  label="V2X Gaps"
                  value={selectedApp.metrics.v2x_coverage_gaps || 0}
                  icon="📡"
                />
                <MetricCard
                  label="Cameras Deployed"
                  value={selectedApp.metrics.cameras_deployed || 0}
                  icon="📹"
                />
                <MetricCard
                  label="DMS Deployed"
                  value={selectedApp.metrics.dms_deployed || 0}
                  icon="🚏"
                />
                <MetricCard
                  label="RSU Deployed"
                  value={selectedApp.metrics.rsu_deployed || 0}
                  icon="📡"
                />
                {selectedApp.metrics.data_quality_score && (
                  <MetricCard
                    label="Data Quality (DQI)"
                    value={selectedApp.metrics.data_quality_score.toFixed(2)}
                    icon="✓"
                  />
                )}
              </div>
            ) : (
              <div style={{
                padding: '30px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '14px'
              }}>
                No metrics generated yet. Click "Regenerate Metrics" to calculate from system data.
              </div>
            )}

            {selectedApp.metrics?.calculation_notes && (
              <div style={{
                marginTop: '15px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                borderRadius: theme.borderRadius.sm,
                fontSize: '12px',
                color: theme.colors.textSecondary
              }}>
                <strong>Data Sources:</strong> {selectedApp.metrics.calculation_notes}
              </div>
            )}
          </div>

          {/* Supporting Data Section */}
          <div style={{
            background: theme.colors.surface,
            borderRadius: theme.borderRadius.lg,
            padding: '30px',
            boxShadow: theme.shadows.lg
          }}>
            <h4 style={{ margin: '0 0 15px 0' }}>📦 Supporting Data Packages</h4>

            {selectedApp.supportingData && selectedApp.supportingData.length > 0 ? (
              <div style={{ display: 'grid', gap: '10px' }}>
                {selectedApp.supportingData.map(data => (
                  <div
                    key={data.id}
                    style={{
                      padding: '15px',
                      border: `1px solid ${theme.colors.border}`,
                      borderRadius: theme.borderRadius.md,
                      backgroundColor: 'white'
                    }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                      {data.data_type} - {data.data_source}
                    </div>
                    {data.date_range_start && (
                      <div style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
                        {new Date(data.date_range_start).toLocaleDateString()} - {new Date(data.date_range_end).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '30px',
                textAlign: 'center',
                color: theme.colors.textSecondary,
                fontSize: '14px',
                border: `2px dashed ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md
              }}>
                No supporting data attached yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Applications List */}
      {viewMode === 'list' && (
        <div>
          {applications.length === 0 ? (
            <div style={{
              background: theme.colors.surface,
              borderRadius: theme.borderRadius.lg,
              padding: '60px 30px',
              textAlign: 'center',
              boxShadow: theme.shadows.lg
            }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>💰</div>
              <h3 style={{ margin: '0 0 10px 0', color: theme.colors.text }}>No Grant Applications Yet</h3>
              <p style={{ margin: '0 0 20px 0', color: theme.colors.textSecondary }}>
                Create your first grant application to start securing federal funding
              </p>
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setViewMode('create');
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: theme.colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: theme.shadows.md
                }}
              >
                + Create Application
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {applications.map(app => (
                <div
                  key={app.id}
                  onClick={() => viewApplicationDetails(app.id)}
                  style={{
                    background: theme.colors.surface,
                    borderRadius: theme.borderRadius.lg,
                    padding: '24px',
                    cursor: 'pointer',
                    boxShadow: theme.shadows.md,
                    transition: 'all 0.2s ease',
                    border: '1px solid transparent'
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.boxShadow = theme.shadows.lg;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.boxShadow = theme.shadows.md;
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '600' }}>
                        {app.application_title}
                      </h4>
                      <div style={{ fontSize: '13px', color: theme.colors.textSecondary }}>
                        {app.grant_program} {app.grant_year} • {app.state_key}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 12px',
                      backgroundColor: getStatusBadgeColor(app.status),
                      color: 'white',
                      borderRadius: theme.borderRadius.full,
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'capitalize'
                    }}>
                      {app.status}
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '12px',
                    marginTop: '16px'
                  }}>
                    {app.requested_amount && (
                      <div>
                        <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>Requested</div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: theme.colors.primary }}>
                          ${app.requested_amount.toLocaleString()}
                        </div>
                      </div>
                    )}
                    {app.attached_datasets > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>Datasets</div>
                        <div style={{ fontSize: '16px', fontWeight: '600' }}>
                          {app.attached_datasets}
                        </div>
                      </div>
                    )}
                    {app.data_quality_score && (
                      <div>
                        <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>Data Quality</div>
                        <div style={{ fontSize: '16px', fontWeight: '600' }}>
                          {app.data_quality_score.toFixed(1)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component for metric cards
function MetricCard({ label, value, icon }) {
  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'white',
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.md,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px', color: theme.colors.primary }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: '11px', color: theme.colors.textSecondary }}>
        {label}
      </div>
    </div>
  );
}
