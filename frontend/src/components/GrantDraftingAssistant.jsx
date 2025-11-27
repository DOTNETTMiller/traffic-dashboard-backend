import { useState } from 'react';
import api from '../services/api';

export default function GrantDraftingAssistant({ user, darkMode = false }) {
  const [formData, setFormData] = useState({
    grantProgram: 'SMART',
    projectDescription: '',
    contentType: 'ideas'
  });
  const [generatedContent, setGeneratedContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const theme = {
    bg: darkMode ? '#0f172a' : '#ffffff',
    bgSecondary: darkMode ? '#1e293b' : '#f8fafc',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    accent: '#3b82f6',
    success: '#10b981',
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setGeneratedContent(null);

    try {
      const response = await api.post('/api/grants/generate-content', {
        stateKey: user?.stateKey || 'multi-state',
        grantProgram: formData.grantProgram,
        projectDescription: formData.projectDescription,
        contentType: formData.contentType
      });

      if (response.data.success) {
        setGeneratedContent(response.data);
      } else {
        setError(response.data.error || 'Failed to generate content');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      padding: '24px',
      background: theme.bg,
      minHeight: '100vh',
    },
    header: {
      marginBottom: '32px',
    },
    title: {
      fontSize: '32px',
      fontWeight: '700',
      color: theme.text,
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    subtitle: {
      fontSize: '16px',
      color: theme.textSecondary,
      lineHeight: '1.6',
    },
    card: {
      background: theme.bgSecondary,
      borderRadius: '16px',
      padding: '24px',
      border: `2px solid ${theme.border}`,
      marginBottom: '24px',
    },
    formGroup: {
      marginBottom: '20px',
    },
    label: {
      display: 'block',
      fontSize: '13px',
      fontWeight: '600',
      color: theme.textSecondary,
      marginBottom: '8px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    },
    select: {
      width: '100%',
      padding: '12px 16px',
      background: darkMode ? '#0f172a' : '#ffffff',
      border: `2px solid ${theme.border}`,
      borderRadius: '10px',
      fontSize: '14px',
      color: theme.text,
      outline: 'none',
      cursor: 'pointer',
    },
    textarea: {
      width: '100%',
      padding: '12px 16px',
      background: darkMode ? '#0f172a' : '#ffffff',
      border: `2px solid ${theme.border}`,
      borderRadius: '10px',
      fontSize: '14px',
      color: theme.text,
      outline: 'none',
      minHeight: '120px',
      fontFamily: 'inherit',
      resize: 'vertical',
    },
    button: {
      padding: '14px 28px',
      background: theme.accent,
      color: '#ffffff',
      border: 'none',
      borderRadius: '10px',
      fontSize: '15px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
      justifyContent: 'center',
    },
    resultCard: {
      background: darkMode ? '#0f172a' : '#ffffff',
      borderRadius: '12px',
      padding: '24px',
      border: `2px solid ${theme.border}`,
      marginTop: '24px',
    },
    content: {
      fontSize: '14px',
      color: theme.text,
      lineHeight: '1.8',
      whiteSpace: 'pre-wrap',
      fontFamily: 'monospace',
    },
    note: {
      padding: '16px',
      background: darkMode ? '#1e293b' : '#fef3c7',
      borderRadius: '8px',
      fontSize: '13px',
      color: darkMode ? theme.textSecondary : '#92400e',
      marginTop: '16px',
      borderLeft: `4px solid ${darkMode ? theme.accent : '#f59e0b'}`,
    },
    inventorySection: {
      marginTop: '20px',
      padding: '16px',
      background: darkMode ? '#1e293b' : '#f0f9ff',
      borderRadius: '8px',
      fontSize: '13px',
    },
    inventoryTitle: {
      fontWeight: '600',
      color: theme.text,
      marginBottom: '8px',
    },
    inventoryItem: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '4px 0',
      color: theme.textSecondary,
    },
    errorBanner: {
      padding: '16px',
      background: '#fee2e2',
      borderRadius: '8px',
      color: '#991b1b',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>
          <span>🤖</span>
          AI Grant Writing Assistant
        </h1>
        <p style={styles.subtitle}>
          Generate grant application content using your ARC-ITS equipment inventory and project details.
          Powered by ChatGPT with federal transportation grant expertise.
        </p>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <div style={styles.card}>
        <form onSubmit={handleGenerate}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Grant Program</label>
            <select
              style={styles.select}
              value={formData.grantProgram}
              onChange={(e) => setFormData({ ...formData, grantProgram: e.target.value })}
            >
              <option value="SMART">SMART - Strengthening Mobility and Revolutionizing Transportation</option>
              <option value="RAISE">RAISE - Rebuilding American Infrastructure</option>
              <option value="FMCSA IT-D">FMCSA IT-D - Commercial Vehicle IT & Data</option>
              <option value="ATCMTD">ATCMTD - Advanced Transportation Technologies</option>
              <option value="PROTECT">PROTECT - Resilient Operations</option>
              <option value="INFRA">INFRA - Infrastructure for Rebuilding America</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Content Type</label>
            <select
              style={styles.select}
              value={formData.contentType}
              onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
            >
              <option value="ideas">Project Ideas - Generate 5-7 fundable project concepts</option>
              <option value="executive_summary">Executive Summary - 1-2 paragraph overview</option>
              <option value="technical_approach">Technical Approach - Detailed implementation plan</option>
              <option value="draft">Custom Assistance - Based on your description</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Project Description (Optional)</label>
            <textarea
              style={styles.textarea}
              value={formData.projectDescription}
              onChange={(e) => setFormData({ ...formData, projectDescription: e.target.value })}
              placeholder="Describe your project goals, scope, or specific needs...&#10;&#10;Example: We want to deploy connected vehicle infrastructure along I-35 corridor with RSUs at 10 key intersections to support safety applications like FCW and EEBL."
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <span>⏳</span>
                Generating Content...
              </>
            ) : (
              <>
                <span>✨</span>
                Generate Grant Content
              </>
            )}
          </button>
        </form>
      </div>

      {generatedContent && (
        <div style={styles.card}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '700',
            color: theme.text,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span>📝</span>
            Generated Content
          </h3>

          <div style={styles.resultCard}>
            <div style={styles.content}>
              {generatedContent.content}
            </div>

            {generatedContent.note && (
              <div style={styles.note}>
                💡 {generatedContent.note}
              </div>
            )}

            {generatedContent.itsInventory && (
              <div style={styles.inventorySection}>
                <div style={styles.inventoryTitle}>📊 ITS Inventory Context Used:</div>
                <div style={styles.inventoryItem}>
                  <span>Total Equipment:</span>
                  <strong>{generatedContent.itsInventory.total}</strong>
                </div>
                <div style={styles.inventoryItem}>
                  <span>ARC-IT Compliant:</span>
                  <strong>{generatedContent.itsInventory.arc_its_compliant} ({generatedContent.itsInventory.compliance_rate}%)</strong>
                </div>
                {generatedContent.itsInventory.by_type && generatedContent.itsInventory.by_type.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ ...styles.inventoryTitle, fontSize: '12px', marginBottom: '6px' }}>Equipment Breakdown:</div>
                    {generatedContent.itsInventory.by_type.map((item, idx) => (
                      <div key={idx} style={styles.inventoryItem}>
                        <span style={{ textTransform: 'capitalize' }}>{item.equipment_type}:</span>
                        <strong>{item.count}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
            <button
              style={{
                ...styles.button,
                background: theme.success,
                flex: 1,
              }}
              onClick={() => navigator.clipboard.writeText(generatedContent.content)}
            >
              📋 Copy to Clipboard
            </button>
            <button
              style={{
                ...styles.button,
                background: theme.textSecondary,
                flex: 1,
              }}
              onClick={() => setGeneratedContent(null)}
            >
              🔄 Generate New Content
            </button>
          </div>
        </div>
      )}

      <div style={{
        marginTop: '32px',
        padding: '24px',
        background: darkMode ? '#1e293b' : '#f0f9ff',
        borderRadius: '16px',
        border: `2px solid ${darkMode ? '#334155' : '#bae6fd'}`,
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '700',
          color: theme.text,
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>💡</span>
          How to Use This Tool
        </h3>
        <ul style={{ paddingLeft: '24px', margin: 0 }}>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            Select your target grant program to get tailored content
          </li>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            Choose content type based on what section you need help with
          </li>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            Provide optional project description for more customized results
          </li>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            System automatically includes your ITS equipment inventory data
          </li>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            Review, edit, and incorporate generated content into your application
          </li>
          <li style={{ fontSize: '14px', color: theme.text, marginBottom: '8px', lineHeight: '1.6' }}>
            <strong>Note:</strong> This tool works with or without OpenAI API key - structured templates provided as fallback
          </li>
        </ul>
      </div>
    </div>
  );
}
