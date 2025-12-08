import { useState, useEffect } from 'react';
import React from 'react';
import api from '../services/api';
import FederalGrantResources from './FederalGrantResources';

export default function GrantApplications({ user }) {
  const [applications, setApplications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [activeTab, setActiveTab] = useState('applications'); // 'applications', 'resources', 'recommend'
  const [recommendations, setRecommendations] = useState(null);
  const [darkMode, setDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

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

  // Dark mode detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
        setViewMode('list');
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
        if (selectedApp?.application?.id === applicationId) {
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

  const getStatusConfig = (status) => {
    switch (status) {
      case 'awarded':
        return { color: '#10b981', bg: '#d1fae5', icon: '🎉' };
      case 'submitted':
        return { color: '#3b82f6', bg: '#dbeafe', icon: '📤' };
      case 'draft':
        return { color: '#6b7280', bg: '#f3f4f6', icon: '📝' };
      case 'denied':
        return { color: '#ef4444', bg: '#fee2e2', icon: '❌' };
      case 'withdrawn':
        return { color: '#f59e0b', bg: '#fef3c7', icon: '⏸️' };
      default:
        return { color: '#6b7280', bg: '#f3f4f6', icon: '📋' };
    }
  };

  // Modern theme
  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    bgSecondary: darkMode ? '#1e293b' : '#ffffff',
    bgTertiary: darkMode ? '#334155' : '#f1f5f9',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    textMuted: darkMode ? '#64748b' : '#94a3b8',
    border: darkMode ? '#334155' : '#e2e8f0',
    borderLight: darkMode ? '#1e293b' : '#f1f5f9',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryLight: darkMode ? '#1e3a8a' : '#dbeafe',
    accent: '#8b5cf6',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    shadow: darkMode
      ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    shadowLg: darkMode
      ? '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)'
      : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    glass: darkMode
      ? 'rgba(30, 41, 59, 0.7)'
      : 'rgba(255, 255, 255, 0.7)',
    glassHover: darkMode
      ? 'rgba(51, 65, 85, 0.8)'
      : 'rgba(255, 255, 255, 0.9)',
  };

  const styles = {
    container: {
      minHeight: '100vh',
      background: theme.bg,
      color: theme.text,
      padding: '20px',
      transition: 'all 0.3s ease',
    },
    innerContainer: {
      maxWidth: '1400px',
      margin: '0 auto',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '32px',
      flexWrap: 'wrap',
      gap: '16px',
    },
    title: {
      margin: 0,
      fontSize: 'clamp(24px, 5vw, 32px)',
      fontWeight: '800',
      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.accent} 100%)`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      letterSpacing: '-0.02em',
    },
    subtitle: {
      margin: '8px 0 0 0',
      color: theme.textSecondary,
      fontSize: 'clamp(13px, 2.5vw, 15px)',
      fontWeight: '500',
    },
    button: {
      padding: '12px 24px',
      background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryHover} 100%)`,
      color: 'white',
      border: 'none',
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: theme.shadow,
      transition: 'all 0.3s ease',
      whiteSpace: 'nowrap',
    },
    buttonSecondary: {
      padding: '12px 24px',
      background: theme.bgTertiary,
      color: theme.text,
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      whiteSpace: 'nowrap',
    },
    card: {
      background: theme.bgSecondary,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: theme.shadowLg,
      border: `1px solid ${theme.border}`,
      transition: 'all 0.3s ease',
    },
    cardGlass: {
      background: theme.glass,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: theme.shadowLg,
      border: `1px solid ${theme.border}`,
      transition: 'all 0.3s ease',
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      background: theme.bgTertiary,
      border: `2px solid ${theme.border}`,
      borderRadius: '10px',
      fontSize: '14px',
      color: theme.text,
      transition: 'all 0.2s ease',
      outline: 'none',
    },
    label: {
      display: 'block',
      marginBottom: '8px',
      fontWeight: '600',
      fontSize: '13px',
      color: theme.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    alert: {
      padding: '16px 20px',
      borderRadius: '12px',
      marginBottom: '24px',
      fontSize: '14px',
      fontWeight: '500',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'slideInDown 0.4s ease',
    },
    loadingCard: {
      background: theme.bgSecondary,
      borderRadius: '16px',
      padding: '40px',
      textAlign: 'center',
      animation: 'pulse 2s ease-in-out infinite',
    },
  };

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.innerContainer}>
          <div style={styles.loadingCard}>
            <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'bounce 1s ease infinite' }}>💰</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: theme.text }}>Loading Applications...</div>
            <div style={{ fontSize: '14px', color: theme.textSecondary, marginTop: '8px' }}>
              Fetching your grant portfolio
            </div>
          </div>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          @keyframes slideInDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.innerContainer}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>💰 Grant Applications</h1>
            <p style={styles.subtitle}>
              Federal & State Funding Support with Automated Data Packages
            </p>
          </div>

          {viewMode === 'list' && (
            <button
              style={styles.button}
              onClick={() => {
                setShowCreateForm(true);
                setViewMode('create');
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                e.currentTarget.style.boxShadow = theme.shadowLg;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = theme.shadow;
              }}
            >
              ✨ New Application
            </button>
          )}

          {viewMode !== 'list' && (
            <button
              style={styles.buttonSecondary}
              onClick={() => {
                setViewMode('list');
                setSelectedApp(null);
                setShowCreateForm(false);
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = theme.glassHover;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = theme.bgTertiary;
              }}
            >
              ← Back to List
            </button>
          )}
        </div>

        {/* Status Messages */}
        {successMessage && (
          <div style={{
            ...styles.alert,
            background: darkMode ? '#064e3b' : '#d1fae5',
            border: `1px solid ${theme.success}`,
            color: darkMode ? '#6ee7b7' : '#065f46',
          }}>
            <span style={{ fontSize: '20px' }}>✅</span>
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage('')}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                opacity: 0.7,
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
            >
              ×
            </button>
          </div>
        )}

        {errorMessage && (
          <div style={{
            ...styles.alert,
            background: darkMode ? '#7f1d1d' : '#fee2e2',
            border: `1px solid ${theme.error}`,
            color: darkMode ? '#fca5a5' : '#991b1b',
          }}>
            <span style={{ fontSize: '20px' }}>❌</span>
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage('')}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                fontSize: '20px',
                cursor: 'pointer',
                opacity: 0.7,
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
              onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
            >
              ×
            </button>
          </div>
        )}

        {/* Create Application Form */}
        {viewMode === 'create' && (
          <CreateApplicationForm
            theme={theme}
            styles={styles}
            templates={templates}
            selectedTemplate={selectedTemplate}
            handleTemplateSelect={handleTemplateSelect}
            formData={formData}
            setFormData={setFormData}
            handleCreateApplication={handleCreateApplication}
            setViewMode={setViewMode}
            darkMode={darkMode}
          />
        )}

        {/* Application Details */}
        {viewMode === 'details' && selectedApp && (
          <ApplicationDetails
            theme={theme}
            styles={styles}
            selectedApp={selectedApp}
            getStatusConfig={getStatusConfig}
            handleGenerateMetrics={handleGenerateMetrics}
            proposalFile={proposalFile}
            setProposalFile={setProposalFile}
            handleProposalUpload={handleProposalUpload}
            uploadingProposal={uploadingProposal}
            darkMode={darkMode}
          />
        )}

        {/* Applications List */}
        {viewMode === 'list' && (
          <ApplicationsList
            theme={theme}
            styles={styles}
            applications={applications}
            viewApplicationDetails={viewApplicationDetails}
            getStatusConfig={getStatusConfig}
            setViewMode={setViewMode}
            setShowCreateForm={setShowCreateForm}
            darkMode={darkMode}
          />
        )}
      </div>

      <style>{`
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @media (max-width: 768px) {
          .template-grid {
            grid-template-columns: 1fr !important;
          }
          .form-grid-2 {
            grid-template-columns: 1fr !important;
          }
          .form-grid-3 {
            grid-template-columns: 1fr !important;
          }
          .metrics-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }

        @media (max-width: 480px) {
          .metrics-grid {
            grid-template-columns: 1fr !important;
          }
        }

        input:focus, textarea:focus, select:focus {
          border-color: ${theme.primary} !important;
          box-shadow: 0 0 0 3px ${theme.primaryLight} !important;
        }

        input::placeholder, textarea::placeholder {
          color: ${theme.textMuted};
        }
      `}</style>
    </div>
  );
}

