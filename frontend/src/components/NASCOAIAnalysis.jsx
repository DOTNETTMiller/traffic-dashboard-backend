import { useState } from 'react';
import api from '../services/api';
import { theme } from '../styles/theme';

export default function NASCOAIAnalysis() {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.post('/api/nasco-corridor-ai-analysis');

      if (response.data.success) {
        setAnalysis(response.data);
        setShowAnalysis(true);
      } else {
        setError(response.data.error || 'Analysis failed');
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate AI analysis');
    } finally {
      setLoading(false);
    }
  };

  const renderMarkdown = (text) => {
    if (!text) return null;

    // Simple markdown rendering for bold, headers, and lists
    return text.split('\n').map((line, i) => {
      // Headers
      if (line.startsWith('###')) {
        return (
          <h4 key={i} style={{
            fontSize: '13px',
            fontWeight: '700',
            marginTop: '16px',
            marginBottom: '8px',
            color: theme.colors.text
          }}>
            {line.replace('###', '').trim()}
          </h4>
        );
      }
      if (line.startsWith('##')) {
        return (
          <h3 key={i} style={{
            fontSize: '14px',
            fontWeight: '700',
            marginTop: '20px',
            marginBottom: '10px',
            color: theme.colors.text,
            borderBottom: `2px solid ${theme.colors.border}`,
            paddingBottom: '4px'
          }}>
            {line.replace('##', '').trim()}
          </h3>
        );
      }
      if (line.startsWith('#')) {
        return (
          <h2 key={i} style={{
            fontSize: '16px',
            fontWeight: '700',
            marginTop: '24px',
            marginBottom: '12px',
            color: theme.colors.text
          }}>
            {line.replace('#', '').trim()}
          </h2>
        );
      }

      // Lists
      if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
        return (
          <li key={i} style={{
            fontSize: '12px',
            lineHeight: '1.6',
            marginLeft: '20px',
            marginBottom: '4px'
          }}>
            {line.replace(/^[\s-*]+/, '')}
          </li>
        );
      }

      // Numbered lists
      if (/^\d+\./.test(line.trim())) {
        return (
          <li key={i} style={{
            fontSize: '12px',
            lineHeight: '1.6',
            marginLeft: '20px',
            marginBottom: '4px',
            listStyleType: 'decimal'
          }}>
            {line.replace(/^\d+\.\s*/, '')}
          </li>
        );
      }

      // Bold text **text**
      const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Regular paragraph
      if (line.trim() !== '') {
        return (
          <p
            key={i}
            style={{
              fontSize: '12px',
              lineHeight: '1.6',
              marginBottom: '12px'
            }}
            dangerouslySetInnerHTML={{ __html: boldLine }}
          />
        );
      }

      return <div key={i} style={{ height: '8px' }} />;
    });
  };

  if (!showAnalysis) {
    return (
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000
        }}
      >
        <button
          onClick={generateAnalysis}
          disabled={loading}
          style={{
            padding: '12px 20px',
            background: loading ? theme.colors.textSecondary : theme.colors.accent,
            color: '#111827',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '13px',
            cursor: loading ? 'wait' : 'pointer',
            boxShadow: theme.shadows.lg,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: `all ${theme.transitions.fast}`
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = theme.shadows.xl;
            }
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = theme.shadows.lg;
          }}
        >
          <span style={{ fontSize: '16px' }}>🤖</span>
          {loading ? 'Analyzing Regulations...' : 'AI Harmonization Analysis'}
        </button>

        {error && (
          <div style={{
            marginTop: '8px',
            padding: '12px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#991b1b',
            maxWidth: '300px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.98)',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: theme.shadows.xl,
        maxWidth: '600px',
        maxHeight: '70vh',
        overflowY: 'auto',
        border: `1px solid ${theme.colors.border}`
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: `2px solid ${theme.colors.border}`
      }}>
        <div>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '700',
            color: theme.colors.text
          }}>
            🤖 AI Harmonization Analysis
          </h2>
          <div style={{
            fontSize: '10px',
            color: theme.colors.textSecondary,
            marginTop: '4px'
          }}>
            NASCO Corridor OS/OW Regulations • {analysis.statesAnalyzed?.length} States
          </div>
        </div>
        <button
          onClick={() => setShowAnalysis(false)}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: theme.colors.textSecondary,
            padding: '4px 8px'
          }}
        >
          ×
        </button>
      </div>

      {/* States Analyzed */}
      <div style={{
        marginBottom: '16px',
        padding: '12px',
        background: theme.colors.bgSecondary,
        borderRadius: '6px',
        border: `1px solid ${theme.colors.border}`
      }}>
        <div style={{
          fontSize: '11px',
          fontWeight: '600',
          color: theme.colors.textSecondary,
          marginBottom: '6px'
        }}>
          States Analyzed:
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px'
        }}>
          {analysis.statesAnalyzed?.map(state => (
            <span
              key={state.key}
              style={{
                padding: '4px 10px',
                background: theme.colors.accent,
                color: '#111827',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: '600'
              }}
            >
              {state.key.toUpperCase()} - {state.name}
            </span>
          ))}
        </div>
      </div>

      {/* Analysis Content */}
      <div style={{
        fontSize: '12px',
        lineHeight: '1.7',
        color: theme.colors.text
      }}>
        {renderMarkdown(analysis.analysis)}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '20px',
        paddingTop: '12px',
        borderTop: `1px solid ${theme.colors.border}`,
        fontSize: '10px',
        color: theme.colors.textSecondary,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          Generated: {new Date(analysis.timestamp).toLocaleString()}
        </div>
        <div>
          Model: {analysis.model}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        gap: '8px'
      }}>
        <button
          onClick={() => {
            const blob = new Blob([analysis.analysis], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nasco-corridor-analysis-${new Date().toISOString().split('T')[0]}.md`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          style={{
            flex: 1,
            padding: '10px',
            background: theme.colors.accentBlue,
            color: '#111827',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          📥 Download as Markdown
        </button>
        <button
          onClick={generateAnalysis}
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px',
            background: loading ? theme.colors.textSecondary : theme.colors.accentGreen,
            color: '#111827',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            fontSize: '12px',
            cursor: loading ? 'wait' : 'pointer'
          }}
        >
          {loading ? 'Regenerating...' : '🔄 Regenerate Analysis'}
        </button>
      </div>
    </div>
  );
}
