import { useState } from 'react';
import api from '../services/api';

export default function GrantProposalAnalyzer({ user, darkMode = false, applicationId = null }) {
  const [mode, setMode] = useState('analyze'); // 'analyze' or 'score'
  const [proposalText, setProposalText] = useState('');
  const [grantProgram, setGrantProgram] = useState('SMART');
  const [projectTitle, setProjectTitle] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [scoring, setScoring] = useState(null);
  const [loading, setLoading] = useState(false);

  const grantPrograms = [
    { value: 'SMART', label: 'SMART Grant - Connected Vehicles & ITS' },
    { value: 'ATCMTD', label: 'ATCMTD - Traffic Management Tech' },
    { value: 'RAISE', label: 'RAISE - Infrastructure & Sustainability' },
    { value: 'INFRA', label: 'INFRA - Major Infrastructure Projects' },
    { value: 'PROTECT', label: 'PROTECT - Resilience & Emergency' },
    { value: 'FMCSA_ITD', label: 'FMCSA IT-D - Commercial Vehicle Data' },
    { value: 'HSIP', label: 'HSIP - Highway Safety Improvement' },
    { value: 'CMAQ', label: 'CMAQ - Congestion & Air Quality' },
  ];

  const theme = {
    bg: darkMode ? '#0f172a' : '#ffffff',
    bgSecondary: darkMode ? '#1e293b' : '#f8fafc',
    bgTertiary: darkMode ? '#334155' : '#f1f5f9',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    textMuted: darkMode ? '#64748b' : '#94a3b8',
    border: darkMode ? '#334155' : '#e2e8f0',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    primaryLight: darkMode ? '#1e3a8a' : '#dbeafe',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    shadow: darkMode ? '0 4px 6px -1px rgba(0, 0, 0, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  const analyzeProposal = async () => {
    setLoading(true);
    setAnalysis(null);

    try {
      const response = await api.post('/api/grants/analyze-proposal', {
        proposalText,
        grantProgram,
        projectTitle,
        requestedAmount: parseFloat(requestedAmount) || null,
        stateKey: user?.stateKey
      });

      if (response.data.success) {
        setAnalysis(response.data.analysis);
      }
    } catch (error) {
      console.error('Error analyzing proposal:', error);
      alert('Failed to analyze proposal. Please check your OpenAI API key configuration.');
    } finally {
      setLoading(false);
    }
  };

  const scoreApplication = async () => {
    setLoading(true);
    setScoring(null);

    try {
      const response = await api.post('/api/grants/score-application', {
        grantProgram,
        applicationData: {
          title: projectTitle,
          description: proposalText,
          requestedAmount: parseFloat(requestedAmount) || null,
          geographicScope: 'multi-state' // Could be from form
        },
        stateKey: user?.stateKey
      });

      if (response.data.success) {
        setScoring(response.data.scoring);
      }
    } catch (error) {
      console.error('Error scoring application:', error);
      alert('Failed to score application. Please check your OpenAI API key configuration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: theme.bg, minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            margin: 0,
            fontSize: '32px',
            fontWeight: '800',
            background: `linear-gradient(135deg, ${theme.primary} 0%, #8b5cf6 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '12px',
          }}>
            📊 Grant Proposal Analyzer & Scorer
          </h1>
          <p style={{
            margin: 0,
            color: theme.textSecondary,
            fontSize: '15px',
            lineHeight: '1.6',
          }}>
            Get AI-powered analysis and scoring of your grant proposals. Receive actionable
            suggestions to improve your application's competitiveness.
          </p>
        </div>

        {/* Mode Selector */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          borderBottom: `2px solid ${theme.border}`,
        }}>
          <button
            onClick={() => setMode('analyze')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: mode === 'analyze' ? theme.primary : 'transparent',
              color: mode === 'analyze' ? '#ffffff' : theme.text,
              borderBottom: mode === 'analyze' ? `3px solid ${theme.primary}` : 'none',
              fontWeight: mode === 'analyze' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            📝 Analyze Proposal
          </button>
          <button
            onClick={() => setMode('score')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: mode === 'score' ? theme.primary : 'transparent',
              color: mode === 'score' ? '#ffffff' : theme.text,
              borderBottom: mode === 'score' ? `3px solid ${theme.primary}` : 'none',
              fontWeight: mode === 'score' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '15px',
            }}
          >
            🎯 Score Application
          </button>
        </div>

        {/* Input Form */}
        <div style={{
          background: theme.bgSecondary,
          borderRadius: '16px',
          padding: '24px',
          boxShadow: theme.shadow,
          marginBottom: '24px',
        }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '20px', fontWeight: '700', color: theme.text }}>
            {mode === 'analyze' ? 'Proposal Details' : 'Application Details'}
          </h2>

          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                fontSize: '13px',
                color: theme.textSecondary,
                textTransform: 'uppercase',
              }}>
                Grant Program *
              </label>
              <select
                value={grantProgram}
                onChange={(e) => setGrantProgram(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: theme.bgTertiary,
                  border: `2px solid ${theme.border}`,
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: theme.text,
                }}
              >
                {grantPrograms.map(prog => (
                  <option key={prog.value} value={prog.value}>{prog.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                }}>
                  Project Title
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="V2X Deployment on I-80 Corridor"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: theme.bgTertiary,
                    border: `2px solid ${theme.border}`,
                    borderRadius: '10px',
                    fontSize: '14px',
                    color: theme.text,
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                }}>
                  Requested Amount ($)
                </label>
                <input
                  type="number"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  placeholder="8500000"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: theme.bgTertiary,
                    border: `2px solid ${theme.border}`,
                    borderRadius: '10px',
                    fontSize: '14px',
                    color: theme.text,
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                fontSize: '13px',
                color: theme.textSecondary,
                textTransform: 'uppercase',
              }}>
                {mode === 'analyze' ? 'Proposal Text *' : 'Project Description *'}
              </label>
              <textarea
                value={proposalText}
                onChange={(e) => setProposalText(e.target.value)}
                rows={12}
                placeholder={mode === 'analyze'
                  ? 'Paste your grant proposal text here for analysis...'
                  : 'Enter your project description and technical approach...'
                }
                style={{
                  width: '100%',
                  padding: '16px',
                  background: theme.bgTertiary,
                  border: `2px solid ${theme.border}`,
                  borderRadius: '10px',
                  fontSize: '14px',
                  color: theme.text,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <div style={{ fontSize: '12px', color: theme.textMuted, marginTop: '8px' }}>
                {proposalText.split(/\s+/).filter(w => w).length} words
              </div>
            </div>

            <button
              onClick={mode === 'analyze' ? analyzeProposal : scoreApplication}
              disabled={loading || !proposalText || !grantProgram}
              style={{
                padding: '14px 28px',
                background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryHover} 100%)`,
                color: '#111827',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading || !proposalText ? 'not-allowed' : 'pointer',
                opacity: loading || !proposalText ? 0.6 : 1,
                boxShadow: theme.shadow,
              }}
            >
              {loading
                ? (mode === 'analyze' ? '🔄 Analyzing...' : '🔄 Scoring...')
                : (mode === 'analyze' ? '📊 Analyze Proposal' : '🎯 Score Application')
              }
            </button>
          </div>
        </div>

        {/* Analysis Results */}
        {mode === 'analyze' && analysis && (
          <AnalysisResults analysis={analysis} theme={theme} />
        )}

        {/* Scoring Results */}
        {mode === 'score' && scoring && (
          <ScoringResults scoring={scoring} theme={theme} />
        )}
      </div>
    </div>
  );
}