// Create Application Form Component
function CreateApplicationForm({ theme, styles, templates, selectedTemplate, handleTemplateSelect, formData, setFormData, handleCreateApplication, setViewMode, darkMode }) {
  return (
    <div style={{ ...styles.card, animation: 'slideInDown 0.5s ease' }}>
      <h2 style={{ margin: '0 0 24px 0', fontSize: '24px', fontWeight: '700', color: theme.text }}>
        Create New Application
      </h2>

      {/* Template Selection */}
      <div style={{ marginBottom: '32px' }}>
        <label style={styles.label}>Select Grant Program Template</label>
        <div className="template-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {templates.map(template => (
            <div
              key={template.id}
              onClick={() => handleTemplateSelect(template)}
              style={{
                padding: '20px',
                border: `2px solid ${selectedTemplate?.id === template.id ? theme.primary : theme.border}`,
                borderRadius: '12px',
                cursor: 'pointer',
                background: selectedTemplate?.id === template.id
                  ? theme.primaryLight
                  : theme.bgTertiary,
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseOver={(e) => {
                if (selectedTemplate?.id !== template.id) {
                  e.currentTarget.style.borderColor = theme.primary;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseOut={(e) => {
                if (selectedTemplate?.id !== template.id) {
                  e.currentTarget.style.borderColor = theme.border;
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
            >
              {selectedTemplate?.id === template.id && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: theme.primary,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                }}>
                  ✓
                </div>
              )}
              <div style={{ fontWeight: '700', fontSize: '16px', marginBottom: '8px', color: theme.text }}>
                {template.template_name}
              </div>
              <div style={{ fontSize: '12px', color: theme.textSecondary, marginBottom: '12px', fontWeight: '600' }}>
                {template.grant_program}
              </div>
              {template.scoring_criteria && (
                <div style={{ fontSize: '11px', color: theme.textMuted }}>
                  📊 {Object.keys(template.scoring_criteria).length} scoring criteria
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Application Form */}
      <form onSubmit={handleCreateApplication}>
        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={styles.label}>Application Title *</label>
            <input
              type="text"
              required
              value={formData.applicationTitle}
              onChange={e => setFormData({ ...formData, applicationTitle: e.target.value })}
              placeholder="Enter project title"
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Grant Year *</label>
            <input
              type="number"
              required
              value={formData.grantYear}
              onChange={e => setFormData({ ...formData, grantYear: parseInt(e.target.value) })}
              style={styles.input}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={styles.label}>Project Description</label>
          <textarea
            value={formData.projectDescription}
            onChange={e => setFormData({ ...formData, projectDescription: e.target.value })}
            rows={4}
            placeholder="Describe your project goals and objectives"
            style={{
              ...styles.input,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={styles.label}>Requested Amount ($)</label>
            <input
              type="number"
              value={formData.requestedAmount}
              onChange={e => setFormData({ ...formData, requestedAmount: parseFloat(e.target.value) })}
              placeholder="0"
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Matching Funds ($)</label>
            <input
              type="number"
              value={formData.matchingFunds}
              onChange={e => setFormData({ ...formData, matchingFunds: parseFloat(e.target.value) })}
              placeholder="0"
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Total Project Cost ($)</label>
            <input
              type="number"
              value={formData.totalProjectCost}
              onChange={e => setFormData({ ...formData, totalProjectCost: parseFloat(e.target.value) })}
              placeholder="0"
              style={styles.input}
            />
          </div>
        </div>

        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
          <div>
            <label style={styles.label}>Primary Corridor</label>
            <input
              type="text"
              value={formData.primaryCorridor}
              onChange={e => setFormData({ ...formData, primaryCorridor: e.target.value })}
              placeholder="e.g., I-95, I-10 Corridor"
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Geographic Scope</label>
            <select
              value={formData.geographicScope}
              onChange={e => setFormData({ ...formData, geographicScope: e.target.value })}
              style={styles.input}
            >
              <option value="state">State</option>
              <option value="regional">Regional</option>
              <option value="national">National</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="submit"
            style={{
              ...styles.button,
              padding: '14px 32px',
              fontSize: '15px',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = theme.shadowLg;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = theme.shadow;
            }}
          >
            🚀 Create Application
          </button>

          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={styles.buttonSecondary}
            onMouseOver={(e) => {
              e.currentTarget.style.background = theme.glassHover;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = theme.bgTertiary;
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// Application Details Component
function ApplicationDetails({ theme, styles, selectedApp, getStatusConfig, handleGenerateMetrics, proposalFile, setProposalFile, handleProposalUpload, uploadingProposal, darkMode }) {
  const statusConfig = getStatusConfig(selectedApp.application.status);
  const [itsEquipment, setItsEquipment] = React.useState(null);
  const [itsStats, setItsStats] = React.useState(null);
  const [loadingITS, setLoadingITS] = React.useState(false);
  const [attachingITS, setAttachingITS] = React.useState(false);

  // AI Grant Narrative state
  const [aiNarrativeForm, setAiNarrativeForm] = React.useState({
    grantType: selectedApp.application.grant_program || '',
    projectTitle: selectedApp.application.application_title || '',
    corridorDescription: selectedApp.application.primary_corridor || ''
  });
  const [generatingNarrative, setGeneratingNarrative] = React.useState(false);
  const [generatedNarrative, setGeneratedNarrative] = React.useState(null);
  const [narrativeError, setNarrativeError] = React.useState('');

  // Fetch ITS equipment on mount
  React.useEffect(() => {
    fetchITSEquipment();
  }, [selectedApp.application.id]);

  const fetchITSEquipment = async () => {
    try {
      setLoadingITS(true);
      const response = await api.get(`/api/grants/applications/${selectedApp.application.id}/its-equipment`);
      if (response.data.success) {
        if (Array.isArray(response.data.equipment)) {
          setItsEquipment(response.data.equipment);
        }
        setItsStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error fetching ITS equipment:', error);
    } finally {
      setLoadingITS(false);
    }
  };

  const handleAttachITSEquipment = async () => {
    try {
      setAttachingITS(true);
      const response = await api.post(`/api/grants/applications/${selectedApp.application.id}/attach-its-equipment`);
      if (response.data.success) {
        alert(`✅ Successfully attached ${response.data.summary.total_equipment} ITS equipment records!`);
        // Refresh the application details to show the new supporting data
        window.location.reload();
      }
    } catch (error) {
      console.error('Error attaching ITS equipment:', error);
      alert('Failed to attach ITS equipment');
    } finally {
      setAttachingITS(false);
    }
  };

  const handleGenerateAINarrative = async () => {
    try {
      setGeneratingNarrative(true);
      setNarrativeError('');

      const response = await api.post('/api/grants/generate-narrative', {
        stateKey: selectedApp.application.state_key,
        grantType: aiNarrativeForm.grantType,
        projectTitle: aiNarrativeForm.projectTitle,
        corridorDescription: aiNarrativeForm.corridorDescription
      });

      if (response.data.success) {
        setGeneratedNarrative(response.data);
      } else {
        setNarrativeError(response.data.error || 'Failed to generate narrative');
      }
    } catch (error) {
      console.error('Error generating AI narrative:', error);
      setNarrativeError(error.response?.data?.error || 'Failed to generate narrative. Please ensure OpenAI API key is configured.');
    } finally {
      setGeneratingNarrative(false);
    }
  };

  const handleCopyNarrative = () => {
    if (generatedNarrative?.narrative) {
      navigator.clipboard.writeText(generatedNarrative.narrative);
      alert('✅ Narrative copied to clipboard!');
    }
  };

  return (
    <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.5s ease' }}>
      {/* Header Card */}
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '28px', fontWeight: '700', color: theme.text }}>
              {selectedApp.application.application_title}
            </h2>
            <div style={{ fontSize: '14px', color: theme.textSecondary, fontWeight: '600' }}>
              {selectedApp.application.grant_program} • {selectedApp.application.grant_year}
            </div>
          </div>
          <div style={{
            padding: '10px 20px',
            background: statusConfig.bg,
            color: statusConfig.color,
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '700',
            textTransform: 'capitalize',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            whiteSpace: 'nowrap',
          }}>
            <span>{statusConfig.icon}</span>
            <span>{selectedApp.application.status}</span>
          </div>
        </div>

        {selectedApp.application.project_description && (
          <p style={{
            margin: '0 0 24px 0',
            color: theme.textSecondary,
            lineHeight: '1.7',
            fontSize: '15px',
          }}>
            {selectedApp.application.project_description}
          </p>
        )}

        {/* Funding Overview */}
        {selectedApp.application.requested_amount && (
          <div className="metrics-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '16px',
            marginTop: '24px',
            padding: '24px',
            background: theme.bgTertiary,
            borderRadius: '12px',
          }}>
            <FundingMetric
              label="Requested Amount"
              value={`$${selectedApp.application.requested_amount?.toLocaleString()}`}
              theme={theme}
              highlight
            />
            {selectedApp.application.matching_funds && (
              <FundingMetric
                label="Matching Funds"
                value={`$${selectedApp.application.matching_funds?.toLocaleString()}`}
                theme={theme}
              />
            )}
            {selectedApp.application.total_project_cost && (
              <FundingMetric
                label="Total Project Cost"
                value={`$${selectedApp.application.total_project_cost?.toLocaleString()}`}
                theme={theme}
              />
            )}
          </div>
        )}
      </div>

      {/* Proposal Upload */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
          📄 Proposal Document
        </h3>

        {selectedApp.application.proposal_document_name ? (
          <div style={{
            padding: '20px',
            background: darkMode ? '#064e3b' : '#d1fae5',
            borderRadius: '12px',
            border: `2px solid ${theme.success}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '32px' }}>✅</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '600', color: darkMode ? '#6ee7b7' : '#065f46', marginBottom: '4px' }}>
                {selectedApp.application.proposal_document_name}
              </div>
              <div style={{ fontSize: '12px', color: theme.textMuted }}>
                Uploaded: {new Date(selectedApp.application.proposal_uploaded_at).toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={e => setProposalFile(e.target.files[0])}
              style={{
                ...styles.input,
                marginBottom: '12px',
                cursor: 'pointer',
                padding: '16px',
              }}
            />
            <button
              onClick={() => handleProposalUpload(selectedApp.application.id)}
              disabled={!proposalFile || uploadingProposal}
              style={{
                ...styles.button,
                opacity: proposalFile && !uploadingProposal ? 1 : 0.5,
                cursor: proposalFile && !uploadingProposal ? 'pointer' : 'not-allowed',
              }}
            >
              {uploadingProposal ? '⏳ Uploading...' : '📤 Upload Proposal'}
            </button>
          </div>
        )}
      </div>

      {/* AI Grant Narrative Generation */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
          🤖 AI-Powered Grant Narrative
        </h3>
        <div style={{ fontSize: '14px', color: theme.textSecondary, marginBottom: '20px' }}>
          Generate compelling, data-driven project justifications using AI analysis of your traffic data, ITS inventory, and incident history.
        </div>

        {/* Form Fields */}
        <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={styles.label}>Grant Type / Program</label>
            <input
              type="text"
              value={aiNarrativeForm.grantType}
              onChange={e => setAiNarrativeForm({ ...aiNarrativeForm, grantType: e.target.value })}
              placeholder="e.g., SMART, Pooled Fund, RAISE, ATCMTD"
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Project Title</label>
            <input
              type="text"
              value={aiNarrativeForm.projectTitle}
              onChange={e => setAiNarrativeForm({ ...aiNarrativeForm, projectTitle: e.target.value })}
              placeholder="Brief, descriptive project title"
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Corridor / Area Description</label>
            <textarea
              value={aiNarrativeForm.corridorDescription}
              onChange={e => setAiNarrativeForm({ ...aiNarrativeForm, corridorDescription: e.target.value })}
              rows={3}
              placeholder="Describe the corridor or geographic area this project will serve..."
              style={{
                ...styles.input,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerateAINarrative}
          disabled={generatingNarrative || !aiNarrativeForm.grantType || !aiNarrativeForm.projectTitle}
          style={{
            ...styles.button,
            opacity: generatingNarrative || !aiNarrativeForm.grantType || !aiNarrativeForm.projectTitle ? 0.5 : 1,
            cursor: generatingNarrative || !aiNarrativeForm.grantType || !aiNarrativeForm.projectTitle ? 'not-allowed' : 'pointer',
            marginBottom: '20px',
          }}
        >
          {generatingNarrative ? '⏳ Generating with AI...' : '✨ Generate Narrative'}
        </button>

        {/* Error Display */}
        {narrativeError && (
          <div style={{
            padding: '16px',
            background: darkMode ? '#7f1d1d' : '#fee2e2',
            border: `2px solid ${theme.error}`,
            borderRadius: '12px',
            marginBottom: '20px',
            color: darkMode ? '#fca5a5' : '#991b1b',
            fontSize: '14px',
          }}>
            <strong>Error:</strong> {narrativeError}
          </div>
        )}

        {/* Generated Narrative Display */}
        {generatedNarrative && (
          <div style={{
            padding: '24px',
            background: theme.bgTertiary,
            borderRadius: '12px',
            border: `2px solid ${theme.primary}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: theme.text }}>
                Generated Project Justification
              </h4>
              <button
                onClick={handleCopyNarrative}
                style={{
                  padding: '8px 16px',
                  background: theme.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                📋 Copy to Clipboard
              </button>
            </div>

            <div style={{
              padding: '20px',
              background: theme.bgSecondary,
              borderRadius: '10px',
              fontSize: '15px',
              lineHeight: '1.8',
              color: theme.text,
              whiteSpace: 'pre-wrap',
              marginBottom: '16px',
            }}>
              {generatedNarrative.narrative}
            </div>

            {/* Data Summary */}
            {generatedNarrative.dataSummary && (
              <div style={{
                padding: '16px',
                background: theme.bgSecondary,
                borderRadius: '10px',
                fontSize: '13px',
                color: theme.textSecondary,
              }}>
                <div style={{ fontWeight: '700', marginBottom: '12px', color: theme.text }}>
                  📊 Data Used in Narrative:
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  <div>Total ITS Equipment: <strong>{generatedNarrative.dataSummary.total_equipment}</strong></div>
                  <div>Total Incidents (12mo): <strong>{generatedNarrative.dataSummary.total_incidents}</strong></div>
                  {generatedNarrative.dataSummary.equipment_breakdown && (
                    <div style={{ marginTop: '8px' }}>
                      Equipment: {Object.entries(generatedNarrative.dataSummary.equipment_breakdown)
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(', ')}
                    </div>
                  )}
                </div>
                {generatedNarrative.usage && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${theme.border}`, fontSize: '11px', color: theme.textMuted }}>
                    AI Tokens: {generatedNarrative.usage.total_tokens} (prompt: {generatedNarrative.usage.prompt_tokens}, completion: {generatedNarrative.usage.completion_tokens})
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metrics Section */}
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: theme.text }}>
            📊 Auto-Generated Metrics
          </h3>
          <button
            onClick={() => handleGenerateMetrics(selectedApp.application.id)}
            style={{
              padding: '10px 18px',
              background: theme.accent,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            🔄 Regenerate
          </button>
        </div>

        {selectedApp.metrics ? (
          <div className="metrics-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px'
          }}>
            <MetricCard label="Total Incidents" value={selectedApp.metrics.total_incidents || 0} icon="🚨" theme={theme} />
            <MetricCard label="High Severity" value={selectedApp.metrics.high_severity_incidents || 0} icon="⚠️" theme={theme} />
            <MetricCard label="V2X Gaps" value={selectedApp.metrics.v2x_coverage_gaps || 0} icon="📡" theme={theme} />
            <MetricCard label="Cameras" value={selectedApp.metrics.cameras_deployed || 0} icon="📹" theme={theme} />
            <MetricCard label="DMS Signs" value={selectedApp.metrics.dms_deployed || 0} icon="🚏" theme={theme} />
            <MetricCard label="RSU Deployed" value={selectedApp.metrics.rsu_deployed || 0} icon="📡" theme={theme} />
            {selectedApp.metrics.data_quality_score && (
              <MetricCard label="Data Quality" value={selectedApp.metrics.data_quality_score.toFixed(2)} icon="✓" theme={theme} />
            )}
          </div>
        ) : (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: theme.textSecondary,
            fontSize: '14px',
            background: theme.bgTertiary,
            borderRadius: '12px',
            border: `2px dashed ${theme.border}`,
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📊</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No metrics generated yet</div>
            <div style={{ fontSize: '13px' }}>Click "Regenerate" to calculate from system data</div>
          </div>
        )}

        {selectedApp.metrics?.calculation_notes && (
          <div style={{
            marginTop: '16px',
            padding: '14px',
            background: theme.bgTertiary,
            borderRadius: '10px',
            fontSize: '12px',
            color: theme.textSecondary,
          }}>
            <strong>Data Sources:</strong> {selectedApp.metrics.calculation_notes}
          </div>
        )}
      </div>

      {/* ITS Equipment Inventory */}
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: theme.text }}>
            🚦 ARC-ITS Equipment Inventory
          </h3>
          <button
            onClick={handleAttachITSEquipment}
            disabled={attachingITS || !itsStats || itsStats.total === 0}
            style={{
              padding: '10px 18px',
              background: theme.primary,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: attachingITS || !itsStats || itsStats.total === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: attachingITS || !itsStats || itsStats.total === 0 ? 0.5 : 1,
            }}
            onMouseOver={(e) => {
              if (!attachingITS && itsStats && itsStats.total > 0) {
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {attachingITS ? '⏳ Attaching...' : '📎 Attach to Grant'}
          </button>
        </div>

        {loadingITS ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: theme.textSecondary,
            fontSize: '14px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', animation: 'pulse 2s ease-in-out infinite' }}>🚦</div>
            <div>Loading ITS equipment inventory...</div>
          </div>
        ) : itsStats && itsStats.total > 0 ? (
          <>
            {/* Statistics Overview */}
            <div className="metrics-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              marginBottom: '20px',
            }}>
              <div style={{
                padding: '16px',
                background: theme.bgTertiary,
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔧</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: theme.primary, marginBottom: '4px' }}>
                  {itsStats.total}
                </div>
                <div style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Equipment
                </div>
              </div>

              <div style={{
                padding: '16px',
                background: theme.bgTertiary,
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📹</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: theme.text, marginBottom: '4px' }}>
                  {itsStats.by_type.camera}
                </div>
                <div style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Cameras
                </div>
              </div>

              <div style={{
                padding: '16px',
                background: theme.bgTertiary,
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚏</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: theme.text, marginBottom: '4px' }}>
                  {itsStats.by_type.dms}
                </div>
                <div style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  DMS Signs
                </div>
              </div>

              <div style={{
                padding: '16px',
                background: theme.bgTertiary,
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📡</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: theme.text, marginBottom: '4px' }}>
                  {itsStats.by_type.rsu}
                </div>
                <div style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  V2X RSU
                </div>
              </div>

              <div style={{
                padding: '16px',
                background: theme.bgTertiary,
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
                <div style={{ fontSize: '24px', fontWeight: '800', color: theme.success, marginBottom: '4px' }}>
                  {itsStats.compliance_rate}%
                </div>
                <div style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ARC-ITS Compliant
                </div>
              </div>
            </div>

            {/* Equipment List (first 5 items) */}
            {Array.isArray(itsEquipment) && itsEquipment.length > 0 && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: theme.bgTertiary,
                borderRadius: '12px',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: theme.textSecondary, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Equipment Sample ({Math.min(5, itsEquipment.length)} of {itsEquipment.length})
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {itsEquipment.slice(0, 5).map((eq, idx) => (
                    <div key={idx} style={{
                      padding: '10px 12px',
                      background: theme.bgSecondary,
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}>
                      <span style={{ fontSize: '18px' }}>{eq.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: theme.text, marginBottom: '2px' }}>
                          {eq.location_description || 'Unknown Location'}
                        </div>
                        <div style={{ fontSize: '11px', color: theme.textMuted }}>
                          {eq.equipment_type.toUpperCase()} {eq.arc_its_id ? `• ARC-ITS: ${eq.arc_its_id}` : ''}
                        </div>
                      </div>
                      {eq.arc_its_id && (
                        <span style={{
                          padding: '4px 8px',
                          background: theme.success,
                          color: 'white',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '700',
                        }}>
                          ✓ COMPLIANT
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {itsEquipment.length > 5 && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: theme.textMuted, textAlign: 'center' }}>
                    + {itsEquipment.length - 5} more equipment items available
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: theme.textSecondary,
            fontSize: '14px',
            background: theme.bgTertiary,
            borderRadius: '12px',
            border: `2px dashed ${theme.border}`,
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>🚦</div>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>No ITS Equipment Found</div>
            <div style={{ fontSize: '13px' }}>Upload equipment inventory to enable ARC-ITS compliant data packages</div>
          </div>
        )}
      </div>

      {/* Supporting Data */}
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
          📦 Supporting Data Packages
        </h3>

        {selectedApp.supportingData && selectedApp.supportingData.length > 0 ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {selectedApp.supportingData.map(data => (
              <div
                key={data.id}
                style={{
                  padding: '16px',
                  border: `1px solid ${theme.border}`,
                  borderRadius: '10px',
                  background: theme.bgTertiary,
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '6px', color: theme.text }}>
                  {data.data_type} - {data.data_source}
                </div>
                {data.date_range_start && (
                  <div style={{ fontSize: '12px', color: theme.textSecondary }}>
                    {new Date(data.date_range_start).toLocaleDateString()} - {new Date(data.date_range_end).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: theme.textSecondary,
            fontSize: '14px',
            border: `2px dashed ${theme.border}`,
            borderRadius: '12px',
            background: theme.bgTertiary,
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>📦</div>
            <div style={{ fontWeight: '600' }}>No supporting data attached yet</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Applications List Component
function ApplicationsList({ theme, styles, applications, viewApplicationDetails, getStatusConfig, setViewMode, setShowCreateForm, darkMode }) {
  if (applications.length === 0) {
    return (
      <div style={{
        ...styles.card,
        padding: '80px 40px',
        textAlign: 'center',
        animation: 'fadeIn 0.5s ease',
      }}>
        <div style={{ fontSize: '64px', marginBottom: '24px', animation: 'bounce 2s ease-in-out infinite' }}>💰</div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: '700', color: theme.text }}>
          No Grant Applications Yet
        </h3>
        <p style={{ margin: '0 0 28px 0', color: theme.textSecondary, fontSize: '15px', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
          Create your first grant application to start securing federal funding for your transportation projects
        </p>
        <button
          onClick={() => {
            setShowCreateForm(true);
            setViewMode('create');
          }}
          style={{
            ...styles.button,
            padding: '14px 32px',
            fontSize: '15px',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.boxShadow = theme.shadowLg;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = theme.shadow;
          }}
        >
          ✨ Create Your First Application
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '16px', animation: 'fadeIn 0.5s ease' }}>
      {applications.map((app, index) => {
        const statusConfig = getStatusConfig(app.status);

        return (
          <div
            key={app.id}
            onClick={() => viewApplicationDetails(app.id)}
            style={{
              ...styles.card,
              cursor: 'pointer',
              animation: `fadeIn 0.5s ease ${index * 0.1}s both`,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = theme.shadowLg;
              e.currentTarget.style.borderColor = theme.primary;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = theme.shadow;
              e.currentTarget.style.borderColor = theme.border;
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: theme.text }}>
                  {app.application_title}
                </h4>
                <div style={{ fontSize: '13px', color: theme.textSecondary, fontWeight: '600' }}>
                  {app.grant_program} {app.grant_year} • {app.state_key}
                </div>
              </div>
              <div style={{
                padding: '8px 16px',
                background: statusConfig.bg,
                color: statusConfig.color,
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: '700',
                textTransform: 'capitalize',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}>
                <span>{statusConfig.icon}</span>
                <span>{app.status}</span>
              </div>
            </div>

            <div className="metrics-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              marginTop: '20px',
            }}>
              {app.requested_amount && (
                <div>
                  <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Requested
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: theme.primary }}>
                    ${app.requested_amount.toLocaleString()}
                  </div>
                </div>
              )}
              {app.attached_datasets > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Datasets
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: theme.text }}>
                    {app.attached_datasets}
                  </div>
                </div>
              )}
              {app.data_quality_score && (
                <div>
                  <div style={{ fontSize: '11px', color: theme.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Data Quality
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: theme.success }}>
                    {app.data_quality_score.toFixed(1)}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper Components
function MetricCard({ label, value, icon, theme }) {
  return (
    <div style={{
      padding: '20px',
      background: theme.bgTertiary,
      border: `1px solid ${theme.border}`,
      borderRadius: '12px',
      textAlign: 'center',
      transition: 'all 0.3s ease',
    }}
    onMouseOver={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.borderColor = theme.primary;
    }}
    onMouseOut={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.borderColor = theme.border;
    }}
    >
      <div style={{ fontSize: '28px', marginBottom: '10px' }}>{icon}</div>
      <div style={{ fontSize: '26px', fontWeight: '800', marginBottom: '6px', color: theme.primary }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div style={{ fontSize: '11px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>
        {label}
      </div>
    </div>
  );
}

function FundingMetric({ label, value, theme, highlight }) {
  return (
    <div>
      <div style={{
        fontSize: '11px',
        color: theme.textMuted,
        marginBottom: '6px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontWeight: '600',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: '800',
        color: highlight ? theme.primary : theme.text,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
    </div>
  );
}