// Analysis Results Component
function AnalysisResults({ analysis, theme }) {
  const getScoreColor = (score) => {
    if (score >= 80) return theme.success;
    if (score >= 60) return theme.warning;
    return theme.error;
  };

  const getRatingColor = (rating) => {
    if (rating === 'Strong') return theme.success;
    if (rating === 'Moderate') return theme.warning;
    return theme.error;
  };

  return (
    <div>
      {/* Overall Score Card */}
      <div style={{
        background: theme.bgSecondary,
        borderRadius: '16px',
        padding: '32px',
        boxShadow: theme.shadow,
        marginBottom: '24px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '72px',
          fontWeight: '800',
          color: getScoreColor(analysis.overallScore),
          marginBottom: '8px',
        }}>
          {analysis.overallScore}
        </div>
        <div style={{ fontSize: '16px', fontWeight: '600', color: theme.textSecondary, marginBottom: '16px' }}>
          Overall Competitiveness Score
        </div>
        <div style={{
          display: 'inline-block',
          padding: '8px 20px',
          background: getRatingColor(analysis.competitivenessRating),
          color: '#111827',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '700',
        }}>
          {analysis.competitivenessRating} Proposal
        </div>

        {/* Metrics Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: `2px solid ${theme.border}`,
        }}>
          <MetricCard
            label="Keyword Coverage"
            value={`${analysis.metrics.keywordCoverage}%`}
            subtitle={`${analysis.metrics.keywordsMatched}/${analysis.metrics.totalKeywords} matched`}
            theme={theme}
          />
          <MetricCard
            label="Word Count"
            value={analysis.metrics.wordCount.toLocaleString()}
            subtitle="words"
            theme={theme}
          />
          <MetricCard
            label="Funding Alignment"
            value={analysis.metrics.fundingAlignment === true ? '✓' : analysis.metrics.fundingAlignment === false ? '✗' : '?'}
            subtitle={analysis.metrics.fundingAlignment === true ? 'Within range' : analysis.metrics.fundingAlignment === false ? 'Out of range' : 'Unknown'}
            theme={theme}
          />
        </div>
      </div>

      {/* Strengths */}
      <div style={{
        background: theme.bgSecondary,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: theme.shadow,
        marginBottom: '24px',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.success }}>
          ✅ Strengths
        </h3>
        <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '14px', lineHeight: '1.8', color: theme.text }}>
          {analysis.strengths.map((strength, idx) => (
            <li key={idx} style={{ marginBottom: '8px' }}>{strength}</li>
          ))}
        </ul>
      </div>

      {/* Weaknesses */}
      <div style={{
        background: theme.bgSecondary,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: theme.shadow,
        marginBottom: '24px',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.error }}>
          ⚠️ Weaknesses
        </h3>
        <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '14px', lineHeight: '1.8', color: theme.text }}>
          {analysis.weaknesses.map((weakness, idx) => (
            <li key={idx} style={{ marginBottom: '8px' }}>{weakness}</li>
          ))}
        </ul>
      </div>

      {/* Improvement Suggestions */}
      <div style={{
        background: theme.bgSecondary,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: theme.shadow,
        marginBottom: '24px',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.primary }}>
          💡 Improvement Suggestions
        </h3>
        <div style={{ display: 'grid', gap: '12px' }}>
          {analysis.improvementSuggestions.map((suggestion, idx) => (
            <div key={idx} style={{
              padding: '16px',
              background: theme.bgTertiary,
              borderRadius: '10px',
              borderLeft: `4px solid ${theme.primary}`,
              fontSize: '14px',
              lineHeight: '1.6',
              color: theme.text,
            }}>
              <strong>{idx + 1}.</strong> {suggestion}
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Actions */}
      {analysis.recommendedActions && (
        <div style={{
          background: theme.bgSecondary,
          borderRadius: '16px',
          padding: '24px',
          boxShadow: theme.shadow,
          marginBottom: '24px',
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
            📋 Recommended Actions
          </h3>

          {analysis.recommendedActions.immediate && analysis.recommendedActions.immediate.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: theme.error }}>
                🔴 IMMEDIATE (Do Before Continuing)
              </h4>
              <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '13px', lineHeight: '1.6' }}>
                {analysis.recommendedActions.immediate.map((action, idx) => (
                  <li key={idx} style={{ marginBottom: '6px' }}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.recommendedActions.beforeSubmission && analysis.recommendedActions.beforeSubmission.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: theme.warning }}>
                ⚠️ BEFORE SUBMISSION (Required)
              </h4>
              <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '13px', lineHeight: '1.6' }}>
                {analysis.recommendedActions.beforeSubmission.map((action, idx) => (
                  <li key={idx} style={{ marginBottom: '6px' }}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.recommendedActions.optional && analysis.recommendedActions.optional.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '700', color: theme.textSecondary }}>
                💚 OPTIONAL (Would Strengthen Application)
              </h4>
              <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '13px', lineHeight: '1.6' }}>
                {analysis.recommendedActions.optional.map((action, idx) => (
                  <li key={idx} style={{ marginBottom: '6px' }}>{action}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Alignment Analysis & Risk Assessment */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{
          background: theme.bgSecondary,
          borderRadius: '16px',
          padding: '24px',
          boxShadow: theme.shadow,
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: theme.text }}>
            🎯 Alignment Analysis
          </h3>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: theme.textSecondary }}>
            {analysis.alignmentAnalysis}
          </p>
        </div>

        <div style={{
          background: theme.bgSecondary,
          borderRadius: '16px',
          padding: '24px',
          boxShadow: theme.shadow,
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: theme.text }}>
            ⚠️ Risk Assessment
          </h3>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: theme.textSecondary }}>
            {analysis.riskAssessment}
          </p>
        </div>
      </div>
    </div>
  );
}

// Scoring Results Component
function ScoringResults({ scoring, theme }) {
  const categories = Object.entries(scoring.scores || {});

  return (
    <div>
      {/* Overall Score Summary */}
      <div style={{
        background: theme.bgSecondary,
        borderRadius: '16px',
        padding: '32px',
        boxShadow: theme.shadow,
        marginBottom: '24px',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '72px',
          fontWeight: '800',
          color: scoring.weightedTotal >= 80 ? theme.success : scoring.weightedTotal >= 60 ? theme.warning : theme.error,
          marginBottom: '8px',
        }}>
          {scoring.weightedTotal}
        </div>
        <div style={{ fontSize: '16px', fontWeight: '600', color: theme.textSecondary, marginBottom: '16px' }}>
          Weighted Total Score (out of 100)
        </div>
        <div style={{
          display: 'inline-block',
          padding: '8px 20px',
          background: scoring.likelihood === 'High' ? theme.success : scoring.likelihood === 'Medium' ? theme.warning : theme.error,
          color: '#111827',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '700',
          marginBottom: '12px',
        }}>
          {scoring.ranking}
        </div>
        <div style={{ fontSize: '14px', color: theme.textMuted }}>
          Award Likelihood: {scoring.likelihood}
        </div>
      </div>

      {/* Scoring Breakdown */}
      <div style={{
        background: theme.bgSecondary,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: theme.shadow,
        marginBottom: '24px',
      }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: theme.text }}>
          📊 Detailed Scoring Breakdown
        </h3>

        <div style={{ display: 'grid', gap: '16px' }}>
          {categories.map(([key, category]) => (
            <ScoringCategory key={key} name={key} category={category} theme={theme} />
          ))}
        </div>
      </div>

      {/* Top Improvements */}
      <div style={{
        background: theme.bgSecondary,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: theme.shadow,
        marginBottom: '24px',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: theme.primary }}>
          🎯 Top 3 Improvements Needed
        </h3>
        <div style={{ display: 'grid', gap: '12px' }}>
          {scoring.topImprovements.map((improvement, idx) => (
            <div key={idx} style={{
              padding: '16px',
              background: theme.bgTertiary,
              borderRadius: '10px',
              borderLeft: `4px solid ${theme.primary}`,
              fontSize: '14px',
              lineHeight: '1.6',
              color: theme.text,
            }}>
              <strong>#{idx + 1}:</strong> {improvement}
            </div>
          ))}
        </div>
      </div>

      {/* Competitive Position */}
      {scoring.competitivePosition && (
        <div style={{
          background: theme.bgSecondary,
          borderRadius: '16px',
          padding: '24px',
          boxShadow: theme.shadow,
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', color: theme.text }}>
            📈 Competitive Position
          </h3>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: theme.textSecondary }}>
            {scoring.competitivePosition}
          </p>
        </div>
      )}
    </div>
  );
}

// Scoring Category Component
function ScoringCategory({ name, category, theme }) {
  const formatName = (str) => {
    return str.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
  };

  const getScoreColor = (score) => {
    if (score >= 80) return theme.success;
    if (score >= 60) return theme.warning;
    return theme.error;
  };

  const percentage = (category.score / 100) * category.weight;

  return (
    <div style={{
      padding: '20px',
      background: theme.bgTertiary,
      borderRadius: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: theme.text }}>
            {formatName(name)}
          </div>
          <div style={{ fontSize: '12px', color: theme.textMuted }}>
            Weight: {category.weight} points
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: getScoreColor(category.score) }}>
            {category.score}
          </div>
          <div style={{ fontSize: '11px', color: theme.textMuted }}>
            {percentage.toFixed(1)} pts
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: '8px',
        background: theme.border,
        borderRadius: '4px',
        overflow: 'hidden',
        marginBottom: '12px',
      }}>
        <div style={{
          width: `${category.score}%`,
          height: '100%',
          background: getScoreColor(category.score),
          borderRadius: '4px',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Justification */}
      <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: theme.textSecondary }}>
        {category.justification}
      </p>
    </div>
  );
}

// Metric Card Component
function MetricCard({ label, value, subtitle, theme }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '28px', fontWeight: '800', color: theme.primary, marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '13px', fontWeight: '600', color: theme.text, marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '11px', color: theme.textMuted }}>
        {subtitle}
      </div>
    </div>
  );
}
